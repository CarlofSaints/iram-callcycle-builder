import * as XLSX from 'xlsx';

export type FileFormat = 'josh-standard' | 'ash-region' | 'josh-alt' | 'unknown';

export function detectFormat(workbook: XLSX.WorkBook): FileFormat {
  const sheetNames = workbook.SheetNames.map(s => s.trim().toLowerCase());

  // Josh ALT: sheets named "Week 1&3" and "Week 2&4"
  const hasWeek13 = sheetNames.some(s => s.includes('week 1') && s.includes('3'));
  const hasWeek24 = sheetNames.some(s => s.includes('week 2') && s.includes('4'));
  if (hasWeek13 && hasWeek24 && sheetNames.length <= 4) {
    return 'josh-alt';
  }

  // Ash format: sheets with region names, row 1 has email
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
    if (data.length > 0) {
      const row1 = (data[0] || []).map(c => String(c || '').toLowerCase());
      // Check if any cell in row 1 contains an @ sign (email)
      if (row1.some(c => c.includes('@'))) {
        return 'ash-region';
      }
    }
  }

  // Josh Standard: sheets named by person names, row 2 contains "week" info
  if (sheetNames.length >= 2) {
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      if (!sheet) continue;
      const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
      if (data.length >= 3) {
        const row2 = (data[1] || []).map(c => String(c || '').toLowerCase());
        if (row2.some(c => c.includes('week'))) {
          return 'josh-standard';
        }
      }
    }
  }

  return 'unknown';
}
