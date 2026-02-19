/**
 * Donor Thank You Generator — Google Apps Script Backend
 * 
 * Sheet columns: ID | DonorName | Email | Amount | Date | LetterTemplate | SentAt | CreatedAt
 * Generates personalized thank-you letters, can email via Gmail
 * Deploy as web app: Execute as "Me", Access "Anyone"
 */

const SHEET_NAME = 'DonorThankYou';

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['ID', 'DonorName', 'Email', 'Amount', 'Date', 'LetterContent', 'SentAt', 'CreatedAt']);
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
      return jsonResponse({ success: true, data: getLetters() });
    }
    if (action === 'templates') {
      return jsonResponse({ success: true, data: getDefaultTemplates() });
    }
    return jsonResponse({ success: false, error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || 'generate';
    
    if (action === 'generate') {
      const result = generateLetter(data);
      return jsonResponse({ success: true, data: result });
    }
    if (action === 'send') {
      const result = sendLetter(data.id);
      return jsonResponse({ success: true, data: result });
    }
    if (action === 'bulk-generate') {
      const results = data.donors.map(d => generateLetter(d));
      return jsonResponse({ success: true, data: results });
    }
    return jsonResponse({ success: false, error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function getLetters() {
  const sheet = getOrCreateSheet();
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  
  return rows.slice(1).map(row => ({
    id: row[0], donorName: row[1], email: row[2], amount: row[3],
    date: row[4], letterContent: row[5], sentAt: row[6], createdAt: row[7]
  }));
}

function generateLetter(data) {
  const sheet = getOrCreateSheet();
  const id = Utilities.getUuid();
  const now = new Date().toISOString();
  
  const template = data.template || getDefaultTemplates()[0].body;
  const letter = template
    .replace(/\{\{name\}\}/g, data.donorName)
    .replace(/\{\{amount\}\}/g, '$' + parseFloat(data.amount).toFixed(2))
    .replace(/\{\{date\}\}/g, data.date || new Date().toLocaleDateString())
    .replace(/\{\{organization\}\}/g, data.organization || 'Our Organization');
  
  sheet.appendRow([id, data.donorName, data.email || '', parseFloat(data.amount), data.date || now, letter, '', now]);
  return { id, letterContent: letter };
}

function sendLetter(id) {
  const sheet = getOrCreateSheet();
  const rows = sheet.getDataRange().getValues();
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      const email = rows[i][2];
      if (!email) return { error: 'No email address' };
      
      GmailApp.sendEmail(email, 'Thank You for Your Generous Donation', rows[i][5]);
      sheet.getRange(i + 1, 7).setValue(new Date().toISOString());
      return { sent: true, email: email };
    }
  }
  return { error: 'Letter not found' };
}

function getDefaultTemplates() {
  return [
    {
      name: 'Standard Thank You',
      body: 'Dear {{name}},\n\nThank you for your generous donation of {{amount}} on {{date}}. Your support means the world to {{organization}}.\n\nWith gratitude,\n{{organization}}'
    },
    {
      name: 'Year-End Thank You',
      body: 'Dear {{name}},\n\nAs the year comes to a close, we want to express our heartfelt thanks for your donation of {{amount}}. Your generosity on {{date}} helped make our mission possible.\n\nThis letter serves as your tax receipt. {{organization}} is a registered 501(c)(3) nonprofit.\n\nWarmly,\n{{organization}}'
    }
  ];
}
