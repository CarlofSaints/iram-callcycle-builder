import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getTenantEmailConfig } from '@/lib/getTenantConfig';
import { hexToArgb } from '@/lib/tenantConfig';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get('type');

  if (type !== 'store' && type !== 'team') {
    return NextResponse.json({ error: 'Invalid type. Use ?type=store or ?type=team' }, { status: 400 });
  }

  const tenant = await getTenantEmailConfig();
  const workbook = new ExcelJS.Workbook();

  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  const COL_BRAND = hexToArgb(tenant.primaryColor);

  let filename: string;

  if (type === 'store') {
    const sheet = workbook.addWorksheet('Stores');
    sheet.columns = [
      { header: 'COUNTRY', key: 'country', width: 15 },
      { header: 'PROVINCE', key: 'province', width: 20 },
      { header: 'CHANNEL', key: 'channel', width: 20 },
      { header: 'STORE NAME', key: 'storeName', width: 35 },
      { header: 'STORE CODE', key: 'storeCode', width: 15 },
      { header: 'ACTIVE', key: 'active', width: 10 },
      { header: 'LONGITUDE', key: 'longitude', width: 15 },
      { header: 'LATITUDE', key: 'latitude', width: 15 },
      { header: 'LOCATION STATUS', key: 'locationStatus', width: 18 },
      { header: 'IGNORE LOCATION DATA', key: 'ignoreLocationData', width: 22 },
      { header: 'EMAIL', key: 'email', width: 30 },
      { header: 'CREATED BY', key: 'createdBy', width: 20 },
      { header: 'UPDATED BY', key: 'updatedBy', width: 20 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COL_BRAND } };
      cell.font = headerFont;
    });

    filename = `${tenant.name} - Store Control Template.xlsx`;
  } else {
    const sheet = workbook.addWorksheet('Teams');
    sheet.columns = [
      { header: 'TEAM NAME', key: 'teamName', width: 20 },
      { header: 'TEAM LEADER', key: 'teamLeader', width: 25 },
      { header: 'TEAM LEADER ID', key: 'teamLeaderId', width: 15 },
      { header: 'MEMBER EMAIL', key: 'memberEmail', width: 30 },
      { header: 'MEMBER ID', key: 'memberId', width: 15 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COL_BRAND } };
      cell.font = headerFont;
    });

    filename = `${tenant.name} - Team Control Template.xlsx`;
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
