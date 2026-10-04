import { BkashPayoutParams } from '../../types';

export interface BkashTokenResponse {
  statusCode: string;
  statusMessage: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
}

export interface BkashPayoutResponse {
  statusCode: string;
  statusMessage: string;
  paymentID: string;
  trxID: string;
  amount: string;
  transactionStatus: string;
  completedTime: string;
  merchantInvoiceNumber: string;
  receiverMSISDN: string;
  currency: string;
  intent: string;
}

// In-memory token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

export const BKASH_LIVE_BASE_URL = 'https://tokenized.pay.bka.sh/v1.2.0-beta';
export const BKASH_SANDBOX_BASE_URL = 'https://tokenized.sandbox.bka.sh/v1.2.0-beta';

// Detect whether environment is live or sandbox
const isLiveMode =
  (typeof process !== 'undefined' && process.env?.BKASH_ENV === 'live') ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BKASH_ENV === 'live');

export const BKASH_DEFAULT_CREDENTIALS = {
  env: isLiveMode ? 'live' : 'sandbox',
  appKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BKASH_APP_KEY) || 'bkash_app_key_sandbox_9921',
  appSecret: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BKASH_APP_SECRET) || 'bkash_sec_38fa099b24',
  username: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BKASH_USERNAME) || 'merchant_live_user',
  password: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BKASH_PASSWORD) || '●●●●●●●●',
  baseUrl: isLiveMode ? BKASH_LIVE_BASE_URL : BKASH_SANDBOX_BASE_URL,
};

export function validateBangladeshiMsisdn(msisdn: string): boolean {
  if (!msisdn) return false;
  // Cleans spaces, dashes, parentheses or plus
  const clean = msisdn.replace(/[\s\-+()]/g, '');
  // Accepts standard 11-digit (013-019XXXXXXXX), international 13-digit (88013-88019XXXXXXXX),
  // or 10-digit without leading 0 (13-19XXXXXXXX)
  return /^(?:8801|01)[3-9]\d{8}$/.test(clean) || /^1[3-9]\d{8}$/.test(clean);
}

export function formatBangladeshiMsisdn(msisdn: string): string {
  if (!msisdn) return '';
  const clean = msisdn.replace(/[\s\-+()]/g, '');
  if (clean.startsWith('880')) {
    return '0' + clean.slice(3);
  }
  if (clean.length === 10 && clean.startsWith('1')) {
    return '0' + clean;
  }
  return clean;
}

/**
 * Generates or retrieves cached bKash grant token
 */
export async function getBkashToken(credentials = BKASH_DEFAULT_CREDENTIALS): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 30000) {
    return cachedToken.token;
  }

  // Simulate network delay
  await new Promise((r) => setTimeout(r, 400));

  // Generated token
  const token = 'bka_jwt_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
  cachedToken = {
    token,
    expiresAt: now + 3600 * 1000, // 1 hour validity
  };
  return token;
}

/**
 * Executes bKash B2C Disbursement / Payout
 */
export async function executeBkashDisbursement(
  params: BkashPayoutParams,
  credentials = BKASH_DEFAULT_CREDENTIALS
): Promise<BkashPayoutResponse> {
  const formattedPhone = formatBangladeshiMsisdn(params.receiverMsisdn);
  if (!validateBangladeshiMsisdn(formattedPhone)) {
    throw new Error(`Invalid bKash receiver MSISDN "${params.receiverMsisdn}". Must be a valid 11-digit Bangladeshi number (e.g., 01712345678).`);
  }

  if (params.amount <= 0) {
    throw new Error('Payout amount must be greater than 0 BDT.');
  }

  const token = await getBkashToken(credentials);

  // Simulate gateway roundtrip
  await new Promise((r) => setTimeout(r, 650));

  const trxID = 'BKS' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 900 + 100);
  const paymentID = 'TR' + Math.random().toString(36).substring(2, 10).toUpperCase();

  const response: BkashPayoutResponse = {
    statusCode: '0000',
    statusMessage: 'Successful',
    paymentID,
    trxID,
    amount: params.amount.toFixed(2),
    transactionStatus: 'Completed',
    completedTime: new Date().toISOString(),
    merchantInvoiceNumber: params.merchantInvoiceNumber,
    receiverMSISDN: formattedPhone,
    currency: 'BDT',
    intent: params.intent || 'sale',
  };

  return response;
}
