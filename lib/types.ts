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
  /**
   * Computed server-side on read by joining userEmail against the team control.
   * Never persisted to disk — always reflects the latest team control upload.
   */
  teamLeader?: string;
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

// --- Control file types ---

export interface StoreControlEntry {
  country: string;
  province: string;
  channel: string;
  storeName: string;
  storeCode: string;
  active: boolean;
  longitude: string;
  latitude: string;
  locationStatus: string;
  ignoreLocationData: boolean;
  email: string;
  createdBy: string;
  updatedBy: string;
}

export interface StoreControlData {
  stores: StoreControlEntry[];
  uploadedAt: string;
  uploadedBy: string;
}

export interface TeamControlEntry {
  teamName: string;
  teamLeader: string;
  teamLeaderEmail: string;
  teamLeaderId: string;
  memberEmail: string;
  memberId: string;
}

export interface TeamControlData {
  teams: TeamControlEntry[];
  uploadedAt: string;
  uploadedBy: string;
}
