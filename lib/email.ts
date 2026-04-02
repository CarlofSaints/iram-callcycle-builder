import { Resend } from 'resend';

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}

const FROM = 'iRam Call Cycle Builder <report_sender@outerjoin.co.za>';
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://iram-callcycle-builder.vercel.app';

function emailShell(bodyContent: string) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e5e5;">
      <!-- Header -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#7CC042;">
        <tr>
          <td style="padding:20px 28px;">
            <div style="color:#fff;font-size:20px;font-weight:bold;letter-spacing:1px;margin:0;">iRAM CALL CYCLE BUILDER</div>
            <div style="color:#fff;margin:3px 0 0;opacity:0.85;font-size:12px;">Powered by OuterJoin &amp; Perigee</div>
          </td>
        </tr>
      </table>

      <!-- Body -->
      <div style="padding:32px 28px;background:#fff;">
        ${bodyContent}
      </div>

      <!-- Footer -->
      <div style="padding:14px 28px;text-align:center;font-size:11px;color:#999;background:#f9f9f9;border-top:1px solid #eee;">
        iRam Call Cycle Builder &bull; Powered by OuterJoin &amp; Perigee
      </div>
    </div>
  `;
}

export async function sendWelcomeEmail(to: string, name: string, password: string) {
  const body = `
    <p style="margin:0 0 14px;">Hi <strong>${name}</strong>,</p>
    <p style="margin:0 0 8px;">Your account has been created on <strong>iRam Call Cycle Builder</strong>.</p>
    <p style="margin:0 0 20px;color:#555;font-size:14px;">This is the portal used to convert raw call cycle files into Perigee Call Schedule format.</p>
    <table style="background:#f9f9f9;border:1px solid #eee;border-radius:6px;padding:14px 16px;width:100%;margin-bottom:20px;">
      <tr><td style="padding:4px 12px 4px 0;color:#666;font-size:13px;">Login URL</td><td style="font-size:13px;"><a href="${APP_URL}/login" style="color:#7CC042;">${APP_URL}/login</a></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666;font-size:13px;">Email</td><td style="font-size:13px;">${to}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666;font-size:13px;">Password</td><td style="font-size:13px;font-family:monospace;">${password}</td></tr>
    </table>
    <p style="margin:0 0 20px;color:#666;font-size:13px;">Please change your password after your first login.</p>
    <a href="${APP_URL}/login" style="background:#7CC042;color:#fff;text-decoration:none;padding:12px 24px;border-radius:4px;font-weight:bold;font-size:14px;display:inline-block;">Login Now</a>
  `;

  return getResend().emails.send({
    from: FROM,
    to,
    subject: 'Welcome to iRam Call Cycle Builder',
    html: emailShell(body),
  });
}

export async function sendPasswordResetEmail(to: string, name: string, password: string) {
  const body = `
    <p style="margin:0 0 14px;">Hi <strong>${name}</strong>,</p>
    <p style="margin:0 0 20px;">Your password has been reset. Use the credentials below to log in.</p>
    <table style="background:#f9f9f9;border:1px solid #eee;border-radius:6px;padding:14px 16px;width:100%;margin-bottom:20px;">
      <tr><td style="padding:4px 12px 4px 0;color:#666;font-size:13px;">Email</td><td style="font-size:13px;">${to}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666;font-size:13px;">New Password</td><td style="font-size:13px;font-family:monospace;">${password}</td></tr>
    </table>
    <a href="${APP_URL}/login" style="background:#7CC042;color:#fff;text-decoration:none;padding:12px 24px;border-radius:4px;font-weight:bold;font-size:14px;display:inline-block;">Login Now</a>
  `;

  return getResend().emails.send({
    from: FROM,
    to,
    subject: 'iRam Call Cycle Builder — Password Reset',
    html: emailShell(body),
  });
}

export async function sendUploadNotification(
  toEmails: string[],
  entry: {
    userName: string;
    userEmail: string;
    filename: string;
    timestamp: string;
    format: string;
    entriesFound: number;
    rowsAdded: number;
    rowsUpdated: number;
    totalRows: number;
    warnings: string[];
    status: 'success' | 'partial' | 'failed';
    errorMessage?: string;
  },
) {
  if (!toEmails.length) return;

  const ts = new Date(entry.timestamp);
  const dateStr = ts.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

  const statusColor = entry.status === 'success' ? '#7CC042' : entry.status === 'partial' ? '#F59E0B' : '#EF4444';
  const statusLabel = entry.status === 'success' ? 'Successful' : entry.status === 'partial' ? 'Partially Loaded' : 'Failed';
  const statusIcon = entry.status === 'success' ? '&#10003;' : entry.status === 'partial' ? '&#9888;' : '&#10007;';

  const warningsHtml = entry.warnings.length > 0
    ? `<div style="margin:16px 0;padding:12px 16px;background:#FFFBEB;border-left:4px solid #F59E0B;border-radius:4px;">
        <p style="margin:0 0 8px;font-weight:bold;color:#92400E;font-size:13px;">Warnings (${entry.warnings.length}):</p>
        <ul style="margin:0;padding:0 0 0 18px;color:#78350F;font-size:12px;">
          ${entry.warnings.map(w => `<li style="margin:0 0 4px;">${w}</li>`).join('')}
        </ul>
      </div>`
    : '';

  const errorHtml = entry.errorMessage
    ? `<div style="margin:16px 0;padding:12px 16px;background:#FEF2F2;border-left:4px solid #EF4444;border-radius:4px;">
        <p style="margin:0;font-weight:bold;color:#991B1B;font-size:13px;">Error:</p>
        <p style="margin:4px 0 0;color:#7F1D1D;font-size:12px;">${entry.errorMessage}</p>
      </div>`
    : '';

  const body = `
    <div style="margin:0 0 16px;padding:12px 20px;background:${statusColor};border-radius:6px;text-align:center;">
      <span style="color:#fff;font-size:20px;font-weight:bold;">${statusIcon} Upload ${statusLabel}</span>
    </div>
    <table style="background:#f9f9f9;border:1px solid #eee;border-radius:6px;padding:14px 16px;width:100%;margin-bottom:16px;border-collapse:collapse;">
      <tr><td style="padding:5px 12px 5px 0;color:#666;font-size:13px;white-space:nowrap;">Uploaded by</td><td style="font-size:13px;">${entry.userName} &lt;${entry.userEmail}&gt;</td></tr>
      <tr><td style="padding:5px 12px 5px 0;color:#666;font-size:13px;white-space:nowrap;">Date</td><td style="font-size:13px;">${dateStr}</td></tr>
      <tr><td style="padding:5px 12px 5px 0;color:#666;font-size:13px;white-space:nowrap;">Time</td><td style="font-size:13px;">${timeStr}</td></tr>
      <tr><td style="padding:5px 12px 5px 0;color:#666;font-size:13px;white-space:nowrap;">File</td><td style="font-size:13px;font-family:monospace;word-break:break-all;">${entry.filename}</td></tr>
      <tr><td style="padding:5px 12px 5px 0;color:#666;font-size:13px;white-space:nowrap;">Format Detected</td><td style="font-size:13px;">${entry.format}</td></tr>
      <tr><td style="padding:5px 12px 5px 0;color:#666;font-size:13px;white-space:nowrap;">Entries Found</td><td style="font-size:13px;">${entry.entriesFound}</td></tr>
      <tr><td style="padding:5px 12px 5px 0;color:#666;font-size:13px;white-space:nowrap;">Rows Added</td><td style="font-size:13px;color:${entry.rowsAdded > 0 ? '#7CC042' : '#666'};font-weight:${entry.rowsAdded > 0 ? 'bold' : 'normal'};">${entry.rowsAdded}</td></tr>
      <tr><td style="padding:5px 12px 5px 0;color:#666;font-size:13px;white-space:nowrap;">Rows Updated</td><td style="font-size:13px;color:${entry.rowsUpdated > 0 ? '#F59E0B' : '#666'};font-weight:${entry.rowsUpdated > 0 ? 'bold' : 'normal'};">${entry.rowsUpdated}</td></tr>
      <tr><td style="padding:5px 12px 5px 0;color:#666;font-size:13px;white-space:nowrap;">Total Schedule Rows</td><td style="font-size:13px;font-weight:bold;">${entry.totalRows}</td></tr>
    </table>
    ${warningsHtml}
    ${errorHtml}
    <p style="margin:0;color:#999;font-size:12px;">This is an automated notification from iRam Call Cycle Builder.</p>
  `;

  const subjectStatus = entry.status === 'success' ? '' : entry.status === 'partial' ? ' [WARNINGS]' : ' [FAILED]';
  return getResend().emails.send({
    from: FROM,
    to: toEmails,
    subject: `iRam CC: Upload by ${entry.userName} — ${entry.filename}${subjectStatus}`,
    html: emailShell(body),
  });
}
