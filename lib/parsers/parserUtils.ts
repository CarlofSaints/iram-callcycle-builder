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

/**
 * Check if a string looks like a Perigee store code.
 * Codes are short alphanumeric tokens like: GC86, G016, CH-42703, B43, S61,
 * NF23, KC03, M23L, UL34, BC84, C-243, CCW532, HC08, CH-55021, NC53, NF51
 * Pattern: 1-5 letters followed by optional hyphen + digits, total ~2-12 chars
 */
function looksLikeStoreCode(s: string): boolean {
  const t = s.trim();
  if (t.length < 1 || t.length > 15) return false;
  // Must not contain spaces (codes are single tokens)
  if (t.includes(' ')) return false;
  // Must contain at least one digit
  if (!/\d/.test(t)) return false;
  // Must start with a letter or digit
  if (!/^[A-Za-z0-9]/.test(t)) return false;
  // General pattern: letters, optional hyphen, digits (or mixed)
  return /^[A-Za-z]{1,5}-?[A-Za-z0-9-]*\d[A-Za-z0-9-]*$/.test(t);
}

/** Extract store code from various formats:
 *  - "STORE NAME - CODE"          (e.g. "GAME KLERKSDORP - G016")
 *  - "STORE NAME [CODE] - CODE"   (e.g. "PICK N PAY - CORPORATE MATLOSANA MALL [GC86] - GC86")
 *  - "STORE NAME [CODE]"          (e.g. "PICK N PAY - HYPER FAERIE GLEN [HC10]")
 *  - "STORE NAME CODE"            (e.g. "PICK N PAY - CORPORATE MATLOSANA MALL GC86")
 *  - "NAME-CODE"                  (e.g. "BWH HELDERBERG-B43")
 */
export function extractStoreCode(storeStr: string): { storeName: string; storeCode: string } {
  const trimmed = storeStr.trim()
    .replace(/\u00a0/g, ' ')   // non-breaking space
    .replace(/\u2013/g, '-')   // en-dash
    .replace(/\u2014/g, '-');  // em-dash

  // 1. Check for [CODE] bracket pattern first
  const bracketMatch = trimmed.match(/^(.+?)\s*\[([A-Za-z0-9-]+)\](.*)$/);
  if (bracketMatch) {
    const code = bracketMatch[2].trim();
    if (looksLikeStoreCode(code)) {
      // Store name is everything before the bracket (may include " - QUALIFIER")
      const namePart = bracketMatch[1].trim();
      // Remove trailing " - CODE" after the bracket if present
      return { storeName: namePart, storeCode: code };
    }
  }

  // 2. Split on last " - " (spaced dash) and check if right side is a valid code
  const dashIdx = trimmed.lastIndexOf(' - ');
  if (dashIdx > 0) {
    const rightSide = trimmed.substring(dashIdx + 3).trim();
    if (looksLikeStoreCode(rightSide)) {
      return {
        storeName: trimmed.substring(0, dashIdx).trim(),
        storeCode: rightSide,
      };
    }
    // Right side is NOT a code (e.g. "PICK N PAY - CORPORATE MATLOSANA MALL GC86")
    // Fall through to check other patterns
  }

  // 3. Split on last hyphen (no spaces around it) — e.g. "BWH ERASMUS PARK-B206" → code "B206"
  //    Must come BEFORE trailing-word check to avoid "PARK-B206" being treated as a single code.
  const lastHyphen = trimmed.lastIndexOf('-');
  if (lastHyphen > 0 && (dashIdx < 0 || lastHyphen !== dashIdx + 1)) {
    const rightOfHyphen = trimmed.substring(lastHyphen + 1).trim();
    if (rightOfHyphen && !rightOfHyphen.includes(' ') && looksLikeStoreCode(rightOfHyphen)) {
      return {
        storeName: trimmed.substring(0, lastHyphen).trim(),
        storeCode: rightOfHyphen,
      };
    }
  }

  // 4. Check for trailing code as last word (e.g. "...MATLOSANA MALL GC86")
  const lastSpaceIdx = trimmed.lastIndexOf(' ');
  if (lastSpaceIdx > 0) {
    const lastWord = trimmed.substring(lastSpaceIdx + 1).trim();
    if (looksLikeStoreCode(lastWord)) {
      return {
        storeName: trimmed.substring(0, lastSpaceIdx).trim(),
        storeCode: lastWord,
      };
    }
  }

  // 5. No code found
  return { storeName: trimmed, storeCode: '' };
}

/** Check if cell value looks like a store entry (not empty, not "off", not a header) */
export function isStoreCell(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v || v === 'off' || v === '-' || v === 'n/a') return false;
  // Skip cells that look like notes/headers/non-store labels
  if (v.startsWith('week ') || v.startsWith('week:') || v.startsWith('first ')) return false;
  if (v.startsWith('email:') || v.startsWith('email ')) return false;
  if (v === 'training' || v.startsWith('travelling') || v.startsWith('travel ')) return false;
  if (v === 'trade visit' || v.startsWith('trade visit')) return false;
  if (v === 't & a' || v === 't&a' || v === 'ta') return false;
  if (v === 'missed stores' || v.startsWith('missed stores')) return false;
  if (v === 'monday' || v === 'tuesday' || v === 'wednesday' || v === 'thursday' || v === 'friday' || v === 'saturday' || v === 'sunday') return false;
  // Must have at least 3 chars to be a real store
  if (v.length < 3) return false;
  return true;
}

const DAY_ORDER: Record<string, number> = {
  Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5,
};

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
      existing.days.sort((a, b) => (DAY_ORDER[a] ?? 6) - (DAY_ORDER[b] ?? 6));
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
  // Handle "Week: 1,3" / "Week: 2,4" comma format (from markers)
  const commaMatch = lc.match(/week[:\s]*(\d)[,\s&]+(\d)/);
  if (commaMatch) {
    const a = commaMatch[1], b = commaMatch[2];
    if ((a === '2' && b === '4') || (a === '4' && b === '2')) return 'Week 2&4';
    if ((a === '1' && b === '3') || (a === '3' && b === '1')) return 'Week 1&3';
  }
  if (lc.includes('2') && lc.includes('4')) return 'Week 2&4';
  if (lc.includes('1') && lc.includes('3')) return 'Week 1&3';
  if (lc.includes('1') && !lc.includes('2')) return 'Week 1&3';
  if (lc.includes('2') && !lc.includes('1')) return 'Week 2&4';
  return null;
}

/** Extract email from an "Email:" marker cell (or joined row). Returns email or null. */
export function extractEmailFromMarker(text: string): string | null {
  const match = text.match(/email[:\s]+\s*(\S+@\S+)/i);
  return match ? match[1].trim().toLowerCase() : null;
}

/** Extract week cycle from a "Week:" marker cell (or joined row). Returns normalized cycle or null. */
export function extractWeekFromMarker(text: string): string | null {
  const match = text.match(/week[:\s]+\s*(\d)[,\s&]+(\d)/i);
  if (!match) return null;
  const a = match[1], b = match[2];
  if ((a === '2' && b === '4') || (a === '4' && b === '2')) return 'Week 2&4';
  if ((a === '1' && b === '3') || (a === '3' && b === '1')) return 'Week 1&3';
  return null;
}

/**
 * Scan a full row for markers where label and value may be in separate cells.
 * E.g. A1="WEEK:", C1="1,3" or A2="EMAIL:", C2="user@iram.co.za"
 * Returns { email, week } with found values or null.
 */
export function extractMarkersFromRow(row: (string | number | null)[]): { email: string | null; week: string | null } {
  const cells = row.map(c => String(c || '').trim());
  const joined = cells.join(' ');

  // Try joined string first (handles both same-cell and split-cell markers)
  const email = extractEmailFromMarker(joined);
  const week = extractWeekFromMarker(joined);

  return { email, week };
}
