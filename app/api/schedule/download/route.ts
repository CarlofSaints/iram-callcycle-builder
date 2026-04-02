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

  // Pre-compute cycle per user:
  // Cycle 1 = same schedule every week (only one block in raw file)
  // Cycle 2 = two patterns: Week 1&3 differs from Week 2&4
  // Cycle 4 = four different week patterns (future)
  const userCycleMap = new Map<string, number>();
  const userCyclePatterns = new Map<string, Set<string>>();
  for (const row of schedule) {
    const key = row.userEmail.toLowerCase();
    if (!userCyclePatterns.has(key)) userCyclePatterns.set(key, new Set());
    userCyclePatterns.get(key)!.add(row.cycle);
  }
  for (const [email, patterns] of userCyclePatterns) {
    const has13 = patterns.has('Week 1&3');
    const has24 = patterns.has('Week 2&4');
    if (has13 && has24) {
      userCycleMap.set(email, 2);  // Two different patterns
    } else {
      userCycleMap.set(email, 1);  // Same schedule every week
    }
  }

  const workbook = new ExcelJS.Workbook();

  // Header styling
  const headerFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7CC042' } };
  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };

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
  ];

  scheduleSheet.getRow(1).eachCell(cell => {
    cell.fill = headerFill;
    cell.font = headerFont;
  });

  const actionColors: Record<string, string> = {
    ADD: 'FFd1fae5',
    UPDATE: 'FFfef3c7',
    REMOVE: 'FFfee2e2',
    LIVE: 'FFf3f4f6',
  };

  for (const row of schedule) {
    const refUser = userLookup.get(row.userEmail.toLowerCase());
    const daysShort = daysToShort(row.days);
    const userCycle = userCycleMap.get(row.userEmail.toLowerCase()) || 1;

    // Convert cycle + days to WEEK1-WEEK4 columns
    let week1 = '', week2 = '', week3 = '', week4 = '';

    if (userCycle === 1) {
      // Cycle 1: Same schedule every week — all weeks get the same days
      week1 = daysShort;
      week2 = daysShort;
      week3 = daysShort;
      week4 = daysShort;
    } else {
      // Cycle 2: Week 1&3 differ from Week 2&4
      const is13 = row.cycle.includes('1') && row.cycle.includes('3');
      const is24 = row.cycle.includes('2') && row.cycle.includes('4');
      if (is13) {
        week1 = daysShort;
        week3 = daysShort;
      } else if (is24) {
        week2 = daysShort;
        week4 = daysShort;
      } else {
        // Fallback: populate all weeks
        week1 = daysShort;
        week2 = daysShort;
        week3 = daysShort;
        week4 = daysShort;
      }
    }

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
      week1,
      week2,
      week3,
      week4,
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
  teamsUserSheet.getRow(1).eachCell(cell => {
    cell.fill = headerFill;
    cell.font = headerFont;
  });

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
  storeSheet.getRow(1).eachCell(cell => {
    cell.fill = headerFill;
    cell.font = headerFont;
  });
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
  dataSheet.getRow(1).eachCell(cell => {
    cell.fill = headerFill;
    cell.font = headerFont;
  });
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
