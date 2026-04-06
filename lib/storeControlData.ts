import fs from 'fs';
import path from 'path';
import { StoreControlData } from './types';

const FILE = path.join(process.cwd(), 'data', 'storeControl.json');
const TMP_FILE = '/tmp/iram_store_control.json';
let _cache: StoreControlData | null = null;

export function loadStoreControl(): StoreControlData | null {
  if (_cache !== null) return _cache;

  // Vercel: try /tmp first
  if (process.env.VERCEL) {
    try {
      if (fs.existsSync(TMP_FILE)) {
        _cache = JSON.parse(fs.readFileSync(TMP_FILE, 'utf-8'));
        return _cache;
      }
    } catch {}
  }

  // Local dev: read from data/ file
  if (fs.existsSync(FILE)) {
    try {
      _cache = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
      return _cache;
    } catch {}
  }

  return null;
}

export async function saveStoreControl(data: StoreControlData) {
  _cache = data;
  // No indent — 92K rows would be huge with formatting
  const json = JSON.stringify(data);

  // Vercel: write to /tmp
  if (process.env.VERCEL) {
    try { fs.writeFileSync(TMP_FILE, json); } catch {}
  }

  // Try local file write
  try {
    const dir = path.dirname(FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FILE, json);
  } catch {
    // Vercel read-only FS
  }

  // NO env var — 92K rows exceeds Vercel's 64KB env var limit.
  // Admin re-uploads after container restart (acceptable for a control file).
}
