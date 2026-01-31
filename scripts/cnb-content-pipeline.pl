#!/usr/bin/env perl
use strict;
use warnings;
use JSON::PP;

sub usage {
  print <<'USAGE';
Usage:
  perl scripts/cnb-content-pipeline.pl export-csv [--in data/cnb-homepage-content-table.json] [--out data/cnb-homepage-content-table.csv]
  perl scripts/cnb-content-pipeline.pl import-csv [--in data/cnb-homepage-content-table.csv] [--out data/cnb-homepage-content-table.json]
  perl scripts/cnb-content-pipeline.pl sync [--table data/cnb-homepage-content-table.json] [--page data/cnb-homepage.json]
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

sub parse_notes {
  my ($notes) = @_;
  my %out;
  $notes = "" unless defined $notes;
  for my $token (split /[,;]/, $notes) {
    $token = lc trim($token);
    next unless length $token;
    if ($token =~ /^(primary|ghost|accent)$/) {
      $out{variant} = $token;
    } elsif ($token eq "modal") {
      $out{behavior} = "modal";
    }
  }
  return %out;
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
  my @data_rows;
  for my $i (1 .. $#$rows) {
    my $csv_row = $rows->[$i];
    next unless @$csv_row;
    my %row;
    for my $c (0 .. $#columns) {
      my $key = $columns[$c] // "";
      next unless length $key;
      $row{$key} = defined $csv_row->[$c] ? $csv_row->[$c] : "";
    }
    push @data_rows, \%row;
  }
  my $payload = {
    columns => \@columns,
    rows => \@data_rows,
  };
  my $json = JSON::PP->new->utf8->pretty->canonical->encode($payload);
  write_file($out_path, $json);
}

sub sync_table_to_page {
  my ($table_path, $page_path) = @_;
  my $table = decode_json(read_file($table_path));
  my $page = decode_json(read_file($page_path));

  my %section_map = (
    "Hero" => "hero",
    "What This Is" => "what",
    "AI Concierge" => "ai",
    "Learn" => "learn",
    "Work With Amanda" => "work",
    "Blind Dinners" => "dinners",
    "Membership" => "membership",
    "Closing" => "closing",
  );

  my %section_index;
  for my $section (@{ $page->{sections} || [] }) {
    $section_index{$section->{id} || ""} = $section;
  }

  my %updates;
  for my $row (@{ $table->{rows} || [] }) {
    my $section_name = $row->{section} // "";
    my $field = $row->{field} // "";
    my $value = $row->{value} // "";
    my $link = $row->{link} // "";
    my $notes = $row->{notes} // "";
    next unless length $section_name && length $field;

    my $section_id = $section_map{$section_name};
    next unless $section_id;

    my $bucket = ($updates{$section_id} ||= {});
    if ($field =~ /^Body\s*(\d+)/i) {
      $bucket->{body}->{$1} = $value;
      $bucket->{has_body} = 1;
    } elsif ($field =~ /^Prompt\s*(\d+)/i) {
      $bucket->{prompts}->{$1} = $value;
      $bucket->{has_prompts} = 1;
    } elsif ($field =~ /^CTA\s*(\d+)?/i) {
      my $idx = defined $1 ? $1 : 1;
      $bucket->{ctas}->{$idx} = {
        label => $value,
        href => $link,
        notes => $notes,
      };
      $bucket->{has_ctas} = 1;
    } elsif ($field =~ /^Inline\s*link/i) {
      $bucket->{inlineLink} = { label => $value, href => $link };
    } elsif ($field =~ /^Image/i) {
      $bucket->{image} = { src => $value, alt => $notes };
    } elsif ($field =~ /^Panel\s*label/i) {
      $bucket->{panelLabel} = $value;
    } elsif ($field =~ /^Title/i) {
      $bucket->{title} = $value;
    } elsif ($field =~ /^Subhead/i) {
      $bucket->{subhead} = $value;
    } elsif ($field =~ /^Note/i) {
      $bucket->{note} = $value;
    } elsif ($field =~ /^Eyebrow/i) {
      $bucket->{eyebrow} = $value;
    } elsif ($field =~ /^Kicker/i) {
      $bucket->{kicker} = $value;
    }
  }

  for my $section_id (keys %updates) {
    my $section = $section_index{$section_id} or next;
    my $data = $updates{$section_id};

    for my $key (qw(title subhead note eyebrow panelLabel kicker)) {
      next unless exists $data->{$key};
      if (length $data->{$key}) {
        $section->{$key} = $data->{$key};
      } else {
        delete $section->{$key};
      }
    }

    if (exists $data->{inlineLink}) {
      my $inline = $data->{inlineLink};
      if (length $inline->{label} || length $inline->{href}) {
        $section->{inlineLink} = { label => $inline->{label}, href => $inline->{href} };
      } else {
        delete $section->{inlineLink};
      }
    }

    if (exists $data->{image}) {
      my $image = $data->{image};
      if (length $image->{src}) {
        $section->{image}->{src} = $image->{src};
        if (length $image->{alt}) {
          $section->{image}->{alt} = $image->{alt};
        }
      }
    }

    if ($data->{has_body}) {
      my @body = map { $data->{body}->{$_} } sort { $a <=> $b } keys %{ $data->{body} || {} };
      @body = grep { length $_ } @body;
      if (@body) {
        $section->{body} = \@body;
      } else {
        delete $section->{body};
      }
    }

    if ($data->{has_prompts}) {
      my @prompts = map { $data->{prompts}->{$_} } sort { $a <=> $b } keys %{ $data->{prompts} || {} };
      @prompts = grep { length $_ } @prompts;
      if (@prompts) {
        $section->{prompts} = \@prompts;
      } else {
        delete $section->{prompts};
      }
    }

    if ($data->{has_ctas}) {
      my @ctas;
      for my $idx (sort { $a <=> $b } keys %{ $data->{ctas} || {} }) {
        my $cta = $data->{ctas}->{$idx};
        next unless length($cta->{label} || "");
        my %cta_out = (label => $cta->{label}, href => $cta->{href});
        my %notes = parse_notes($cta->{notes});
        $cta_out{variant} = $notes{variant} if $notes{variant};
        $cta_out{behavior} = $notes{behavior} if $notes{behavior};
        push @ctas, \%cta_out;
      }
      if (@ctas) {
        $section->{ctas} = \@ctas;
      } else {
        delete $section->{ctas};
      }
    }
  }

  my $json = JSON::PP->new->utf8->pretty->canonical->encode($page);
  write_file($page_path, $json);
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
  } elsif ($arg eq '--page') {
    $opts{page} = shift @ARGV;
  } else {
    usage();
  }
}

if ($cmd eq 'export-csv') {
  export_csv($opts{in} || 'data/cnb-homepage-content-table.json',
             $opts{out} || 'data/cnb-homepage-content-table.csv');
} elsif ($cmd eq 'import-csv') {
  import_csv($opts{in} || 'data/cnb-homepage-content-table.csv',
             $opts{out} || 'data/cnb-homepage-content-table.json');
} elsif ($cmd eq 'sync') {
  sync_table_to_page($opts{table} || 'data/cnb-homepage-content-table.json',
                     $opts{page} || 'data/cnb-homepage.json');
} else {
  usage();
}
