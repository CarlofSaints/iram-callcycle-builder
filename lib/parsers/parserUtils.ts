import { ParsedEntry } from '../types';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAYS_SHORT = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** Find day-of-week column positions in a row */
export function findDayColumns(row: (string | number | null)[]): { col: number; day: string }[] {
  const cols: { col: number; day: string }[] = [];
  for (let col = 0; col < row.length; col++) {
    const cell = String(row[col] || '').toLowerCase().trim();
    if (!cell) continue;
    for (let i = 0; i < DAYS.length; i++) {
      if (cell.startsWith(DAYS_SHORT[i])) {
        cols.push({ col, day: DAYS[i].charAt(0).toUpperCase() + DAYS[i].slice(1) });
        break;
      }
    }
  }
  return cols;
}

/** Scan first N rows to find the day-header row */
export function findDayHeaderRow(
  data: (string | number | null)[][],
  maxRows = 5,
  minDays = 3,
): { dayColumns: { col: number; day: string }[]; dayRowIdx: number } | null {
  for (let r = 0; r < Math.min(maxRows, data.length); r++) {
    const cols = findDayColumns(data[r] || []);
    if (cols.length >= minDays) {
      return { dayColumns: cols, dayRowIdx: r };
    }
  }
  return null;
}

/** Extract store code from "Store Name - CODE" format */
export function extractStoreCode(storeStr: string): { storeName: string; storeCode: string } {
  const trimmed = storeStr.trim()
    .replace(/\u00a0/g, ' ')   // non-breaking space
    .replace(/\u2013/g, '-')   // en-dash
    .replace(/\u2014/g, '-');  // em-dash

  // Look for " - CODE" pattern at the end
  const dashIdx = trimmed.lastIndexOf(' - ');
  if (dashIdx > 0) {
    const storeName = trimmed.substring(0, dashIdx).trim();
    const storeCode = trimmed.substring(dashIdx + 3).trim();
    return { storeName, storeCode };
  }

  // Try "NAME-CODE" pattern (e.g. "BWH HELDERBERG-B43")
  const hyphenMatch = trimmed.match(/^(.+?)-([A-Z0-9][A-Z0-9-]*)$/i);
  if (hyphenMatch && hyphenMatch[2].length <= 15) {
    return { storeName: hyphenMatch[1].trim(), storeCode: hyphenMatch[2].trim() };
  }

  return { storeName: trimmed, storeCode: '' };
}

/** Check if cell value looks like a store entry (not empty, not "off", not a header) */
export function isStoreCell(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v || v === 'off' || v === '-' || v === 'n/a') return false;
  // Skip cells that look like notes/headers
  if (v.startsWith('week ') || v.startsWith('first ')) return false;
  if (v === 'training' || v.startsWith('travelling') || v.startsWith('travel ')) return false;
  // Must have at least 3 chars to be a real store
  if (v.length < 3) return false;
  return true;
}

/** Add entry to entries array, merging days if same user+store+cycle already exists */
export function addOrMergeEntry(
  entries: ParsedEntry[],
  entry: Omit<ParsedEntry, 'days'> & { day: string },
): void {
  const existing = entries.find(e =>
    e.userEmail.toLowerCase() === entry.userEmail.toLowerCase() &&
    e.storeId.toUpperCase() === entry.storeId.toUpperCase() &&
    e.storeName.toLowerCase() === entry.storeName.toLowerCase() &&
    e.cycle === entry.cycle
  );

  if (existing) {
    if (!existing.days.includes(entry.day)) {
      existing.days.push(entry.day);
    }
  } else {
    entries.push({
      userEmail: entry.userEmail,
      firstName: entry.firstName,
      surname: entry.surname,
      storeId: entry.storeId,
      storeName: entry.storeName,
      cycle: entry.cycle,
      days: [entry.day],
    });
  }
}

/** Detect cycle from text containing "week" info */
export function detectCycleFromText(text: string): string | null {
  const lc = text.toLowerCase();
  if (!lc.includes('week')) return null;
  if (lc.includes('2') && lc.includes('4')) return 'Week 2&4';
  if (lc.includes('1') && lc.includes('3')) return 'Week 1&3';
  if (lc.includes('1') && !lc.includes('2')) return 'Week 1&3';
  if (lc.includes('2') && !lc.includes('1')) return 'Week 2&4';
  return null;
}
