import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  Download,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  User,
  Clock,
  Key,
  Database,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Lock,
  Layers,
  Sparkles,
  Zap,
  Check,
  Copy,
  FileJson,
} from 'lucide-react';
import {
  AuditLogEntry,
  AuditCategory,
  AuditSeverity,
  AuditStatus,
} from '../types';
import {
  getLocalAuditLogs,
  recordAuditEvent,
  verifyAuditChainIntegrity,
  exportAuditLogsToCSV,
  exportAuditLogsToJSON,
  clearLocalAuditLogs,
} from '../services/audit/audit.service';

interface Props {
  userEmail?: string;
  lang?: 'en' | 'bn';
}

export const AuditLogView: React.FC<Props> = ({
  userEmail = 'monikhoku10@gmail.com',
  lang = 'en',
}) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | AuditCategory>('ALL');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | AuditSeverity>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | AuditStatus>('ALL');

  // Expanded log rows for detail view
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Integrity Check State
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<{
    isValid: boolean;
    verifiedCount: number;
    error?: string;
  } | null>(null);

  // Simulation modal state
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState<boolean>(false);
  const [simActionType, setSimActionType] = useState<string>('MANUAL_PAYOUT_OVERRIDE');
  const [simTarget, setSimTarget] = useState<string>('bKash: 01988887777');
  const [simSeverity, setSimSeverity] = useState<AuditSeverity>('CRITICAL');

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadLogs = () => {
    const data = getLocalAuditLogs();
    setLogs(data);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleRunIntegrityCheck = async () => {
    setIsVerifying(true);
    setVerificationResult(null);
    try {
      const result = await verifyAuditChainIntegrity(logs);
      setVerificationResult(result);
      if (result.isValid) {
        showToast(
          lang === 'bn'
            ? `সবগুলো (${result.verifiedCount}টি) লগ ক্রিপ্টোগ্রাফিকভাবে অক্ষত ও অপরিবর্তিত রয়েছে!`
            : `All ${result.verifiedCount} audit logs verified tamper-free via SHA-256 chain!`
        );
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSimulateSensitiveAction = async () => {
    let category: AuditCategory = 'DISBURSEMENT';
    let details: Record<string, any> = {};

    if (simActionType === 'MANUAL_PAYOUT_OVERRIDE') {
      category = 'DISBURSEMENT';
      details = {
        amount: 25000,
        currency: 'BDT',
        authorizedBy: userEmail,
        overrideCode: 'FIN_OVERRIDE_9921',
        reason: 'Emergency executive supplier release',
      };
    } else if (simActionType === 'SECURITY_SECRET_ROTATION') {
      category = 'CONFIG_CHANGE';
      details = {
        provider: 'Stripe & Nagad',
        keyType: 'HMAC_WEBHOOK_SECRET',
        rotationScheduled: false,
        triggeredManually: true,
      };
    } else if (simActionType === 'COMPLIANCE_VAULT_EXPORT') {
      category = 'DATA_EXPORT';
      details = {
        exportFormat: 'SOC2_JSON_ARCHIVE',
        recordsCount: logs.length,
        retentionPolicy: '7_YEARS',
      };
    } else {
      category = 'SECURITY_CRYPTO';
      details = {
        action: 'RSA_REKEYING',
        algorithm: 'RSA-OAEP-2048',
        vaultId: 'VAULT_BD_FINTECH_01',
      };
    }

    await recordAuditEvent({
      category,
      severity: simSeverity,
      action: simActionType,
      status: 'SUCCESS',
      actor: {
        email: userEmail,
        role: 'SUPER_ADMIN',
        ipAddress: '103.114.98.24 (Dhaka Gateway)',
      },
      targetResource: simTarget,
      details,
    });

    loadLogs();
    setIsSimulateModalOpen(false);
    showToast(
      lang === 'bn'
        ? 'সংবেদনশীল অ্যাকশন সফলভাবে অডিট ট্রেইলে যুক্ত হয়েছে!'
        : 'Sensitive action logged to tamper-proof audit trail!'
    );
  };

  const handleClearLogs = async () => {
    if (
      window.confirm(
        lang === 'bn'
          ? 'আপনি কি নিশ্চিত যে অডিট লগ সাফ করতে চান? এই অ্যাকশনটিও অডিট ট্রেইলে ক্রিপ্টোগ্রাফিকভাবে সংরক্ষিত হবে।'
          : 'Are you sure you want to clear audit logs? This action itself will be permanently logged as a CRITICAL audit event.'
      )
    ) {
      const remaining = await clearLocalAuditLogs(userEmail);
      setLogs(remaining);
      showToast(lang === 'bn' ? 'অডিট লগ রিসেট সম্পন্ন' : 'Audit logs cleared and logged');
    }
  };

  // Filter logs
  const filteredLogs = logs.filter((l) => {
    if (categoryFilter !== 'ALL' && l.category !== categoryFilter) return false;
    if (severityFilter !== 'ALL' && l.severity !== severityFilter) return false;
    if (statusFilter !== 'ALL' && l.status !== statusFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchAction = l.action.toLowerCase().includes(q);
      const matchActor = l.actor.email.toLowerCase().includes(q);
      const matchResource = l.targetResource.toLowerCase().includes(q);
      const matchId = l.id.toLowerCase().includes(q);
      if (!matchAction && !matchActor && !matchResource && !matchId) return false;
    }
    return true;
  });

  const criticalCount = logs.filter((l) => l.severity === 'CRITICAL').length;
  const warningCount = logs.filter((l) => l.severity === 'WARNING').length;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-slate-900 border border-indigo-500/40 text-white shadow-2xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Compliance Executive Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/70 to-slate-900 border border-indigo-500/30 flex items-center gap-4 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400">
              {lang === 'bn' ? 'মোট রেকর্ডকৃত অডিট ইভেন্ট' : 'Total Audit Entries'}
            </div>
            <div className="text-2xl font-extrabold text-white font-mono mt-0.5">{logs.length}</div>
            <div className="text-[11px] text-indigo-300 mt-0.5">Immutable Append-Only</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-4 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400">
              {lang === 'bn' ? 'সংবেদনশীল / ক্রিটিকাল অ্যাকশন' : 'Critical Actions'}
            </div>
            <div className="text-2xl font-extrabold text-rose-400 font-mono mt-0.5">
              {criticalCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {warningCount} Warnings &bull; Payout & Secrets
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-4 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400">
              {lang === 'bn' ? 'ক্রিপ্টোগ্রাফিক হ্যাশ চেইন' : 'Cryptographic Hash Chain'}
            </div>
            <div className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>SHA-256 Chained</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Tamper-Evident Merkle Chain</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-4 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400">
              {lang === 'bn' ? 'কমপ্লায়েন্স ফ্রেমওয়ার্ক' : 'Compliance Standards'}
            </div>
            <div className="text-xs font-bold text-white mt-1">SOC 2 / ISO 27001</div>
            <div className="text-[11px] text-amber-400 mt-0.5">Bangladesh Bank Fintech 2024</div>
          </div>
        </div>
      </div>

      {/* Toolbar & Filter Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                lang === 'bn'
                  ? 'অ্যাকশন, ব্যবহারকারী, আইপি বা ইনভয়েস খুঁজুন...'
                  : 'Search actions, actors, IP addresses, invoices...'
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRunIntegrityCheck}
              disabled={isVerifying}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-800/80 bg-emerald-950/40 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/60 transition cursor-pointer disabled:opacity-50"
              title="Verify cryptographic SHA-256 hash chaining"
            >
              <ShieldCheck className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
              <span>
                {isVerifying
                  ? 'Verifying...'
                  : lang === 'bn'
                  ? 'হ্যাশ চেইন যাচাই'
                  : 'Verify Chain Integrity'}
              </span>
            </button>

            <button
              onClick={() => setIsSimulateModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-700 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition cursor-pointer shadow-md"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>{lang === 'bn' ? 'অ্যাকশন সিমুলেট করুন' : 'Simulate Action'}</span>
            </button>

            <div className="flex items-center gap-1 border-l border-slate-700 pl-2">
              <button
                onClick={() => exportAuditLogsToCSV(filteredLogs)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white transition cursor-pointer"
                title="Export filtered records to CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>

              <button
                onClick={() => exportAuditLogsToJSON(filteredLogs)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white transition cursor-pointer"
                title="Export filtered records to JSON"
              >
                <FileJson className="w-3.5 h-3.5" />
                <span>JSON</span>
              </button>

              <button
                onClick={handleClearLogs}
                className="p-2 rounded-xl border border-rose-900/50 bg-rose-950/30 text-rose-400 hover:bg-rose-900/50 transition cursor-pointer"
                title="Purge logs"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              <option value="DISBURSEMENT">Disbursements & Payouts</option>
              <option value="CONFIG_CHANGE">Configuration & Secrets</option>
              <option value="GMAIL_DISPATCH">Gmail Vouchers</option>
              <option value="SECURITY_CRYPTO">Security & RSA Crypto</option>
              <option value="AUTHENTICATION">Authentication</option>
              <option value="DATA_EXPORT">Data Exports & Purges</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="WARNING">Warning</option>
              <option value="INFO">Info</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILED">Failed</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </div>

          <div className="ml-auto text-[11px] text-slate-400 font-mono">
            Showing {filteredLogs.length} of {logs.length} entries
          </div>
        </div>

        {/* Cryptographic Verification Banner if ran */}
        {verificationResult && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
              verificationResult.isValid
                ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                : 'bg-rose-950/70 border-rose-800 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {verificationResult.isValid ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>
                {verificationResult.isValid
                  ? `Cryptographic Merkle Chain verified: All ${verificationResult.verifiedCount} historical records have matching SHA-256 parent hashes. Zero unauthorized modifications detected.`
                  : `Integrity Failure: ${verificationResult.error}`}
              </span>
            </div>
            <span className="text-[10px] font-mono opacity-80">
              Verified at {new Date().toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>

      {/* Main Audit Trail Table */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4 w-10"></th>
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Category & Action</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Target Resource</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Hash (SHA-256)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    {lang === 'bn'
                      ? 'ফিল্টারের সাথে মেলে এমন কোনো অডিট রেকর্ড পাওয়া যায়নি।'
                      : 'No audit records match the current filter criteria.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;

                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className={`transition cursor-pointer hover:bg-slate-800/50 ${
                          isExpanded ? 'bg-slate-800/70' : ''
                        }`}
                      >
                        {/* Expand toggle */}
                        <td className="py-3 px-4 text-slate-400">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-indigo-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </td>

                        {/* Timestamp */}
                        <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString(undefined, {
                            month: 'short',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false,
                          })}
                        </td>

                        {/* Severity */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              log.severity === 'CRITICAL'
                                ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                : log.severity === 'WARNING'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {log.severity}
                          </span>
                        </td>

                        {/* Category & Action */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white font-mono text-xs">
                            {log.action}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {log.category.replace('_', ' ')}
                          </div>
                        </td>

                        {/* Actor */}
                        <td className="py-3 px-4">
                          <div className="text-slate-200 font-medium truncate max-w-[170px]">
                            {log.actor.email}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {log.actor.role} &bull; {log.actor.ipAddress.split(' ')[0]}
                          </div>
                        </td>

                        {/* Target Resource */}
                        <td className="py-3 px-4">
                          <div className="font-mono text-cyan-300 truncate max-w-[180px]">
                            {log.targetResource}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.status === 'SUCCESS'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>

                        {/* Hash preview */}
                        <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-400 whitespace-nowrap">
                          <span className="text-indigo-400 select-all">
                            {log.hash.substring(0, 10)}...{log.hash.substring(log.hash.length - 6)}
                          </span>
                        </td>
                      </tr>

                      {/* Expanded Details Pane */}
                      {isExpanded && (
                        <tr className="bg-slate-950/90 border-b border-slate-800">
                          <td colSpan={8} className="p-5">
                            <div className="space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
                                <div className="space-y-0.5">
                                  <div className="text-xs text-slate-400 font-mono">
                                    Log Identifier: <span className="text-white font-bold">{log.id}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-400">
                                    Actor User-Agent: {log.actor.userAgent || 'Web Client'}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopy(log.hash, log.id);
                                    }}
                                    className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white transition cursor-pointer flex items-center gap-1.5"
                                  >
                                    {copiedHash === log.id ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                    <span>{copiedHash === log.id ? 'Hash Copied' : 'Copy Hash'}</span>
                                  </button>
                                </div>
                              </div>

                              {/* Cryptographic Chain Info */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs">
                                <div>
                                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                                    Current Record SHA-256 Hash
                                  </span>
                                  <span className="text-emerald-400 break-all select-all block mt-0.5">
                                    {log.hash}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                                    Previous Parent Record Hash (Chain Anchor)
                                  </span>
                                  <span className="text-indigo-400 break-all select-all block mt-0.5">
                                    {log.parentHash}
                                  </span>
                                </div>
                              </div>

                              {/* State Diff if changes exist */}
                              {(log.previousState || log.newState) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-900/40 space-y-1">
                                    <span className="text-[11px] font-semibold text-rose-400 block">
                                      Previous State
                                    </span>
                                    <pre className="font-mono text-xs text-rose-300 overflow-x-auto">
                                      {JSON.stringify(log.previousState, null, 2)}
                                    </pre>
                                  </div>

                                  <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/40 space-y-1">
                                    <span className="text-[11px] font-semibold text-emerald-400 block">
                                      New State Applied
                                    </span>
                                    <pre className="font-mono text-xs text-emerald-300 overflow-x-auto">
                                      {JSON.stringify(log.newState, null, 2)}
                                    </pre>
                                  </div>
                                </div>
                              )}

                              {/* Detailed Metadata Payload */}
                              <div>
                                <span className="text-xs font-semibold text-slate-300 block mb-1.5">
                                  Contextual Audit Metadata (JSON)
                                </span>
                                <pre className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Simulation Modal */}
      {isSimulateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>
                  {lang === 'bn' ? 'সংবেদনশীল অ্যাকশন সিমুলেশন' : 'Simulate Sensitive Compliance Action'}
                </span>
              </h3>
              <button
                onClick={() => setIsSimulateModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Action Type</label>
                <select
                  value={simActionType}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSimActionType(val);
                    if (val === 'MANUAL_PAYOUT_OVERRIDE') {
                      setSimTarget('bKash: 01988887777');
                      setSimSeverity('CRITICAL');
                    } else if (val === 'SECURITY_SECRET_ROTATION') {
                      setSimTarget('Stripe Webhook Signing Secret');
                      setSimSeverity('WARNING');
                    } else if (val === 'COMPLIANCE_VAULT_EXPORT') {
                      setSimTarget('Ledger Archival Vault');
                      setSimSeverity('INFO');
                    } else {
                      setSimTarget('Nagad RSA-2048 HSM');
                      setSimSeverity('WARNING');
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none"
                >
                  <option value="MANUAL_PAYOUT_OVERRIDE">Manual Payout Force Override (bKash/Nagad)</option>
                  <option value="SECURITY_SECRET_ROTATION">Rotate Webhook Signing Secret</option>
                  <option value="COMPLIANCE_VAULT_EXPORT">Export Sensitive Compliance Ledger</option>
                  <option value="RSA_REKEYING">Cryptographic Keypair Rekeying</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Target Resource</label>
                <input
                  type="text"
                  value={simTarget}
                  onChange={(e) => setSimTarget(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Severity Level</label>
                <select
                  value={simSeverity}
                  onChange={(e) => setSimSeverity(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none"
                >
                  <option value="CRITICAL">CRITICAL (Red Alert)</option>
                  <option value="WARNING">WARNING (Yellow Notice)</option>
                  <option value="INFO">INFO (Standard Audit)</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-900/60 text-[11px] text-indigo-200">
                This action will be hashed using SHA-256 and chained into the audit trail under actor:
                <span className="font-mono font-bold block text-white mt-0.5">{userEmail}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsSimulateModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:text-white text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSimulateSensitiveAction}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-indigo-950"
              >
                Commit to Audit Trail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
