export interface ScheduleRow {
  userEmail: string;
  firstName: string;
  surname: string;
  storeId: string;
  storeName: string;
  channel: string;
  cycle: string;         // e.g. "Week 1&3" or "Week 2&4"
  days: string[];        // e.g. ["Monday", "Wednesday"]
  action: 'ADD' | 'UPDATE' | 'REMOVE' | 'LIVE';
  uploadedAt: string;
  uploadedBy: string;
}

export interface ParsedEntry {
  userEmail: string;
  firstName: string;
  surname: string;
  storeId: string;
  storeName: string;
  cycle: string;
  days: string[];
}

export interface ReferenceStore {
  storeCode: string;
  storeName: string;
  channel: string;
}

export interface ReferenceUser {
  userId: string;
  userEmail: string;
  firstName: string;
  surname: string;
  status: string;
}

export interface ReferenceData {
  stores: ReferenceStore[];
  users: ReferenceUser[];
  teams: { teamName: string; leader: string }[];
}

export interface UploadResult {
  rowsAdded: number;
  rowsUpdated: number;
  totalRows: number;
  warnings: string[];
}
