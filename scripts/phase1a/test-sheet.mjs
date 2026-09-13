import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { root, out, columns, readJson } from './lib.mjs';

const baseline = await readJson(path.join(out, 'baseline.json'));
const patch = await readJson(path.join(out, 'sheet-patch.json'));
const script = await fs.readFile(path.join(root, 'scripts/phase1a/sheet-apply.gs'), 'utf8');
function fixture() {
  const writes = [], formats = [];
  class Sheet {
    constructor(name, id, rows) { this.name = name; this.id = id; this.values = structuredClone(rows); this.formulas = new Map(); }
    getSheetId() { return this.id; }
    getDataRange() {
      return {
        getValues: () => structuredClone(this.values),
        getFormulas: () => this.values.map((row, y) => row.map((value, x) => this.formulas.get(`${y + 1},${x + 1}`) || '')),
      };
    }
    getLastRow() { return this.values.length; }
    getMaxRows() { return 2000; }
    setColumnWidth() {}
    getColumnWidth() { return 120; }
    setFrozenRows() {}
    getRange(row, col, height = 1, width = 1) {
      const sheet = this;
      return {
        sheet, row, col,
        getA1Notation: () => `${String.fromCharCode(64 + col)}${row}`,
        getFormula: () => sheet.formulas.get(`${row},${col}`) || '',
        getValue: () => sheet.values[row - 1]?.[col - 1] ?? '',
        setValue: value => { sheet.values[row - 1][col - 1] = value; writes.push([sheet.name, row, col]); },
        setValues: values => {
          values.forEach((r, y) => r.forEach((v, x) => {
            sheet.values[row + y - 1] ||= [];
            sheet.values[row + y - 1][col + x - 1] = v;
            writes.push([sheet.name, row + y, col + x]);
          }));
        },
        copyTo: (target, options) => { assert.equal(options.formatOnly, true); formats.push([target.sheet.name, target.row]); },
      };
    }
  }
  const sheets = baseline.tabs.map(t => new Sheet(t.tab, t.gid, [columns, ...t.rows.map(r => columns.map(c =>
    c === 'value' && r.field === 'Show Section?' ? String(r[c]).toUpperCase() === 'TRUE' : r[c]
  ))]));
  const book = {
    getSheetById: id => sheets.find(s => s.id === id),
    getSheetByName: name => sheets.find(s => s.name === name),
    insertSheet: name => { const s = new Sheet(name, 999000 + sheets.length, []); sheets.push(s); return s; },
  };
  const context = {
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify(patch) }) },
    SpreadsheetApp: { openById: id => { assert.equal(id, baseline.workbook); return book; }, flush() {} },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }, console: { log() {} } };
  vm.createContext(context); vm.runInContext(script, context);
  return { context, book, sheets, writes, formats };
}
const preview = fixture();
preview.context.cnbPhase1aPreview();
assert.equal(preview.writes.length, 0); assert.equal(preview.formats.length, 0);
const conflict = fixture();
const first = patch.tabs[0].changes[0];
const target = conflict.book.getSheetById(patch.tabs[0].gid);
const row = target.values.findIndex(r => r[0] === first.section && r[1] === first.field);
target.values[row][columns.indexOf(first.column)] = 'Edited by client after snapshot';
assert.throws(() => conflict.context.cnbPhase1aApply(), /Nothing was written/);
assert.equal(conflict.writes.length, 0);
const formula = fixture();
formula.book.getSheetById(patch.tabs[0].gid).formulas.set(`${row + 1},${columns.indexOf(first.column) + 1}`, '=A1');
assert.throws(() => formula.context.cnbPhase1aApply(), /Nothing was written/);
assert.equal(formula.writes.length, 0);
const applied = fixture();
const about = applied.book.getSheetByName('About');
about.values[2][2] = 'A concurrent edit on an unrelated tab';
assert.throws(() => applied.context.cnbPhase1aApply(), /PrepareNewPages first/);
assert.equal(applied.writes.length, 0);
applied.context.cnbPhase1aPrepareNewPages();
assert.ok(applied.writes.every(([tab]) => ['member-home', 'speaking-education'].includes(tab)), 'Preparation changes only new tabs');
applied.context.cnbPhase1aApply();
assert.equal(about.values[2][2], 'A concurrent edit on an unrelated tab');
const comparable = value => value === true || String(value).toUpperCase() === 'TRUE' ? 'TRUE'
  : value === false || String(value).toUpperCase() === 'FALSE' ? 'FALSE' : String(value ?? '');
for (const tab of patch.tabs) {
  const expected = await readJson(path.join(out, `proposed/${tab.key}.json`));
  assert.deepEqual(applied.book.getSheetByName(tab.tab).values.map(row => row.map(comparable)),
    [columns, ...expected.map(r => columns.map(c => r[c]))].map(row => row.map(comparable)));
}
for (const [tab, row, column] of applied.writes) {
  const old = baseline.tabs.find(t => t.tab === tab);
  if (old && row <= old.rows.length + 1) assert.ok(column >= 3 && column <= 5, 'Existing A/B/schema never rewritten');
}
for (const [tab, row] of applied.formats) {
  const old = baseline.tabs.find(t => t.tab === tab);
  if (old) assert.ok(row > old.rows.length + 1, 'Existing formatting never changed');
}
applied.writes.length = 0;
applied.context.cnbPhase1aApply();
assert.equal(applied.writes.length, 0, 'Reapplication is idempotent');
console.log('PASS: read-only preview, conflict rejection, formula protection, targeted writes, untouched-tab preservation, append-only formatting.');
