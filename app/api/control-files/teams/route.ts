import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { TeamControlEntry } from '@/lib/types';
import { loadTeamControl, saveTeamControl } from '@/lib/teamControlData';
import { addActivity } from '@/lib/activityLogData';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

function findHeader(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.findIndex(h => h.toLowerCase().trim() === c.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

// Parse "Name (email)" → email, or return raw string if no parens
function parseLeaderEmail(raw: string): string {
  const match = raw.match(/\(([^)]+)\)/);
  return match ? match[1].trim() : '';
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const userName = formData.get('userName') as string || 'Unknown';
    const userEmail = formData.get('userEmail') as string || '';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ error: 'No sheets found in file' }, { status: 400 });
    }

    const sheet = wb.Sheets[sheetName];
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (rows.length < 2) {
      return NextResponse.json({ error: 'File has no data rows' }, { status: 400 });
    }

    const headers = rows[0].map(String);

    const colTeamName = findHeader(headers, ['team name', 'teamname']);
    const colTeamLeader = findHeader(headers, ['team leader', 'teamleader']);
    const colTeamLeaderId = findHeader(headers, ['team leader id', 'teamleaderid', 'leader id']);
    const colMemberEmail = findHeader(headers, ['member email', 'memberemail', 'team member email', 'teammemberemail', 'user email', 'useremail', 'email']);
    const colMemberId = findHeader(headers, ['member id', 'memberid', 'team member id', 'teammemberid', 'user id', 'userid']);

    const missing: string[] = [];
    if (colTeamName < 0) missing.push('Team Name');
    if (colMemberEmail < 0) missing.push('Member Email');
    if (missing.length > 0) {
      return NextResponse.json({
        error: `Required column(s) not found: ${missing.join(', ')}. Found headers: ${headers.join(', ')}`,
      }, { status: 400 });
    }

    const teams: TeamControlEntry[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const memberEmail = String(r[colMemberEmail] || '').trim();
      if (!memberEmail) continue;

      const teamLeaderRaw = colTeamLeader >= 0 ? String(r[colTeamLeader] || '').trim() : '';
      const teamLeaderEmail = parseLeaderEmail(teamLeaderRaw);
      // Team leader display name: strip the "(email)" part
      const teamLeaderName = teamLeaderRaw.replace(/\s*\([^)]*\)\s*$/, '').trim();

      teams.push({
        teamName: colTeamName >= 0 ? String(r[colTeamName] || '').trim() : '',
        teamLeader: teamLeaderName,
        teamLeaderEmail,
        teamLeaderId: colTeamLeaderId >= 0 ? String(r[colTeamLeaderId] || '').trim() : '',
        memberEmail,
        memberId: colMemberId >= 0 ? String(r[colMemberId] || '').trim() : '',
      });
    }

    if (teams.length === 0) {
      return NextResponse.json({ error: 'No valid team rows found' }, { status: 400 });
    }

    const uniqueTeams = new Set(teams.map(t => t.teamName)).size;
    const uniqueMembers = new Set(teams.map(t => t.memberEmail.toLowerCase())).size;
    const unknownCount = teams.filter(t =>
      t.teamName.toUpperCase() === 'UNKNOWN' || !t.teamName
    ).length;

    await saveTeamControl({
      teams,
      uploadedAt: new Date().toISOString(),
      uploadedBy: userEmail || userName,
    });

    await addActivity({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'control_file_upload',
      userName,
      userEmail,
      detail: `Uploaded team control file: ${teams.length} entries, ${uniqueTeams} teams${unknownCount > 0 ? `, ${unknownCount} UNKNOWN` : ''}`,
    });

    return NextResponse.json({
      ok: true,
      totalEntries: teams.length,
      uniqueTeams,
      uniqueMembers,
      unknownCount,
    });
  } catch (err) {
    console.error('[control-files/teams] POST error:', err);
    return NextResponse.json({ error: 'Failed to process file', detail: String(err) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const exceptions = url.searchParams.get('exceptions');

  const data = loadTeamControl();

  if (status === 'true') {
    if (!data) {
      return NextResponse.json({ loaded: false }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    const unknownCount = data.teams.filter(t =>
      t.teamName.toUpperCase() === 'UNKNOWN' || !t.teamName
    ).length;
    return NextResponse.json({
      loaded: true,
      totalEntries: data.teams.length,
      uniqueTeams: new Set(data.teams.map(t => t.teamName)).size,
      uniqueMembers: new Set(data.teams.map(t => t.memberEmail.toLowerCase())).size,
      unknownCount,
      uploadedAt: data.uploadedAt,
      uploadedBy: data.uploadedBy,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  if (!data || data.teams.length === 0) {
    return NextResponse.json({ error: 'No team control data loaded' }, { status: 404 });
  }

  // Filter to exceptions only if requested
  const entries = exceptions === 'true'
    ? data.teams.filter(t => t.teamName.toUpperCase() === 'UNKNOWN' || !t.teamName)
    : data.teams;

  if (entries.length === 0) {
    return NextResponse.json({ error: 'No exception entries found' }, { status: 404 });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Teams');

  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  const COL_GREEN = 'FF7CC042';

  sheet.columns = [
    { header: 'TEAM NAME', key: 'teamName', width: 20 },
    { header: 'TEAM LEADER', key: 'teamLeader', width: 25 },
    { header: 'TEAM LEADER EMAIL', key: 'teamLeaderEmail', width: 30 },
    { header: 'TEAM LEADER ID', key: 'teamLeaderId', width: 15 },
    { header: 'MEMBER EMAIL', key: 'memberEmail', width: 30 },
    { header: 'MEMBER ID', key: 'memberId', width: 15 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COL_GREEN } };
    cell.font = headerFont;
  });

  for (const t of entries) {
    sheet.addRow({
      teamName: t.teamName,
      teamLeader: t.teamLeader,
      teamLeaderEmail: t.teamLeaderEmail,
      teamLeaderId: t.teamLeaderId,
      memberEmail: t.memberEmail,
      memberId: t.memberId,
    });
  }

  const buf = await workbook.xlsx.writeBuffer();
  const date = new Date().toISOString().split('T')[0];
  const label = exceptions === 'true' ? 'Exceptions' : 'Team Control';
  const filename = `iRam - ${label} - ${date}.xlsx`;

  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
