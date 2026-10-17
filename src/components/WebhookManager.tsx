import React, { useState, useEffect } from 'react';
import {
  Webhook,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Copy,
  RefreshCw,
  Trash2,
  Play,
  Terminal,
  ExternalLink,
  Code2,
  Settings,
  Activity,
  Key,
  Eye,
  EyeOff,
  Check,
  Radio,
  FileJson,
  Layers,
  Sparkles,
} from 'lucide-react';
import { PaymentGateway, WebhookConfig, WebhookLog } from '../types';
import {
  getWebhookConfigs,
  updateWebhookConfig,
  getWebhookLogs,
  clearWebhookLogs,
  simulateWebhookEvent,
  DEFAULT_WEBHOOK_CONFIGS,
} from '../services/webhook/webhook.service';

interface Props {
  lang?: 'en' | 'bn';
}

export const WebhookManager: React.FC<Props> = ({ lang = 'en' }) => {
  const [activeSubTab, setActiveSubTab] = useState<'monitor' | 'config' | 'simulator'>('monitor');
  const [configs, setConfigs] = useState<Record<PaymentGateway, WebhookConfig>>(DEFAULT_WEBHOOK_CONFIGS);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);

  // Filters
  const [gatewayFilter, setGatewayFilter] = useState<'ALL' | PaymentGateway>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'ERROR'>('ALL');

  // Secrets visibility
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Simulator state
  const [simGateway, setSimGateway] = useState<PaymentGateway>('BKASH');
  const [simEvent, setSimEvent] = useState<string>('disbursement.completed');
  const [simPayload, setSimPayload] = useState<string>('');
  const [simInvalidSig, setSimInvalidSig] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simResult, setSimResult] = useState<{ success: boolean; message: string; log?: WebhookLog } | null>(null);

  // Load configs & logs
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fetchedConfigs, fetchedLogs] = await Promise.all([getWebhookConfigs(), getWebhookLogs()]);
      setConfigs(fetchedConfigs);
      setLogs(fetchedLogs);
      if (fetchedLogs.length > 0 && !selectedLog) {
        setSelectedLog(fetchedLogs[0]);
      }
    } catch (e) {
      console.warn('Webhooks data loaded with offline fallback', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      try {
        const latestLogs = await getWebhookLogs();
        if (latestLogs && latestLogs.length > 0) {
          setLogs(latestLogs);
        }
      } catch {}
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // Update Simulator template when gateway or event changes
  useEffect(() => {
    const inv = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowIso = new Date().toISOString();

    if (simGateway === 'BKASH') {
      if (simEvent === 'disbursement.completed') {
        setSimPayload(
          JSON.stringify(
            {
              event: 'disbursement.completed',
              paymentID: 'TR' + Math.random().toString(36).substring(2, 9).toUpperCase(),
              trxID: 'BKS' + Date.now().toString(36).toUpperCase(),
              merchantInvoiceNumber: inv,
              amount: '2500.00',
              currency: 'BDT',
              receiverMSISDN: '01712345678',
              transactionStatus: 'Completed',
              dateTime: nowIso,
            },
            null,
            2
          )
        );
      } else {
        setSimPayload(
          JSON.stringify(
            {
              event: 'disbursement.failed',
              paymentID: 'TR' + Math.random().toString(36).substring(2, 9).toUpperCase(),
              merchantInvoiceNumber: inv,
              amount: '2500.00',
              currency: 'BDT',
              receiverMSISDN: '01712345678',
              transactionStatus: 'Failed',
              errorCode: '2023',
              errorMessage: 'Insufficient merchant pool funds',
              dateTime: nowIso,
            },
            null,
            2
          )
        );
      }
    } else if (simGateway === 'STRIPE') {
      setSimPayload(
        JSON.stringify(
          {
            id: 'evt_' + Math.random().toString(36).substring(2, 12),
            type: simEvent,
            created: Math.floor(Date.now() / 1000),
            data: {
              object: {
                id: 'pi_' + Math.random().toString(36).substring(2, 14),
                amount: 4500,
                currency: 'usd',
                status: simEvent === 'payment_intent.succeeded' ? 'succeeded' : 'requires_payment_method',
                customer_email: 'client@example.com',
                metadata: {
                  invoiceNo: inv,
                },
              },
            },
          },
          null,
          2
        )
      );
    } else {
      // NAGAD
      setSimPayload(
        JSON.stringify(
          {
            merchantId: 'NAGAD_B2C_POOL_991',
            merchantInvoice: inv,
            issuerPaymentRefNo: 'NGD' + Date.now().toString(36).toUpperCase(),
            receiverMSISDN: '01899990001',
            amount: '1800.00',
            status: simEvent === 'payout.settled' ? 'Success' : 'Failed',
            statusCode: simEvent === 'payout.settled' ? '000' : '501',
            dateTime: nowIso,
          },
          null,
          2
        )
      );
    }
  }, [simGateway, simEvent]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleToggleConfig = async (gw: PaymentGateway, field: keyof WebhookConfig, val: any) => {
    const updated = await updateWebhookConfig(gw, { [field]: val });
    setConfigs((prev) => ({ ...prev, [gw]: updated }));
  };

  const handleClearLogs = async () => {
    await clearWebhookLogs();
    setLogs([]);
    setSelectedLog(null);
  };

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    setSimResult(null);
    try {
      let parsed = {};
      try {
        parsed = JSON.parse(simPayload);
      } catch (err: any) {
        throw new Error('Invalid JSON format in payload editor: ' + err.message);
      }

      const res = await simulateWebhookEvent({
        gateway: simGateway,
        event: simEvent,
        payload: parsed,
        simulateInvalidSignature: simInvalidSig,
      });

      setSimResult({
        success: true,
        message: `${simGateway} webhook dispatched & verified successfully! (HTTP ${res.status})`,
        log: res.log,
      });

      // Reload logs
      const updatedLogs = await getWebhookLogs();
      setLogs(updatedLogs);
      setSelectedLog(res.log);
    } catch (err: any) {
      setSimResult({
        success: false,
        message: err.message || 'Webhook simulation rejected',
      });
      const updatedLogs = await getWebhookLogs();
      setLogs(updatedLogs);
    } finally {
      setIsSimulating(false);
    }
  };

  // Filter logs
  const filteredLogs = logs.filter((l) => {
    if (gatewayFilter !== 'ALL' && l.gateway !== gatewayFilter) return false;
    if (statusFilter === 'SUCCESS' && l.status >= 400) return false;
    if (statusFilter === 'ERROR' && l.status < 400) return false;
    return true;
  });

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://payhub.local';

  return (
    <div className="space-y-6">
      {/* Top Banner & KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/60 to-slate-900 border border-indigo-500/30 flex items-center gap-4 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Webhook className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400">
              {lang === 'bn' ? 'মোট প্রাপ্ত ওয়েবহুক' : 'Total Inbound Webhooks'}
            </div>
            <div className="text-2xl font-extrabold text-white font-mono mt-0.5">{logs.length}</div>
            <div className="text-[11px] text-indigo-300 flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Real-time listener active</span>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-4 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400">
              {lang === 'bn' ? 'সিগনেচার যাচাইকৃত' : 'Signatures Verified'}
            </div>
            <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-0.5">
              {logs.filter((l) => l.signatureVerified).length} / {logs.length || 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {logs.length > 0
                ? `${Math.round((logs.filter((l) => l.signatureVerified).length / logs.length) * 100)}% Pass Rate`
                : 'HMAC & RSA Active'}
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-4 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400">
              {lang === 'bn' ? 'সক্রিয় গেটওয়ে রিসিভার' : 'Active Receivers'}
            </div>
            <div className="text-2xl font-extrabold text-white font-mono mt-0.5">3 / 3</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Stripe, bKash & Nagad</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-4 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400">
              {lang === 'bn' ? 'লেজার ও জিমেইল সিঙ্ক' : 'Auto-Sync Actions'}
            </div>
            <div className="text-sm font-bold text-white mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Automated</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Zero-latency webhook handler</div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveSubTab('monitor')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeSubTab === 'monitor'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'লাইভ লগ মনিটর' : 'Live Inbound Monitor'}</span>
            <span className="text-[10px] bg-slate-950/60 px-1.5 py-0.5 rounded font-mono">
              {logs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('config')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeSubTab === 'config'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'গেটওয়ে এন্ডপয়েন্ট কনফিগ' : 'Endpoint Configurations'}</span>
          </button>

          <button
            onClick={() => setActiveSubTab('simulator')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeSubTab === 'simulator'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Play className="w-3.5 h-3.5 text-amber-400" />
            <span>{lang === 'bn' ? 'ওয়েবহুক টেস্ট রানার' : 'Test Simulator'}</span>
          </button>
        </div>

        {activeSubTab === 'monitor' && (
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-xs text-slate-300 hover:text-white transition cursor-pointer disabled:opacity-50"
              title="Refresh logs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
            </button>

            <button
              onClick={handleClearLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-900/60 bg-rose-950/40 text-xs text-rose-300 hover:bg-rose-900/60 transition cursor-pointer"
              title="Clear all logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'ক্লিয়ার লগ' : 'Clear Logs'}</span>
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: LIVE INBOUND MONITOR */}
      {activeSubTab === 'monitor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Event List */}
          <div className="lg:col-span-5 space-y-3">
            {/* Filter Controls */}
            <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Gateway:</span>
                <select
                  value={gatewayFilter}
                  onChange={(e) => setGatewayFilter(e.target.value as any)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none"
                >
                  <option value="ALL">All Gateways</option>
                  <option value="BKASH">bKash</option>
                  <option value="NAGAD">Nagad</option>
                  <option value="STRIPE">Stripe</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none"
                >
                  <option value="ALL">All Status</option>
                  <option value="SUCCESS">200 OK</option>
                  <option value="ERROR">Errors (4xx/5xx)</option>
                </select>
              </div>
            </div>

            {/* List of Incoming Webhook Events */}
            <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
              {filteredLogs.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-500 text-xs">
                  {lang === 'bn' ? 'কোনো ওয়েবহুক ইভেন্ট পাওয়া যায়নি।' : 'No webhook events match current filters.'}
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const isSelected = selectedLog?.id === log.id;
                  const isOk = log.status >= 200 && log.status < 300;

                  return (
                    <div
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={`p-3.5 rounded-xl border text-left transition cursor-pointer relative ${
                        isSelected
                          ? 'bg-slate-800/90 border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg'
                          : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              log.gateway === 'BKASH'
                                ? 'bg-pink-500'
                                : log.gateway === 'NAGAD'
                                ? 'bg-orange-500'
                                : 'bg-indigo-500'
                            }`}
                          />
                          <span className="font-bold text-white text-xs">{log.gateway}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              isOk
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                                : 'bg-rose-950 text-rose-400 border border-rose-800/60'
                            }`}
                          >
                            {log.status} {log.statusText.split(':')[0]}
                          </span>
                        </div>

                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(log.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>

                      <div className="mt-2 text-xs font-mono font-semibold text-slate-200 truncate">
                        {log.event}
                      </div>

                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-mono text-cyan-400 truncate max-w-[140px]">
                          {log.associatedInvoice || log.associatedTrxId || log.id}
                        </span>

                        <div className="flex items-center gap-1.5 font-mono text-[10px]">
                          {log.signatureVerified ? (
                            <span className="text-emerald-400 flex items-center gap-0.5">
                              <ShieldCheck className="w-3 h-3" />
                              <span>Verified</span>
                            </span>
                          ) : (
                            <span className="text-rose-400 flex items-center gap-0.5">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Sig Mismatch</span>
                            </span>
                          )}
                          <span className="text-slate-600">&bull;</span>
                          <span>{log.durationMs}ms</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Detailed Payload & Header Inspector */}
          <div className="lg:col-span-7">
            {selectedLog ? (
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-5 shadow-2xl">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                          selectedLog.gateway === 'BKASH'
                            ? 'bg-pink-950 text-pink-400 border border-pink-800'
                            : selectedLog.gateway === 'NAGAD'
                            ? 'bg-orange-950 text-orange-400 border border-orange-800'
                            : 'bg-indigo-950 text-indigo-400 border border-indigo-800'
                        }`}
                      >
                        {selectedLog.gateway}
                      </span>
                      <h4 className="font-mono font-bold text-white text-sm">{selectedLog.event}</h4>
                    </div>
                    <div className="text-xs text-slate-400 mt-1 font-mono">
                      Log ID: {selectedLog.id} &bull; Received: {new Date(selectedLog.timestamp).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 ${
                        selectedLog.status < 400
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                          : 'bg-rose-950/80 text-rose-400 border border-rose-800'
                      }`}
                    >
                      {selectedLog.status < 400 ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      )}
                      <span>HTTP {selectedLog.status}</span>
                    </span>

                    <button
                      onClick={() =>
                        handleCopy(JSON.stringify(selectedLog.payload, null, 2), selectedLog.id)
                      }
                      className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white transition cursor-pointer flex items-center gap-1"
                      title="Copy raw JSON payload"
                    >
                      {copiedKey === selectedLog.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === selectedLog.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Key Extraction Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      Associated Invoice
                    </span>
                    <span className="font-mono font-bold text-white mt-0.5 block truncate">
                      {selectedLog.associatedInvoice || 'N/A'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      Associated TrxID
                    </span>
                    <span className="font-mono font-bold text-cyan-400 mt-0.5 block truncate">
                      {selectedLog.associatedTrxId || 'N/A'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      Signature Security
                    </span>
                    <span
                      className={`font-semibold mt-0.5 block flex items-center gap-1 ${
                        selectedLog.signatureVerified ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {selectedLog.signatureVerified ? 'HMAC/RSA Valid' : 'Invalid Signature'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      Response Latency
                    </span>
                    <span className="font-mono text-slate-300 mt-0.5 block">
                      {selectedLog.durationMs} ms
                    </span>
                  </div>
                </div>

                {/* Error Banner if any */}
                {selectedLog.error && (
                  <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{selectedLog.error}</span>
                  </div>
                )}

                {/* Request Headers Inspector */}
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                    <span>HTTP Request Headers</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1 max-h-36 overflow-y-auto">
                    {Object.entries(selectedLog.headers || {}).map(([key, val]) => (
                      <div key={key} className="flex gap-2">
                        <span className="text-indigo-400 select-all">{key}:</span>
                        <span className="text-slate-400 select-all truncate">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Raw JSON Payload Viewer */}
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FileJson className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Decoded JSON Payload</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">application/json</span>
                  </div>
                  <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto max-h-72 leading-relaxed">
                    {JSON.stringify(selectedLog.payload, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-500 text-center">
                <Code2 className="w-10 h-10 mb-3 text-slate-600" />
                <p className="text-sm font-semibold">Select a webhook event from the list to inspect</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  View raw request headers, decrypted cryptographic payload, and automated actions taken.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ENDPOINT CONFIGURATIONS */}
      {activeSubTab === 'config' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>
                {lang === 'bn'
                  ? 'নিচের পাবলিক ইউআরএলগুলো বিকাশ, নগদ বা স্ট্রাইপ মার্চেন্ট পোর্টালে ওয়েবহুক হিসেবে যোগ করুন:'
                  : 'Configure the public Webhook Callback URLs below in your payment provider developer dashboards:'}
              </span>
            </div>
            <span className="text-[11px] font-mono text-indigo-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
              Host: {originUrl}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Stripe Card */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-extrabold text-xs">
                      St
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Stripe Webhooks</h4>
                      <p className="text-[11px] text-slate-400">Card Charge & PaymentIntent</p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={configs.STRIPE.enabled}
                      onChange={(e) => handleToggleConfig('STRIPE', 'enabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {/* Callback URL */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Callback URL (POST)</label>
                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-indigo-300">
                    <span className="truncate flex-1">{originUrl + configs.STRIPE.endpointPath}</span>
                    <button
                      onClick={() =>
                        handleCopy(originUrl + configs.STRIPE.endpointPath, 'url_stripe')
                      }
                      className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
                      title="Copy URL"
                    >
                      {copiedKey === 'url_stripe' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Signing Secret */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-slate-400">Webhook Signing Secret</label>
                    <button
                      onClick={() =>
                        setShowSecrets((prev) => ({ ...prev, STRIPE: !prev.STRIPE }))
                      }
                      className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {showSecrets.STRIPE ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showSecrets.STRIPE ? 'Hide' : 'Reveal'}</span>
                    </button>
                  </div>
                  <input
                    type={showSecrets.STRIPE ? 'text' : 'password'}
                    value={configs.STRIPE.secret}
                    onChange={(e) =>
                      setConfigs((prev) => ({
                        ...prev,
                        STRIPE: { ...prev.STRIPE, secret: e.target.value },
                      }))
                    }
                    onBlur={(e) => handleToggleConfig('STRIPE', 'secret', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Subscribed Events */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1.5">Subscribed Events</label>
                  <div className="flex flex-wrap gap-1.5">
                    {configs.STRIPE.subscribedEvents.map((ev) => (
                      <span
                        key={ev}
                        className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-950/60 border border-indigo-800 text-indigo-300"
                      >
                        {ev}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Automation Toggles */}
              <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-slate-300">Auto-update Ledger:</span>
                  <input
                    type="checkbox"
                    checked={configs.STRIPE.autoUpdateLedger}
                    onChange={(e) =>
                      handleToggleConfig('STRIPE', 'autoUpdateLedger', e.target.checked)
                    }
                    className="rounded text-indigo-600 bg-slate-900 border-slate-700"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-slate-300">Auto-dispatch Gmail Receipt:</span>
                  <input
                    type="checkbox"
                    checked={configs.STRIPE.autoSendGmailReceipt}
                    onChange={(e) =>
                      handleToggleConfig('STRIPE', 'autoSendGmailReceipt', e.target.checked)
                    }
                    className="rounded text-indigo-600 bg-slate-900 border-slate-700"
                  />
                </label>
              </div>
            </div>

            {/* bKash Card */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-pink-600/20 border border-pink-500/30 flex items-center justify-center text-pink-400 font-extrabold text-xs">
                      bK
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">bKash B2C Webhook</h4>
                      <p className="text-[11px] text-slate-400">Disbursement Status Notifications</p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={configs.BKASH.enabled}
                      onChange={(e) => handleToggleConfig('BKASH', 'enabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pink-600"></div>
                  </label>
                </div>

                {/* Callback URL */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Callback URL (POST)</label>
                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-pink-300">
                    <span className="truncate flex-1">{originUrl + configs.BKASH.endpointPath}</span>
                    <button
                      onClick={() =>
                        handleCopy(originUrl + configs.BKASH.endpointPath, 'url_bkash')
                      }
                      className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
                      title="Copy URL"
                    >
                      {copiedKey === 'url_bkash' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Signing Secret */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-slate-400">Callback Auth Secret</label>
                    <button
                      onClick={() =>
                        setShowSecrets((prev) => ({ ...prev, BKASH: !prev.BKASH }))
                      }
                      className="text-[10px] text-pink-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {showSecrets.BKASH ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showSecrets.BKASH ? 'Hide' : 'Reveal'}</span>
                    </button>
                  </div>
                  <input
                    type={showSecrets.BKASH ? 'text' : 'password'}
                    value={configs.BKASH.secret}
                    onChange={(e) =>
                      setConfigs((prev) => ({
                        ...prev,
                        BKASH: { ...prev.BKASH, secret: e.target.value },
                      }))
                    }
                    onBlur={(e) => handleToggleConfig('BKASH', 'secret', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-pink-500"
                  />
                </div>

                {/* Subscribed Events */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1.5">Subscribed Events</label>
                  <div className="flex flex-wrap gap-1.5">
                    {configs.BKASH.subscribedEvents.map((ev) => (
                      <span
                        key={ev}
                        className="px-2 py-0.5 rounded text-[10px] font-mono bg-pink-950/60 border border-pink-800 text-pink-300"
                      >
                        {ev}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Automation Toggles */}
              <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-slate-300">Auto-update Ledger:</span>
                  <input
                    type="checkbox"
                    checked={configs.BKASH.autoUpdateLedger}
                    onChange={(e) =>
                      handleToggleConfig('BKASH', 'autoUpdateLedger', e.target.checked)
                    }
                    className="rounded text-pink-600 bg-slate-900 border-slate-700"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-slate-300">Auto-dispatch Gmail Receipt:</span>
                  <input
                    type="checkbox"
                    checked={configs.BKASH.autoSendGmailReceipt}
                    onChange={(e) =>
                      handleToggleConfig('BKASH', 'autoSendGmailReceipt', e.target.checked)
                    }
                    className="rounded text-pink-600 bg-slate-900 border-slate-700"
                  />
                </label>
              </div>
            </div>

            {/* Nagad Card */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400 font-extrabold text-xs">
                      Ng
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Nagad B2C Webhook</h4>
                      <p className="text-[11px] text-slate-400">RSA Callback & Settlement</p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={configs.NAGAD.enabled}
                      onChange={(e) => handleToggleConfig('NAGAD', 'enabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-600"></div>
                  </label>
                </div>

                {/* Callback URL */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Callback URL (POST)</label>
                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-orange-300">
                    <span className="truncate flex-1">{originUrl + configs.NAGAD.endpointPath}</span>
                    <button
                      onClick={() =>
                        handleCopy(originUrl + configs.NAGAD.endpointPath, 'url_nagad')
                      }
                      className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
                      title="Copy URL"
                    >
                      {copiedKey === 'url_nagad' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Signing Secret */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-slate-400">Verification Public Key</label>
                    <button
                      onClick={() =>
                        setShowSecrets((prev) => ({ ...prev, NAGAD: !prev.NAGAD }))
                      }
                      className="text-[10px] text-orange-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {showSecrets.NAGAD ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showSecrets.NAGAD ? 'Hide' : 'Reveal'}</span>
                    </button>
                  </div>
                  <input
                    type={showSecrets.NAGAD ? 'text' : 'password'}
                    value={configs.NAGAD.secret}
                    onChange={(e) =>
                      setConfigs((prev) => ({
                        ...prev,
                        NAGAD: { ...prev.NAGAD, secret: e.target.value },
                      }))
                    }
                    onBlur={(e) => handleToggleConfig('NAGAD', 'secret', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                {/* Subscribed Events */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1.5">Subscribed Events</label>
                  <div className="flex flex-wrap gap-1.5">
                    {configs.NAGAD.subscribedEvents.map((ev) => (
                      <span
                        key={ev}
                        className="px-2 py-0.5 rounded text-[10px] font-mono bg-orange-950/60 border border-orange-800 text-orange-300"
                      >
                        {ev}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Automation Toggles */}
              <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-slate-300">Auto-update Ledger:</span>
                  <input
                    type="checkbox"
                    checked={configs.NAGAD.autoUpdateLedger}
                    onChange={(e) =>
                      handleToggleConfig('NAGAD', 'autoUpdateLedger', e.target.checked)
                    }
                    className="rounded text-orange-600 bg-slate-900 border-slate-700"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-slate-300">Auto-dispatch Gmail Receipt:</span>
                  <input
                    type="checkbox"
                    checked={configs.NAGAD.autoSendGmailReceipt}
                    onChange={(e) =>
                      handleToggleConfig('NAGAD', 'autoSendGmailReceipt', e.target.checked)
                    }
                    className="rounded text-orange-600 bg-slate-900 border-slate-700"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: WEBHOOK SIMULATOR & TESTER */}
      {activeSubTab === 'simulator' && (
        <div className="max-w-4xl mx-auto p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Play className="w-4 h-4 text-amber-400" />
              <span>{lang === 'bn' ? 'ইন্টারেক্টিভ ওয়েবহুক টেস্ট সিমুলেটর' : 'Interactive Webhook Test Simulator'}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {lang === 'bn'
                ? 'বিকাশ, নগদ বা স্ট্রাইপ সার্ভার থেকে আসা ওয়েবহুক পে-লোড সিমুলেট করে সিগনেচার যাচাই ও অটোমেশন পরীক্ষা করুন।'
                : 'Simulate realistic inbound payment webhooks from Stripe, bKash, or Nagad to test HMAC/RSA signature verification and ledger integration.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {lang === 'bn' ? 'টার্গেট গেটওয়ে' : 'Target Gateway'}
              </label>
              <select
                value={simGateway}
                onChange={(e) => {
                  const gw = e.target.value as PaymentGateway;
                  setSimGateway(gw);
                  if (gw === 'BKASH') setSimEvent('disbursement.completed');
                  else if (gw === 'STRIPE') setSimEvent('payment_intent.succeeded');
                  else setSimEvent('payout.settled');
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="BKASH">bKash B2C API (/api/webhooks/bkash)</option>
                <option value="NAGAD">Nagad B2C API (/api/webhooks/nagad)</option>
                <option value="STRIPE">Stripe Global Card (/api/webhooks/stripe)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {lang === 'bn' ? 'ইভেন্ট টেমপ্লেট' : 'Event Template'}
              </label>
              <select
                value={simEvent}
                onChange={(e) => setSimEvent(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {simGateway === 'BKASH' && (
                  <>
                    <option value="disbursement.completed">disbursement.completed (Success)</option>
                    <option value="disbursement.failed">disbursement.failed (Error)</option>
                    <option value="payout.callback">payout.callback (General)</option>
                  </>
                )}
                {simGateway === 'STRIPE' && (
                  <>
                    <option value="payment_intent.succeeded">payment_intent.succeeded (Success)</option>
                    <option value="payment_intent.payment_failed">payment_intent.payment_failed (Failed)</option>
                    <option value="charge.refunded">charge.refunded (Reversal)</option>
                  </>
                )}
                {simGateway === 'NAGAD' && (
                  <>
                    <option value="payout.settled">payout.settled (Settled)</option>
                    <option value="payout.rejected">payout.rejected (Rejected)</option>
                    <option value="callback.verify">callback.verify (Handshake)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Payload Editor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <FileJson className="w-3.5 h-3.5 text-indigo-400" />
                <span>Simulated Inbound Payload (JSON)</span>
              </label>
              <span className="text-[11px] text-slate-400 font-mono">Editable</span>
            </div>
            <textarea
              rows={9}
              value={simPayload}
              onChange={(e) => setSimPayload(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 font-mono text-xs text-emerald-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
            />
          </div>

          {/* Security Testing Toggles */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <span>Security Test: Simulate Invalid Signature</span>
              </span>
              <p className="text-[11px] text-slate-400">
                Sends a corrupt HMAC/RSA signature to test if the server correctly rejects the request with HTTP 401 Unauthorized.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={simInvalidSig}
                onChange={(e) => setSimInvalidSig(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
            </label>
          </div>

          {/* Result Alert */}
          {simResult && (
            <div
              className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
                simResult.success
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-800 text-rose-300'
              }`}
            >
              {simResult.success ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
              )}
              <div className="space-y-1">
                <span className="font-bold block">
                  {simResult.success ? 'Webhook Execution Successful' : 'Webhook Execution Error'}
                </span>
                <p>{simResult.message}</p>
                {simResult.log && (
                  <div className="text-[11px] font-mono text-slate-300 pt-1">
                    Log Entry: {simResult.log.id} &bull; Check "Live Inbound Monitor" tab for full audit.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Submit Action */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleRunSimulation}
              disabled={isSimulating}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold transition shadow-lg shadow-indigo-950/50 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isSimulating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Dispatching Webhook...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 text-amber-300 fill-amber-300" />
                  <span>
                    {lang === 'bn' ? 'টেস্ট ওয়েবহুক ইভেন্ট পাঠান' : 'Dispatch Test Webhook Event'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
