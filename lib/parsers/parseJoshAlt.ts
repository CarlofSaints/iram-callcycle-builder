import * as XLSX from 'xlsx';
import { ParsedEntry } from '../types';
import { ReferenceData } from '../types';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function extractStoreCode(storeStr: string): { storeName: string; storeCode: string } {
  const trimmed = storeStr.trim();
  const dashIdx = trimmed.lastIndexOf(' - ');
  if (dashIdx > 0) {
    const storeName = trimmed.substring(0, dashIdx).trim();
    const storeCode = trimmed.substring(dashIdx + 3).trim();
    return { storeName, storeCode };
  }
  return { storeName: trimmed, storeCode: '' };
}

export function parseJoshAlt(workbook: XLSX.WorkBook, references: ReferenceData): { entries: ParsedEntry[]; warnings: string[] } {
  const entries: ParsedEntry[] = [];
  const warnings: string[] = [];

  // Build email lookup
  const emailLookup = new Map<string, { email: string; firstName: string; surname: string }>();
  for (const u of references.users) {
    const fullName = `${u.firstName} ${u.surname}`.toLowerCase();
    emailLookup.set(fullName, { email: u.userEmail, firstName: u.firstName, surname: u.surname });
    emailLookup.set(u.firstName.toLowerCase(), { email: u.userEmail, firstName: u.firstName, surname: u.surname });
    emailLookup.set(u.userEmail.toLowerCase(), { email: u.userEmail, firstName: u.firstName, surname: u.surname });
  }

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // Determine cycle from sheet name
    const nameLower = sheetName.toLowerCase();
    let currentCycle = 'Week 1&3';
    if (nameLower.includes('2') && nameLower.includes('4')) {
      currentCycle = 'Week 2&4';
    }

    const data = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1 });
    if (data.length < 2) continue;

    // Find day columns
    let dayColumns: { col: number; day: string }[] = [];
    let dayRowIdx = -1;

    for (let r = 0; r < Math.min(5, data.length); r++) {
      const row = (data[r] || []).map(c => String(c || '').toLowerCase().trim());
      const cols: { col: number; day: string }[] = [];
      for (let col = 0; col < row.length; col++) {
        for (const d of DAYS) {
          if (row[col].startsWith(d.substring(0, 3))) {
            cols.push({ col, day: d.charAt(0).toUpperCase() + d.slice(1) });
            break;
          }
        }
      }
      if (cols.length >= 3) {
        dayColumns = cols;
        dayRowIdx = r;
        break;
      }
    }

    if (dayColumns.length === 0) {
      warnings.push(`No day columns found in sheet "${sheetName}"`);
      continue;
    }

    // Look for user identifier (email or name) in cells
    let currentUserEmail = '';
    let currentFirstName = '';
    let currentSurname = '';

    for (let rowIdx = dayRowIdx + 1; rowIdx < data.length; rowIdx++) {
      const row = data[rowIdx] || [];
      const firstCell = String(row[0] || '').trim();

      // Check if this row identifies a user (email or name)
      if (firstCell.includes('@')) {
        const ref = emailLookup.get(firstCell.toLowerCase());
        currentUserEmail = firstCell.toLowerCase();
        currentFirstName = ref?.firstName || firstCell.split('@')[0];
        currentSurname = ref?.surname || '';
        continue;
      }

      // Check if it's a name
      if (firstCell && !firstCell.includes(' - ') && firstCell.length > 2) {
        const ref = emailLookup.get(firstCell.toLowerCase());
        if (ref) {
          currentUserEmail = ref.email;
          currentFirstName = ref.firstName;
          currentSurname = ref.surname;
          continue;
        }
      }

      if (!currentUserEmail) continue;

      // Parse store entries from day columns
      for (const { col, day } of dayColumns) {
        const cellValue = String(row[col] || '').trim();
        if (!cellValue || cellValue.toLowerCase() === 'off' || cellValue === '-') continue;

        const { storeName, storeCode } = extractStoreCode(cellValue);
        if (!storeName) continue;

        const existing = entries.find(e =>
          e.userEmail === currentUserEmail &&
          e.storeId === storeCode &&
          e.cycle === currentCycle
        );

        if (existing) {
          if (!existing.days.includes(day)) {
            existing.days.push(day);
          }
        } else {
          entries.push({
            userEmail: currentUserEmail,
            firstName: currentFirstName,
            surname: currentSurname,
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
