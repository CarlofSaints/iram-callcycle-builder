import * as XLSX from 'xlsx';
import { ParsedEntry, ReferenceData } from '../types';
import { findDayHeaderRow, extractStoreCode, isStoreCell, addOrMergeEntry, detectCycleFromText, findDayColumns } from './parserUtils';

/**
 * Email-sheet format: Sheet names are email addresses (e.g. "ntethelelo@iram.co.za").
 * Some sheets may still be named by person name (mixed file like Lucky 2026).
 * Day headers in early rows, stores below. May have week sections.
 */
export function parseEmailSheet(workbook: XLSX.WorkBook, references: ReferenceData): { entries: ParsedEntry[]; warnings: string[] } {
  const entries: ParsedEntry[] = [];
  const warnings: string[] = [];

  // Build email lookup from reference data
  const emailLookup = new Map<string, { email: string; firstName: string; surname: string }>();
  for (const u of references.users) {
    const fullName = `${u.firstName} ${u.surname}`.toLowerCase().trim();
    emailLookup.set(fullName, { email: u.userEmail, firstName: u.firstName, surname: u.surname });
    emailLookup.set(u.firstName.toLowerCase().trim(), { email: u.userEmail, firstName: u.firstName, surname: u.surname });
    emailLookup.set(u.userEmail.toLowerCase().trim(), { email: u.userEmail, firstName: u.firstName, surname: u.surname });
  }

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const data = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1 });
    if (data.length < 2) continue;

    let userEmail = '';
    let firstName = '';
    let surname = '';

    if (sheetName.includes('@')) {
      // Sheet name IS the email
      userEmail = sheetName.trim().toLowerCase();
      const ref = emailLookup.get(userEmail);
      firstName = ref?.firstName || sheetName.split('@')[0];
      surname = ref?.surname || '';
    } else {
      // Named sheet — look up in reference data
      const personName = sheetName.trim();
      if (personName.toLowerCase() === 'blank') continue;
      const ref = emailLookup.get(personName.toLowerCase());
      userEmail = ref?.email || '';
      firstName = ref?.firstName || personName.split(/\s+/)[0] || personName;
      surname = ref?.surname || personName.split(/\s+/).slice(1).join(' ') || '';
      if (!userEmail) {
        warnings.push(`Sheet "${sheetName}" will not be loaded — no email address found. Label the sheet with the user's Perigee email address or add an "Email:" marker above each cycle table.`);
        continue;
      }
    }

    // Find day header row
    const dayResult = findDayHeaderRow(data, 5);
    if (!dayResult) {
      warnings.push(`No day columns found in sheet "${sheetName}"`);
      continue;
    }
    const { dayColumns, dayRowIdx } = dayResult;

    // Check for cycle info in rows before the day headers
    let currentCycle = 'Week 1&3';
    for (let r = 0; r < dayRowIdx; r++) {
      const rowText = (data[r] || []).map(c => String(c || '').trim()).join(' ');
      const detected = detectCycleFromText(rowText);
      if (detected) {
        currentCycle = detected;
        break;
      }
    }

    // Parse stores
    let currentDayColumns = dayColumns;
    for (let rowIdx = dayRowIdx + 1; rowIdx < data.length; rowIdx++) {
      const row = data[rowIdx] || [];
      const rowStrs = row.map(c => String(c || '').trim());
      const rowJoined = rowStrs.join(' ');

      // Check for cycle switch
      const newCycle = detectCycleFromText(rowJoined);
      if (newCycle) {
        currentCycle = newCycle;
        continue;
      }

      // Check if this is another day header row
      const dayCols = findDayColumns(row);
      if (dayCols.length >= 3) {
        currentDayColumns = dayCols;
        continue;
      }

      // Skip empty rows
      if (rowStrs.every(s => !s)) continue;

      // Parse store entries
      for (const { col, day } of currentDayColumns) {
        const cellValue = String(row[col] || '').trim();
        if (!isStoreCell(cellValue)) continue;

        const { storeName, storeCode } = extractStoreCode(cellValue);
        if (!storeName) continue;

        addOrMergeEntry(entries, {
          userEmail: userEmail,
          firstName,
          surname,
          storeId: storeCode,
          storeName,
          cycle: currentCycle,
          day,
        });
      }
    }
  }

  return { entries, warnings };
}
