'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';

// ── Inline CSV Parser (handles quoted fields, newlines inside quotes) ──

function parseCSV(text: string): { data: Record<string, string>[]; fields: string[] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        row.push(field);
        field = '';
        i++;
      } else if (ch === '\r' || ch === '\n') {
        row.push(field);
        field = '';
        if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
        i++;
        if (row.length > 1 || (row.length === 1 && row[0] !== '')) rows.push(row);
        row = [];
      } else {
        field += ch;
        i++;
      }
    }
  }
  // Last field
  row.push(field);
  if (row.length > 1 || (row.length === 1 && row[0] !== '')) rows.push(row);

  if (rows.length === 0) return { data: [], fields: [] };
  const fields = rows[0];
  const data = rows.slice(1).map(r => {
    const obj: Record<string, string> = {};
    fields.forEach((f, idx) => { obj[f] = r[idx] ?? ''; });
    return obj;
  });
  return { data, fields };
}

function unparseCSV(rows: Record<string, string>[]): string {
  if (rows.length === 0) return '';
  const keys = Object.keys(rows[0]);
  const escape = (v: string) => '"' + v.replace(/"/g, '""') + '"';
  return keys.join(',') + '\n' + rows.map(r => keys.map(k => escape(r[k] || '')).join(',')).join('\n');
}

// ── Column Detection ──

const NAME_ALIASES = ['billing name', 'name', 'full name', 'contact name', 'customer name', 'customer'];
const FIRST_NAME_ALIASES = ['first name', 'firstname', 'first'];
const LAST_NAME_ALIASES = ['last name', 'lastname', 'last', 'surname', 'family name'];
const EMAIL_ALIASES = ['email', 'email address', 'e-mail', 'e-mail address', 'customer email'];
const PHONE_ALIASES = ['phone', 'phone number', 'telephone', 'phone #', 'mobile', 'cell', 'billing phone'];

interface ColumnMapping {
  mode: 'name' | 'first-last';
  nameCol?: string;       // when mode === 'name'
  firstNameCol?: string;  // when mode === 'first-last'
  lastNameCol?: string;   // when mode === 'first-last'
  emailCol: string;
  phoneCol: string;
}

interface DetectionResult {
  mapping: ColumnMapping | null;
  partial: Partial<ColumnMapping>;
  detectedLabels: Record<string, string>; // e.g. { Name: 'Billing Name', Email: 'Email' }
}

function findColumn(fields: string[], aliases: string[]): string | undefined {
  const lower = fields.map(f => f.trim().toLowerCase());
  for (const alias of aliases) {
    const idx = lower.indexOf(alias);
    if (idx !== -1) return fields[idx];
  }
  return undefined;
}

function detectColumns(fields: string[]): DetectionResult {
  const trimmed = fields.map(f => f.trim());
  const firstNameCol = findColumn(trimmed, FIRST_NAME_ALIASES);
  const lastNameCol = findColumn(trimmed, LAST_NAME_ALIASES);
  const nameCol = findColumn(trimmed, NAME_ALIASES);
  const emailCol = findColumn(trimmed, EMAIL_ALIASES);
  const phoneCol = findColumn(trimmed, PHONE_ALIASES);

  const detectedLabels: Record<string, string> = {};
  const partial: Partial<ColumnMapping> = {};

  // Determine name mode
  let nameResolved = false;
  if (firstNameCol && lastNameCol) {
    partial.mode = 'first-last';
    partial.firstNameCol = firstNameCol;
    partial.lastNameCol = lastNameCol;
    detectedLabels['First Name'] = firstNameCol;
    detectedLabels['Last Name'] = lastNameCol;
    nameResolved = true;
  } else if (nameCol) {
    partial.mode = 'name';
    partial.nameCol = nameCol;
    detectedLabels['Name'] = nameCol;
    nameResolved = true;
  }

  if (emailCol) { partial.emailCol = emailCol; detectedLabels['Email'] = emailCol; }
  if (phoneCol) { partial.phoneCol = phoneCol; detectedLabels['Phone'] = phoneCol; }

  // Full mapping if all detected
  if (nameResolved && emailCol && phoneCol) {
    const mapping: ColumnMapping = partial.mode === 'first-last'
      ? { mode: 'first-last', firstNameCol: partial.firstNameCol!, lastNameCol: partial.lastNameCol!, emailCol, phoneCol }
      : { mode: 'name', nameCol: partial.nameCol!, emailCol, phoneCol };
    return { mapping, partial, detectedLabels };
  }

  return { mapping: null, partial, detectedLabels };
}

// ── Core Processing ──

interface NameResult { firstName: string; lastName: string; flagged: boolean; flagReason: string }
interface PhoneResult { formatted: string; flagged: boolean; flagReason: string }
interface Contact { 'First Name': string; 'Last Name': string; 'Email Address': string; 'Phone Number': string; _flagReason?: string }
interface Stats { totalRows: number; afterNameFilter: number; afterContactFilter: number; afterDedup: number; clean: number; flagged: number }
interface ProcessResult { clean: Contact[]; flagged: Contact[]; stats: Stats; error?: string }

function parseName(billingName: string): NameResult {
  const result: NameResult = { firstName: '', lastName: '', flagged: false, flagReason: '' };
  if (!billingName || !billingName.trim()) return result;

  let segment = billingName.trim();
  if (segment.includes(',')) {
    const parts = segment.split(',');
    segment = parts[parts.length - 1].trim();
  }

  const words = segment.split(/\s+/).filter(Boolean);
  if (words.length === 0) return result;
  if (words.length === 1) {
    result.firstName = words[0];
    result.flagged = true;
    result.flagReason = 'Single-word name segment: "' + segment + '" from "' + billingName + '"';
    return result;
  }
  result.firstName = words[0];
  result.lastName = words.slice(1).join(' ');
  return result;
}

function cleanPhone(phone: string): PhoneResult {
  if (!phone || !phone.trim()) return { formatted: '', flagged: false, flagReason: '' };
  let digits = phone.trim().replace(/^\+/, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.substring(1);
  }
  if (digits.length !== 10 || !/^\d{10}$/.test(digits)) {
    return { formatted: digits, flagged: true, flagReason: 'Non-10-digit phone: "' + phone + '"' };
  }
  const formatted = '(' + digits.substring(0, 3) + ') ' + digits.substring(3, 6) + '-' + digits.substring(6);
  return { formatted, flagged: false, flagReason: '' };
}

function processCSVWithMapping(csvData: Record<string, string>[], mapping: ColumnMapping): ProcessResult {
  const rows = csvData;
  const stats: Stats = { totalRows: rows.length, afterNameFilter: 0, afterContactFilter: 0, afterDedup: 0, clean: 0, flagged: 0 };

  const getName = (r: Record<string, string>) => {
    if (mapping.mode === 'first-last') {
      return { first: (r[mapping.firstNameCol!] || '').trim(), last: (r[mapping.lastNameCol!] || '').trim() };
    }
    return null; // will use parseName
  };
  const getRawName = (r: Record<string, string>) => mapping.mode === 'name' ? (r[mapping.nameCol!] || '').trim() : '';
  const getEmail = (r: Record<string, string>) => (r[mapping.emailCol] || '').trim();
  const getPhone = (r: Record<string, string>) => (r[mapping.phoneCol] || '').trim();

  // Step 1: Filter empty names and 'A Customer'
  let filtered = rows.filter(r => {
    if (mapping.mode === 'first-last') {
      const n = getName(r)!;
      return n.first || n.last;
    }
    const bn = getRawName(r);
    return bn && bn !== 'A Customer';
  });
  stats.afterNameFilter = filtered.length;

  // Step 2: Filter rows missing BOTH email AND phone
  filtered = filtered.filter(r => getEmail(r) || getPhone(r));
  stats.afterContactFilter = filtered.length;

  // Step 3: Deduplicate by email, then phone for email-less
  const byEmail = new Map<string, Record<string, string>>();
  const noEmail: Record<string, string>[] = [];
  for (const row of filtered) {
    const email = getEmail(row).toLowerCase();
    if (email) {
      if (!byEmail.has(email)) byEmail.set(email, row);
    } else {
      noEmail.push(row);
    }
  }
  const byPhone = new Map<string, Record<string, string>>();
  for (const row of noEmail) {
    const phone = getPhone(row);
    if (!byPhone.has(phone)) byPhone.set(phone, row);
  }
  const deduped = [...byEmail.values(), ...byPhone.values()];
  stats.afterDedup = deduped.length;

  // Step 4: Parse names, clean phones, separate clean/flagged
  const clean: Contact[] = [];
  const flaggedList: Contact[] = [];

  for (const row of deduped) {
    let firstName: string, lastName: string;
    let nameFlagged = false, nameFlagReason = '';

    if (mapping.mode === 'first-last') {
      const n = getName(row)!;
      firstName = n.first;
      lastName = n.last;
      // No name parsing needed — use values directly
    } else {
      const nameResult = parseName(getRawName(row));
      firstName = nameResult.firstName;
      lastName = nameResult.lastName;
      nameFlagged = nameResult.flagged;
      nameFlagReason = nameResult.flagReason;
    }

    const phoneResult = cleanPhone(getPhone(row));
    const contact: Contact = {
      'First Name': firstName,
      'Last Name': lastName,
      'Email Address': getEmail(row),
      'Phone Number': phoneResult.formatted,
    };
    if (nameFlagged || phoneResult.flagged) {
      const reasons: string[] = [];
      if (nameFlagged) reasons.push(nameFlagReason);
      if (phoneResult.flagged) reasons.push(phoneResult.flagReason);
      contact._flagReason = reasons.join('; ');
      flaggedList.push(contact);
    } else {
      clean.push(contact);
    }
  }

  stats.clean = clean.length;
  stats.flagged = flaggedList.length;
  return { clean, flagged: flaggedList, stats };
}

// Legacy wrapper for tests that call processCSV(text)
function processCSV(csvText: string): ProcessResult {
  const parsed = parseCSV(csvText);
  const fields = parsed.fields.map(f => f.trim());
  const detection = detectColumns(fields);
  if (!detection.mapping) {
    const missing: string[] = [];
    if (!detection.partial.mode) missing.push('Name (or First Name + Last Name)');
    if (!detection.partial.emailCol) missing.push('Email');
    if (!detection.partial.phoneCol) missing.push('Phone');
    return {
      clean: [], flagged: [],
      stats: { totalRows: parsed.data.length, afterNameFilter: 0, afterContactFilter: 0, afterDedup: 0, clean: 0, flagged: 0 },
      error: `Could not auto-detect column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Found columns: ${fields.slice(0, 10).join(', ')}${fields.length > 10 ? '...' : ''}`,
    };
  }
  return processCSVWithMapping(parsed.data, detection.mapping);
}

// ── CSV Generation & Download ──

function toCSV(contacts: Contact[], includeFlagReason: boolean): string {
  const cols = ['First Name', 'Last Name', 'Email Address', 'Phone Number'];
  if (includeFlagReason) cols.push('Flag Reason');
  const rows = contacts.map(c =>
    cols.map(col => {
      const val = col === 'Flag Reason' ? (c._flagReason || '') : ((c as unknown as Record<string, string>)[col] || '');
      return '"' + val.replace(/"/g, '""') + '"';
    }).join(',')
  );
  return cols.join(',') + '\n' + rows.join('\n');
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Tooltip Component (inline, matching site design) ──

function Tip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onEnter = () => { timer.current = setTimeout(() => setShow(true), 300); };
  const onLeave = () => { if (timer.current) clearTimeout(timer.current); setShow(false); };

  return (
    <span ref={ref} onMouseEnter={onEnter} onMouseLeave={onLeave} style={{ position: 'relative', display: 'inline-flex' }}>
      {children}
      {show && (
        <span style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: 8, backgroundColor: '#1e293b', color: '#f1f5f9',
          padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
          whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 50,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)', lineHeight: 1.4,
        }}>
          {text}
          <span style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            borderWidth: '5px 5px 0', borderStyle: 'solid',
            borderColor: '#1e293b transparent transparent transparent',
          }} />
        </span>
      )}
    </span>
  );
}

// ── Test Suite ──

interface TestLog { type: 'header' | 'pass' | 'fail'; text: string }

function runTests(): TestLog[] {
  const logs: TestLog[] = [];
  let pass = 0, fail = 0;

  function assert(name: string, actual: unknown, expected: unknown) {
    if (JSON.stringify(actual) === JSON.stringify(expected)) {
      pass++;
      logs.push({ type: 'pass', text: '  \u2713 ' + name });
    } else {
      fail++;
      logs.push({ type: 'fail', text: '  \u2717 ' + name + ' \u2014 expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual) });
    }
  }

  // Name parsing tests
  logs.push({ type: 'header', text: 'Name Parsing' });
  let r = parseName('John Smith');
  assert('Simple name', { f: r.firstName, l: r.lastName, fl: r.flagged }, { f: 'John', l: 'Smith', fl: false });

  r = parseName('Chase, Paulette, Silas Aguirre');
  assert('Family group - last segment', { f: r.firstName, l: r.lastName, fl: r.flagged }, { f: 'Silas', l: 'Aguirre', fl: false });

  r = parseName('Alex, Emma, Owen, Audrey Alcoff');
  assert('Large family group', { f: r.firstName, l: r.lastName, fl: r.flagged }, { f: 'Audrey', l: 'Alcoff', fl: false });

  r = parseName('Elizabeth Wollenhaupt-Nimirowski');
  assert('Hyphenated last name', { f: r.firstName, l: r.lastName, fl: r.flagged }, { f: 'Elizabeth', l: 'Wollenhaupt-Nimirowski', fl: false });

  r = parseName('Ivey Kyler, Isadora, Lawson');
  assert('Single-word last segment flagged', { f: r.firstName, fl: r.flagged }, { f: 'Lawson', fl: true });

  r = parseName('');
  assert('Empty name', { f: r.firstName, l: r.lastName }, { f: '', l: '' });

  r = parseName('  Jane   Doe  ');
  assert('Extra whitespace', { f: r.firstName, l: r.lastName }, { f: 'Jane', l: 'Doe' });

  r = parseName('Mary Jane Watson');
  assert('Three-word name', { f: r.firstName, l: r.lastName }, { f: 'Mary', l: 'Jane Watson' });

  r = parseName('Anjalise, Zaida, Lucy Dua-Zamorano');
  assert('Family with hyphenated surname', { f: r.firstName, l: r.lastName }, { f: 'Lucy', l: 'Dua-Zamorano' });

  // Phone cleaning tests
  logs.push({ type: 'header', text: 'Phone Cleaning' });
  let p = cleanPhone('+18604889185');
  assert('Standard +1 phone', { fmt: p.formatted, fl: p.flagged }, { fmt: '(860) 488-9185', fl: false });

  p = cleanPhone('+12032609496');
  assert('Another +1 phone', { fmt: p.formatted, fl: p.flagged }, { fmt: '(203) 260-9496', fl: false });

  p = cleanPhone('18604889185');
  assert('No plus, 11 digits with leading 1', { fmt: p.formatted, fl: p.flagged }, { fmt: '(860) 488-9185', fl: false });

  p = cleanPhone('8604889185');
  assert('10 digits, no country code', { fmt: p.formatted, fl: p.flagged }, { fmt: '(860) 488-9185', fl: false });

  p = cleanPhone('+4412345678');
  assert('Non-US number flagged', p.flagged, true);

  p = cleanPhone('');
  assert('Empty phone', { fmt: p.formatted, fl: p.flagged }, { fmt: '', fl: false });

  p = cleanPhone('123');
  assert('Short number flagged', p.flagged, true);

  // Deduplication tests
  logs.push({ type: 'header', text: 'Deduplication' });
  const testCSV = unparseCSV([
    { 'Billing Name': 'John Smith', 'Email': 'john@test.com', 'Phone': '+18001234567' },
    { 'Billing Name': 'John Smith', 'Email': 'JOHN@TEST.COM', 'Phone': '+18001234567' },
    { 'Billing Name': 'Jane Doe', 'Email': '', 'Phone': '+18009876543' },
    { 'Billing Name': 'Jane Again', 'Email': '', 'Phone': '+18009876543' },
    { 'Billing Name': 'A Customer', 'Email': 'skip@test.com', 'Phone': '+18001111111' },
    { 'Billing Name': 'No Contact', 'Email': '', 'Phone': '' },
  ]);
  const result = processCSV(testCSV);
  assert('Dedup by email (case-insensitive)', result.stats.clean + result.stats.flagged, 2);
  assert('A Customer filtered out', result.stats.afterNameFilter, 4);
  assert('No-contact filtered out', result.stats.afterContactFilter, 3);
  assert('Email dedup keeps first', result.clean[0]['First Name'], 'John');
  assert('Phone dedup for email-less', result.stats.afterDedup, 2);

  const testCSV2 = unparseCSV([
    { 'Billing Name': 'A One', 'Email': 'a@test.com', 'Phone': '+18001234567' },
    { 'Billing Name': 'B Two', 'Email': '', 'Phone': '+18001234567' },
  ]);
  const r2 = processCSV(testCSV2);
  assert('Same phone different email status = both kept', r2.stats.afterDedup, 2);

  // Column detection tests
  logs.push({ type: 'header', text: 'Column Detection' });

  let det = detectColumns(['Billing Name', 'Email', 'Phone']);
  assert('Shopify columns detected', det.mapping !== null, true);
  assert('Shopify mode = name', det.mapping?.mode, 'name');

  det = detectColumns(['First Name', 'Last Name', 'Email Address', 'Phone Number']);
  assert('First+Last columns detected', det.mapping !== null, true);
  assert('First+Last mode', det.mapping?.mode, 'first-last');

  det = detectColumns(['full name', 'e-mail', 'mobile']);
  assert('Aliases detected', det.mapping !== null, true);

  det = detectColumns(['Customer Name', 'Customer Email', 'Billing Phone']);
  assert('Mixed aliases detected', det.mapping !== null, true);

  det = detectColumns(['foo', 'bar', 'baz']);
  assert('Unknown columns not detected', det.mapping, null);

  // First+Last name processing test
  const firstLastCSV = unparseCSV([
    { 'First Name': 'John', 'Last Name': 'Smith', 'Email Address': 'john@test.com', 'Phone Number': '+18001234567' },
    { 'First Name': 'Jane', 'Last Name': 'Doe', 'Email Address': 'jane@test.com', 'Phone Number': '+18009876543' },
  ]);
  const flParsed = parseCSV(firstLastCSV);
  const flDet = detectColumns(flParsed.fields);
  assert('First+Last CSV auto-detected', flDet.mapping !== null, true);
  if (flDet.mapping) {
    const flResult = processCSVWithMapping(flParsed.data, flDet.mapping);
    assert('First+Last uses values directly', flResult.clean[0]['First Name'], 'John');
    assert('First+Last last name', flResult.clean[0]['Last Name'], 'Smith');
    assert('First+Last no flagging on names', flResult.stats.flagged, 0);
  }

  logs.push({ type: 'header', text: 'Results: ' + pass + ' passed, ' + fail + ' failed' });
  return logs;
}

// ── Column Mapping UI ──

function ColumnMappingUI({ fields, partial, onProcess }: {
  fields: string[];
  partial: Partial<ColumnMapping>;
  onProcess: (mapping: ColumnMapping) => void;
}) {
  const [nameMode, setNameMode] = useState<'name' | 'first-last'>(partial.mode || 'name');
  const [nameCol, setNameCol] = useState(partial.nameCol || '');
  const [firstNameCol, setFirstNameCol] = useState(partial.firstNameCol || '');
  const [lastNameCol, setLastNameCol] = useState(partial.lastNameCol || '');
  const [emailCol, setEmailCol] = useState(partial.emailCol || '');
  const [phoneCol, setPhoneCol] = useState(partial.phoneCol || '');

  const canProcess = nameMode === 'first-last'
    ? (firstNameCol && lastNameCol && emailCol && phoneCol)
    : (nameCol && emailCol && phoneCol);

  const handleProcess = () => {
    if (!canProcess) return;
    if (nameMode === 'first-last') {
      onProcess({ mode: 'first-last', firstNameCol, lastNameCol, emailCol, phoneCol });
    } else {
      onProcess({ mode: 'name', nameCol, emailCol, phoneCol });
    }
  };

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#374151',
    backgroundColor: '#fff', outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.8rem', fontWeight: 600, color: '#475569',
    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4,
  };

  return (
    <div style={{
      marginTop: 24, backgroundColor: '#fff', borderRadius: 12,
      border: '1px solid #E2E8F0', padding: '24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>
        Column Mapping
      </h2>
      <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 20, lineHeight: 1.5 }}>
        Some columns couldn&apos;t be auto-detected. Please map each field to a column in your CSV.
      </p>

      {/* Name mode toggle */}
      <div style={{ marginBottom: 16 }}>
        <div style={labelStyle}>Name Format</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            onClick={() => setNameMode('name')}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600,
              border: '1px solid #e2e8f0', cursor: 'pointer',
              backgroundColor: nameMode === 'name' ? '#3B82F6' : '#fff',
              color: nameMode === 'name' ? '#fff' : '#374151',
            }}
          >
            Single Name Column
          </button>
          <button
            onClick={() => setNameMode('first-last')}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600,
              border: '1px solid #e2e8f0', cursor: 'pointer',
              backgroundColor: nameMode === 'first-last' ? '#3B82F6' : '#fff',
              color: nameMode === 'first-last' ? '#fff' : '#374151',
            }}
          >
            First + Last Name
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {nameMode === 'name' ? (
          <div>
            <div style={labelStyle}>Name</div>
            <select value={nameCol} onChange={e => setNameCol(e.target.value)} style={selectStyle}>
              <option value="">-- Select column --</option>
              {fields.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        ) : (
          <>
            <div>
              <div style={labelStyle}>First Name</div>
              <select value={firstNameCol} onChange={e => setFirstNameCol(e.target.value)} style={selectStyle}>
                <option value="">-- Select column --</option>
                {fields.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <div style={labelStyle}>Last Name</div>
              <select value={lastNameCol} onChange={e => setLastNameCol(e.target.value)} style={selectStyle}>
                <option value="">-- Select column --</option>
                {fields.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </>
        )}
        <div>
          <div style={labelStyle}>Email</div>
          <select value={emailCol} onChange={e => setEmailCol(e.target.value)} style={selectStyle}>
            <option value="">-- Select column --</option>
            {fields.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <div style={labelStyle}>Phone</div>
          <select value={phoneCol} onChange={e => setPhoneCol(e.target.value)} style={selectStyle}>
            <option value="">-- Select column --</option>
            {fields.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      <button
        disabled={!canProcess}
        onClick={handleProcess}
        style={{
          marginTop: 20, padding: '10px 24px', borderRadius: 8, border: 'none',
          fontSize: '0.9rem', fontWeight: 600,
          cursor: canProcess ? 'pointer' : 'not-allowed',
          backgroundColor: '#3B82F6', color: '#fff',
          opacity: canProcess ? 1 : 0.5,
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={e => { if (canProcess) (e.target as HTMLElement).style.backgroundColor = '#2563EB'; }}
        onMouseLeave={e => { (e.target as HTMLElement).style.backgroundColor = '#3B82F6'; }}
      >
        Process CSV
      </button>
    </div>
  );
}

// ── Main Page Component ──

const ACCENT = '#1282a2';

export default function MailingListBuilderPage() {
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [testLogs, setTestLogs] = useState<TestLog[] | null>(null);
  const [showFlagged, setShowFlagged] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [detectedLabels, setDetectedLabels] = useState<Record<string, string> | null>(null);

  // Column mapping state
  const [pendingData, setPendingData] = useState<Record<string, string>[] | null>(null);
  const [pendingFields, setPendingFields] = useState<string[] | null>(null);
  const [pendingPartial, setPendingPartial] = useState<Partial<ColumnMapping> | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) { alert('Please upload a CSV file.'); return; }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      const fields = parsed.fields.map(f => f.trim());
      const detection = detectColumns(fields);

      // Reset state
      setTestLogs(null);
      setShowFlagged(false);
      setCurrentPage(1);
      setPendingData(null);
      setPendingFields(null);
      setPendingPartial(null);

      if (detection.mapping) {
        // All columns auto-detected
        setDetectedLabels(detection.detectedLabels);
        setResult(processCSVWithMapping(parsed.data, detection.mapping));
      } else {
        // Need manual mapping
        setDetectedLabels(null);
        setResult(null);
        setPendingData(parsed.data);
        setPendingFields(parsed.fields);
        setPendingPartial(detection.partial);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleManualMapping = useCallback((mapping: ColumnMapping) => {
    if (!pendingData) return;
    const labels: Record<string, string> = {};
    if (mapping.mode === 'first-last') {
      labels['First Name'] = mapping.firstNameCol!;
      labels['Last Name'] = mapping.lastNameCol!;
    } else {
      labels['Name'] = mapping.nameCol!;
    }
    labels['Email'] = mapping.emailCol;
    labels['Phone'] = mapping.phoneCol;
    setDetectedLabels(labels);
    setResult(processCSVWithMapping(pendingData, mapping));
    setPendingData(null);
    setPendingFields(null);
    setPendingPartial(null);
    setShowFlagged(false);
    setCurrentPage(1);
  }, [pendingData]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const onTitleClick = useCallback((e: React.MouseEvent) => {
    if (e.shiftKey) {
      setTestLogs(runTests());
      setResult(null);
      setPendingData(null);
      setPendingFields(null);
      setPendingPartial(null);
      setDetectedLabels(null);
    }
  }, []);

  const cols = ['First Name', 'Last Name', 'Email Address', 'Phone Number'] as const;
  const ROWS_PER_PAGE = 50;
  const allData = result ? (showFlagged ? result.flagged : result.clean) : [];
  const totalPages = Math.max(1, Math.ceil(allData.length / ROWS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const pageData = allData.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE);
  const rowOffset = (safePage - 1) * ROWS_PER_PAGE;
  const sectionLabel = showFlagged
    ? `Review Contacts (${result?.flagged.length ?? 0})`
    : `Review Contacts (${result?.clean.length ?? 0})`;

  return (
    <div style={{ paddingTop: 64, minHeight: '100vh', backgroundColor: '#F8FAFC', fontFamily: "'Montserrat', sans-serif" }}>
      {/* Breadcrumb */}
      <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 8, fontSize: 13, color: '#64748b' }}>
        <Link href="/" style={{ color: '#64748b', textDecoration: 'none' }}>Automation Lab</Link>
        <span>/</span>
        <Link href="/tools" style={{ color: '#64748b', textDecoration: 'none' }}>Tools</Link>
        <span>/</span>
        <span style={{ color: ACCENT }}>Mailing List Builder</span>
      </div>

      {/* Hero */}
      <div style={{ padding: '3rem 1.5rem 1.5rem', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          backgroundColor: `${ACCENT}14`, border: `1px solid ${ACCENT}40`,
          borderRadius: 100, padding: '4px 12px', marginBottom: '1rem',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: ACCENT, display: 'inline-block' }} />
          <span style={{ fontSize: 12, color: ACCENT, fontWeight: 600 }}>Live</span>
        </div>
        <h1
          onClick={onTitleClick}
          style={{ fontSize: 'clamp(1.6rem, 4vw, 2.5rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.5rem', color: '#1a1a2e', cursor: 'default', userSelect: 'none' }}
        >
          Mailing List Builder
        </h1>
        <p style={{ color: '#475569', fontSize: 15, lineHeight: 1.7, maxWidth: 600 }}>
          Convert any contact list CSV into a clean, deduplicated Constant Contact mailing list.
          Names are parsed, phones formatted, and duplicates removed — all in your browser.
        </p>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 1.5rem 5rem' }}>

        {/* Drop Zone */}
        <Tip text="Drop a CSV file here, or click to browse">
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            style={{
              border: `2px dashed ${dragOver ? ACCENT : '#E2E8F0'}`,
              borderRadius: 12, padding: '48px 24px', textAlign: 'center',
              cursor: 'pointer', transition: 'all 0.2s',
              backgroundColor: dragOver ? `${ACCENT}08` : '#ffffff',
              width: '100%',
            }}
          >
            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              {fileName ? `\u2713 ${fileName}` : 'Drop your CSV here'}
            </p>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
              {fileName ? 'Drop another file to re-process' : 'or click to browse — works with Shopify exports, Constant Contact lists, or any contact CSV'}
            </p>
          </div>
        </Tip>
        <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
          onChange={e => { if (e.target.files?.length) handleFile(e.target.files[0]); }} />

        {/* Column Mapping UI (when auto-detection incomplete) */}
        {pendingFields && pendingPartial && (
          <ColumnMappingUI
            fields={pendingFields}
            partial={pendingPartial}
            onProcess={handleManualMapping}
          />
        )}

        {/* Error */}
        {result?.error && (
          <div style={{
            marginTop: 24, backgroundColor: '#FEF2F2', border: '1px solid #FECACA',
            borderRadius: 12, padding: '16px 20px', display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 18 }}>X</span>
            <div>
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#991B1B', marginBottom: 4 }}>CSV Column Mismatch</p>
              <p style={{ fontSize: '0.82rem', color: '#B91C1C', lineHeight: 1.5 }}>{result.error}</p>
            </div>
          </div>
        )}

        {/* Auto-detection banner */}
        {result && !result.error && detectedLabels && (
          <div style={{
            marginTop: 24, backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD',
            borderRadius: 12, padding: '12px 16px',
            display: 'flex', gap: 8, alignItems: 'center',
            fontSize: '0.82rem', color: '#0369A1',
          }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>i</span>
            <span>
              Auto-detected columns: {Object.entries(detectedLabels).map(([field, col], i) => (
                <span key={field}>
                  {i > 0 && ', '}
                  {field} <span style={{ color: '#0284C7', fontWeight: 600 }}>&rarr;</span> {col}
                </span>
              ))}
            </span>
          </div>
        )}

        {/* Stats */}
        {result && !result.error && (
          <div style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>Processing Summary</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <StatCard label="Total Rows" value={result.stats.totalRows} tooltip="Total data rows in the uploaded CSV (excluding header)" />
              <StatCard label="After Name Filter" value={result.stats.afterNameFilter} tooltip="Rows remaining after removing empty names and 'A Customer'" />
              <StatCard label="After Contact Filter" value={result.stats.afterContactFilter} tooltip="Rows remaining after removing those with no email AND no phone" />
              <StatCard label="After Dedup" value={result.stats.afterDedup} tooltip="Unique contacts after deduplicating by email, then phone" />
              <StatCard label="Clean Contacts" value={result.stats.clean} color="#16a34a" tooltip="Contacts with valid names and phone numbers, ready for export" />
              <StatCard label="Flagged for Review" value={result.stats.flagged}
                color={result.stats.flagged > 0 ? '#d97706' : '#16a34a'}
                tooltip="Contacts with single-word names or non-standard phone numbers" />
            </div>
          </div>
        )}

        {/* Actions */}
        {result && !result.error && (
          <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
            <Tip text="Download clean contacts as CSV for Constant Contact import">
              <button
                disabled={result.clean.length === 0}
                onClick={() => downloadCSV(toCSV(result.clean, false), 'clean-contacts.csv')}
                style={{
                  padding: '10px 20px', borderRadius: 8, border: 'none',
                  fontSize: '0.9rem', fontWeight: 600, cursor: result.clean.length === 0 ? 'not-allowed' : 'pointer',
                  backgroundColor: '#3B82F6', color: '#fff',
                  opacity: result.clean.length === 0 ? 0.5 : 1,
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={e => { if (result.clean.length > 0) (e.target as HTMLElement).style.backgroundColor = '#2563EB'; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.backgroundColor = '#3B82F6'; }}
              >
                Download Clean CSV
              </button>
            </Tip>
            <Tip text="Download flagged contacts with reasons for manual review">
              <button
                disabled={result.flagged.length === 0}
                onClick={() => downloadCSV(toCSV(result.flagged, true), 'flagged-contacts.csv')}
                style={{
                  padding: '10px 20px', borderRadius: 8,
                  fontSize: '0.9rem', fontWeight: 600,
                  cursor: result.flagged.length === 0 ? 'not-allowed' : 'pointer',
                  backgroundColor: '#fff', color: '#0f172a',
                  border: '1px solid #e2e8f0',
                  opacity: result.flagged.length === 0 ? 0.5 : 1,
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={e => { if (result.flagged.length > 0) (e.target as HTMLElement).style.backgroundColor = '#f8fafc'; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.backgroundColor = '#fff'; }}
              >
                Download Flagged CSV
              </button>
            </Tip>
            {result.flagged.length > 0 && (
              <Tip text={showFlagged ? 'Switch to the clean contacts preview' : 'Switch to the flagged contacts preview'}>
                <button
                  onClick={() => { setShowFlagged(v => !v); setCurrentPage(1); }}
                  style={{
                    padding: '10px 20px', borderRadius: 8,
                    fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                    backgroundColor: '#fff', color: '#0f172a',
                    border: '1px solid #e2e8f0',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.backgroundColor = '#f8fafc'; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.backgroundColor = '#fff'; }}
                >
                  {showFlagged ? 'Show Clean' : 'Show Flagged'}
                </button>
              </Tip>
            )}
          </div>
        )}

        {/* Contact Table */}
        {result && !result.error && (
          <div style={{
            marginTop: 24, backgroundColor: '#fff', borderRadius: 12,
            border: '1px solid #E2E8F0', overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a1a2e' }}>{sectionLabel}</h2>
              {showFlagged && <span style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 600 }}>Flagged</span>}
            </div>
            {pageData.length === 0 ? (
              <p style={{ padding: 20, color: '#64748b' }}>No records</p>
            ) : (
              <>
                {/* Pagination — Top */}
                {totalPages > 1 && (
                  <PaginationBar safePage={safePage} totalPages={totalPages} setCurrentPage={setCurrentPage} border="bottom" />
                )}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                        <th style={thStyle} title="Row number">#</th>
                        {cols.map(c => (
                          <th key={c} style={thStyle} title={colTooltip(c)}>{c}</th>
                        ))}
                        {showFlagged && <th style={thStyle} title="Reason this contact was flagged for review">Flag Reason</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {pageData.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #E2E8F0', transition: 'background-color 0.1s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#f8fafc'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; }}
                        >
                          <td style={tdStyle}>{rowOffset + i + 1}</td>
                          {cols.map(c => <td key={c} style={tdStyle}>{(row as unknown as Record<string, string>)[c] || '\u2014'}</td>)}
                          {showFlagged && (
                            <td style={{ ...tdStyle, color: '#d97706', fontSize: '0.8rem', whiteSpace: 'normal', maxWidth: 300 }}>
                              {row._flagReason}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Pagination — Bottom */}
                {totalPages > 1 && (
                  <PaginationBar safePage={safePage} totalPages={totalPages} setCurrentPage={setCurrentPage} border="top" />
                )}
              </>
            )}
          </div>
        )}

        {/* Flagged warning */}
        {result && result.flagged.length > 0 && !showFlagged && (
          <div style={{
            marginTop: 16, backgroundColor: '#FFFBEB', border: '1px solid #FDE68A',
            borderRadius: 12, padding: '16px 20px',
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 18 }}>!</span>
            <div>
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#92400E', marginBottom: 4 }}>
                {result.flagged.length} contact{result.flagged.length !== 1 ? 's' : ''} flagged for review
              </p>
              <p style={{ fontSize: '0.82rem', color: '#A16207', lineHeight: 1.5 }}>
                These have single-word name segments or non-standard phone numbers. Click &quot;Show Flagged&quot; to preview, or download the flagged CSV for manual review.
              </p>
            </div>
          </div>
        )}

        {/* Test Results */}
        {testLogs && (
          <div style={{
            marginTop: 24, backgroundColor: '#fff', border: '1px solid #E2E8F0',
            borderRadius: 12, padding: '20px 24px', fontFamily: 'monospace', fontSize: '0.82rem',
            maxHeight: 400, overflowY: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a1a2e', marginBottom: 12, fontFamily: "'Montserrat', sans-serif" }}>
              Test Results
            </h2>
            {testLogs.map((log, i) => (
              <div key={i} style={{
                color: log.type === 'pass' ? '#16a34a' : log.type === 'fail' ? '#dc2626' : '#3B82F6',
                fontWeight: log.type === 'header' ? 700 : 400,
                marginTop: log.type === 'header' && i > 0 ? 12 : 0,
                whiteSpace: 'pre-wrap',
              }}>
                {log.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared styles ──

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '10px 20px',
  fontSize: '0.75rem', fontWeight: 600,
  color: '#475569', textTransform: 'uppercase',
  letterSpacing: '0.05em', whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 20px', whiteSpace: 'nowrap', color: '#374151',
};

function paginationBtnStyle(active: boolean, disabled: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: '1px solid #e2e8f0',
    backgroundColor: active ? '#3B82F6' : '#fff',
    color: active ? '#fff' : disabled ? '#94a3b8' : '#374151',
    opacity: disabled ? 0.6 : 1,
    transition: 'background-color 0.15s',
  };
}

function getPaginationPages(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('...');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push('...');
  pages.push(total);
  return pages;
}

function PaginationBar({ safePage, totalPages, setCurrentPage, border }: {
  safePage: number; totalPages: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  border: 'top' | 'bottom';
}) {
  return (
    <div
      title="Browse all contacts before downloading"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 6, padding: '12px 20px',
        borderTop: border === 'top' ? '1px solid #E2E8F0' : undefined,
        borderBottom: border === 'bottom' ? '1px solid #E2E8F0' : undefined,
        flexWrap: 'wrap',
      }}
    >
      <button disabled={safePage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} style={paginationBtnStyle(false, safePage <= 1)}>Previous</button>
      {getPaginationPages(safePage, totalPages).map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} style={{ padding: '0 4px', color: '#94a3b8', fontSize: '0.85rem' }}>...</span>
        ) : (
          <button key={p} onClick={() => setCurrentPage(p as number)} style={paginationBtnStyle(safePage === p, false)}>{p}</button>
        )
      )}
      <button disabled={safePage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} style={paginationBtnStyle(false, safePage >= totalPages)}>Next</button>
      <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: 8 }}>Page {safePage} of {totalPages}</span>
    </div>
  );
}

function colTooltip(col: string): string {
  switch (col) {
    case 'First Name': return 'Parsed from the last comma-separated segment of Billing Name';
    case 'Last Name': return 'Remaining words after first name in the name segment';
    case 'Email Address': return 'Email from the CSV, used for primary deduplication';
    case 'Phone Number': return 'Formatted as (XXX) XXX-XXXX after stripping country code';
    default: return col;
  }
}

function StatCard({ label, value, color, tooltip }: { label: string; value: number; color?: string; tooltip: string }) {
  return (
    <Tip text={tooltip}>
      <div style={{
        backgroundColor: '#fff', borderRadius: 12, border: '1px solid #E2E8F0',
        padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', width: '100%',
      }}>
        <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
          {label}
        </div>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: 2, color: color || '#1a1a2e', fontVariantNumeric: 'tabular-nums' }}>
          {value.toLocaleString()}
        </div>
      </div>
    </Tip>
  );
}
