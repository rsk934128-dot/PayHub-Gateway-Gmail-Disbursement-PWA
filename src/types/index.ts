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
