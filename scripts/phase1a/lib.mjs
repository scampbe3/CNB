import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const out = path.join(root, 'docs/phase1a');
export const columns = ['section', 'field', 'value', 'link', 'notes'];
export const workbook = '1HdRNoXtoiZed0tcqXC4VmIuArNeEMFUocRTheTEM0VM';
export const published = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSLEkKnYnuBnC6T_dS2MAaW5jpJVh3SRHiAo-3vpNUqq1aj5SPmbQY-lrEeEVleHyhQlsoYOE0_S0WS/pub';
export const tabs = [
  ['homepage', 'Content', 1699360495, 'new-page-test-3'],
  ['about', 'About', 679707562, 'about'],
  ['membership', 'Membership', 500345497, 'membership'],
  ['work-with-amanda', 'work-with-amanda', 1124001858, 'work-with-amanda'],
  ['learn', 'Learn', 370763382, 'learn'],
  ['blind-dinners', 'blind-dinners', 146642427, 'blind-dinners'],
  ['stories', 'Stories', 429327426, 'stories'],
  ['apply-business-counsel', 'apply-business-counsel', 35334212, 'apply-business-counsel'],
  ['apply-strategic-partnership', 'apply-strategic-partnership', 532129066, 'apply-strategic-partnership'],
  ['thank-you-business-counsel', 'thank-you-business-counsel', 739690775, 'thank-you-business-counsel'],
  ['thank-you-strategic-partnership', 'thank-you-strategic-partnership', 1359088875, 'thank-you-strategic-partnership'],
].map(([key, tab, gid, slug]) => ({key, tab, gid, slug}));

export function parseCsv(text) {
  const rows = []; let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\n')) {
      row.push(value); value = '';
      if (c === '\n') { rows.push(row); row = []; }
    } else if (c !== '\r' || quoted) value += c;
  }
  if (quoted) throw new Error('Unterminated CSV quote');
  if (value || row.length) rows.push([...row, value]);
  const header = rows.shift().map(v => v.replace(/^\uFEFF/, ''));
  if (columns.some((c, i) => header[i] !== c)) throw new Error('Unexpected Sheet schema');
  return rows.filter(r => r.some(Boolean)).map(r => Object.fromEntries(columns.map((c, i) => [c, r[i] || ''])));
}
export const csv = rows => [columns, ...rows.map(r => columns.map(c => r[c] || ''))]
  .map(row => row.map(v => /[",\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v).join(',')).join('\r\n') + '\r\n';
export const readJson = async p => JSON.parse(await fs.readFile(p, 'utf8'));
export async function writeJson(p, value) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(value, null, 2) + '\n');
}
export const rowKey = r => `${r.section}\u0000${r.field}`;

// Execute the exact production parser in a sandbox rather than reimplementing its merge rules.
export async function rendererParser() {
  const source = await fs.readFile(path.join(root, 'js/cnb-homepage.js'), 'utf8');
  const stop = '  const isCsvUrl =';
  if (!source.includes(stop)) throw new Error('Renderer changed: inspect parser adapter');
  const mount = { dataset: {}, childElementCount: 0 };
  const context = { window: {}, document: { querySelectorAll: () => [mount] }, URL };
  vm.runInNewContext(source.slice(0, source.indexOf(stop)) +
    'globalThis.convert = (page, rows, raw) => raw ? applyRowsToPage(page, rows) : applySectionControls(applyRowsToPage(page, rows));})();', context);
  return (base, rows, raw = false) => JSON.parse(JSON.stringify(context.convert(structuredClone(base), rows, raw)));
}
