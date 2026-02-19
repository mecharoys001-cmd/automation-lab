/**
 * Volunteer Hour Tracker — Google Apps Script Backend
 * 
 * Sheet columns: ID | VolunteerName | Email | Date | Hours | Activity | Notes | CreatedAt
 * Deploy as web app: Execute as "Me", Access "Anyone"
 */

const SHEET_NAME = 'VolunteerHours';

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['ID', 'VolunteerName', 'Email', 'Date', 'Hours', 'Activity', 'Notes', 'CreatedAt']);
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
      const volunteer = e.parameter.volunteer || '';
      const from = e.parameter.from || '';
      const to = e.parameter.to || '';
      return jsonResponse({ success: true, data: getEntries(volunteer, from, to) });
    }
    if (action === 'summary') {
      return jsonResponse({ success: true, data: getSummary() });
    }
    if (action === 'leaderboard') {
      return jsonResponse({ success: true, data: getLeaderboard() });
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
    if (action === 'delete') {
      deleteEntry(data.id);
      return jsonResponse({ success: true });
    }
    return jsonResponse({ success: false, error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function getEntries(volunteer, from, to) {
  const sheet = getOrCreateSheet();
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  
  let entries = rows.slice(1).map(row => ({
    id: row[0], volunteerName: row[1], email: row[2],
    date: row[3], hours: row[4], activity: row[5],
    notes: row[6], createdAt: row[7]
  }));
  
  if (volunteer) {
    entries = entries.filter(e => e.volunteerName.toLowerCase().includes(volunteer.toLowerCase()));
  }
  if (from) entries = entries.filter(e => new Date(e.date) >= new Date(from));
  if (to) entries = entries.filter(e => new Date(e.date) <= new Date(to));
  
  return entries;
}

function createEntry(data) {
  const sheet = getOrCreateSheet();
  const id = Utilities.getUuid();
  const now = new Date().toISOString();
  
  sheet.appendRow([
    id, data.volunteerName, data.email || '',
    data.date || now, parseFloat(data.hours), data.activity || '', data.notes || '', now
  ]);
  
  return { id };
}

function deleteEntry(id) {
  const sheet = getOrCreateSheet();
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0] === id) { sheet.deleteRow(i + 1); return; }
  }
}

function getSummary() {
  const entries = getEntries('', '', '');
  const totalHours = entries.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);
  const uniqueVolunteers = [...new Set(entries.map(e => e.volunteerName))].length;
  return { totalEntries: entries.length, totalHours, uniqueVolunteers };
}

function getLeaderboard() {
  const entries = getEntries('', '', '');
  const byVolunteer = {};
  entries.forEach(e => {
    byVolunteer[e.volunteerName] = (byVolunteer[e.volunteerName] || 0) + (parseFloat(e.hours) || 0);
  });
  return Object.entries(byVolunteer)
    .map(([name, hours]) => ({ name, hours }))
    .sort((a, b) => b.hours - a.hours);
}
