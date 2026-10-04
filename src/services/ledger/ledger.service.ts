import { Transaction, PaymentGateway, TransactionStatus } from '../../types';

const STORAGE_KEY = 'payhub_ledger_transactions_v2';
const IDEMPOTENCY_KEY_CACHE = 'payhub_idempotency_cache';

const INITIAL_SEED_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-001',
    trxId: 'BKS9K2A8114',
    invoiceNo: 'INV-2026-0901',
    gateway: 'BKASH',
    type: 'DISBURSEMENT',
    amount: 3500.0,
    currency: 'BDT',
    receiver: '01712345678',
    sender: 'Merchant Account 01700000000',
    status: 'COMPLETED',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    idempotencyKey: 'idemp_bkash_881920',
    gmailReceiptSent: true,
    gmailMessageId: '18fb92a01944e8',
    gmailRecipient: 'recipient@example.com',
    metadata: { note: 'Monthly Affiliate Payout' },
  },
  {
    id: 'tx-002',
    trxId: 'NGD8F21M992',
    invoiceNo: 'INV-2026-0902',
    gateway: 'NAGAD',
    type: 'DISBURSEMENT',
    amount: 5200.0,
    currency: 'BDT',
    receiver: '01899123456',
    sender: 'Merchant Account 01899990001',
    status: 'COMPLETED',
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    idempotencyKey: 'idemp_nagad_330192',
    gmailReceiptSent: true,
    gmailMessageId: '18fb8890214a1c',
    gmailRecipient: 'vendor.bangla@example.com',
    metadata: { note: 'Supplier Invoice settlement' },
  },
  {
    id: 'tx-003',
    trxId: 'pi_3M92kaLa_9918',
    invoiceNo: 'INV-2026-0903',
    gateway: 'STRIPE',
    type: 'PAYMENT_RECEIVED',
    amount: 145.0,
    currency: 'USD',
    receiver: 'PayHub Merchant Stripe',
    sender: 'alex.smith@globaltech.io',
    status: 'COMPLETED',
    createdAt: new Date(Date.now() - 3600000 * 14).toISOString(),
    idempotencyKey: 'idemp_stripe_77192',
    gmailReceiptSent: true,
    gmailMessageId: '18fb7002bc4501',
    gmailRecipient: 'alex.smith@globaltech.io',
    metadata: { cardBrand: 'Visa', last4: '4242' },
  },
  {
    id: 'tx-004',
    trxId: 'BKS7M31A002',
    invoiceNo: 'INV-2026-0904',
    gateway: 'BKASH',
    type: 'DISBURSEMENT',
    amount: 1200.0,
    currency: 'BDT',
    receiver: '01911223344',
    sender: 'Merchant Account 01700000000',
    status: 'COMPLETED',
    createdAt: new Date(Date.now() - 3600000 * 26).toISOString(),
    idempotencyKey: 'idemp_bkash_66191',
    gmailReceiptSent: false,
    gmailRecipient: 'user019@domain.com',
    metadata: { note: 'Cashback reward' },
  },
];

export function getTransactions(): Transaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SEED_TRANSACTIONS));
      return INITIAL_SEED_TRANSACTIONS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load transactions:', err);
    return INITIAL_SEED_TRANSACTIONS;
  }
}

export function saveTransaction(trx: Transaction): Transaction {
  const transactions = getTransactions();
  // Prepend new transaction
  const updated = [trx, ...transactions];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

  // Record idempotency key
  if (trx.idempotencyKey) {
    recordIdempotencyKey(trx.idempotencyKey, trx.trxId);
  }

  return trx;
}

export function updateTransaction(id: string, updates: Partial<Transaction>): Transaction | null {
  const transactions = getTransactions();
  const index = transactions.findIndex((t) => t.id === id);
  if (index === -1) return null;

  transactions[index] = { ...transactions[index], ...updates };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  return transactions[index];
}

export function clearTransactions(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Idempotency checking to protect against duplicate disbursements
 */
export function checkIdempotency(key: string): { exists: boolean; trxId?: string } {
  try {
    const raw = localStorage.getItem(IDEMPOTENCY_KEY_CACHE);
    if (!raw) return { exists: false };
    const map = JSON.parse(raw);
    if (map[key]) {
      return { exists: true, trxId: map[key] };
    }
    return { exists: false };
  } catch {
    return { exists: false };
  }
}

export function recordIdempotencyKey(key: string, trxId: string): void {
  try {
    const raw = localStorage.getItem(IDEMPOTENCY_KEY_CACHE) || '{}';
    const map = JSON.parse(raw);
    map[key] = trxId;
    localStorage.setItem(IDEMPOTENCY_KEY_CACHE, JSON.stringify(map));
  } catch (err) {
    console.error('Failed to record idempotency key:', err);
  }
}

export function exportTransactionsToCsv(transactions: Transaction[]): void {
  const headers = [
    'Transaction ID',
    'Invoice Number',
    'Gateway',
    'Transaction Type',
    'Gross Amount',
    'Currency',
    'Status',
    'Receiver / Customer',
    'Sender / Merchant',
    'Gmail Recipient Email',
    'Gmail Receipt Sent',
    'Mapped Gmail Label',
    'Idempotency Key',
    'Created At (UTC)',
    'Completed At (UTC)',
    'Notes / Reference',
  ];

  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = transactions.map((t) => [
    escapeCsv(t.trxId),
    escapeCsv(t.invoiceNo),
    escapeCsv(t.gateway),
    escapeCsv(t.type),
    escapeCsv(t.amount.toFixed(2)),
    escapeCsv(t.currency),
    escapeCsv(t.status),
    escapeCsv(t.receiver),
    escapeCsv(t.sender),
    escapeCsv(t.gmailRecipient || ''),
    escapeCsv(t.gmailReceiptSent ? 'YES' : 'NO'),
    escapeCsv(t.metadata?.disbursementLabel || ''),
    escapeCsv(t.idempotencyKey || ''),
    escapeCsv(t.createdAt ? new Date(t.createdAt).toISOString() : ''),
    escapeCsv(t.metadata?.completedAt ? new Date(t.metadata.completedAt).toISOString() : new Date(t.createdAt).toISOString()),
    escapeCsv(t.note || t.metadata?.note || t.metadata?.description || ''),
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const dateStr = new Date().toISOString().slice(0, 10);
  link.setAttribute('download', `payhub_accounting_ledger_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportTransactionsToJson(transactions: Transaction[]): void {
  const jsonStr = JSON.stringify(transactions, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `payhub_ledger_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface LedgerStats {
  totalDisbursedBdt: number;
  totalReceivedUsd: number;
  completedCount: number;
  pendingCount: number;
  failedCount: number;
  successRate: number;
  gatewayDistribution: {
    bkash: number;
    nagad: number;
    stripe: number;
  };
}

export function computeLedgerStats(transactions: Transaction[]): LedgerStats {
  let totalDisbursedBdt = 0;
  let totalReceivedUsd = 0;
  let completedCount = 0;
  let pendingCount = 0;
  let failedCount = 0;

  const gatewayDistribution = {
    bkash: 0,
    nagad: 0,
    stripe: 0,
  };

  for (const t of transactions) {
    if (t.status === 'COMPLETED') {
      completedCount++;
      if (t.type === 'DISBURSEMENT') {
        totalDisbursedBdt += t.amount;
      } else {
        totalReceivedUsd += t.amount;
      }
    } else if (t.status === 'PENDING') {
      pendingCount++;
    } else if (t.status === 'FAILED') {
      failedCount++;
    }

    if (t.gateway === 'BKASH') gatewayDistribution.bkash++;
    else if (t.gateway === 'NAGAD') gatewayDistribution.nagad++;
    else if (t.gateway === 'STRIPE') gatewayDistribution.stripe++;
  }

  const total = transactions.length;
  const successRate = total > 0 ? (completedCount / total) * 100 : 100;

  return {
    totalDisbursedBdt,
    totalReceivedUsd,
    completedCount,
    pendingCount,
    failedCount,
    successRate,
    gatewayDistribution,
  };
}
