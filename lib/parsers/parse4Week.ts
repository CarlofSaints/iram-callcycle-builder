import * as XLSX from 'xlsx';
import { ParsedEntry, ReferenceData } from '../types';
import {
  findDayHeaderRow, extractStoreCode, isStoreCell, addOrMergeEntry,
} from './parserUtils';

/**
 * User Sheets 4wk format: one sheet per user, 4 individual week blocks stacked
 * vertically. Sheet name MUST be the user's Perigee email address.
 *
 * Layout (example — MT February Call Cycle 2026.xlsx):
 *   Row 0     "WEEK: 1,2" general banner (ignored)
 *   Row 1     <email> | ROLE | CELL | ADDRESS
 *   Row 2     MONDAY | TUESDAY | ... | SATURDAY | NO OF CALLS PER WEEK
 *   Row 3–10  "WEEK 1" merged in col A + store cells in cols B–G
 *   Row 11–18 "WEEK 2" merged in col A + stores
 *   Row 19–26 "WEEK 3" merged in col A + stores
 *   Row 27–34 "WEEK 4" merged in col A + stores
 *
 * Column A holds the merged "WEEK N" marker (only populated on the first row
 * of the block). Columns B–G are the six day columns. Column H onwards is
 * ignored — it holds a "no of calls" column and a channel legend.
 *
 * Output cycle starts per individual week ("Week 1" / "Week 2" / ...) then
 * a post-process pass merges rows that share the same (userEmail, storeId,
 * day-pattern) into a single row whose cycle string joins all matching weeks
 * with `&` — e.g. a Norwood store visited every Monday in weeks 1–4 becomes
 * ONE row with cycle "Week 1&2&3&4" instead of four separate rows. This
 * matches the Josh ALT convention ("Week 1&3" / "Week 2&4") and the download
 * route's parseCycleWeeks() regex handles arbitrary digit sets cleanly.
 *
 * Non-email sheets (e.g. a "REP INFO" tab) are skipped silently-with-warning.
 */
export function parse4Week(
  workbook: XLSX.WorkBook,
  references: ReferenceData,
): { entries: ParsedEntry[]; warnings: string[] } {
  const entries: ParsedEntry[] = [];
  const warnings: string[] = [];

  // Build name/email lookup from reference data so we can populate
  // firstName + surname on the parsed entries.
  const refLookup = new Map<string, { firstName: string; surname: string }>();
  for (const u of references.users) {
    refLookup.set(u.userEmail.toLowerCase().trim(), {
      firstName: u.firstName,
      surname: u.surname,
    });
  }

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // Only process sheets named after an email address. Anything else (e.g.
    // "REP INFO") is a legend tab that should be ignored with a warning.
    const trimmed = sheetName.trim();
    if (!trimmed.includes('@')) {
      warnings.push(`Sheet "${sheetName}" skipped — sheet name is not an email address.`);
      continue;
    }

    const sheetEmail = trimmed.toLowerCase();
    const ref = refLookup.get(sheetEmail);
    const localPart = sheetEmail.split('@')[0];
    const firstName = ref?.firstName || localPart;
    const surname = ref?.surname || '';

    const data = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      defval: '',
    });
    if (data.length < 4) {
      warnings.push(`Sheet "${sheetName}" has too few rows to contain a 4-week block.`);
      continue;
    }

    // Find the day-of-week header row. Scan the first 10 rows because the
    // layout can have a banner, an email/role row, and then the day headers.
    const dayResult = findDayHeaderRow(data, 10);
    if (!dayResult) {
      warnings.push(`No day columns found in sheet "${sheetName}"`);
      continue;
    }

    // Constraint: only look at day columns in A–G (0–6). Everything from col H
    // onwards on this format is a "calls" count + channel legend and must be
    // ignored — e.g. a "STORE NAME" header in col I would otherwise register
    // as a misspelled day of the week.
    const dayColumns = dayResult.dayColumns.filter(c => c.col <= 6);
    if (dayColumns.length < 3) {
      warnings.push(`Sheet "${sheetName}" has too few day columns (A–G) to parse.`);
      continue;
    }

    let currentWeek: number | null = null;
    let foundAnyWeek = false;

    for (let rowIdx = dayResult.dayRowIdx + 1; rowIdx < data.length; rowIdx++) {
      const row = data[rowIdx] || [];

      // Column A — week marker (merged cell, only populated on the block's
      // first row). Matches "WEEK 1", "Week: 2", "week 03", etc.
      //
      // IMPORTANT: after detecting the week marker we must NOT `continue` —
      // the same row contains the first line of store data for that week
      // (e.g. row 3 in MT's file has "WEEK 1" in col A AND "PNP NORWOOD - HC05"
      // in col B). Fall through to the store-cell loop below.
      const colAStr = String(row[0] || '').trim();
      if (colAStr) {
        const weekMatch = colAStr.match(/week\s*[:\s]*\s*(\d+)/i);
        if (weekMatch) {
          const weekNum = Number(weekMatch[1]);
          if (weekNum < 1 || weekNum > 6) {
            warnings.push(`Sheet "${sheetName}" row ${rowIdx + 1}: unexpected week number "${colAStr}"`);
            currentWeek = null;
            continue;
          }
          currentWeek = weekNum;
          foundAnyWeek = true;
          // fall through — row may also contain store data in cols B–G
        }
      }

      // Skip rows until we've seen at least one WEEK marker — prevents us
      // picking up stray store cells from garbage rows above the first block.
      if (currentWeek === null) continue;

      const cycleLabel = `Week ${currentWeek}`;

      for (const { col, day } of dayColumns) {
        const cellValue = String(row[col] || '').trim();
        if (!isStoreCell(cellValue)) continue;

        const { storeName, storeCode } = extractStoreCode(cellValue);
        if (!storeName) continue;

        addOrMergeEntry(entries, {
          userEmail: sheetEmail,
          firstName,
          surname,
          storeId: storeCode,
          storeName,
          cycle: cycleLabel,
          day,
        });
      }
    }

    if (!foundAnyWeek) {
      warnings.push(`Sheet "${sheetName}" has no "WEEK N" markers in column A — no entries parsed.`);
    }
  }

  return { entries: mergeSameDayPatternWeeks(entries), warnings };
}

/**
 * Post-process: collapse rows with identical (userEmail, storeId, day-pattern)
 * across different weeks into a single row whose cycle string joins the weeks
 * with `&`. Single-week rows and rows with unique day patterns pass through
 * unchanged.
 *
 * Example input:
 *   { ..., storeId: S009, cycle: "Week 1", days: [Mon] }
 *   { ..., storeId: S009, cycle: "Week 2", days: [Mon] }
 *   { ..., storeId: S009, cycle: "Week 3", days: [Mon] }
 *   { ..., storeId: S009, cycle: "Week 4", days: [Mon] }
 * Example output:
 *   { ..., storeId: S009, cycle: "Week 1&2&3&4", days: [Mon] }
 */
function mergeSameDayPatternWeeks(entries: ParsedEntry[]): ParsedEntry[] {
  const groups = new Map<string, ParsedEntry[]>();
  for (const e of entries) {
    const daysKey = [...e.days].sort().join('|');
    const key = `${e.userEmail.toLowerCase()}__${e.storeId.toUpperCase()}__${daysKey}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(e);
    else groups.set(key, [e]);
  }

  const merged: ParsedEntry[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }
    // Union all week numbers across the group
    const weekSet = new Set<number>();
    for (const e of group) {
      const nums = e.cycle.match(/\d+/g);
      if (nums) for (const n of nums) weekSet.add(Number(n));
    }
    const sortedWeeks = [...weekSet].sort((a, b) => a - b);
    const cycle = sortedWeeks.length > 0 ? `Week ${sortedWeeks.join('&')}` : group[0].cycle;
    merged.push({ ...group[0], cycle });
  }
  return merged;
}
