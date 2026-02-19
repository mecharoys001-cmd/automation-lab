/**
 * Event Attendance Checker — Google Apps Script Backend
 * 
 * Compares registration list vs check-in list to find no-shows and walk-ins.
 * Sheets: "Registrations" (Name, Email, Event) and "CheckIns" (Name, Email, Event, CheckInTime)
 * Deploy as web app: Execute as "Me", Access "Anyone"
 */

const REG_SHEET = 'Registrations';
const CHECKIN_SHEET = 'CheckIns';

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'compare';

  try {
    if (action === 'compare') {
      const event = e.parameter.event || '';
      return jsonResponse({ success: true, data: compareAttendance(event) });
    }
    if (action === 'registrations') {
      return jsonResponse({ success: true, data: getRows(REG_SHEET) });
    }
    if (action === 'checkins') {
      return jsonResponse({ success: true, data: getRows(CHECKIN_SHEET) });
    }
    if (action === 'events') {
      return jsonResponse({ success: true, data: listEvents() });
    }
    return jsonResponse({ success: false, error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || 'register';

    if (action === 'register') {
      return jsonResponse({ success: true, data: addRegistration(data) });
    }
    if (action === 'checkin') {
      return jsonResponse({ success: true, data: addCheckIn(data) });
    }
    if (action === 'bulk-register') {
      const ids = data.attendees.map(a => addRegistration({ ...a, event: data.event }));
      return jsonResponse({ success: true, data: ids });
    }
    if (action === 'bulk-checkin') {
      const ids = data.attendees.map(a => addCheckIn({ ...a, event: data.event }));
      return jsonResponse({ success: true, data: ids });
    }
    return jsonResponse({ success: false, error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function getRows(sheetName) {
  const sheet = getOrCreateSheet(
    sheetName,
    sheetName === REG_SHEET
      ? ['ID', 'Name', 'Email', 'Event']
      : ['ID', 'Name', 'Email', 'Event', 'CheckInTime']
  );
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  const headers = rows[0].map(String);
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h.toLowerCase()] = row[i]; });
    return obj;
  });
}

function addRegistration(data) {
  const sheet = getOrCreateSheet(REG_SHEET, ['ID', 'Name', 'Email', 'Event']);
  const id = Utilities.getUuid();
  sheet.appendRow([id, data.name, data.email || '', data.event || '']);
  return { id };
}

function addCheckIn(data) {
  const sheet = getOrCreateSheet(CHECKIN_SHEET, ['ID', 'Name', 'Email', 'Event', 'CheckInTime']);
  const id = Utilities.getUuid();
  sheet.appendRow([id, data.name, data.email || '', data.event || '', new Date().toISOString()]);
  return { id };
}

function listEvents() {
  const regs = getRows(REG_SHEET);
  const checkins = getRows(CHECKIN_SHEET);
  const events = new Set([...regs.map(r => r.event), ...checkins.map(c => c.event)]);
  return [...events].filter(Boolean);
}

function compareAttendance(event) {
  let regs = getRows(REG_SHEET);
  let checkins = getRows(CHECKIN_SHEET);

  if (event) {
    regs = regs.filter(r => r.event === event);
    checkins = checkins.filter(c => c.event === event);
  }

  const normalize = (s) => (s || '').toString().trim().toLowerCase();
  const regEmails = new Set(regs.map(r => normalize(r.email)));
  const checkinEmails = new Set(checkins.map(c => normalize(c.email)));

  const attended = regs.filter(r => checkinEmails.has(normalize(r.email)));
  const noShows = regs.filter(r => !checkinEmails.has(normalize(r.email)));
  const walkIns = checkins.filter(c => !regEmails.has(normalize(c.email)));

  return {
    totalRegistered: regs.length,
    totalCheckedIn: checkins.length,
    attended: attended.length,
    noShows: noShows.map(r => ({ name: r.name, email: r.email })),
    walkIns: walkIns.map(c => ({ name: c.name, email: c.email })),
    attendanceRate: regs.length ? ((attended.length / regs.length) * 100).toFixed(1) + '%' : '0%'
  };
}
