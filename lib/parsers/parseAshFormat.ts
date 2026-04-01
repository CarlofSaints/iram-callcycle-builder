import * as XLSX from 'xlsx';
import { ParsedEntry } from '../types';

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

export function parseAshFormat(workbook: XLSX.WorkBook): { entries: ParsedEntry[]; warnings: string[] } {
  const entries: ParsedEntry[] = [];
  const warnings: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const data = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1 });
    if (data.length < 3) continue;

    // Row 1 (index 0): name + email
    const row1 = (data[0] || []).map(c => String(c || '').trim());

    // Find email in row 1
    let userEmail = '';
    let firstName = '';
    let surname = '';

    for (const cell of row1) {
      if (cell.includes('@')) {
        userEmail = cell.toLowerCase();
      }
    }

    // The first non-empty cell in row 1 that's not the email is likely the name
    for (const cell of row1) {
      if (cell && !cell.includes('@')) {
        const parts = cell.split(/\s+/);
        firstName = parts[0] || '';
        surname = parts.slice(1).join(' ') || '';
        break;
      }
    }

    if (!userEmail) {
      warnings.push(`No email found in row 1 of sheet "${sheetName}"`);
      continue;
    }

    // Row 2 (index 1): day headers
    const dayRow = (data[1] || []).map(c => String(c || '').toLowerCase().trim());
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

    if (dayColumns.length === 0) {
      warnings.push(`No day columns found in sheet "${sheetName}"`);
      continue;
    }

    // Determine cycle from row 1 or sheet name
    let currentCycle = 'Week 1&3';
    const row1Str = row1.join(' ').toLowerCase();
    if (row1Str.includes('2') && row1Str.includes('4')) {
      currentCycle = 'Week 2&4';
    }

    // Rows 3+ (index 2+): store entries
    for (let rowIdx = 2; rowIdx < data.length; rowIdx++) {
      const row = data[rowIdx] || [];

      // Check if this is a new cycle section
      const firstCell = String(row[0] || '').trim().toLowerCase();
      if (firstCell.includes('week')) {
        if (firstCell.includes('2') && firstCell.includes('4')) {
          currentCycle = 'Week 2&4';
        } else if (firstCell.includes('1') && firstCell.includes('3')) {
          currentCycle = 'Week 1&3';
        }
        continue;
      }

      for (const { col, day } of dayColumns) {
        const cellValue = String(row[col] || '').trim();
        if (!cellValue || cellValue.toLowerCase() === 'off' || cellValue === '-') continue;

        const { storeName, storeCode } = extractStoreCode(cellValue);
        if (!storeName) continue;

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
            userEmail,
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
