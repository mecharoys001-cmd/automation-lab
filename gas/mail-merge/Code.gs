/**
 * Mail Merge Preview — Google Apps Script Backend
 * 
 * Sheet: uses a specified sheet as data source
 * Applies mustache-style {{field}} templates, can send via Gmail
 * Deploy as web app: Execute as "Me", Access "Anyone"
 */

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'sheets';
  
  try {
    if (action === 'sheets') {
      return jsonResponse({ success: true, data: listSheets() });
    }
    if (action === 'data') {
      const sheetName = e.parameter.sheet;
      if (!sheetName) return jsonResponse({ success: false, error: 'sheet parameter required' });
      return jsonResponse({ success: true, data: getSheetData(sheetName) });
    }
    return jsonResponse({ success: false, error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || 'preview';
    
    if (action === 'preview') {
      const results = mergeTemplate(data.template, data.rows);
      return jsonResponse({ success: true, data: results });
    }
    if (action === 'send') {
      const results = sendEmails(data.template, data.subject, data.rows);
      return jsonResponse({ success: true, data: results });
    }
    return jsonResponse({ success: false, error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function listSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheets().map(s => s.getName());
}

function getSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { headers: [], rows: [] };
  
  const values = sheet.getDataRange().getValues();
  if (values.length === 0) return { headers: [], rows: [] };
  
  const headers = values[0].map(String);
  const rows = values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
  
  return { headers, rows };
}

function mergeTemplate(template, rows) {
  return rows.map(row => {
    let result = template;
    Object.keys(row).forEach(key => {
      result = result.replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), row[key]);
    });
    return result;
  });
}

function sendEmails(template, subject, rows) {
  const sent = [];
  rows.forEach(row => {
    if (!row.Email && !row.email) return;
    const email = row.Email || row.email;
    let body = template;
    Object.keys(row).forEach(key => {
      body = body.replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), row[key]);
    });
    
    let subjectMerged = subject;
    Object.keys(row).forEach(key => {
      subjectMerged = subjectMerged.replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), row[key]);
    });
    
    GmailApp.sendEmail(email, subjectMerged, body);
    sent.push(email);
  });
  return { sentCount: sent.length, sentTo: sent };
}
