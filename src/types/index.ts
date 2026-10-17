export type PaymentGateway = 'BKASH' | 'NAGAD' | 'STRIPE';

export type TransactionType = 'DISBURSEMENT' | 'PAYMENT_RECEIVED' | 'REFUND';

export type TransactionStatus = 'COMPLETED' | 'PENDING' | 'FAILED' | 'REVERSED';

export interface Transaction {
  id: string;
  trxId: string;
  invoiceNo: string;
  gateway: PaymentGateway;
  type: TransactionType;
  amount: number;
  currency: 'BDT' | 'USD' | 'EUR' | 'GBP';
  receiver: string;
  sender: string;
  status: TransactionStatus;
  createdAt: string;
  idempotencyKey: string;
  note?: string;
  gmailReceiptSent: boolean;
  gmailMessageId?: string;
  gmailRecipient?: string;
  metadata?: Record<string, any>;
}

export interface BkashPayoutParams {
  receiverMsisdn: string; // e.g. "01712345678"
  amount: number;
  currency: 'BDT';
  merchantInvoiceNumber: string;
  intent?: 'sale' | 'disbursement';
  note?: string;
  idempotencyKey?: string;
}

export interface NagadPayoutParams {
  receiverMsisdn: string; // e.g. "01812345678"
  amount: number;
  currency: 'BDT';
  merchantInvoiceNumber: string;
  merchantId?: string;
  secretKey?: string;
  publicKey?: string;
  idempotencyKey?: string;
}

export interface StripeChargeParams {
  amount: number;
  currency: 'USD' | 'EUR' | 'GBP' | 'BDT';
  customerEmail: string;
  customerName: string;
  cardNumber: string;
  expMonth: string;
  expYear: string;
  cvc: string;
  description?: string;
  idempotencyKey?: string;
}

export interface GmailReceiptRequest {
  toEmail: string;
  recipientName?: string;
  amount: number;
  currency: string;
  trxId: string;
  invoiceNo: string;
  gateway: PaymentGateway;
  type: TransactionType;
  completedAt: string;
  label?: string; // e.g. "Payments/Disbursed"
  note?: string;
}

export interface GatewayConfig {
  bkash: {
    appKey: string;
    appSecret: string;
    username: string;
    password: string;
    baseUrl: string;
    sandbox: boolean;
  };
  nagad: {
    merchantId: string;
    secretKey: string;
    publicKey: string;
    baseUrl: string;
    sandbox: boolean;
  };
  stripe: {
    publishableKey: string;
    secretKey: string;
    webhookSecret: string;
    sandbox: boolean;
  };
}

export interface WebhookConfig {
  gateway: PaymentGateway;
  endpointPath: string;
  secret: string;
  enabled: boolean;
  subscribedEvents: string[];
  autoUpdateLedger: boolean;
  autoSendGmailReceipt: boolean;
}

export interface WebhookLog {
  id: string;
  gateway: PaymentGateway;
  event: string;
  timestamp: string;
  status: number;
  statusText: string;
  durationMs: number;
  headers: Record<string, string>;
  payload: any;
  signatureVerified: boolean;
  ledgerUpdated?: boolean;
  receiptSent?: boolean;
  associatedInvoice?: string;
  associatedTrxId?: string;
  error?: string;
}

export type AuditCategory =
  | 'DISBURSEMENT'
  | 'CONFIG_CHANGE'
  | 'GMAIL_DISPATCH'
  | 'SECURITY_CRYPTO'
  | 'AUTHENTICATION'
  | 'DATA_EXPORT';

export type AuditSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type AuditStatus = 'SUCCESS' | 'FAILED' | 'BLOCKED';

export interface AuditActor {
  email: string;
  role: 'SUPER_ADMIN' | 'COMPLIANCE_OFFICER' | 'FINANCE_OPERATOR' | 'SYSTEM_AUTOMATION';
  ipAddress: string;
  userAgent?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  category: AuditCategory;
  severity: AuditSeverity;
  action: string;
  status: AuditStatus;
  actor: AuditActor;
  targetResource: string;
  details: Record<string, any>;
  previousState?: Record<string, any>;
  newState?: Record<string, any>;
  parentHash: string;
  hash: string;
}

