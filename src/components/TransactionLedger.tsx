import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Mail,
  Eye,
  FileSpreadsheet,
  FileCode,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Check,
  FileText,
  Calendar,
  X,
  ChevronDown,
  Sliders,
  DollarSign,
  Calculator,
  ShieldCheck,
  QrCode,
} from 'lucide-react';
import { Transaction, PaymentGateway, TransactionStatus } from '../types';
import {
  exportTransactionsToCsv,
  exportTransactionsToJson,
  computeLedgerStats,
  calculateGatewayFee,
  CsvExportResult,
} from '../services/ledger/ledger.service';
import { DisbursementChart } from './DisbursementChart';
import { LedgerSummaryCard } from './LedgerSummaryCard';
import { TransactionQrModal } from './TransactionQrModal';

interface Props {
  transactions: Transaction[];
  onSelectTransaction: (tx: Transaction) => void;
  onRequestSendReceipt: (tx: Transaction) => void;
  onRefresh: () => void;
  lang?: 'en' | 'bn';
}

type ExportDateRange = 'ALL' | 'TODAY' | '7DAYS' | 'THIS_MONTH' | 'LAST_MONTH';

export const TransactionLedger: React.FC<Props> = ({
  transactions,
  onSelectTransaction,
  onRequestSendReceipt,
  onRefresh,
  lang = 'en',
}) => {
  const [search, setSearch] = useState('');
  const [gatewayFilter, setGatewayFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  // Accounting Export Modal & Settings
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportTarget, setExportTarget] = useState<'FILTERED' | 'ALL'>('FILTERED');
  const [exportDateRange, setExportDateRange] = useState<ExportDateRange>('ALL');
  const [exportToast, setExportToast] = useState<CsvExportResult | null>(null);

  // QR Receipt Modal State
  const [qrSelectedTx, setQrSelectedTx] = useState<Transaction | null>(null);

  // Background 60-Second Auto-Refresh & Polling Service
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(true);
  const [secondsUntilNextPoll, setSecondsUntilNextPoll] = useState(60);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(() => new Date());

  const executeRefresh = useCallback(() => {
    setIsRefreshing(true);
    onRefresh();
    setLastRefreshedAt(new Date());
    setSecondsUntilNextPoll(60);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 650);
  }, [onRefresh]);

  // 60-second polling interval timer
  useEffect(() => {
    if (!isAutoRefreshEnabled) return;

    const timer = setInterval(() => {
      setSecondsUntilNextPoll((prev) => {
        if (prev <= 1) {
          executeRefresh();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isAutoRefreshEnabled, executeRefresh]);

  // Cross-tab synchronization via local storage events
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'payhub_ledger_transactions_v2') {
        executeRefresh();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [executeRefresh]);

  const stats = useMemo(() => computeLedgerStats(transactions), [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Gateway filter
      if (gatewayFilter !== 'ALL' && tx.gateway !== gatewayFilter) return false;
      // Status filter
      if (statusFilter !== 'ALL' && tx.status !== statusFilter) return false;
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTrx = tx.trxId.toLowerCase().includes(q);
        const matchInv = tx.invoiceNo.toLowerCase().includes(q);
        const matchRec = tx.receiver.toLowerCase().includes(q);
        const matchSender = tx.sender.toLowerCase().includes(q);
        const matchEmail = tx.gmailRecipient?.toLowerCase().includes(q) || false;
        const matchNote = (tx.note || tx.metadata?.note || '').toLowerCase().includes(q);
        if (!matchTrx && !matchInv && !matchRec && !matchSender && !matchEmail && !matchNote) return false;
      }
      return true;
    });
  }, [transactions, gatewayFilter, statusFilter, search]);

  // Direct quick CSV export
  const handleExportCsv = (targetList: Transaction[] = filteredTransactions, customName?: string) => {
    setIsExportingCsv(true);
    try {
      const result = exportTransactionsToCsv(targetList, { customFilename: customName });
      setExportToast(result);
      setTimeout(() => {
        setExportToast(null);
      }, 5000);
    } finally {
      setTimeout(() => {
        setIsExportingCsv(false);
      }, 1200);
    }
  };

  // Target records for the accounting modal with date range filters
  const modalTransactions = useMemo(() => {
    const base = exportTarget === 'FILTERED' ? filteredTransactions : transactions;
    if (exportDateRange === 'ALL') return base;

    const now = new Date();
    return base.filter((tx) => {
      const txDate = new Date(tx.createdAt);
      if (exportDateRange === 'TODAY') {
        return txDate.toDateString() === now.toDateString();
      }
      if (exportDateRange === '7DAYS') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return txDate >= sevenDaysAgo;
      }
      if (exportDateRange === 'THIS_MONTH') {
        return txDate.getFullYear() === now.getFullYear() && txDate.getMonth() === now.getMonth();
      }
      if (exportDateRange === 'LAST_MONTH') {
        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        return txDate.getFullYear() === year && txDate.getMonth() === lastMonth;
      }
      return true;
    });
  }, [exportTarget, exportDateRange, filteredTransactions, transactions]);

  // Live accounting reconciliation preview metrics
  const modalReconciliation = useMemo(() => {
    let grossBdt = 0;
    let feesBdt = 0;
    let netBdt = 0;
    let grossUsd = 0;
    let feesUsd = 0;
    let netUsd = 0;

    modalTransactions.forEach((tx) => {
      const { fee, net } = calculateGatewayFee(tx.amount, tx.gateway, tx.currency);
      if (tx.currency === 'BDT') {
        grossBdt += tx.amount;
        feesBdt += fee;
        netBdt += net;
      } else {
        grossUsd += tx.amount;
        feesUsd += fee;
        netUsd += net;
      }
    });

    return {
      count: modalTransactions.length,
      grossBdt,
      feesBdt,
      netBdt,
      grossUsd,
      feesUsd,
      netUsd,
    };
  }, [modalTransactions]);

  const handleConfirmAccountingExport = () => {
    const dateStr = new Date().toISOString().slice(0, 10);
    const rangeSlug = exportDateRange.toLowerCase();
    const filename = `payhub_accounting_${rangeSlug}_${dateStr}.csv`;
    handleExportCsv(modalTransactions, filename);
    setIsExportModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Executive Recharts Summary Dashboard Card: Daily Disbursement Totals & Success Rates */}
      <LedgerSummaryCard transactions={transactions} lang={lang} />

      {/* Top Metric Cards with Brand-Specific Gradients */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Disbursed (bKash Branded) */}
        <div className="p-5 rounded-2xl brand-card-bkash border shadow-md transition">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">{lang === 'bn' ? 'মোট ডিসবার্সমেন্ট (BDT)' : 'Total Disbursed (BDT)'}</span>
            <div className="p-1.5 rounded-lg bg-rose-600/10 text-rose-600 dark:text-pink-400 border border-rose-500/20">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-2">
            ৳{stats.totalDisbursedBdt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-rose-600 dark:text-pink-400/90 mt-1 flex items-center gap-1.5 font-medium">
            <span>bKash &bull; Nagad Payouts</span>
          </div>
        </div>

        {/* Total Received (Stripe Branded) */}
        <div className="p-5 rounded-2xl brand-card-stripe border shadow-md transition">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">{lang === 'bn' ? 'মোট পেমেন্ট গৃহীত (USD)' : 'Total Received (USD)'}</span>
            <div className="p-1.5 rounded-lg bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <ArrowDownLeft className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-2">
            ${stats.totalReceivedUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-indigo-600 dark:text-indigo-400/90 mt-1 flex items-center gap-1.5 font-medium">
            <span>Stripe International</span>
          </div>
        </div>

        {/* Success Rate */}
        <div className="p-5 rounded-2xl bg-emerald-50/70 dark:bg-slate-900/80 border border-emerald-200 dark:border-slate-800 shadow-md transition">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">{lang === 'bn' ? 'সফলতার হার' : 'Success Rate'}</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-2">
            {stats.successRate.toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {stats.completedCount} of {transactions.length} completed
          </div>
        </div>

        {/* Gateway Volume Distribution */}
        <div className="p-5 rounded-2xl brand-card-hub border shadow-md transition">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
            {lang === 'bn' ? 'গেটওয়ে বিভাজন' : 'Gateway Breakdown'}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs font-semibold">
            <span className="flex items-center gap-1 text-rose-600 dark:text-pink-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              bK: {stats.gatewayDistribution.bkash}
            </span>
            <span className="flex items-center gap-1 text-orange-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              NG: {stats.gatewayDistribution.nagad}
            </span>
            <span className="flex items-center gap-1 text-indigo-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              Str: {stats.gatewayDistribution.stripe}
            </span>
          </div>
        </div>
      </div>

      {/* 30-Day Gateway Disbursement Trends Chart (Recharts) */}
      <DisbursementChart transactions={transactions} lang={lang} />

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              lang === 'bn'
                ? 'আইডি, ইনভয়েস বা ফোন খুঁজুন...'
                : 'Search TrxID, invoice, phone, email...'
            }
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Gateway Filter */}
          <select
            value={gatewayFilter}
            onChange={(e) => setGatewayFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
          >
            <option value="ALL">{lang === 'bn' ? 'সব গেটওয়ে' : 'All Gateways'}</option>
            <option value="BKASH">bKash</option>
            <option value="NAGAD">Nagad</option>
            <option value="STRIPE">Stripe</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
          >
            <option value="ALL">{lang === 'bn' ? 'সব স্ট্যাটাস' : 'All Status'}</option>
            <option value="COMPLETED">Completed</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
          </select>

          {/* Auto-Refresh Toggle Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700/80 text-xs">
            <button
              type="button"
              onClick={() => setIsAutoRefreshEnabled(!isAutoRefreshEnabled)}
              className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white transition"
              title={
                isAutoRefreshEnabled
                  ? (lang === 'bn' ? 'অটো-রিফ্রেশ সক্রিয়: প্রতি ৬০ সেকেন্ডে নতুন ডেটা লোড হবে' : 'Auto-refresh active: fetching fresh ledger data every 60s')
                  : (lang === 'bn' ? 'অটো-রিফ্রেশ বন্ধ: চালু করতে ক্লিক করুন' : 'Auto-refresh paused: click to enable background polling')
              }
            >
              <span className="relative flex h-2 w-2">
                {isAutoRefreshEnabled && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isAutoRefreshEnabled ? 'bg-emerald-500' : 'bg-slate-600'
                  }`}
                />
              </span>
              <span className="font-medium text-slate-300 hidden sm:inline">
                {lang === 'bn' ? 'অটো-রিফ্রেশ' : 'Auto-Sync'}
              </span>
            </button>

            {isAutoRefreshEnabled ? (
              <span
                className="font-mono text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/60"
                title={lang === 'bn' ? `পরবর্তী রিফ্রেশ ${secondsUntilNextPoll} সেকেন্ডে` : `Next sync in ${secondsUntilNextPoll}s`}
              >
                {secondsUntilNextPoll}s
              </span>
            ) : (
              <span className="font-mono text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">
                OFF
              </span>
            )}

            {/* Toggle Switch */}
            <button
              type="button"
              onClick={() => setIsAutoRefreshEnabled(!isAutoRefreshEnabled)}
              className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isAutoRefreshEnabled ? 'bg-emerald-600' : 'bg-slate-700'
              }`}
              role="switch"
              aria-checked={isAutoRefreshEnabled}
              title={isAutoRefreshEnabled ? 'Toggle auto-refresh off' : 'Toggle auto-refresh on'}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isAutoRefreshEnabled ? 'translate-x-3' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Manual Refresh */}
          <button
            onClick={executeRefresh}
            className="p-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            title={
              lang === 'bn'
                ? `এখনই রিফ্রেশ করুন (সর্বশেষ: ${lastRefreshedAt.toLocaleTimeString()})`
                : `Refresh Ledger Now (Last sync: ${lastRefreshedAt.toLocaleTimeString()})`
            }
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
          </button>

          {/* Export to CSV (Accounting Ledger) & Accounting Options */}
          <div className="flex items-center rounded-xl overflow-hidden border border-emerald-700/60 shadow-sm">
            <button
              onClick={() => handleExportCsv(filteredTransactions)}
              disabled={filteredTransactions.length === 0}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isExportingCsv
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-950/70 hover:bg-emerald-900/70 text-emerald-300 hover:text-emerald-100'
              }`}
              title={lang === 'bn' ? 'বর্তমান ফিল্টার করা ডেটা CSV আকারে ডাউনলোড করুন' : 'Export current filtered transactions as CSV'}
            >
              {isExportingCsv ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>{lang === 'bn' ? 'এক্সপোর্ট সম্পন্ন!' : 'Exported!'}</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{lang === 'bn' ? 'CSV এক্সপোর্ট' : 'Export CSV'}</span>
                  <span className="text-[10px] bg-emerald-900/90 text-emerald-200 px-1.5 py-0.2 rounded-full border border-emerald-600/40 font-mono">
                    {filteredTransactions.length}
                  </span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsExportModalOpen(true)}
              className="px-2 py-2 bg-emerald-950/90 hover:bg-emerald-900/90 text-emerald-300 border-l border-emerald-700/60 transition cursor-pointer"
              title={lang === 'bn' ? 'অ্যাকাউন্টিং এক্সপোর্ট অপশন খুলুন' : 'Open Accounting Export Options & Reconciliation'}
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Export JSON */}
          <button
            onClick={() => exportTransactionsToJson(filteredTransactions)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-medium text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            title="Download transaction data as JSON"
          >
            <FileCode className="w-3.5 h-3.5 text-cyan-400" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">{lang === 'bn' ? 'ইনভয়েস ও আইডি' : 'Invoice & TrxID'}</th>
                <th className="py-3.5 px-4">{lang === 'bn' ? 'গেটওয়ে' : 'Gateway'}</th>
                <th className="py-3.5 px-4">{lang === 'bn' ? 'প্রাপক / গ্রাহক' : 'Receiver / Account'}</th>
                <th className="py-3.5 px-4">{lang === 'bn' ? 'পরিমাণ' : 'Amount'}</th>
                <th className="py-3.5 px-4">{lang === 'bn' ? 'স্ট্যাটাস' : 'Status'}</th>
                <th className="py-3.5 px-4">{lang === 'bn' ? 'তারিখ' : 'Timestamp'}</th>
                <th className="py-3.5 px-4">{lang === 'bn' ? 'জিমেইল রসিদ' : 'Gmail Receipt'}</th>
                <th className="py-3.5 px-4 text-right">{lang === 'bn' ? 'অ্যাকশন' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    {lang === 'bn' ? 'কোনো লেনদেন পাওয়া যায়নি।' : 'No transactions found matching criteria.'}
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{tx.invoiceNo}</div>
                      <div className="font-mono text-[11px] text-cyan-400">{tx.trxId}</div>
                      {(tx.note || tx.metadata?.note) && (
                        <div
                          className="text-[10px] text-slate-400 italic truncate max-w-[170px] flex items-center gap-1 mt-0.5"
                          title={tx.note || tx.metadata?.note}
                        >
                          <FileText className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                          <span className="truncate">{tx.note || tx.metadata?.note}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold ${
                          tx.gateway === 'BKASH'
                            ? 'bg-pink-950/80 text-pink-300 border border-pink-800/60'
                            : tx.gateway === 'NAGAD'
                            ? 'bg-orange-950/80 text-orange-300 border border-orange-800/60'
                            : 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/60'
                        }`}
                      >
                        {tx.gateway}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-slate-200 font-medium">{tx.receiver}</div>
                      <div className="text-[10px] text-slate-400">{tx.type}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-white">
                        {tx.currency === 'BDT' ? '৳' : tx.currency}{' '}
                        {tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          tx.status === 'COMPLETED'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : tx.status === 'PENDING'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[11px] text-slate-400">
                      {new Date(tx.createdAt).toLocaleDateString()}{' '}
                      <span className="text-slate-500">
                        {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {tx.gmailReceiptSent ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Sent</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => onRequestSendReceipt(tx)}
                          className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>Dispatch</span>
                        </button>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setQrSelectedTx(tx)}
                          className="p-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-400 hover:text-white border border-indigo-800/50 transition cursor-pointer"
                          title="Generate QR code receipt"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onSelectTransaction(tx)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                          title="View details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Ledger Accounting Footer Summary */}
        <div className="px-4 py-3 bg-slate-950/90 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>
              {lang === 'bn'
                ? `মোট ${transactions.length}টির মধ্যে ${filteredTransactions.length}টি লেনদেন প্রদর্শিত হচ্ছে`
                : `Showing ${filteredTransactions.length} of ${transactions.length} accounting records`}
            </span>
            <span className="text-slate-600 hidden sm:inline">&bull;</span>
            <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{lang === 'bn' ? 'সিঙ্ক:' : 'Synced:'} {lastRefreshedAt.toLocaleTimeString()}</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-500 hidden md:inline">
              UTF-8 BOM Encoded &bull; Excel &amp; Accounting Ready
            </span>
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 text-xs font-semibold transition cursor-pointer"
              title="Open full accounting CSV export dialog"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'অ্যাকাউন্টিং CSV রিপোর্ট এক্সপোর্ট' : 'Accounting CSV Export'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Accounting CSV Export Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-700/80 p-6 shadow-2xl text-slate-100 relative max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>{lang === 'bn' ? 'অ্যাকাউন্টিং CSV এক্সপোর্ট' : 'Accounting Ledger CSV Export'}</span>
                    <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                      Excel / QuickBooks
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {lang === 'bn'
                      ? 'জেনারেল লেজার কোড, গেটওয়ে ফি এবং নেট সেটেলমেন্টসহ অডিট উপযোগী CSV ডাউনলোড করুন'
                      : 'Generate GAAP/IFRS reconciliation CSV with Chart of Accounts & gateway fees'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-5 py-4">
              {/* Dataset Scope Selection */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">
                  {lang === 'bn' ? '১. লেনদেনের পরিসর নির্বাচন করুন:' : '1. Select Transaction Scope:'}
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setExportTarget('FILTERED')}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition cursor-pointer ${
                      exportTarget === 'FILTERED'
                        ? 'border-emerald-500 bg-emerald-950/40 text-white ring-1 ring-emerald-500/40'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs font-bold text-emerald-300">
                      {lang === 'bn' ? 'বর্তমান ফিল্টার করা তালিকা' : 'Current Filtered View'}
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1">
                      {filteredTransactions.length} {lang === 'bn' ? 'টি লেনদেন' : 'records selected'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportTarget('ALL')}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition cursor-pointer ${
                      exportTarget === 'ALL'
                        ? 'border-emerald-500 bg-emerald-950/40 text-white ring-1 ring-emerald-500/40'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs font-bold text-emerald-300">
                      {lang === 'bn' ? 'সম্পূর্ণ লেজার হিস্টোরি' : 'Complete Ledger History'}
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1">
                      {transactions.length} {lang === 'bn' ? 'টি সর্বমোট রেকর্ড' : 'total records'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Date Preset Filter */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">
                  {lang === 'bn' ? '২. অ্যাকাউন্টিং পিরিয়ড / সময়কাল:' : '2. Accounting Period:'}
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {[
                    { id: 'ALL', label: lang === 'bn' ? 'সব রেকর্ড' : 'All Time' },
                    { id: 'TODAY', label: lang === 'bn' ? 'আজকের' : 'Today' },
                    { id: '7DAYS', label: lang === 'bn' ? 'বিগত ৭ দিন' : 'Past 7 Days' },
                    { id: 'THIS_MONTH', label: lang === 'bn' ? 'চলতি মাস' : 'This Month' },
                    { id: 'LAST_MONTH', label: lang === 'bn' ? 'বিগত মাস' : 'Last Month' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setExportDateRange(p.id as ExportDateRange)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium text-center transition cursor-pointer ${
                        exportDateRange === p.id
                          ? 'bg-emerald-600 text-white font-semibold'
                          : 'bg-slate-950 text-slate-400 hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Reconciliation Preview Card */}
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-4">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-3 pb-2 border-b border-slate-800/80">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{lang === 'bn' ? 'রিকনসিলিয়েশন প্রিভিউ' : 'Reconciliation Preview'}</span>
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {modalReconciliation.count} {lang === 'bn' ? 'টি রেকর্ড' : 'rows ready'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  {/* BDT Reconciliation */}
                  <div className="space-y-1.5 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                    <div className="text-[11px] font-bold text-pink-400">bKash & Nagad (BDT)</div>
                    <div className="flex justify-between text-slate-300">
                      <span className="text-slate-400">Gross:</span>
                      <span className="font-mono font-medium">৳{modalReconciliation.grossBdt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-rose-400/90 text-[11px]">
                      <span>Est. Fees (~1.5%):</span>
                      <span className="font-mono">-৳{modalReconciliation.feesBdt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-400 pt-1 border-t border-slate-800">
                      <span>Net Payout:</span>
                      <span className="font-mono">৳{modalReconciliation.netBdt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* USD Reconciliation */}
                  <div className="space-y-1.5 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                    <div className="text-[11px] font-bold text-indigo-400">Stripe (USD)</div>
                    <div className="flex justify-between text-slate-300">
                      <span className="text-slate-400">Gross:</span>
                      <span className="font-mono font-medium">${modalReconciliation.grossUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-rose-400/90 text-[11px]">
                      <span>Est. Fees:</span>
                      <span className="font-mono">-${modalReconciliation.feesUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-400 pt-1 border-t border-slate-800">
                      <span>Net Settled:</span>
                      <span className="font-mono">${modalReconciliation.netUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                {/* Audit Columns Included */}
                <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    Includes Transaction ID, Invoice Number, UTC & Local Post Dates, COA Category, Currency, Gross, Fee, Net, Counterparty, Idempotency Hash & Gmail Dispatch State.
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmAccountingExport}
                disabled={modalTransactions.length === 0 || isExportingCsv}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold shadow-lg transition active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                <span>
                  {lang === 'bn'
                    ? `অ্যাকাউন্টিং CSV ডাউনলোড (${modalTransactions.length})`
                    : `Download Accounting CSV (${modalTransactions.length})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Success Floating Toast */}
      {exportToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-2xl p-4 shadow-2xl max-w-md flex items-start gap-3 ring-1 ring-emerald-500/20">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <Check className="w-4 h-4" />
            </div>
            <div className="flex-1 text-xs">
              <h4 className="font-bold text-white flex items-center justify-between">
                <span>{lang === 'bn' ? 'অ্যাকাউন্টিং CSV এক্সপোর্ট সফল!' : 'Accounting CSV Export Complete!'}</span>
                <button
                  onClick={() => setExportToast(null)}
                  className="text-slate-400 hover:text-white p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </h4>
              <p className="text-slate-300 font-mono text-[11px] mt-1 break-all">
                {exportToast.filename}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] text-slate-400">
                <span className="bg-slate-800 px-2 py-0.5 rounded text-emerald-300 font-semibold">
                  {exportToast.rowCount} {lang === 'bn' ? 'রেকর্ড' : 'records'}
                </span>
                {exportToast.totalGrossBdt > 0 && (
                  <span className="bg-slate-800 px-2 py-0.5 rounded text-pink-300">
                    ৳{exportToast.totalGrossBdt.toLocaleString()}
                  </span>
                )}
                {exportToast.totalGrossUsd > 0 && (
                  <span className="bg-slate-800 px-2 py-0.5 rounded text-indigo-300">
                    ${exportToast.totalGrossUsd.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Receipt Modal */}
      <TransactionQrModal
        isOpen={!!qrSelectedTx}
        onClose={() => setQrSelectedTx(null)}
        transaction={qrSelectedTx}
        lang={lang}
      />
    </div>
  );
};
