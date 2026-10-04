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
} from 'lucide-react';
import { Transaction, PaymentGateway, TransactionStatus } from '../types';
import {
  exportTransactionsToCsv,
  exportTransactionsToJson,
  computeLedgerStats,
} from '../services/ledger/ledger.service';
import { DisbursementChart } from './DisbursementChart';

interface Props {
  transactions: Transaction[];
  onSelectTransaction: (tx: Transaction) => void;
  onRequestSendReceipt: (tx: Transaction) => void;
  onRefresh: () => void;
  lang?: 'en' | 'bn';
}

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

  const handleExportCsv = () => {
    setIsExportingCsv(true);
    try {
      exportTransactionsToCsv(filteredTransactions);
    } finally {
      setTimeout(() => {
        setIsExportingCsv(false);
      }, 1800);
    }
  };

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

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Disbursed */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{lang === 'bn' ? 'মোট ডিসবার্সমেন্ট (BDT)' : 'Total Disbursed (BDT)'}</span>
            <div className="p-1.5 rounded-lg bg-pink-950/40 text-pink-400 border border-pink-800/40">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-white font-mono mt-2">
            ৳{stats.totalDisbursedBdt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-pink-400/90 mt-1 flex items-center gap-1.5">
            <span>bKash &bull; Nagad Payouts</span>
          </div>
        </div>

        {/* Total Received */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{lang === 'bn' ? 'মোট পেমেন্ট গৃহীত (USD)' : 'Total Received (USD)'}</span>
            <div className="p-1.5 rounded-lg bg-indigo-950/40 text-indigo-400 border border-indigo-800/40">
              <ArrowDownLeft className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-white font-mono mt-2">
            ${stats.totalReceivedUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-indigo-400/90 mt-1 flex items-center gap-1.5">
            <span>Stripe International</span>
          </div>
        </div>

        {/* Success Rate */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{lang === 'bn' ? 'সফলতার হার' : 'Success Rate'}</span>
            <div className="p-1.5 rounded-lg bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono mt-2">
            {stats.successRate.toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {stats.completedCount} of {transactions.length} completed
          </div>
        </div>

        {/* Gateway Volume Distribution */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
          <div className="text-xs text-slate-400 mb-2">
            {lang === 'bn' ? 'গেটওয়ে বিভাজন' : 'Gateway Breakdown'}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs">
            <span className="flex items-center gap-1 text-pink-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-pink-500" />
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

          {/* Export to CSV (Accounting Ledger) */}
          <button
            onClick={handleExportCsv}
            disabled={filteredTransactions.length === 0}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              isExportingCsv
                ? 'bg-emerald-600 border-emerald-500 text-white'
                : 'bg-emerald-950/60 hover:bg-emerald-900/60 border-emerald-700/60 text-emerald-300 hover:text-emerald-200'
            }`}
            title="Download current transaction data as CSV for accounting purposes"
          >
            {isExportingCsv ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>{lang === 'bn' ? 'এক্সপোর্ট সম্পন্ন!' : 'Exported to CSV!'}</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>{lang === 'bn' ? 'CSV এক্সপোর্ট' : 'Export to CSV'}</span>
                <span className="text-[10px] bg-emerald-900/80 text-emerald-200 px-1.5 py-0.5 rounded-full border border-emerald-700/50 font-mono">
                  {filteredTransactions.length}
                </span>
              </>
            )}
          </button>

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
                      <button
                        onClick={() => onSelectTransaction(tx)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                        title="View details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
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
              onClick={handleExportCsv}
              disabled={filteredTransactions.length === 0}
              className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 text-xs font-semibold transition cursor-pointer disabled:opacity-40"
              title="Download accounting CSV report"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'CSV ফাইল ডাউনলোড করুন' : 'Export to CSV'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
