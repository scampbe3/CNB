/**
 * Lillier Google Sheet -> GitHub sync dispatcher (debounced).
 *
 * Flow:
 * - on edit in the "Content" tab, mark sheet dirty
 * - debounce for 1 minute
 * - dispatch GitHub repository_dispatch event: lillier_sheet_dirty
 * - GitHub Action downloads published CSV and syncs theme files
 *
 * Required Script Properties:
 * - GITHUB_OWNER
 * - GITHUB_REPO
 * - GITHUB_TOKEN
 */

const LILLIER_CONTENT_TAB = "Content";
const LILLIER_DIRTY_KEY = "LILLIER_SHEET_DIRTY";
const LILLIER_TIMER_KEY = "LILLIER_SHEET_TIMER_TRIGGER_ID";
const LILLIER_EVENT_TYPE = "lillier_sheet_dirty";
// Requested debounce window. Note: Apps Script clock triggers are best-effort
// and may execute later than this (often around minute granularity).
const LILLIER_DEBOUNCE_MS = 15 * 1000;

function handleLillierSheetEdit_(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (!sheet || sheet.getName() !== LILLIER_CONTENT_TAB) return;
  markDirtyAndDebounce_();
}

function markDirtyAndDebounce_() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(LILLIER_DIRTY_KEY, "1");

  const existingTriggerId = props.getProperty(LILLIER_TIMER_KEY);
  if (existingTriggerId) {
    deleteTriggerById_(existingTriggerId);
    props.deleteProperty(LILLIER_TIMER_KEY);
  }

  const trigger = ScriptApp.newTrigger("flushLillierSheetChanges_")
    .timeBased()
    .after(LILLIER_DEBOUNCE_MS)
    .create();

  props.setProperty(LILLIER_TIMER_KEY, trigger.getUniqueId());
}

function flushLillierSheetChanges_() {
  const props = PropertiesService.getScriptProperties();
  const isDirty = props.getProperty(LILLIER_DIRTY_KEY) === "1";

  props.deleteProperty(LILLIER_DIRTY_KEY);
  props.deleteProperty(LILLIER_TIMER_KEY);

  if (!isDirty) return;
  dispatchGithubSync_();
}

function dispatchGithubSync_() {
  const props = PropertiesService.getScriptProperties();
  const owner = props.getProperty("GITHUB_OWNER");
  const repo = props.getProperty("GITHUB_REPO");
  const token = props.getProperty("GITHUB_TOKEN");

  if (!owner || !repo || !token) {
    throw new Error("Missing script properties: GITHUB_OWNER, GITHUB_REPO, or GITHUB_TOKEN");
  }

  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const url = `https://api.github.com/repos/${owner}/${repo}/dispatches`;
  const payload = {
    event_type: LILLIER_EVENT_TYPE,
    client_payload: {
      source: "google_sheets",
      spreadsheet_id: spreadsheetId,
      updated_at: new Date().toISOString()
    }
  };

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error(`GitHub dispatch failed (${status}): ${response.getContentText()}`);
  }
}

function deleteTriggerById_(triggerId) {
  if (!triggerId) return;
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach((trigger) => {
    if (trigger.getUniqueId && trigger.getUniqueId() === triggerId) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

/**
 * Run once to install or reset the installable onEdit trigger.
 */
function installLillierOnEditTrigger_() {
  const fnName = "handleLillierSheetEdit_";
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach((trigger) => {
    if (trigger.getHandlerFunction() === fnName) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger(fnName)
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
}
