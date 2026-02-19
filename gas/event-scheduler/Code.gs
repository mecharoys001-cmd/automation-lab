/**
 * Event Schedule Generator — Google Apps Script Backend
 * 
 * Sheet columns: ID | EventName | Date | StartTime | EndTime | Location | Speaker | Notes | CreatedAt
 * Deploy as web app: Execute as "Me", Access "Anyone"
 */

const SHEET_NAME = 'EventSchedule';

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['ID', 'EventName', 'Date', 'StartTime', 'EndTime', 'Location', 'Speaker', 'Notes', 'CreatedAt']);
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
      const date = e.parameter.date || '';
      return jsonResponse({ success: true, data: getEvents(date) });
    }
    if (action === 'dates') {
      return jsonResponse({ success: true, data: getUniqueDates() });
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
      return jsonResponse({ success: true, data: createEvent(data) });
    }
    if (action === 'update') {
      updateEvent(data);
      return jsonResponse({ success: true });
    }
    if (action === 'delete') {
      deleteEvent(data.id);
      return jsonResponse({ success: true });
    }
    if (action === 'bulk-create') {
      const ids = data.events.map(ev => createEvent(ev));
      return jsonResponse({ success: true, data: ids });
    }
    return jsonResponse({ success: false, error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function getEvents(date) {
  const sheet = getOrCreateSheet();
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  let events = rows.slice(1).map(row => ({
    id: row[0], eventName: row[1], date: row[2], startTime: row[3],
    endTime: row[4], location: row[5], speaker: row[6], notes: row[7], createdAt: row[8]
  }));

  if (date) events = events.filter(ev => ev.date === date);
  return events.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
}

function createEvent(data) {
  const sheet = getOrCreateSheet();
  const id = Utilities.getUuid();
  sheet.appendRow([
    id, data.eventName, data.date || '', data.startTime || '',
    data.endTime || '', data.location || '', data.speaker || '', data.notes || '',
    new Date().toISOString()
  ]);
  return { id };
}

function updateEvent(data) {
  const sheet = getOrCreateSheet();
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.id) {
      const fields = ['eventName', 'date', 'startTime', 'endTime', 'location', 'speaker', 'notes'];
      const cols = [2, 3, 4, 5, 6, 7, 8];
      fields.forEach((f, idx) => {
        if (data[f] !== undefined) sheet.getRange(i + 1, cols[idx]).setValue(data[f]);
      });
      return;
    }
  }
}

function deleteEvent(id) {
  const sheet = getOrCreateSheet();
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0] === id) { sheet.deleteRow(i + 1); return; }
  }
}

function getUniqueDates() {
  const events = getEvents('');
  return [...new Set(events.map(e => e.date))].filter(Boolean).sort();
}
