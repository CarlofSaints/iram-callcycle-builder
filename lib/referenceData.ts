import fs from 'fs';
import path from 'path';
import { ReferenceData } from './types';

const FILE = path.join(process.cwd(), 'data', 'references.json');
let _cache: ReferenceData | null = null;

export function loadReferences(): ReferenceData {
  if (_cache !== null) return _cache;

  if (fs.existsSync(FILE)) {
    _cache = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
    return _cache!;
  }

  return { stores: [], users: [], teams: [] };
}

export function saveReferences(data: ReferenceData) {
  _cache = data;
  try {
    const dir = path.dirname(FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[referenceData] Failed to save:', err);
  }
}
