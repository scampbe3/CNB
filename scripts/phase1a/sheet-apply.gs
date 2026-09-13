// C+B Phase 1A guarded Sheet updater, version 2.
// Paste this into a NEW standalone Apps Script project. Do not replace C+B Tools.
const CNB_PHASE1A_PATCH_URL = 'https://raw.githubusercontent.com/scampbe3/CNB/7f89781/docs/phase1a/sheet-patch.json';
const CNB_PHASE1A_PUBLISHED = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSLEkKnYnuBnC6T_dS2MAaW5jpJVh3SRHiAo-3vpNUqq1aj5SPmbQY-lrEeEVleHyhQlsoYOE0_S0WS/pub';
const CNB_PHASE1A_COLUMNS = ['section', 'field', 'value', 'link', 'notes'];

function cnbPhase1aPreview() { return cnbPhase1aRun_('preview'); }
function cnbPhase1aPrepareNewPages() { return cnbPhase1aRun_('new-pages'); }
function cnbPhase1aApply() { return cnbPhase1aRun_('apply'); }

function cnbPhase1aRun_(mode) {
  const patch = cnbPhase1aLoadPatch_();
  const workbook = SpreadsheetApp.openById(patch.workbook);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const plans = cnbPhase1aPlan_(workbook, patch, mode === 'new-pages');
    const conflicts = plans.reduce((all, plan) => all.concat(plan.conflicts), []);
    const summary = plans.map(plan => ({ tab: plan.tab.tab, cellsToUpdate: plan.changes.length,
      rowsToAppend: plan.additions.length, newTab: !plan.sheet, conflicts: plan.conflicts.length }));
    console.log(JSON.stringify(summary, null, 2));
    if (conflicts.length) {
      console.log('CONFLICT DETAILS:\n' + conflicts.join('\n'));
      throw new Error('Nothing was written. Found ' + conflicts.length + ' conflict(s). See the execution log.');
    }
    if (mode === 'preview') {
      console.log('PREVIEW PASSED. Nothing was written.');
      return summary;
    }
    if (mode === 'apply' && plans.some(plan => plan.tab.create && !plan.sheet)) {
      throw new Error('Nothing was written. Run cnbPhase1aPrepareNewPages first, then connect and verify the new Squarespace pages.');
    }
    cnbPhase1aWrite_(workbook, plans);
    SpreadsheetApp.flush();
    console.log('COMPLETE: ' + mode);
    return summary;
  } finally { lock.releaseLock(); }
}

function cnbPhase1aLoadPatch_() {
  const response = UrlFetchApp.fetch(CNB_PHASE1A_PATCH_URL, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) {
    throw new Error('Could not download the tested content patch. HTTP ' + response.getResponseCode());
  }
  return JSON.parse(response.getContentText());
}

function cnbPhase1aPlan_(workbook, patch, newPagesOnly) {
  return patch.tabs.filter(tab => !newPagesOnly || tab.create).map(tab => {
    const sheet = tab.gid === null ? workbook.getSheetByName(tab.tab) : workbook.getSheetById(tab.gid);
    const values = sheet ? sheet.getDataRange().getValues() : [CNB_PHASE1A_COLUMNS];
    const formulas = sheet ? sheet.getDataRange().getFormulas() : [CNB_PHASE1A_COLUMNS.map(() => '')];
    const conflicts = [];
    if (!sheet && !tab.create) conflicts.push('Missing existing tab: ' + tab.tab);
    if (CNB_PHASE1A_COLUMNS.some((column, index) => values[0][index] !== column)) {
      conflicts.push('Unexpected five-column schema in tab: ' + tab.tab);
    }
    const identities = {};
    values.slice(1).forEach((row, index) => {
      if (!row[0] && !row[1]) return;
      const key = row[0] + '\u0000' + row[1];
      if (identities[key]) conflicts.push('Duplicate section/field identity: ' + tab.tab + ' / ' + row[0] + ' / ' + row[1]);
      identities[key] = index + 2;
    });
    const changes = [];
    tab.changes.forEach(change => {
      const row = identities[change.section + '\u0000' + change.field];
      const column = CNB_PHASE1A_COLUMNS.indexOf(change.column) + 1;
      if (!row) {
        conflicts.push('Missing row: ' + tab.tab + ' / ' + change.section + ' / ' + change.field);
        return;
      }
      if (formulas[row - 1][column - 1]) {
        conflicts.push('Formula in target cell: ' + tab.tab + '!' + cnbPhase1aA1_(row, column));
        return;
      }
      const current = cnbPhase1aComparable_(values[row - 1][column - 1]);
      const before = cnbPhase1aComparable_(change.before);
      const after = cnbPhase1aComparable_(change.after);
      if (current !== before && current !== after) {
        conflicts.push('Target edited since snapshot: ' + tab.tab + '!' + cnbPhase1aA1_(row, column));
      } else if (current !== after) {
        changes.push({ row: row, column: column, before: change.before, after: change.after });
      }
    });
    const additions = [];
    tab.additions.forEach(addition => {
      const row = identities[addition.section + '\u0000' + addition.field];
      if (!row) { additions.push(addition); return; }
      const current = CNB_PHASE1A_COLUMNS.map((column, index) => cnbPhase1aComparable_(values[row - 1][index]));
      const expected = CNB_PHASE1A_COLUMNS.map(column => cnbPhase1aComparable_(addition[column]));
      if (JSON.stringify(current) !== JSON.stringify(expected)) {
        conflicts.push('New row identity is already occupied: ' + tab.tab + ' / ' + addition.section + ' / ' + addition.field);
      }
    });
    return { tab: tab, sheet: sheet, values: values, changes: changes, additions: additions, conflicts: conflicts };
  });
}

function cnbPhase1aWrite_(workbook, plans) {
  plans.forEach(plan => {
    const sheet = plan.sheet || cnbPhase1aCreateTab_(workbook, plan.tab.tab);
    if (plan.sheet && plan.changes.length) {
      // One fresh read and one values-only write preserve current non-target content and all formatting.
      const range = sheet.getDataRange();
      const current = range.getValues();
      const formulas = range.getFormulas();
      plan.changes.forEach(change => {
        if (formulas[change.row - 1][change.column - 1] ||
            cnbPhase1aComparable_(current[change.row - 1][change.column - 1]) !== cnbPhase1aComparable_(change.before)) {
          throw new Error('Stopped before writing ' + plan.tab.tab + ': a target changed after preview.');
        }
      });
      const content = current.map((row, y) => row.slice(2, 5).map((value, x) => formulas[y][x + 2] || value));
      plan.changes.forEach(change => {
        content[change.row - 1][change.column - 3] = change.column === 3
          ? cnbPhase1aCellValue_(plan.values[change.row - 1][1], change.after)
          : change.after;
      });
      sheet.getRange(1, 3, content.length, 3).setValues(content);
    }
    if (plan.additions.length) cnbPhase1aAppend_(workbook, sheet, plan);
    if (!plan.sheet) {
      const url = CNB_PHASE1A_PUBLISHED + '?gid=' + sheet.getSheetId() + '&single=true&output=csv';
      console.log('NEW PAGE GID: ' + plan.tab.key + ' = ' + sheet.getSheetId());
      console.log('<div data-cnb-home-root data-cnb-page="' + plan.tab.key + '" data-cnb-src="' + url + '"></div>');
    }
  });
}

function cnbPhase1aCreateTab_(workbook, name) {
  const sheet = workbook.insertSheet(name);
  const donor = workbook.getSheetById(1699360495);
  sheet.getRange(1, 1, 1, 5).setValues([CNB_PHASE1A_COLUMNS]);
  donor.getRange(1, 1, 1, 5).copyTo(sheet.getRange(1, 1, 1, 5), { formatOnly: true });
  for (let column = 1; column <= 5; column++) sheet.setColumnWidth(column, donor.getColumnWidth(column));
  sheet.setFrozenRows(1);
  return sheet;
}

function cnbPhase1aAppend_(workbook, sheet, plan) {
  const start = sheet.getLastRow() + 1;
  const end = start + plan.additions.length - 1;
  if (end > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), end - sheet.getMaxRows());
  const donor = workbook.getSheetById(1699360495);
  plan.additions.forEach((addition, index) => {
    const target = sheet.getRange(start + index, 1, 1, 5);
    const sameField = plan.values.findIndex((row, rowIndex) => rowIndex > 0 && row[1] === addition.field);
    (sameField > 0 ? sheet.getRange(sameField + 1, 1, 1, 5) : donor.getRange(2, 1, 1, 5))
      .copyTo(target, { formatOnly: true });
    target.setValues([CNB_PHASE1A_COLUMNS.map(column =>
      column === 'value' ? cnbPhase1aCellValue_(addition.field, addition[column]) : addition[column]
    )]);
  });
}

function cnbPhase1aCellValue_(field, value) {
  if (field === 'Show Section?') return cnbPhase1aComparable_(value) === 'TRUE';
  return value;
}

function cnbPhase1aComparable_(value) {
  if (value === true || String(value).toUpperCase() === 'TRUE') return 'TRUE';
  if (value === false || String(value).toUpperCase() === 'FALSE') return 'FALSE';
  return value === null || value === undefined ? '' : String(value);
}

function cnbPhase1aA1_(row, column) { return String.fromCharCode(64 + column) + row; }
