import * as XLSX from 'xlsx';
import { ParsedEntry, ReferenceData } from '../types';
import { detectFormat, FileFormat } from './detectFormat';
import { parseJoshStandard } from './parseJoshStandard';
import { parseAshFormat } from './parseAshFormat';
import { parseJoshAlt } from './parseJoshAlt';

export interface ParseResult {
  format: FileFormat;
  entries: ParsedEntry[];
  warnings: string[];
}

export function parseCallCycleFile(buffer: Buffer, references: ReferenceData): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const format = detectFormat(workbook);

  let entries: ParsedEntry[] = [];
  let warnings: string[] = [];

  switch (format) {
    case 'josh-standard': {
      const result = parseJoshStandard(workbook, references);
      entries = result.entries;
      warnings = result.warnings;
      break;
    }
    case 'ash-region': {
      const result = parseAshFormat(workbook);
      entries = result.entries;
      warnings = result.warnings;
      break;
    }
    case 'josh-alt': {
      const result = parseJoshAlt(workbook, references);
      entries = result.entries;
      warnings = result.warnings;
      break;
    }
    default:
      warnings.push('Could not auto-detect file format. Please ensure the file matches one of the expected formats.');
  }

  return { format, entries, warnings };
}
