import assert from 'node:assert/strict';
import path from 'node:path';
import { out, readJson, writeJson, workbook, parseCsv } from './lib.mjs';
const baseline = await readJson(path.join(out, 'baseline.json'));
const report = [];
for (const tab of baseline.tabs) {
  const response = await fetch(`https://www.cupcakesandbroccoli.com/${tab.slug}`, { signal: AbortSignal.timeout(30000) });
  assert.equal(response.ok, true, tab.slug);
  const html = await response.text();
  const mount = html.match(/<div[^>]*data-cnb-home-root[^>]*>/g)?.[0];
  assert.ok(mount, `Missing live mount: ${tab.slug}`);
  const globalSource = html.match(/window\.CNB_CONTENT_URL\s*=\s*["']([^"']+)["']/)?.[1];
  const mountSource = mount.match(/data-cnb-src=["']([^"']+)["']/)?.[1];
  const connection = (mountSource || (tab.key === 'homepage' && globalSource) || '').replaceAll('&amp;', '&');
  assert.equal(new URL(connection).searchParams.get('gid'), String(tab.gid), `Wrong live tab connection: ${tab.slug}`);
  const source = await fetch(`https://docs.google.com/spreadsheets/d/${workbook}/gviz/tq?tqx=out:csv&gid=${tab.gid}&t=${Date.now()}`);
  assert.equal(source.ok, true);
  const rows = parseCsv(await source.text());
  const changed = JSON.stringify(rows) !== JSON.stringify(tab.rows);
  report.push({ slug: tab.slug, gid: tab.gid, mount, connection, changedSinceBaseline: changed });
  console.log(`${tab.slug}: mount/GID verified; Sheet ${changed ? 'changed since baseline - refresh patch before deployment' : 'unchanged'}`);
}
await writeJson(path.join(out, 'live-contract-report.json'), report);
