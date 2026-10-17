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
  {
    id: 'tx-005',
    trxId: 'BKS8M44X912',
    invoiceNo: 'INV-2026-0905',
    gateway: 'BKASH',
    type: 'DISBURSEMENT',
    amount: 14500.0,
    currency: 'BDT',
    receiver: '01755112233',
    sender: 'Merchant Account 01700000000',
    status: 'COMPLETED',
    createdAt: new Date(Date.now() - 86400000 * 1 - 3600000 * 3).toISOString(),
    idempotencyKey: 'idemp_bka_0905',
    gmailReceiptSent: true,
    metadata: { note: 'B2C Commission Payout' },
  },
  {
    id: 'tx-006',
    trxId: 'NGD9A12B003',
    invoiceNo: 'INV-2026-0906',
    gateway: 'NAGAD',
    type: 'DISBURSEMENT',
    amount: 8900.0,
    currency: 'BDT',
    receiver: '01844778899',
    sender: 'Merchant Account 01899990001',
    status: 'COMPLETED',
    createdAt: new Date(Date.now() - 86400000 * 1 - 3600000 * 7).toISOString(),
    idempotencyKey: 'idemp_ngd_0906',
    gmailReceiptSent: false,
    metadata: { note: 'Direct Agent Payout' },
  },
  {
    id: 'tx-007',
    trxId: 'pi_3Pj891048bBa',
    invoiceNo: 'INV-2026-0907',
    gateway: 'STRIPE',
    type: 'PAYMENT_RECEIVED',
    amount: 280.0,
    currency: 'USD',
    receiver: 'PayHub Merchant Stripe',
    sender: 'enterprise@acme-corp.com',
    status: 'COMPLETED',
    createdAt: new Date(Date.now() - 86400000 * 2 - 3600000 * 5).toISOString(),
    idempotencyKey: 'idemp_str_0907',
    gmailReceiptSent: true,
    metadata: { note: 'SaaS Subscription Tier 2' },
  },
  {
    id: 'tx-008',
    trxId: 'BKS4L21K883',
    invoiceNo: 'INV-2026-0908',
    gateway: 'BKASH',
    type: 'DISBURSEMENT',
    amount: 22000.0,
    currency: 'BDT',
    receiver: '01788223344',
    sender: 'Merchant Account 01700000000',
    status: 'COMPLETED',
    createdAt: new Date(Date.now() - 86400000 * 2 - 3600000 * 9).toISOString(),
    idempotencyKey: 'idemp_bka_0908',
    gmailReceiptSent: true,
    metadata: { note: 'Bulk Vendor Settlement' },
  },
  {
    id: 'tx-009',
    trxId: 'NGD3X99P112',
    invoiceNo: 'INV-2026-0909',
    gateway: 'NAGAD',
    type: 'DISBURSEMENT',
    amount: 16500.0,
    currency: 'BDT',
    receiver: '01811556677',
    sender: 'Merchant Account 01899990001',
    status: 'COMPLETED',
    createdAt: new Date(Date.now() - 86400000 * 3 - 3600000 * 4).toISOString(),
    idempotencyKey: 'idemp_ngd_0909',
    gmailReceiptSent: true,
    metadata: { note: 'Executive Payout' },
  },
  {
    id: 'tx-010',
    trxId: 'BKS9Z12Q554',
    invoiceNo: 'INV-2026-0910',
    gateway: 'BKASH',
    type: 'DISBURSEMENT',
    amount: 18400.0,
    currency: 'BDT',
    receiver: '01933445566',
    sender: 'Merchant Account 01700000000',
    status: 'COMPLETED',
    createdAt: new Date(Date.now() - 86400000 * 3 - 3600000 * 11).toISOString(),
    idempotencyKey: 'idemp_bka_0910',
    gmailReceiptSent: false,
  },
  {
    id: 'tx-011',
    trxId: 'pi_3Kk8291048bAa',
    invoiceNo: 'INV-2026-0911',
    gateway: 'STRIPE',
    type: 'PAYMENT_RECEIVED',
    amount: 450.0,
    currency: 'USD',
    receiver: 'PayHub Merchant Stripe',
    sender: 'jordan@cloudservices.net',
    status: 'COMPLETED',
    createdAt: new Date(Date.now() - 86400000 * 4 - 3600000 * 8).toISOString(),
    idempotencyKey: 'idemp_str_0911',
    gmailReceiptSent: true,
  },
  {
    id: 'tx-012',
    trxId: 'BKS5B77M321',
    invoiceNo: 'INV-2026-0912',
    gateway: 'BKASH',
    type: 'DISBURSEMENT',
    amount: 31000.0,
    currency: 'BDT',
    receiver: '01711998877',
    sender: 'Merchant Account 01700000000',
    status: 'COMPLETED',
    createdAt: new Date(Date.now() - 86400000 * 5 - 3600000 * 6).toISOString(),
    idempotencyKey: 'idemp_bka_0912',
    gmailReceiptSent: true,
    metadata: { note: 'Seasonal Bonus Release' },
  },
  {
    id: 'tx-013',
    trxId: 'NGD7C22K998',
    invoiceNo: 'INV-2026-0913',
    gateway: 'NAGAD',
    type: 'DISBURSEMENT',
    amount: 14200.0,
    currency: 'BDT',
    receiver: '01866332211',
    sender: 'Merchant Account 01899990001',
    status: 'COMPLETED',
    createdAt: new Date(Date.now() - 86400000 * 5 - 3600000 * 10).toISOString(),
    idempotencyKey: 'idemp_ngd_0913',
    gmailReceiptSent: true,
  },
  {
    id: 'tx-014',
    trxId: 'BKS2V88P443',
    invoiceNo: 'INV-2026-0914',
    gateway: 'BKASH',
    type: 'DISBURSEMENT',
    amount: 27500.0,
    currency: 'BDT',
    receiver: '01799221100',
    sender: 'Merchant Account 01700000000',
    status: 'COMPLETED',
    createdAt: new Date(Date.now() - 86400000 * 6 - 3600000 * 2).toISOString(),
    idempotencyKey: 'idemp_bka_0914',
    gmailReceiptSent: true,
  },
  {
    id: 'tx-015',
    trxId: 'pi_3Aa981248bCc',
    invoiceNo: 'INV-2026-0915',
    gateway: 'STRIPE',
    type: 'PAYMENT_RECEIVED',
    amount: 320.0,
    currency: 'USD',
    receiver: 'PayHub Merchant Stripe',
    sender: 'billing@dubai-agency.ae',
    status: 'COMPLETED',
    createdAt: new Date(Date.now() - 86400000 * 7 - 3600000 * 5).toISOString(),
    idempotencyKey: 'idemp_str_0915',
    gmailReceiptSent: true,
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

export interface CsvExportOptions {
  includeReconciliationFees?: boolean;
  dateRangeLabel?: string;
  customFilename?: string;
}

export interface CsvExportResult {
  filename: string;
  rowCount: number;
  totalGrossBdt: number;
  totalGrossUsd: number;
  totalFeesBdt: number;
  totalFeesUsd: number;
  totalNetBdt: number;
  totalNetUsd: number;
}

export function calculateGatewayFee(amount: number, gateway: PaymentGateway, currency: string): { fee: number; net: number; feeRateStr: string } {
  let fee = 0;
  let feeRateStr = '0.0%';

  if (gateway === 'BKASH') {
    // Standard bKash B2C Payout / Merchant Fee ~ 1.5%
    fee = Math.round(amount * 0.015 * 100) / 100;
    feeRateStr = '1.50%';
  } else if (gateway === 'NAGAD') {
    // Standard Nagad B2C Payout / Merchant Fee ~ 1.4%
    fee = Math.round(amount * 0.014 * 100) / 100;
    feeRateStr = '1.40%';
  } else if (gateway === 'STRIPE') {
    // Standard Stripe processing fee: 2.9% + $0.30 USD
    fee = Math.round((amount * 0.029 + 0.30) * 100) / 100;
    feeRateStr = '2.90% + $0.30';
  }

  const net = Math.max(0, Math.round((amount - fee) * 100) / 100);
  return { fee, net, feeRateStr };
}

export function getChartOfAccountsCategory(type: string, gateway: PaymentGateway): string {
  if (type === 'DISBURSEMENT') {
    return '2100 - Accounts Payable: B2C Payouts & Disbursements';
  } else if (type === 'REFUND') {
    return '2150 - Contra-Revenue / Customer Refunds & Reversals';
  } else {
    return `1200 - Accounts Receivable: ${gateway} Digital Collections`;
  }
}

export function exportTransactionsToCsv(
  transactions: Transaction[],
  options: CsvExportOptions = {}
): CsvExportResult {
  const headers = [
    'Transaction ID',
    'Invoice Number',
    'Posting Date (UTC)',
    'Posting Date (Local Formatted)',
    'Payment Gateway',
    'Transaction Type',
    'General Ledger Account (COA)',
    'Currency',
    'Gross Transaction Amount',
    'Gateway Fee Rate',
    'Estimated Gateway Processing Fee',
    'Net Settlement / Disbursed Amount',
    'Transaction Status',
    'Beneficiary / Receiver Account',
    'Payer / Sender Account',
    'Gmail Recipient Email',
    'Gmail Receipt Dispatched',
    'Audit / Gateway Label',
    'Idempotency Hash Key',
    'Accounting Memo / Notes',
  ];

  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  let totalGrossBdt = 0;
  let totalGrossUsd = 0;
  let totalFeesBdt = 0;
  let totalFeesUsd = 0;
  let totalNetBdt = 0;
  let totalNetUsd = 0;

  const rows = transactions.map((t) => {
    const { fee, net, feeRateStr } = calculateGatewayFee(t.amount, t.gateway, t.currency);
    const coa = getChartOfAccountsCategory(t.type, t.gateway);
    const createdAtDate = t.createdAt ? new Date(t.createdAt) : new Date();

    if (t.currency === 'BDT') {
      totalGrossBdt += t.amount;
      totalFeesBdt += fee;
      totalNetBdt += net;
    } else {
      totalGrossUsd += t.amount;
      totalFeesUsd += fee;
      totalNetUsd += net;
    }

    return [
      escapeCsv(t.trxId),
      escapeCsv(t.invoiceNo),
      escapeCsv(createdAtDate.toISOString()),
      escapeCsv(createdAtDate.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })),
      escapeCsv(t.gateway),
      escapeCsv(t.type),
      escapeCsv(coa),
      escapeCsv(t.currency),
      escapeCsv(t.amount.toFixed(2)),
      escapeCsv(feeRateStr),
      escapeCsv(fee.toFixed(2)),
      escapeCsv(net.toFixed(2)),
      escapeCsv(t.status),
      escapeCsv(t.receiver),
      escapeCsv(t.sender),
      escapeCsv(t.gmailRecipient || ''),
      escapeCsv(t.gmailReceiptSent ? 'YES' : 'NO'),
      escapeCsv(t.metadata?.disbursementLabel || `${t.gateway} ${t.type}`),
      escapeCsv(t.idempotencyKey || ''),
      escapeCsv(t.note || t.metadata?.note || t.metadata?.description || ''),
    ];
  });

  // Append Accounting Summary / Totals Row at the bottom
  const summaryDivider = headers.map(() => '""');
  const summaryRow = [
    escapeCsv('=== TOTAL RECONCILIATION SUMMARY ==='),
    escapeCsv(`Transactions: ${transactions.length}`),
    escapeCsv(''),
    escapeCsv(''),
    escapeCsv(''),
    escapeCsv(''),
    escapeCsv(''),
    escapeCsv('BDT / USD'),
    escapeCsv(`BDT ${totalGrossBdt.toFixed(2)} | USD $${totalGrossUsd.toFixed(2)}`),
    escapeCsv(''),
    escapeCsv(`BDT ${totalFeesBdt.toFixed(2)} | USD $${totalFeesUsd.toFixed(2)}`),
    escapeCsv(`BDT ${totalNetBdt.toFixed(2)} | USD $${totalNetUsd.toFixed(2)}`),
    escapeCsv(''),
    escapeCsv(''),
    escapeCsv(''),
    escapeCsv(''),
    escapeCsv(''),
    escapeCsv(''),
    escapeCsv(''),
    escapeCsv('Generated by PayHub Accounting Ledger Export'),
  ];

  const csvContent =
    '\uFEFF' +
    [headers.join(','), ...rows.map((r) => r.join(',')), summaryDivider.join(','), summaryRow.join(',')].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = options.customFilename || `payhub_accounting_ledger_${dateStr}.csv`;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return {
    filename,
    rowCount: transactions.length,
    totalGrossBdt,
    totalGrossUsd,
    totalFeesBdt,
    totalFeesUsd,
    totalNetBdt,
    totalNetUsd,
  };
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
