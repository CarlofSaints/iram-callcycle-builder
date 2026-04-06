import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { loadSchedule } from '@/lib/scheduleData';
import { loadReferences } from '@/lib/referenceData';
import { addActivity } from '@/lib/activityLogData';
import { randomUUID } from 'crypto';

function daysToShort(days: string[]): string {
  const map: Record<string, string> = {
    Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
    Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat',
  };
  return days.map(d => map[d] || d).join(',');
}

function parseCycleWeeks(cycle: string): number[] {
  if (!cycle) return [];
  const nums = cycle.match(/\d+/g);
  return nums ? nums.map(Number).filter(n => n >= 1 && n <= 6).sort((a, b) => a - b) : [];
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userName = url.searchParams.get('userName') || 'Unknown';
  const userEmail = url.searchParams.get('userEmail') || '';

  const schedule = loadSchedule();
  const references = loadReferences();

  // Build user lookup for extra fields
  const userLookup = new Map<string, {
    userId: string; status: string; firstName: string; surname: string;
  }>();
  for (const u of references.users) {
    userLookup.set(u.userEmail.toLowerCase(), {
      userId: u.userId, status: u.status,
      firstName: u.firstName, surname: u.surname,
    });
  }

  // Build team lookup
  const teamLookup = new Map<string, { teamName: string; leader: string }>();
  for (const t of references.teams) {
    teamLookup.set(t.teamName, t);
  }

  // Pre-compute cycle per user: max week number across all entries
  const userCycleMap = new Map<string, number>();
  for (const row of schedule) {
    const key = row.userEmail.toLowerCase();
    const weeks = parseCycleWeeks(row.cycle);
    const maxWeek = weeks.length > 0 ? Math.max(...weeks) : 1;
    const current = userCycleMap.get(key) || 0;
    if (maxWeek > current) userCycleMap.set(key, maxWeek);
  }

  const workbook = new ExcelJS.Workbook();

  // Header styling — colour groups for visual relevance
  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  const COL_BLUE   = 'FF4472C4';  // User info
  const COL_DGREEN = 'FF548235';  // Cycle admin
  const COL_ORANGE = 'FFED7D31';  // Action
  const COL_NAVY   = 'FF2F5496';  // Store info
  const COL_GREY   = 'FF828282';  // Cycle number
  const COL_GREEN  = 'FF7CC042';  // Weeks (iRam brand)

  // Schedule sheet: column-index → colour (1-based)
  const scheduleColors: Record<number, string> = {
    1: COL_BLUE, 2: COL_BLUE, 3: COL_BLUE, 4: COL_BLUE,
    5: COL_BLUE, 6: COL_BLUE, 7: COL_BLUE,
    8: COL_DGREEN, 9: COL_DGREEN, 10: COL_DGREEN, 11: COL_DGREEN,
    12: COL_ORANGE,
    13: COL_NAVY, 14: COL_NAVY, 15: COL_NAVY,
    16: COL_GREY,
    17: COL_GREEN, 18: COL_GREEN, 19: COL_GREEN,
    20: COL_GREEN, 21: COL_GREEN, 22: COL_GREEN,
  };

  function applyHeaderColors(row: ExcelJS.Row, colorMap?: Record<number, string>) {
    row.eachCell((cell, colNumber) => {
      const argb = colorMap ? (colorMap[colNumber] || COL_GREEN) : COL_GREEN;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
      cell.font = headerFont;
    });
  }

  // === Sheet 1: Schedule (Perigee format) ===
  const scheduleSheet = workbook.addWorksheet('Schedule');
  scheduleSheet.columns = [
    { header: 'USER ID', key: 'userId', width: 10 },
    { header: 'USER EMAIL', key: 'userEmail', width: 30 },
    { header: 'FIRST NAME', key: 'firstName', width: 15 },
    { header: 'SURNAME', key: 'surname', width: 15 },
    { header: 'USER STATUS', key: 'userStatus', width: 12 },
    { header: 'USER ACCESS', key: 'userAccess', width: 12 },
    { header: 'ASSIGNED PROVINCES', key: 'assignedProvinces', width: 25 },
    { header: 'CALL CYCLE ACCESS', key: 'callCycleAccess', width: 15 },
    { header: 'CYCLE START DATE', key: 'cycleStartDate', width: 15 },
    { header: 'CYCLE END DATE', key: 'cycleEndDate', width: 15 },
    { header: 'CYCLE STATUS', key: 'cycleStatus', width: 12 },
    { header: 'ACTION', key: 'action', width: 12 },
    { header: 'STORE ID', key: 'storeId', width: 15 },
    { header: 'STORE NAME', key: 'storeName', width: 35 },
    { header: 'CHANNEL', key: 'channel', width: 20 },
    { header: 'CYCLE', key: 'cycle', width: 8 },
    { header: 'WEEK1', key: 'week1', width: 15 },
    { header: 'WEEK2', key: 'week2', width: 15 },
    { header: 'WEEK3', key: 'week3', width: 15 },
    { header: 'WEEK4', key: 'week4', width: 15 },
    { header: 'WEEK5', key: 'week5', width: 15 },
    { header: 'WEEK6', key: 'week6', width: 15 },
  ];

  applyHeaderColors(scheduleSheet.getRow(1), scheduleColors);

  const actionColors: Record<string, string> = {
    ADD: 'FFd1fae5',
    UPDATE: 'FFfef3c7',
    REMOVE: 'FFfee2e2',
    LIVE: 'FFf3f4f6',
  };

  // Merge rows with same user+store into a single export row
  const mergedMap = new Map<string, {
    row: typeof schedule[0];
    weekDays: Map<number, string>; // week number → short days
  }>();

  for (const row of schedule) {
    const key = `${row.userEmail.toLowerCase()}|${row.storeId.toUpperCase()}`;
    const weekNums = parseCycleWeeks(row.cycle);
    const daysShort = daysToShort(row.days);

    if (!mergedMap.has(key)) {
      mergedMap.set(key, { row, weekDays: new Map() });
    }

    const entry = mergedMap.get(key)!;
    for (const w of weekNums) {
      entry.weekDays.set(w, daysShort);
    }
    // Keep latest action/upload info
    if (new Date(row.uploadedAt) > new Date(entry.row.uploadedAt)) {
      entry.row = { ...row };
    }
  }

  for (const [, { row, weekDays }] of mergedMap) {
    const refUser = userLookup.get(row.userEmail.toLowerCase());
    const userCycle = userCycleMap.get(row.userEmail.toLowerCase()) || 1;

    const r = scheduleSheet.addRow({
      userId: refUser?.userId || '',
      userEmail: row.userEmail,
      firstName: row.firstName,
      surname: row.surname,
      userStatus: refUser?.status || 'ACTIVE',
      userAccess: 'ENABLED',
      assignedProvinces: '',
      callCycleAccess: 'YES',
      cycleStartDate: '',
      cycleEndDate: '',
      cycleStatus: 'ACTIVE',
      action: row.action,
      storeId: row.storeId,
      storeName: row.storeName,
      channel: row.channel,
      cycle: String(userCycle),
      week1: weekDays.get(1) || '',
      week2: weekDays.get(2) || '',
      week3: weekDays.get(3) || '',
      week4: weekDays.get(4) || '',
      week5: weekDays.get(5) || '',
      week6: weekDays.get(6) || '',
    });

    const color = actionColors[row.action] || 'FFf3f4f6';
    r.getCell('action').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  }

  // === Sheet 2: Teams And User Cycle ===
  const teamsUserSheet = workbook.addWorksheet('Teams And User Cycle');
  teamsUserSheet.columns = [
    { header: 'USER ID', key: 'userId', width: 10 },
    { header: 'USER EMAIL', key: 'userEmail', width: 30 },
    { header: 'FIRST NAME', key: 'firstName', width: 15 },
    { header: 'SURNAME', key: 'surname', width: 15 },
    { header: 'STATUS', key: 'status', width: 12 },
    { header: 'ASSIGNED PROVINCES', key: 'assignedProvinces', width: 25 },
    { header: 'JOB TITLE', key: 'jobTitle', width: 20 },
    { header: 'LEAVE TYPE', key: 'leaveType', width: 12 },
    { header: 'LEAVE START', key: 'leaveStart', width: 12 },
    { header: 'LEAVE END', key: 'leaveEnd', width: 12 },
    { header: 'TEAM NAME', key: 'teamName', width: 20 },
    { header: 'TEAM LEADER', key: 'teamLeader', width: 30 },
    { header: 'ASM', key: 'asm', width: 15 },
    { header: 'REGIONAL MANAGER', key: 'regionalManager', width: 20 },
    { header: 'ACTION', key: 'action', width: 10 },
    { header: 'CYCLE STATUS', key: 'cycleStatus', width: 12 },
    { header: 'CYCLE', key: 'cycle', width: 8 },
    { header: 'CYCLE START DATE', key: 'cycleStartDate', width: 15 },
    { header: 'CYCLE END DATE', key: 'cycleEndDate', width: 15 },
  ];
  applyHeaderColors(teamsUserSheet.getRow(1));

  // Add unique users from schedule
  const seenEmails = new Set<string>();
  for (const row of schedule) {
    const key = row.userEmail.toLowerCase();
    if (seenEmails.has(key)) continue;
    seenEmails.add(key);

    const refUser = userLookup.get(key);
    const userCycle = userCycleMap.get(key) || 1;
    teamsUserSheet.addRow({
      userId: refUser?.userId || '',
      userEmail: row.userEmail,
      firstName: row.firstName,
      surname: row.surname,
      status: refUser?.status || 'ACTIVE',
      assignedProvinces: '',
      jobTitle: '',
      leaveType: '',
      leaveStart: '',
      leaveEnd: '',
      teamName: '',
      teamLeader: '',
      asm: '',
      regionalManager: '',
      action: row.action,
      cycleStatus: 'ACTIVE',
      cycle: String(userCycle),
      cycleStartDate: '',
      cycleEndDate: '',
    });
  }

  // === Sheet 3: Stores (Delete Before Upload) ===
  const storeSheet = workbook.addWorksheet('Stores (Delete Before Upload)');
  storeSheet.columns = [
    { header: 'STORE ID', key: 'storeId', width: 15 },
    { header: 'STORE NAME', key: 'storeName', width: 35 },
    { header: 'CHANNEL', key: 'channel', width: 20 },
  ];
  applyHeaderColors(storeSheet.getRow(1));
  for (const s of references.stores) {
    storeSheet.addRow({
      storeId: s.storeCode,
      storeName: s.storeName,
      channel: s.channel,
    });
  }

  // === Sheet 4: Data (validation lists) ===
  const dataSheet = workbook.addWorksheet('Data');
  dataSheet.columns = [
    { header: 'ACTION', key: 'action', width: 15 },
    { header: 'CYCLE STATUS', key: 'cycleStatus', width: 15 },
  ];
  applyHeaderColors(dataSheet.getRow(1));
  ['ADD', 'UPDATE', 'REMOVE', 'LIVE', 'SET_END_TODAY'].forEach(a =>
    dataSheet.addRow({ action: a, cycleStatus: '' })
  );
  // Add cycle status values in column B
  const statusValues = ['ACTIVE', 'PENDING'];
  for (let i = 0; i < statusValues.length; i++) {
    const cell = dataSheet.getCell(i + 2, 2);
    cell.value = statusValues[i];
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();

  // Log activity
  await addActivity({
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    type: 'download',
    userName,
    userEmail,
    detail: `Downloaded Perigee Call Schedule (${schedule.length} rows)`,
  });

  const date = new Date().toISOString().split('T')[0];
  const filename = `iRam - Perigee Call Schedule - ${date}.xlsx`;

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
