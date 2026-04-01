import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { loadSchedule } from '@/lib/scheduleData';
import { loadReferences } from '@/lib/referenceData';
import { addActivity } from '@/lib/activityLogData';
import { randomUUID } from 'crypto';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userName = url.searchParams.get('userName') || 'Unknown';
  const userEmail = url.searchParams.get('userEmail') || '';

  const schedule = loadSchedule();
  const references = loadReferences();

  const workbook = new ExcelJS.Workbook();

  // === Sheet 1: Schedule (main output) ===
  const scheduleSheet = workbook.addWorksheet('Schedule');
  scheduleSheet.columns = [
    { header: 'USER EMAIL', key: 'userEmail', width: 30 },
    { header: 'FIRST NAME', key: 'firstName', width: 15 },
    { header: 'SURNAME', key: 'surname', width: 15 },
    { header: 'STORE ID', key: 'storeId', width: 15 },
    { header: 'STORE NAME', key: 'storeName', width: 30 },
    { header: 'CHANNEL', key: 'channel', width: 20 },
    { header: 'CYCLE', key: 'cycle', width: 15 },
    { header: 'DAYS', key: 'days', width: 35 },
    { header: 'ACTION', key: 'action', width: 12 },
  ];

  // Header styling
  const headerFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7CC042' } };
  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };

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
    const r = scheduleSheet.addRow({
      userEmail: row.userEmail,
      firstName: row.firstName,
      surname: row.surname,
      storeId: row.storeId,
      storeName: row.storeName,
      channel: row.channel,
      cycle: row.cycle,
      days: row.days.join(', '),
      action: row.action,
    });

    const color = actionColors[row.action] || 'FFf3f4f6';
    r.getCell('action').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  }

  // === Sheet 2: Perigee Store Dictionary ===
  const storeSheet = workbook.addWorksheet('Perigee Store Dictionary');
  storeSheet.columns = [
    { header: 'STORE CODE', key: 'storeCode', width: 15 },
    { header: 'STORE NAME', key: 'storeName', width: 35 },
    { header: 'CHANNEL', key: 'channel', width: 20 },
  ];
  storeSheet.getRow(1).eachCell(cell => {
    cell.fill = headerFill;
    cell.font = headerFont;
  });
  for (const s of references.stores) {
    storeSheet.addRow(s);
  }

  // === Sheet 3: Perigee Email Dictionary ===
  const emailSheet = workbook.addWorksheet('Perigee Email Dictionary');
  emailSheet.columns = [
    { header: 'USER ID', key: 'userId', width: 15 },
    { header: 'USER EMAIL', key: 'userEmail', width: 30 },
    { header: 'FIRST NAME', key: 'firstName', width: 15 },
    { header: 'SURNAME', key: 'surname', width: 15 },
    { header: 'STATUS', key: 'status', width: 12 },
  ];
  emailSheet.getRow(1).eachCell(cell => {
    cell.fill = headerFill;
    cell.font = headerFont;
  });
  for (const u of references.users) {
    emailSheet.addRow(u);
  }

  // === Sheet 4: Teams & Job Titles ===
  const teamsSheet = workbook.addWorksheet('Teams & Job Titles');
  teamsSheet.columns = [
    { header: 'TEAM NAME', key: 'teamName', width: 25 },
    { header: 'LEADER', key: 'leader', width: 25 },
  ];
  teamsSheet.getRow(1).eachCell(cell => {
    cell.fill = headerFill;
    cell.font = headerFont;
  });
  for (const t of references.teams) {
    teamsSheet.addRow(t);
  }

  // === Sheet 5: DATA (validation) ===
  const dataSheet = workbook.addWorksheet('DATA');
  dataSheet.columns = [
    { header: 'ACTION', key: 'action', width: 15 },
  ];
  dataSheet.getRow(1).eachCell(cell => {
    cell.fill = headerFill;
    cell.font = headerFont;
  });
  ['ADD', 'UPDATE', 'REMOVE', 'LIVE'].forEach(a => dataSheet.addRow({ action: a }));

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
