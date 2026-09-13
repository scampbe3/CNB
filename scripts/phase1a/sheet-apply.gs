// Run in a NEW, temporary standalone Apps Script project. Do not replace the existing CMS script.
// CNB_PHASE1A_PATCH is injected by package.mjs. Preview never writes to the workbook.
function cnbPhase1aPreview() {
  return cnbPhase1aRun(false);
}

function cnbPhase1aPrepareNewPages() {
  return cnbPhase1aRun(true, true);
}

function cnbPhase1aApply() {
  return cnbPhase1aRun(true);
}

function cnbPhase1aRun(apply, newPagesOnly) {
  const workbook = SpreadsheetApp.openById(CNB_PHASE1A_PATCH.workbook);
  const columns = ['section', 'field', 'value', 'link', 'notes'];
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const plans = [];
    const conflicts = [];
    for (const tab of CNB_PHASE1A_PATCH.tabs) {
      if (newPagesOnly && !tab.create) continue;
      let sheet = tab.gid === null ? workbook.getSheetByName(tab.tab) : workbook.getSheetById(tab.gid);
      if (!sheet && !tab.create) { conflicts.push('Missing existing tab: ' + tab.tab); continue; }
      const values = sheet ? sheet.getDataRange().getValues() : [columns];
      if (columns.some((c, i) => values[0][i] !== c)) { conflicts.push('Schema changed: ' + tab.tab); continue; }
      const identities = new Map();
      values.slice(1).forEach((row, i) => {
        if (!row[0] && !row[1]) return;
        const key = row[0] + '\u0000' + row[1];
        if (identities.has(key)) conflicts.push('Duplicate identity: ' + tab.tab + ' / ' + key);
        identities.set(key, i + 2);
      });
      const cells = [];
      for (const change of tab.changes) {
        const row = identities.get(change.section + '\u0000' + change.field);
        const column = columns.indexOf(change.column) + 1;
        if (!row) { conflicts.push('Missing row: ' + tab.tab + ' / ' + change.section + ' / ' + change.field); continue; }
        const range = sheet.getRange(row, column);
        if (range.getFormula()) { conflicts.push('Formula in target cell: ' + tab.tab + '!' + range.getA1Notation()); continue; }
        const current = String(range.getValue());
        if (current !== change.before && current !== change.after) {
          conflicts.push('Content edited since snapshot: ' + tab.tab + '!' + range.getA1Notation());
        } else if (current !== change.after) cells.push({ row: row, column: column, change: change });
      }
      const additions = [];
      for (const addition of tab.additions) {
        const row = identities.get(addition.section + '\u0000' + addition.field);
        if (row) {
          if (columns.some((c, i) => String(values[row - 1][i] || '') !== addition[c])) {
            conflicts.push('New row identity now occupied: ' + tab.tab + ' / ' + addition.section + ' / ' + addition.field);
          }
        } else additions.push(addition);
      }
      plans.push({ tab: tab, sheet: sheet, values: values, cells: cells, additions: additions });
    }
    if (conflicts.length) throw new Error('Nothing written. Resolve conflicts first:\n' + conflicts.join('\n'));
    const summary = plans.map(p => ({ tab: p.tab.tab, cells: p.cells.length, rows: p.additions.length, newTab: !p.sheet }));
    if (!apply) { console.log(JSON.stringify(summary, null, 2)); return summary; }
    if (!newPagesOnly && plans.some(p => p.tab.create && !p.sheet)) {
      throw new Error('Nothing written. Run cnbPhase1aPrepareNewPages first, then connect and verify the new Squarespace pages before applying existing-page content.');
    }
    // Script locks do not block human edits. Keep the Sheet idle during this brief application.
    for (const plan of plans) {
      const sheet = plan.sheet || workbook.insertSheet(plan.tab.tab);
      if (!plan.sheet) {
        sheet.getRange(1, 1, 1, 5).setValues([columns]);
        const donor = workbook.getSheetById(1699360495);
        donor.getRange(1, 1, 1, 5).copyTo(sheet.getRange(1, 1, 1, 5), { formatOnly: true });
        for (let c = 1; c <= 5; c++) sheet.setColumnWidth(c, donor.getColumnWidth(c));
        sheet.setFrozenRows(1);
      }
      for (const cell of plan.cells) {
        const range = sheet.getRange(cell.row, cell.column);
        if (range.getFormula() || String(range.getValue()) !== cell.change.before) {
          throw new Error('Stopped: a target changed during application. Review the execution log before resuming.');
        }
        range.setValue(cell.change.after);
        console.log('Updated ' + plan.tab.tab + '!' + range.getA1Notation());
      }
      if (plan.additions.length) {
        const start = sheet.getLastRow() + 1;
        const end = start + plan.additions.length - 1;
        if (end > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), end - sheet.getMaxRows());
        for (let i = 0; i < plan.additions.length; i++) {
          const addition = plan.additions[i];
          const target = sheet.getRange(start + i, 1, 1, 5);
          const sameField = plan.values.findIndex((r, index) => index > 0 && r[1] === addition.field);
          if (sameField > 0) sheet.getRange(sameField + 1, 1, 1, 5).copyTo(target, { formatOnly: true });
          else {
            const donor = workbook.getSheetById(1699360495);
            donor.getRange(2, 1, 1, 5).copyTo(target, { formatOnly: true });
          }
          target.setValues([columns.map(c => addition[c])]);
        }
      }
      if (!plan.sheet) {
        const url = CNB_PHASE1A_PUBLISHED + '?gid=' + sheet.getSheetId() + '&single=true&output=csv';
        console.log('NEW PAGE MOUNT (verify published CSV before use):\n<div data-cnb-home-root data-cnb-page="' + plan.tab.key + '" data-cnb-src="' + url + '"></div>');
      }
    }
    SpreadsheetApp.flush();
    return summary;
  } finally { lock.releaseLock(); }
}
