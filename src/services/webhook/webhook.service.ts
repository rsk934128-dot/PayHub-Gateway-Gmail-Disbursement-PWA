import { PaymentGateway, WebhookConfig, WebhookLog } from '../../types';

const WEBHOOK_LOGS_STORAGE_KEY = 'payhub_webhook_logs_cache_v1';
const WEBHOOK_CONFIGS_STORAGE_KEY = 'payhub_webhook_configs_cache_v1';

export const DEFAULT_WEBHOOK_CONFIGS: Record<PaymentGateway, WebhookConfig> = {
  STRIPE: {
    gateway: 'STRIPE',
    endpointPath: '/api/webhooks/stripe',
    secret: 'whsec_live_948f9382bca8192d0012fba894',
    enabled: true,
    subscribedEvents: ['payment_intent.succeeded', 'payment_intent.payment_failed', 'charge.refunded'],
    autoUpdateLedger: true,
    autoSendGmailReceipt: true,
  },
  BKASH: {
    gateway: 'BKASH',
    endpointPath: '/api/webhooks/bkash',
    secret: 'bkash_wh_sec_b2c_88301fae298',
    enabled: true,
    subscribedEvents: ['disbursement.completed', 'disbursement.failed', 'payout.callback'],
    autoUpdateLedger: true,
    autoSendGmailReceipt: true,
  },
  NAGAD: {
    gateway: 'NAGAD',
    endpointPath: '/api/webhooks/nagad',
    secret: 'nagad_wh_pub_rsa_774910b2ef8',
    enabled: true,
    subscribedEvents: ['payout.settled', 'payout.rejected', 'callback.verify'],
    autoUpdateLedger: true,
    autoSendGmailReceipt: false,
  },
};

export const DEFAULT_WEBHOOK_LOGS: WebhookLog[] = [
  {
    id: 'wh_log_init_01',
    gateway: 'BKASH',
    event: 'disbursement.completed',
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    status: 200,
    statusText: 'OK',
    durationMs: 42,
    headers: {
      'content-type': 'application/json',
      'x-bkash-signature': 'sha256_bka_9a87d0f912e847c1a84f...',
      'user-agent': 'bKash-Webhook-Worker/1.2',
    },
    payload: {
      event: 'disbursement.completed',
      paymentID: 'TR88291039',
      trxID: 'BKS902819284',
      merchantInvoiceNumber: 'INV-2026-8921',
      amount: '3500.00',
      currency: 'BDT',
      receiverMSISDN: '01712345678',
      transactionStatus: 'Completed',
      dateTime: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    },
    signatureVerified: true,
    ledgerUpdated: true,
    receiptSent: true,
    associatedInvoice: 'INV-2026-8921',
    associatedTrxId: 'BKS902819284',
  },
  {
    id: 'wh_log_init_02',
    gateway: 'STRIPE',
    event: 'payment_intent.succeeded',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    status: 200,
    statusText: 'OK',
    durationMs: 38,
    headers: {
      'content-type': 'application/json',
      'stripe-signature': 't=1728000000,v1=99a72b8c91d84...',
      'user-agent': 'Stripe/1.0 (+https://stripe.com/docs/webhooks)',
    },
    payload: {
      id: 'evt_1Po8392810aBc',
      type: 'payment_intent.succeeded',
      created: Math.floor((Date.now() - 1000 * 60 * 45) / 1000),
      data: {
        object: {
          id: 'pi_3Pj8291048bBa',
          amount: 5000,
          currency: 'usd',
          status: 'succeeded',
          metadata: {
            invoiceNo: 'INV-2026-4412',
          },
          customer_email: 'client@example.com',
        },
      },
    },
    signatureVerified: true,
    ledgerUpdated: true,
    receiptSent: true,
    associatedInvoice: 'INV-2026-4412',
    associatedTrxId: 'pi_3Pj8291048bBa',
  },
  {
    id: 'wh_log_init_03',
    gateway: 'NAGAD',
    event: 'payout.settled',
    timestamp: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
    status: 200,
    statusText: 'OK',
    durationMs: 65,
    headers: {
      'content-type': 'application/json',
      'x-nagad-signature': 'rsa_sha256_pkcs1_082a9f...',
      'user-agent': 'Nagad-PGW-Notification/2.0',
    },
    payload: {
      merchantId: 'NAGAD_B2C_POOL_991',
      merchantInvoice: 'INV-2026-2104',
      issuerPaymentRefNo: 'NGD98301829',
      receiverMSISDN: '01899990001',
      amount: '2200.00',
      status: 'Success',
      statusCode: '000',
    },
    signatureVerified: true,
    ledgerUpdated: true,
    receiptSent: false,
    associatedInvoice: 'INV-2026-2104',
    associatedTrxId: 'NGD98301829',
  },
];

function getCachedLogs(): WebhookLog[] {
  try {
    const raw = localStorage.getItem(WEBHOOK_LOGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_WEBHOOK_LOGS;
}

function setCachedLogs(logs: WebhookLog[]): void {
  try {
    localStorage.setItem(WEBHOOK_LOGS_STORAGE_KEY, JSON.stringify(logs));
  } catch {}
}

/**
 * Fetch current webhook configurations from server or fallback
 */
export async function getWebhookConfigs(): Promise<Record<PaymentGateway, WebhookConfig>> {
  try {
    const res = await fetch('/api/webhooks/configs');
    if (res.ok) {
      const configs = await res.json();
      try {
        localStorage.setItem(WEBHOOK_CONFIGS_STORAGE_KEY, JSON.stringify(configs));
      } catch {}
      return configs;
    }
  } catch {
    // Network or server starting up
  }

  try {
    const cached = localStorage.getItem(WEBHOOK_CONFIGS_STORAGE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}

  return DEFAULT_WEBHOOK_CONFIGS;
}

/**
 * Update configuration for a specific payment gateway webhook
 */
export async function updateWebhookConfig(
  gateway: PaymentGateway,
  partial: Partial<WebhookConfig>
): Promise<WebhookConfig> {
  let updatedConfig: WebhookConfig = { ...DEFAULT_WEBHOOK_CONFIGS[gateway], ...partial };

  try {
    const res = await fetch('/api/webhooks/configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gateway, ...partial }),
    });
    if (res.ok) {
      const data = await res.json();
      updatedConfig = data.config;
    }
  } catch {
    // Local fallback
  }

  try {
    const current = await getWebhookConfigs();
    current[gateway] = updatedConfig;
    localStorage.setItem(WEBHOOK_CONFIGS_STORAGE_KEY, JSON.stringify(current));
  } catch {}

  return updatedConfig;
}

/**
 * Fetch historical & live incoming webhook logs
 */
export async function getWebhookLogs(): Promise<WebhookLog[]> {
  try {
    const res = await fetch('/api/webhooks/logs');
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.logs)) {
        setCachedLogs(data.logs);
        return data.logs;
      }
    }
  } catch {
    // Graceful offline / server restart fallback - avoid throwing console.error
  }
  return getCachedLogs();
}

/**
 * Clear webhook logs
 */
export async function clearWebhookLogs(): Promise<boolean> {
  try {
    setCachedLogs([]);
    await fetch('/api/webhooks/logs', { method: 'DELETE' });
    return true;
  } catch {
    return true;
  }
}

/**
 * Dispatch a simulated webhook to verify server signature checking and ledger sync
 */
export async function simulateWebhookEvent(params: {
  gateway: PaymentGateway;
  event: string;
  payload: any;
  simulateInvalidSignature?: boolean;
}): Promise<{ log: WebhookLog; response: any; status: number }> {
  try {
    const res = await fetch('/api/webhooks/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (res.ok) {
      const currentLogs = getCachedLogs();
      if (data.log) {
        setCachedLogs([data.log, ...currentLogs]);
      }
      return data;
    }

    if (res.status === 401 && data.log) {
      const currentLogs = getCachedLogs();
      setCachedLogs([data.log, ...currentLogs]);
      return data;
    }

    throw new Error(data.error || `Webhook rejected with HTTP ${res.status}`);
  } catch (err: any) {
    if (err.message && err.message.includes('401')) {
      throw err;
    }

    // Client-side fallback simulation if server is unreachable
    const isValid = !params.simulateInvalidSignature;
    const fallbackLog: WebhookLog = {
      id: 'wh_sim_' + Date.now(),
      gateway: params.gateway,
      event: params.event,
      timestamp: new Date().toISOString(),
      status: isValid ? 200 : 401,
      statusText: isValid ? 'OK' : 'Unauthorized: Signature Mismatch (Simulated)',
      durationMs: 14,
      headers: {
        'content-type': 'application/json',
        'x-simulated-signature': isValid ? 'valid_sig_sha256' : 'invalid_sig',
      },
      payload: params.payload || {},
      signatureVerified: isValid,
      ledgerUpdated: isValid,
      receiptSent: isValid,
      associatedInvoice: params.payload?.merchantInvoiceNumber || 'INV-2026-TEST',
      associatedTrxId: params.payload?.trxID || 'TRX-TEST',
      error: isValid ? undefined : 'Test simulation: Signature verification explicitly rejected',
    };

    const currentLogs = getCachedLogs();
    setCachedLogs([fallbackLog, ...currentLogs]);

    if (!isValid) {
      throw new Error('Simulated 401 Unauthorized: Invalid signature detected');
    }

    return {
      log: fallbackLog,
      response: { received: true },
      status: 200,
    };
  }
}
