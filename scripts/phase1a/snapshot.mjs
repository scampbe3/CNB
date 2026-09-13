import fs from 'node:fs/promises';
import path from 'node:path';
import { root, out, workbook, tabs, parseCsv, writeJson } from './lib.mjs';

const snapshotPath = path.join(out, 'baseline.json');
try { await fs.access(snapshotPath); throw new Error('Snapshot already exists; never overwrite the release baseline.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const snapshot = { capturedAt: new Date().toISOString(), workbook, tabs: [] };
for (const tab of tabs) {
  const response = await fetch(`https://docs.google.com/spreadsheets/d/${workbook}/gviz/tq?tqx=out:csv&gid=${tab.gid}&t=${Date.now()}`);
  if (!response.ok) throw new Error(`${tab.tab}: HTTP ${response.status}`);
  const rows = parseCsv(await response.text());
  const base = JSON.parse(await fs.readFile(path.join(root, `data/cnb-${tab.key}.json`), 'utf8'));
  snapshot.tabs.push({ ...tab, rows, base });
  console.log(`${tab.tab}: ${rows.length} rows`);
}
await writeJson(snapshotPath, snapshot);
console.log('Read-only baseline captured. No Sheet edits.');
