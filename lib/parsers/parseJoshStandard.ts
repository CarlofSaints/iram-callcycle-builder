import * as XLSX from 'xlsx';
import { ParsedEntry } from '../types';
import { ReferenceData } from '../types';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function extractStoreCode(storeStr: string): { storeName: string; storeCode: string } {
  const trimmed = storeStr.trim();
  // Format: "Store Name - Store Code" or "Store Name - CODE"
  const dashIdx = trimmed.lastIndexOf(' - ');
  if (dashIdx > 0) {
    const storeName = trimmed.substring(0, dashIdx).trim();
    const storeCode = trimmed.substring(dashIdx + 3).trim();
    return { storeName, storeCode };
  }
  return { storeName: trimmed, storeCode: '' };
}

export function parseJoshStandard(workbook: XLSX.WorkBook, references: ReferenceData): { entries: ParsedEntry[]; warnings: string[] } {
  const entries: ParsedEntry[] = [];
  const warnings: string[] = [];

  // Build email lookup from reference data (name -> email)
  const emailLookup = new Map<string, { email: string; firstName: string; surname: string }>();
  for (const u of references.users) {
    const fullName = `${u.firstName} ${u.surname}`.toLowerCase();
    emailLookup.set(fullName, { email: u.userEmail, firstName: u.firstName, surname: u.surname });
    // Also try first name only
    emailLookup.set(u.firstName.toLowerCase(), { email: u.userEmail, firstName: u.firstName, surname: u.surname });
  }

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const data = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1 });
    if (data.length < 4) continue;

    // Sheet name is the person's name
    const personName = sheetName.trim();
    const ref = emailLookup.get(personName.toLowerCase());
    const userEmail = ref?.email || '';
    const firstName = ref?.firstName || personName;
    const surname = ref?.surname || '';

    if (!userEmail) {
      warnings.push(`Could not find email for "${personName}" (sheet: ${sheetName})`);
    }

    // Find day column positions from row 3 (index 2)
    const dayRow = (data[2] || []).map(c => String(c || '').toLowerCase().trim());
    const dayColumns: { col: number; day: string }[] = [];
    for (let col = 0; col < dayRow.length; col++) {
      const cell = dayRow[col];
      for (const d of DAYS) {
        if (cell.startsWith(d.substring(0, 3))) {
          dayColumns.push({ col, day: d.charAt(0).toUpperCase() + d.slice(1) });
          break;
        }
      }
    }

    // Parse week sections
    // Row 2 (index 1) contains cycle info like "Name week 1&3"
    let currentCycle = 'Week 1&3';
    let inBlock = false;

    for (let rowIdx = 1; rowIdx < data.length; rowIdx++) {
      const row = data[rowIdx] || [];
      const firstCell = String(row[0] || '').trim().toLowerCase();

      // Check if this is a cycle header row
      if (firstCell.includes('week')) {
        if (firstCell.includes('2') && firstCell.includes('4')) {
          currentCycle = 'Week 2&4';
        } else if (firstCell.includes('1') && firstCell.includes('3')) {
          currentCycle = 'Week 1&3';
        }
        inBlock = true;
        continue;
      }

      // Check if this is the day header row
      const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');
      if (rowStr.includes('monday') || rowStr.includes('mon')) {
        inBlock = true;
        continue;
      }

      if (!inBlock) continue;

      // Parse store entries from each day column
      for (const { col, day } of dayColumns) {
        const cellValue = String(row[col] || '').trim();
        if (!cellValue || cellValue.toLowerCase() === 'off' || cellValue === '-') continue;

        const { storeName, storeCode } = extractStoreCode(cellValue);
        if (!storeName) continue;

        // Check if we already have this user+store+cycle, if so add the day
        const existing = entries.find(e =>
          e.userEmail === userEmail &&
          e.storeId === storeCode &&
          e.cycle === currentCycle
        );

        if (existing) {
          if (!existing.days.includes(day)) {
            existing.days.push(day);
          }
        } else {
          entries.push({
            userEmail: userEmail || `unknown_${personName.replace(/\s/g, '_')}`,
            firstName,
            surname,
            storeId: storeCode,
            storeName,
            cycle: currentCycle,
            days: [day],
          });
        }
      }
    }
  }

  return { entries, warnings };
}
