/**
 * Donation Receipt Generator — Google Apps Script Backend
 * 
 * Sheet columns: ID | Date | DonorName | DonorEmail | Amount | Purpose | ReceiptNumber | CreatedAt
 * Deploy as web app: Execute as "Me", Access "Anyone"
 */

const SHEET_NAME = 'Donations';

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['ID', 'Date', 'DonorName', 'DonorEmail', 'Amount', 'Purpose', 'ReceiptNumber', 'CreatedAt']);
  }
  return sheet;
}

function generateReceiptNumber() {
  return 'RCP-' + new Date().getFullYear() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'list';
  
  try {
    if (action === 'list') {
      return jsonResponse({ success: true, data: getReceipts() });
    }
    if (action === 'get') {
      const id = e.parameter.id;
      const receipts = getReceipts().filter(r => r.id === id);
      return jsonResponse({ success: true, data: receipts[0] || null });
    }
    if (action === 'summary') {
      return jsonResponse({ success: true, data: getSummary() });
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
      const result = createReceipt(data);
      return jsonResponse({ success: true, data: result });
    }
    if (action === 'delete') {
      deleteReceipt(data.id);
      return jsonResponse({ success: true });
    }
    return jsonResponse({ success: false, error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function getReceipts() {
  const sheet = getOrCreateSheet();
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  
  return rows.slice(1).map(row => ({
    id: row[0],
    date: row[1],
    donorName: row[2],
    donorEmail: row[3],
    amount: row[4],
    purpose: row[5],
    receiptNumber: row[6],
    createdAt: row[7]
  }));
}

function createReceipt(data) {
  const sheet = getOrCreateSheet();
  const id = Utilities.getUuid();
  const receiptNumber = generateReceiptNumber();
  const now = new Date().toISOString();
  
  sheet.appendRow([
    id, data.date || now, data.donorName, data.donorEmail,
    parseFloat(data.amount), data.purpose || '', receiptNumber, now
  ]);
  
  return { id, receiptNumber, date: data.date || now };
}

function deleteReceipt(id) {
  const sheet = getOrCreateSheet();
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0] === id) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

function getSummary() {
  const receipts = getReceipts();
  const total = receipts.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  return { totalDonations: receipts.length, totalAmount: total };
}
