#!/usr/bin/env perl
use strict;
use warnings;
use JSON::PP;

sub usage {
  print <<'USAGE';
Usage:
  perl scripts/lillier-content-pipeline.pl export-csv [--in data/lillier-homepage-content-table.json] [--out data/lillier-homepage-content-table.csv]
  perl scripts/lillier-content-pipeline.pl import-csv [--in data/lillier-homepage-content-table.csv] [--out data/lillier-homepage-content-table.json]
  perl scripts/lillier-content-pipeline.pl sync [--table data/lillier-homepage-content-table.json] [--template lillier-splash/shopify-theme/templates/index.json] [--settings lillier-splash/shopify-theme/config/settings_data.json]
USAGE
  exit 1;
}

sub read_file {
  my ($path) = @_;
  open my $fh, '<', $path or die "Failed to read $path: $!\n";
  local $/;
  my $content = <$fh>;
  close $fh;
  return $content;
}

sub write_file {
  my ($path, $content) = @_;
  open my $fh, '>', $path or die "Failed to write $path: $!\n";
  print {$fh} $content;
  close $fh;
}

sub csv_escape {
  my ($value) = @_;
  $value = "" unless defined $value;
  $value =~ s/\r\n/\n/g;
  if ($value =~ /[",\n]/) {
    $value =~ s/"/""/g;
    return "\"$value\"";
  }
  return $value;
}

sub parse_csv {
  my ($text) = @_;
  $text =~ s/^\x{FEFF}//; # strip BOM
  my @rows;
  my @row;
  my $field = "";
  my $in_quotes = 0;
  my $len = length($text);
  for (my $i = 0; $i < $len; $i++) {
    my $char = substr($text, $i, 1);
    if ($in_quotes) {
      if ($char eq '"') {
        my $next = ($i + 1 < $len) ? substr($text, $i + 1, 1) : "";
        if ($next eq '"') {
          $field .= '"';
          $i++;
        } else {
          $in_quotes = 0;
        }
      } else {
        $field .= $char;
      }
    } else {
      if ($char eq '"') {
        $in_quotes = 1;
      } elsif ($char eq ',') {
        push @row, $field;
        $field = "";
      } elsif ($char eq "\n") {
        push @row, $field;
        push @rows, [@row];
        @row = ();
        $field = "";
      } elsif ($char eq "\r") {
        next;
      } else {
        $field .= $char;
      }
    }
  }
  if (length($field) || @row) {
    push @row, $field;
    push @rows, [@row];
  }
  return \@rows;
}

sub trim {
  my ($value) = @_;
  return "" unless defined $value;
  $value =~ s/^\s+//;
  $value =~ s/\s+$//;
  return $value;
}

sub parse_bool {
  my ($value) = @_;
  my $v = lc trim($value);
  return 1 if $v =~ /^(1|true|yes|y|on)$/;
  return 0 if $v =~ /^(0|false|no|n|off)$/;
  return undef;
}

sub html_escape {
  my ($value) = @_;
  $value = "" unless defined $value;
  $value =~ s/&/&amp;/g;
  $value =~ s/</&lt;/g;
  $value =~ s/>/&gt;/g;
  return $value;
}

sub normalize_richtext {
  my ($value) = @_;
  $value = "" unless defined $value;
  $value =~ s/\r\n/\n/g;
  return "" unless length trim($value);
  return $value if $value =~ /<[^>]+>/;
  return "<p>" . html_escape($value) . "</p>";
}

sub assign_or_delete {
  my ($hash, $key, $value) = @_;
  if (defined $value && length trim($value)) {
    $hash->{$key} = $value;
  } else {
    delete $hash->{$key};
  }
}

sub looks_like_url {
  my ($value) = @_;
  $value = "" unless defined $value;
  return $value =~ /^(?:https?:\/\/|\/|#|mailto:|tel:|www\.)/i ? 1 : 0;
}

sub normalize_content_row {
  my ($row, $column_count) = @_;
  my @cells = map { defined($_) ? "$_" : "" } @{ $row || [] };

  if (@cells < $column_count) {
    push @cells, ("") x ($column_count - @cells);
  }

  return \@cells unless $column_count == 5;

  my ($section, $field, $value, $link, $notes) = @cells[0..4];

  if (@cells == 5) {
    if (length trim($link) && !looks_like_url($link)) {
      my $merged = join(", ", grep { length trim($_) } ($value, $link, $notes));
      return [$section, $field, $merged, "", ""];
    }
    return [$section, $field, $value, $link, $notes];
  }

  if (@cells > 5) {
    my @rest = @cells[2 .. $#cells];
    my $link_idx = -1;
    for my $i (0 .. $#rest) {
      if (looks_like_url($rest[$i])) {
        $link_idx = $i;
        last;
      }
    }

    if ($link_idx == -1) {
      my $merged = join(", ", grep { length trim($_) } map { trim($_) } @rest);
      return [$section, $field, $merged, "", ""];
    }

    my $merged_value = join(", ", grep { length trim($_) } map { trim($_) } @rest[0 .. $link_idx - 1]);
    my $real_link = $rest[$link_idx] // "";
    my $merged_notes = join(", ", grep { length trim($_) } map { trim($_) } @rest[$link_idx + 1 .. $#rest]);
    return [$section, $field, $merged_value, $real_link, $merged_notes];
  }

  return [$section, $field, $value, $link, $notes];
}

sub export_csv {
  my ($in_path, $out_path) = @_;
  my $data = decode_json(read_file($in_path));
  my $columns = $data->{columns} || [];
  my $rows = $data->{rows} || [];
  if (!@$columns && @$rows) {
    $columns = [sort keys %{ $rows->[0] || {} }];
  }

  my @lines;
  push @lines, join(",", map { csv_escape($_) } @$columns);
  for my $row (@$rows) {
    push @lines, join(",", map { csv_escape($row->{$_}) } @$columns);
  }
  write_file($out_path, join("\n", @lines) . "\n");
}

sub import_csv {
  my ($in_path, $out_path) = @_;
  my $rows = parse_csv(read_file($in_path));
  die "CSV appears empty\n" unless @$rows;

  my @columns = map { trim($_) } @{ $rows->[0] };
  my $column_count = scalar @columns;
  my @data_rows;
  for my $i (1 .. $#$rows) {
    my $csv_row = $rows->[$i];
    next unless @$csv_row;
    my $normalized = normalize_content_row($csv_row, $column_count);
    next unless grep { length trim($_) } @$normalized;
    my %row;
    for my $c (0 .. $#columns) {
      my $key = $columns[$c] // "";
      next unless length $key;
      $row{$key} = defined $normalized->[$c] ? $normalized->[$c] : "";
    }
    push @data_rows, \%row;
  }

  my $payload = {
    columns => \@columns,
    rows    => \@data_rows,
  };
  my $json = JSON::PP->new->utf8->pretty->canonical->encode($payload);
  write_file($out_path, $json);
}

sub resolve_block_id {
  my ($section, $prefix, $index, $type) = @_;
  my $named = "${prefix}_${index}";

  if (exists $section->{blocks}->{$named}) {
    return $named;
  }

  my $order = $section->{block_order} || [];
  if ($index - 1 <= $#$order) {
    my $existing = $order->[$index - 1];
    return $existing if defined $existing && exists $section->{blocks}->{$existing};
  }

  $section->{blocks} ||= {};
  $section->{blocks}->{$named} ||= {
    type     => $type,
    settings => {},
  };
  $section->{block_order} ||= [];
  push @{ $section->{block_order} }, $named unless grep { $_ eq $named } @{ $section->{block_order} };
  return $named;
}

sub sync_table_to_theme {
  my ($table_path, $template_path, $settings_path) = @_;
  my $table = decode_json(read_file($table_path));
  my $template = decode_json(read_file($template_path));
  my $settings_data = decode_json(read_file($settings_path));
  $settings_data->{current} ||= {};

  my %section_map = (
    announcement => "announcement",
    hero         => "hero",
    categories   => "categories",
    spotlight    => "spotlight",
    difference   => "difference",
    closing      => "closing",
    footer       => "footer",
  );

  for my $row (@{ $table->{rows} || [] }) {
    my $section_name = lc trim($row->{section});
    my $field = trim($row->{field});
    my $value = defined $row->{value} ? $row->{value} : "";
    my $link = defined $row->{link} ? $row->{link} : "";
    next unless length $section_name && length $field;

    if ($section_name eq "global") {
      if ($field =~ /^banner\s*text/i) {
        assign_or_delete($settings_data->{current}, "global_banner_text", $value);
      } elsif ($field =~ /^cart\s*helper\s*text/i) {
        assign_or_delete($settings_data->{current}, "cart_helper_text", $value);
      } elsif ($field =~ /^shipping\s*note\s*text/i) {
        assign_or_delete($settings_data->{current}, "shipping_note_text", $value);
      } elsif ($field =~ /^trust\s*line\s*default/i) {
        assign_or_delete($settings_data->{current}, "trust_line_default", $value);
      } elsif ($field =~ /^footer\s*support\s*line/i) {
        assign_or_delete($settings_data->{current}, "footer_support_line", $value);
      } elsif ($field =~ /^sister\s*site\s*link\s*label/i) {
        assign_or_delete($settings_data->{current}, "sister_site_link_label", $value);
      } elsif ($field =~ /^sister\s*site\s*link\s*url/i) {
        assign_or_delete($settings_data->{current}, "sister_site_link_url", (length trim($link) ? $link : $value));
      }
      next;
    }

    my $section_id = $section_map{$section_name};
    next unless $section_id;

    my $section = $template->{sections}->{$section_id} ||= {};
    $section->{settings} ||= {};
    my $section_settings = $section->{settings};

    if ($section_id eq "announcement") {
      if ($field =~ /^text/i) {
        assign_or_delete($section_settings, "text", $value);
      } elsif ($field =~ /^show\s*bar/i) {
        my $bool = parse_bool($value);
        $section_settings->{show_bar} = $bool if defined $bool;
      }
      next;
    }

    if ($section_id eq "hero") {
      if ($field =~ /^eyebrow/i) {
        assign_or_delete($section_settings, "eyebrow", $value);
      } elsif ($field =~ /^(title|heading)/i) {
        assign_or_delete($section_settings, "heading", $value);
      } elsif ($field =~ /^subhead/i) {
        assign_or_delete($section_settings, "subhead", $value);
      } elsif ($field =~ /^body/i) {
        assign_or_delete($section_settings, "body", normalize_richtext($value));
      } elsif ($field =~ /^(cta\s*1|primary\s*cta)/i) {
        assign_or_delete($section_settings, "primary_cta_label", $value);
        assign_or_delete($section_settings, "primary_cta_url", $link);
      } elsif ($field =~ /^(cta\s*2|secondary\s*cta)/i) {
        assign_or_delete($section_settings, "secondary_cta_label", $value);
        assign_or_delete($section_settings, "secondary_cta_url", $link);
      } elsif ($field =~ /^theme\s*variant/i) {
        assign_or_delete($section_settings, "theme_variant", lc trim($value));
      }
      next;
    }

    if ($section_id eq "categories") {
      if ($field =~ /^eyebrow/i) {
        assign_or_delete($section_settings, "eyebrow", $value);
      } elsif ($field =~ /^(title|heading)/i) {
        assign_or_delete($section_settings, "heading", $value);
      } elsif ($field =~ /^intro/i) {
        assign_or_delete($section_settings, "intro", $value);
      } elsif ($field =~ /^cta/i) {
        assign_or_delete($section_settings, "cta_label", $value);
        assign_or_delete($section_settings, "cta_url", $link);
      } elsif ($field =~ /^category\s*(\d+)\s*support/i) {
        my $idx = $1;
        my $block_id = resolve_block_id($section, "category", $idx, "category_card");
        $section->{blocks}->{$block_id}->{settings} ||= {};
        assign_or_delete($section->{blocks}->{$block_id}->{settings}, "support_text", $value);
      } elsif ($field =~ /^category\s*(\d+)/i) {
        my $idx = $1;
        my $block_id = resolve_block_id($section, "category", $idx, "category_card");
        $section->{blocks}->{$block_id}->{settings} ||= {};
        assign_or_delete($section->{blocks}->{$block_id}->{settings}, "label_override", $value);
      }
      next;
    }

    if ($section_id eq "spotlight") {
      if ($field =~ /^eyebrow/i) {
        assign_or_delete($section_settings, "eyebrow", $value);
      } elsif ($field =~ /^(title|heading)/i) {
        assign_or_delete($section_settings, "heading", $value);
      } elsif ($field =~ /^body/i) {
        assign_or_delete($section_settings, "body", $value);
      } elsif ($field =~ /^story\s*title/i) {
        assign_or_delete($section_settings, "manual_title", $value);
      } elsif ($field =~ /^story\s*excerpt/i) {
        assign_or_delete($section_settings, "manual_excerpt", $value);
      } elsif ($field =~ /^cta/i) {
        assign_or_delete($section_settings, "manual_cta_label", $value);
        assign_or_delete($section_settings, "manual_cta_url", $link);
      }
      next;
    }

    if ($section_id eq "difference") {
      if ($field =~ /^eyebrow/i) {
        assign_or_delete($section_settings, "eyebrow", $value);
      } elsif ($field =~ /^(title|heading)/i) {
        assign_or_delete($section_settings, "heading", $value);
      } elsif ($field =~ /^body/i) {
        assign_or_delete($section_settings, "body", $value);
      } elsif ($field =~ /^point\s*(\d+)/i) {
        my $idx = $1;
        my $block_id = resolve_block_id($section, "point", $idx, "difference_point");
        $section->{blocks}->{$block_id}->{settings} ||= {};
        assign_or_delete($section->{blocks}->{$block_id}->{settings}, "point_text", $value);
      } elsif ($field =~ /^cta/i) {
        assign_or_delete($section_settings, "primary_cta_label", $value);
        assign_or_delete($section_settings, "primary_cta_url", $link);
      }
      next;
    }

    if ($section_id eq "closing") {
      if ($field =~ /^eyebrow/i) {
        assign_or_delete($section_settings, "eyebrow", $value);
      } elsif ($field =~ /^(title|heading)/i) {
        assign_or_delete($section_settings, "heading", $value);
      } elsif ($field =~ /^body/i) {
        assign_or_delete($section_settings, "body", $value);
      } elsif ($field =~ /^cta/i) {
        assign_or_delete($section_settings, "cta_label", $value);
        assign_or_delete($section_settings, "cta_url", $link);
      }
      next;
    }

    if ($section_id eq "footer") {
      if ($field =~ /^footer\s*line\s*override/i) {
        assign_or_delete($section_settings, "footer_line_override", $value);
      } elsif ($field =~ /^show\s*sister\s*link/i) {
        my $bool = parse_bool($value);
        $section_settings->{show_sister_link} = $bool if defined $bool;
      }
      next;
    }
  }

  my $template_json = JSON::PP->new->utf8->pretty->canonical->encode($template);
  write_file($template_path, $template_json);

  my $settings_json = JSON::PP->new->utf8->pretty->canonical->encode($settings_data);
  write_file($settings_path, $settings_json);
}

my $cmd = shift @ARGV || usage();
my %opts;
while (@ARGV) {
  my $arg = shift @ARGV;
  if ($arg eq '--in') {
    $opts{in} = shift @ARGV;
  } elsif ($arg eq '--out') {
    $opts{out} = shift @ARGV;
  } elsif ($arg eq '--table') {
    $opts{table} = shift @ARGV;
  } elsif ($arg eq '--template') {
    $opts{template} = shift @ARGV;
  } elsif ($arg eq '--settings') {
    $opts{settings} = shift @ARGV;
  } else {
    usage();
  }
}

if ($cmd eq 'export-csv') {
  export_csv(
    $opts{in}  || 'data/lillier-homepage-content-table.json',
    $opts{out} || 'data/lillier-homepage-content-table.csv'
  );
} elsif ($cmd eq 'import-csv') {
  import_csv(
    $opts{in}  || 'data/lillier-homepage-content-table.csv',
    $opts{out} || 'data/lillier-homepage-content-table.json'
  );
} elsif ($cmd eq 'sync') {
  sync_table_to_theme(
    $opts{table}    || 'data/lillier-homepage-content-table.json',
    $opts{template} || 'lillier-splash/shopify-theme/templates/index.json',
    $opts{settings} || 'lillier-splash/shopify-theme/config/settings_data.json'
  );
} else {
  usage();
}
