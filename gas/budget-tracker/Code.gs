/**
 * Budget vs Actual Tracker — Google Apps Script Backend
 * 
 * Sheet columns: ID | Category | BudgetAmount | ActualAmount | Period | Notes | CreatedAt
 * Deploy as web app: Execute as "Me", Access "Anyone"
 */

const SHEET_NAME = 'BudgetVsActual';

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['ID', 'Category', 'BudgetAmount', 'ActualAmount', 'Period', 'Notes', 'CreatedAt']);
  }
  return sheet;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'list';
  
  try {
    if (action === 'list') {
      const period = e.parameter.period || '';
      return jsonResponse({ success: true, data: getEntries(period) });
    }
    if (action === 'summary') {
      const period = e.parameter.period || '';
      return jsonResponse({ success: true, data: getSummary(period) });
    }
    return jsonResponse({ success: false, error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || 'create';
    
    if (action === 'create') {
      const result = createEntry(data);
      return jsonResponse({ success: true, data: result });
    }
    if (action === 'update') {
      updateEntry(data);
      return jsonResponse({ success: true });
    }
    if (action === 'delete') {
      deleteEntry(data.id);
      return jsonResponse({ success: true });
    }
    return jsonResponse({ success: false, error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function getEntries(period) {
  const sheet = getOrCreateSheet();
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  
  let entries = rows.slice(1).map(row => ({
    id: row[0], category: row[1], budgetAmount: row[2],
    actualAmount: row[3], period: row[4], notes: row[5], createdAt: row[6],
    variance: (parseFloat(row[2]) || 0) - (parseFloat(row[3]) || 0),
    variancePercent: row[2] ? (((parseFloat(row[2]) - parseFloat(row[3])) / parseFloat(row[2])) * 100).toFixed(1) : 0
  }));
  
  if (period) entries = entries.filter(e => e.period === period);
  return entries;
}

function createEntry(data) {
  const sheet = getOrCreateSheet();
  const id = Utilities.getUuid();
  sheet.appendRow([
    id, data.category, parseFloat(data.budgetAmount) || 0,
    parseFloat(data.actualAmount) || 0, data.period || '', data.notes || '', new Date().toISOString()
  ]);
  return { id };
}

function updateEntry(data) {
  const sheet = getOrCreateSheet();
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.id) {
      if (data.actualAmount !== undefined) sheet.getRange(i + 1, 4).setValue(parseFloat(data.actualAmount));
      if (data.budgetAmount !== undefined) sheet.getRange(i + 1, 3).setValue(parseFloat(data.budgetAmount));
      if (data.notes !== undefined) sheet.getRange(i + 1, 6).setValue(data.notes);
      return;
    }
  }
}

function deleteEntry(id) {
  const sheet = getOrCreateSheet();
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0] === id) { sheet.deleteRow(i + 1); return; }
  }
}

function getSummary(period) {
  const entries = getEntries(period);
  const totalBudget = entries.reduce((s, e) => s + (parseFloat(e.budgetAmount) || 0), 0);
  const totalActual = entries.reduce((s, e) => s + (parseFloat(e.actualAmount) || 0), 0);
  return {
    totalBudget, totalActual,
    totalVariance: totalBudget - totalActual,
    categories: entries.length
  };
}
