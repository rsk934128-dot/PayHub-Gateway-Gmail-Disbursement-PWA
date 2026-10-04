import { GmailReceiptRequest } from '../../types';

export interface GmailLabel {
  id: string;
  name: string;
  type: string;
  messagesTotal?: number;
  messagesUnread?: number;
}

export interface SentReceiptMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  date?: string;
  subject?: string;
  to?: string;
}

/**
 * Lists user labels from Gmail API
 */
export async function listGmailLabels(accessToken: string): Promise<GmailLabel[]> {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to list Gmail labels: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.labels || [];
}

/**
 * Ensures label 'Payments/Disbursed' or 'Payments/Received' exists, creating it if necessary.
 */
export async function ensureGmailLabel(
  accessToken: string,
  labelName: string = 'Payments/Disbursed'
): Promise<string> {
  const labels = await listGmailLabels(accessToken);
  const existing = labels.find(
    (l) => l.name.toLowerCase() === labelName.toLowerCase() || l.id === labelName
  );
  if (existing) {
    return existing.id;
  }

  // Create new label
  const createRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: labelName,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
      color: {
        backgroundColor: '#16a765',
        textColor: '#ffffff',
      },
    }),
  });

  if (!createRes.ok) {
    // If color assignment fails on some account tiers, retry without color
    const fallbackRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: labelName,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      }),
    });
    if (!fallbackRes.ok) {
      throw new Error(`Failed to create Gmail label "${labelName}"`);
    }
    const created = await fallbackRes.json();
    return created.id;
  }

  const created = await createRes.json();
  return created.id;
}

/**
 * Helper to encode string to RFC 4648 Base64URL
 */
function base64UrlEncode(str: string): string {
  // Support UTF-8 characters like Bengali script
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generates clean, responsive HTML email body with professional payment receipt branding
 */
export function buildReceiptHtml(params: GmailReceiptRequest, userSenderEmail?: string): string {
  const isBdt = params.currency === 'BDT';
  const formattedAmount = isBdt
    ? `৳${params.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    : `${params.currency} ${params.amount.toFixed(2)}`;

  const gatewayColors = {
    BKASH: { bg: '#e1147e', name: 'bKash B2C Disbursement' },
    NAGAD: { bg: '#f97316', name: 'Nagad B2C Disbursement' },
    STRIPE: { bg: '#6366f1', name: 'Stripe Global Card Payment' },
  };

  const currentGw = gatewayColors[params.gateway] || { bg: '#4f46e5', name: params.gateway };

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payment Receipt - ${params.invoiceNo}</title>
</head>
<body style="margin:0;padding:24px;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background-color:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;">
    <tr>
      <td style="padding:28px 24px;background:linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%);border-bottom:1px solid #334155;text-align:center;">
        <div style="display:inline-block;padding:6px 14px;border-radius:9999px;background-color:${currentGw.bg};color:#ffffff;font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:12px;">
          ${currentGw.name}
        </div>
        <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Official Payment Receipt</h1>
        <p style="margin:6px 0 0 0;font-size:13px;color:#94a3b8;">ট্রানজেকশন সফলভাবে সম্পন্ন হয়েছে / Transaction Successfully Disbursed</p>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 24px;text-align:center;border-bottom:1px solid #334155;background-color:#0f172a;">
        <p style="margin:0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Amount / টাকার পরিমাণ</p>
        <div style="margin:8px 0 0 0;font-size:36px;font-weight:800;color:#38bdf8;font-family:'Courier New',Courier,monospace;">
          ${formattedAmount}
        </div>
        <div style="display:inline-block;margin-top:10px;padding:4px 12px;border-radius:6px;background-color:#064e3b;color:#34d399;font-size:12px;font-weight:600;">
          Status: COMPLETED (Verified via ${params.gateway})
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size:13px;line-height:20px;">
          <tr>
            <td style="padding:8px 0;color:#94a3b8;">Invoice Number (ইনভয়েস):</td>
            <td style="padding:8px 0;text-align:right;color:#ffffff;font-weight:600;font-family:monospace;">${params.invoiceNo}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#94a3b8;">Transaction ID (TrxID):</td>
            <td style="padding:8px 0;text-align:right;color:#38bdf8;font-weight:700;font-family:monospace;">${params.trxId}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#94a3b8;">Recipient Account / Phone:</td>
            <td style="padding:8px 0;text-align:right;color:#ffffff;font-weight:600;">${params.toEmail}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#94a3b8;">Execution Date (সময়):</td>
            <td style="padding:8px 0;text-align:right;color:#cbd5e1;">${new Date(params.completedAt).toLocaleString()}</td>
          </tr>
          ${params.note ? `
          <tr>
            <td style="padding:8px 0;color:#94a3b8;">Note / Memo (নোট):</td>
            <td style="padding:8px 0;text-align:right;color:#38bdf8;font-weight:500;">${params.note}</td>
          </tr>` : ''}
          <tr>
            <td style="padding:8px 0;color:#94a3b8;">Automated Mailer:</td>
            <td style="padding:8px 0;text-align:right;color:#cbd5e1;">Gmail API Hub (${userSenderEmail || 'PayHub Gateway'})</td>
          </tr>
        </table>

        <div style="margin-top:20px;padding:14px;border-radius:10px;background-color:#0f172a;border:1px dashed #334155;font-size:11px;color:#94a3b8;line-height:16px;">
          <strong>Security Notice:</strong> This disbursement is protected by Idempotency Key validation, RSA encryption and HMAC signature integrity checks. If you have any inquiries, reference your TrxID <code>${params.trxId}</code>.
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 24px;background-color:#0b1120;border-top:1px solid #1e293b;text-align:center;font-size:11px;color:#64748b;">
        Generated by PayHub Gateway &amp; Gmail Disbursement Service &bull; All Rights Reserved
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Sends automated payment receipt email via Gmail API
 */
export async function sendPaymentReceiptEmail(
  accessToken: string,
  params: GmailReceiptRequest,
  senderEmail: string
): Promise<{ messageId: string; threadId: string; labelId: string }> {
  // Step 1: Ensure custom label 'Payments/Disbursed' or 'Payments/Received' exists
  const targetLabelName = params.label || 'Payments/Disbursed';
  let labelId = '';
  try {
    labelId = await ensureGmailLabel(accessToken, targetLabelName);
  } catch (err) {
    console.warn('Could not ensure label, continuing send:', err);
  }

  // Step 2: Build RFC 2822 message
  const subject = `[Receipt] ${params.gateway} Payment of ${params.currency} ${params.amount} - ${params.invoiceNo}`;
  const htmlBody = buildReceiptHtml(params, senderEmail);

  const rawMessage = [
    `From: PayHub Gateway <${senderEmail}>`,
    `To: ${params.toEmail}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    btoa(unescape(encodeURIComponent(htmlBody))),
  ].join('\r\n');

  const encodedMessage = base64UrlEncode(rawMessage);

  // Step 3: Send via Gmail API users/me/messages/send
  const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: encodedMessage,
    }),
  });

  if (!sendRes.ok) {
    const errorBody = await sendRes.text();
    throw new Error(`Gmail API send failed: ${sendRes.status} ${errorBody}`);
  }

  const result = await sendRes.json();

  // Step 4: Apply label if created
  if (labelId && result.id) {
    try {
      await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${result.id}/modify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          addLabelIds: [labelId],
        }),
      });
    } catch (lblErr) {
      console.warn('Failed to attach label to sent email:', lblErr);
    }
  }

  return {
    messageId: result.id,
    threadId: result.threadId,
    labelId: labelId || '',
  };
}

/**
 * Fetches recent sent payment emails to display audit trail directly in the UI
 */
export async function fetchRecentReceiptEmails(
  accessToken: string,
  maxResults: number = 10
): Promise<SentReceiptMessage[]> {
  const query = 'subject:Receipt OR subject:Payment OR "PayHub"';
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent(
    query
  )}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch receipt emails: ${res.status}`);
  }

  const data = await res.json();
  if (!data.messages || data.messages.length === 0) {
    return [];
  }

  // Fetch snippets for top messages
  const messageDetails: SentReceiptMessage[] = [];
  for (const m of data.messages.slice(0, 6)) {
    try {
      const detailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=To&metadataHeaders=Date`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (detailRes.ok) {
        const detail = await detailRes.json();
        const headers = detail.payload?.headers || [];
        const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value;
        const to = headers.find((h: any) => h.name.toLowerCase() === 'to')?.value;
        const date = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value;

        messageDetails.push({
          id: detail.id,
          threadId: detail.threadId,
          labelIds: detail.labelIds || [],
          snippet: detail.snippet || '',
          subject,
          to,
          date,
        });
      }
    } catch {
      // Continue next message
    }
  }

  return messageDetails;
}
