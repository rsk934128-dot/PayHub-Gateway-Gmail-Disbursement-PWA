import React, { useState, useEffect } from 'react';
import {
  Wallet,
  BookOpen,
  Mail,
  Terminal,
  Shield,
  Send,
  Layers,
  Sparkles,
  Globe,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Bot,
  Webhook,
  ShieldAlert,
  LayoutDashboard,
  Sun,
  Moon,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, logoutGoogle, getAccessToken } from './services/gmail/auth';
import { sendPaymentReceiptEmail } from './services/gmail/gmail.service';
import { getTransactions, updateTransaction, saveTransaction } from './services/ledger/ledger.service';
import { Transaction, GmailReceiptRequest } from './types';
import { getMappedLabelForGateway } from './services/gmail/labelManager.service';
import { recordAuditEvent } from './services/audit/audit.service';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './hooks/useOnlineStatus';
import { DashboardSummary } from './components/DashboardSummary';
import { DisbursementForm } from './components/DisbursementForm';
import { AiAgentChat } from './components/AiAgentChat';
import { TransactionLedger } from './components/TransactionLedger';
import { WebhookManager } from './components/WebhookManager';
import { AuditLogView } from './components/AuditLogView';
import { GmailHub } from './components/GmailHub';
import { ApiSandbox } from './components/ApiSandbox';
import { SecurityCryptoView } from './components/SecurityCryptoView';
import { GmailConfirmModal } from './components/GmailConfirmModal';
import { TransactionDetailModal } from './components/TransactionDetailModal';
import { SpeedInsights } from '@vercel/speed-insights/react';

type NavTab = 'dashboard' | 'disbursement' | 'agent' | 'ledger' | 'webhooks' | 'audit' | 'gmail' | 'sandbox' | 'security';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [lang, setLang] = useState<'en' | 'bn'>('en');

  // Theme State: 'light' (vibrant colorful mode) or 'dark' (executive dark slate)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('payhub_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'light'; // Default to Light Mode so the app is not "সাদা কালো" / dark!
  });

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.body.classList.remove('light-mode');
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
    try {
      localStorage.setItem('payhub_theme', theme);
    } catch {}
  }, [theme]);

  // Firebase Auth & Gmail Access Token
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Transactions Ledger State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Gmail Confirmation Modal (Required for Workspace Mutating Operations)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [pendingReceipt, setPendingReceipt] = useState<GmailReceiptRequest | null>(null);
  const [isSendingReceipt, setIsSendingReceipt] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Load transactions and init Firebase auth listener on mount
  useEffect(() => {
    const loadedTx = getTransactions();
    setTransactions(loadedTx);

    // If opened via mobile QR scan (/?view=receipt&trx=...)
    try {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('view') === 'receipt') {
        const trx = searchParams.get('trx');
        const existing = loadedTx.find((t) => t.trxId === trx);
        if (existing) {
          setSelectedTransaction(existing);
        } else if (trx) {
          setSelectedTransaction({
            id: 'tx_scanned_' + trx,
            trxId: trx,
            invoiceNo: searchParams.get('inv') || 'INV-SCANNED',
            gateway: (searchParams.get('gw') || 'BKASH') as any,
            type: 'DISBURSEMENT',
            amount: Number(searchParams.get('amt') || '0'),
            currency: (searchParams.get('cur') || 'BDT') as any,
            receiver: searchParams.get('rec') || 'Beneficiary Account',
            sender: 'PayHub Merchant Pool',
            status: (searchParams.get('status') || 'COMPLETED') as any,
            createdAt: searchParams.get('dt') || new Date().toISOString(),
            idempotencyKey: 'scanned_idemp_' + trx,
            gmailReceiptSent: false,
          });
        }
      }
    } catch {}

    const unsubscribe = initAuth(
      (authedUser, token) => {
        setUser(authedUser);
        setAccessToken(token);
      },
      () => {
        setUser(null);
        setAccessToken(null);
      }
    );

    return () => unsubscribe();
  }, []);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleLogin = async () => {
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        showToast(
          lang === 'bn'
            ? 'গুগল অ্যাকাউন্ট ও জিমেইল সংযুক্ত হয়েছে!'
            : 'Google Account & Gmail connected successfully!'
        );
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setAuthError(err.message || 'Failed to sign in with Google');
      showToast(err.message || 'Google sign-in failed', 'error');
    }
  };

  const handleLogout = async () => {
    await logoutGoogle();
    setUser(null);
    setAccessToken(null);
    showToast(lang === 'bn' ? 'সাইন আউট সম্পন্ন হয়েছে' : 'Signed out from Google');
  };

  const handleTransactionCreated = (newTx: Transaction) => {
    setTransactions(getTransactions());
    
    // Log sensitive transaction to immutable compliance audit trail
    recordAuditEvent({
      category: 'DISBURSEMENT',
      severity: newTx.amount >= 20000 ? 'CRITICAL' : 'WARNING',
      action: `MANUAL_DISBURSEMENT_${newTx.gateway}`,
      status: newTx.status === 'COMPLETED' ? 'SUCCESS' : 'FAILED',
      actor: {
        email: user?.email || 'monikhoku10@gmail.com',
        role: 'FINANCE_OPERATOR',
      },
      targetResource: `${newTx.gateway}: ${newTx.receiver} (${newTx.invoiceNo})`,
      details: {
        trxId: newTx.trxId,
        amount: newTx.amount,
        currency: newTx.currency,
        idempotencyKey: newTx.idempotencyKey,
        type: newTx.type,
      },
    });

    showToast(
      lang === 'bn'
        ? `লেনদেন ${newTx.trxId} সফলভাবে সম্পন্ন হয়েছে`
        : `Disbursement ${newTx.trxId} completed & logged`
    );
  };

  const handleRequestSendReceipt = (receiptReq: GmailReceiptRequest) => {
    if (!accessToken || !user) {
      showToast(
        lang === 'bn'
          ? 'জিমেইল দিয়ে রসিদ পাঠাতে অনুগ্রহ করে প্রথমে Sign in with Google করুন।'
          : 'Please Sign in with Google first to dispatch Gmail receipts.',
        'error'
      );
      setActiveTab('gmail');
      return;
    }
    setPendingReceipt(receiptReq);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmSendReceipt = async () => {
    if (!pendingReceipt || !accessToken || !user) return;
    setIsSendingReceipt(true);

    try {
      const res = await sendPaymentReceiptEmail(accessToken, pendingReceipt, user.email || 'me');
      
      // Update transaction status in ledger
      const txToUpdate = transactions.find((t) => t.trxId === pendingReceipt.trxId);
      if (txToUpdate) {
        updateTransaction(txToUpdate.id, {
          gmailReceiptSent: true,
          gmailMessageId: res.messageId,
          gmailRecipient: pendingReceipt.toEmail,
        });
        setTransactions(getTransactions());
      }

      // Log Gmail receipt dispatch to compliance audit trail
      recordAuditEvent({
        category: 'GMAIL_DISPATCH',
        severity: 'INFO',
        action: 'GMAIL_PAYMENT_VOUCHER_AUTHORIZED',
        status: 'SUCCESS',
        actor: {
          email: user.email || 'monikhoku10@gmail.com',
          role: 'FINANCE_OPERATOR',
        },
        targetResource: `Recipient: ${pendingReceipt.toEmail}`,
        details: {
          trxId: pendingReceipt.trxId,
          invoiceNo: pendingReceipt.invoiceNo,
          amount: `${pendingReceipt.amount} ${pendingReceipt.currency}`,
          label: pendingReceipt.label || 'Payments/Disbursed',
          gmailMessageId: res.messageId,
        },
      });

      setIsConfirmModalOpen(false);
      setPendingReceipt(null);
      showToast(
        lang === 'bn'
          ? `পেমেন্ট রসিদ সফলভাবে ${pendingReceipt.toEmail}-এ পাঠানো হয়েছে (লেবেল: ${pendingReceipt.label || 'Payments/Disbursed'})`
          : `Receipt sent to ${pendingReceipt.toEmail} & filed under ${pendingReceipt.label || 'Payments/Disbursed'}!`,
        'success'
      );
    } catch (err: any) {
      console.error('Failed to send receipt:', err);
      showToast(`Failed to send receipt: ${err.message}`, 'error');
    } finally {
      setIsSendingReceipt(false);
    }
  };

  const getTabClass = (tab: NavTab, specialActive?: string) => {
    if (activeTab === tab) {
      return specialActive || 'bg-indigo-600 text-white shadow-sm font-semibold';
    }
    return theme === 'light'
      ? 'text-slate-600 hover:text-indigo-600 hover:bg-slate-200/70 font-medium'
      : 'text-slate-400 hover:text-white hover:bg-slate-800/60 font-medium';
  };

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
        theme === 'light'
          ? 'bg-slate-50 text-slate-900'
          : 'bg-[#070a13] text-slate-100'
      }`}
    >
      {/* Top Colorful Brand Accent Line */}
      <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 via-orange-500 via-emerald-500 to-indigo-600 shadow-md" />

      {/* Offline Banner */}
      <OfflineIndicator />

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold border animate-in slide-in-from-top-2 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-700/60 ring-1 ring-emerald-500/20'
              : 'bg-rose-950/90 text-rose-200 border-rose-700/60 ring-1 ring-rose-500/20'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Main Navigation Header */}
      <header
        className={`sticky top-0 z-40 backdrop-blur-md border-b transition-colors ${
          theme === 'light'
            ? 'bg-white/95 border-slate-200 shadow-sm'
            : 'bg-slate-900/90 border-slate-800'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-500 via-orange-500 to-indigo-600 p-0.5 shadow-md">
              <div
                className={`w-full h-full rounded-[10px] flex items-center justify-center ${
                  theme === 'light' ? 'bg-white' : 'bg-slate-950'
                }`}
              >
                <Wallet className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight">PayHub</span>
                <span className="text-[10px] bg-rose-600 text-white font-mono font-bold px-1.5 py-0.2 rounded shadow-sm">
                  bKash
                </span>
                <span className="text-[10px] bg-orange-500 text-white font-mono font-bold px-1.5 py-0.2 rounded shadow-sm">
                  Nagad
                </span>
                <span className="text-[10px] bg-indigo-600 text-white font-mono font-bold px-1.5 py-0.2 rounded shadow-sm">
                  Stripe
                </span>
              </div>
              <div
                className={`hidden sm:block text-[11px] ${
                  theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                Unified B2C Disbursement & Automated Gmail Receipts
              </div>
            </div>
          </div>

          {/* Center Tabs for Desktop */}
          <nav
            className={`hidden md:flex items-center gap-1 p-1 rounded-xl border text-xs transition-colors ${
              theme === 'light'
                ? 'bg-slate-100/90 border-slate-200'
                : 'bg-slate-950 border-slate-800'
            }`}
          >
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${getTabClass('dashboard')}`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'ড্যাশবোর্ড' : 'Dashboard'}</span>
            </button>

            <button
              onClick={() => setActiveTab('disbursement')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${getTabClass('disbursement')}`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'পেআউট ও পেমেন্ট' : 'Disburse & Pay'}</span>
            </button>

            <button
              onClick={() => setActiveTab('agent')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer relative ${getTabClass(
                'agent',
                'bg-gradient-to-r from-pink-600 to-indigo-600 text-white shadow-sm font-semibold'
              )}`}
            >
              <Bot className="w-3.5 h-3.5 text-pink-400" />
              <span>{lang === 'bn' ? 'এআই এজেন্ট' : 'AI Agent'}</span>
              <span className="text-[9px] bg-pink-500/20 text-pink-300 border border-pink-500/30 px-1 py-0.2 rounded font-mono">
                bKash
              </span>
            </button>

            <button
              onClick={() => setActiveTab('ledger')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${getTabClass('ledger')}`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'লেনদেন লেজার' : 'Ledger'}</span>
            </button>

            <button
              onClick={() => setActiveTab('webhooks')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${getTabClass('webhooks')}`}
            >
              <Webhook className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'ওয়েবহুক' : 'Webhooks'}</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${getTabClass('audit')}`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'অডিট লগ' : 'Audit Log'}</span>
            </button>

            <button
              onClick={() => setActiveTab('gmail')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer relative ${getTabClass('gmail')}`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'জিমেইল রসিদ' : 'Gmail Hub'}</span>
              {user && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute top-1.5 right-1.5" />}
            </button>

            <button
              onClick={() => setActiveTab('sandbox')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${getTabClass('sandbox')}`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'এপিআই স্যান্ডবক্স' : 'API Sandbox'}</span>
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${getTabClass('security')}`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'নিরাপত্তা ও টেস্ট' : 'Security & Tests'}</span>
            </button>
          </nav>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle (Light / Dark Mode) */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer shadow-sm ${
                theme === 'light'
                  ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 border-amber-300 hover:brightness-105'
                  : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-indigo-400/50 hover:brightness-110 shadow-indigo-900/30'
              }`}
              title={theme === 'light' ? 'Switch to Dark Neon Mode (ডার্ক মোড)' : 'Switch to Light Vibrant Mode (উজ্জ্বল রঙিন মোড)'}
            >
              {theme === 'light' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-slate-950 fill-amber-300" />
                  <span>{lang === 'bn' ? 'লাইট মোড (রঙিন)' : 'Light Mode'}</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                  <span>{lang === 'bn' ? 'ডার্ক মোড (নিয়ন)' : 'Dark Mode'}</span>
                </>
              )}
            </button>

            {/* Language Switcher */}
            <button
              onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer shadow-sm ${
                theme === 'light'
                  ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600'
                  : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title="Switch Language / ভাষা পরিবর্তন"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-500" />
              <span>{lang === 'en' ? 'বাংলা' : 'EN'}</span>
            </button>

            {/* In-App PWA Install Button */}
            <PWAInstallButton lang={lang} />

            {/* Google Sign-in / User Avatar */}
            {user ? (
              <div
                onClick={() => setActiveTab('gmail')}
                className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 transition cursor-pointer"
                title={`Connected as ${user.email}`}
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt="avatar" className="w-6 h-6 rounded-full" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {(user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <span className="hidden xl:inline text-xs text-slate-300 font-mono truncate max-w-[120px]">
                  {user.email?.split('@')[0]}
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5 text-red-400" />
                <span>Connect Gmail</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Tab Bar */}
        <div
          className={`md:hidden flex items-center justify-around border-t py-2 px-1 text-[11px] overflow-x-auto ${
            theme === 'light'
              ? 'bg-white border-slate-200 shadow-inner'
              : 'bg-slate-950 border-slate-800'
          }`}
        >
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1 ${
              activeTab === 'dashboard'
                ? theme === 'light'
                  ? 'text-indigo-600 font-bold'
                  : 'text-indigo-400 font-bold'
                : theme === 'light'
                ? 'text-slate-500 hover:text-slate-800'
                : 'text-slate-400'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab('disbursement')}
            className={`flex flex-col items-center gap-1 ${
              activeTab === 'disbursement'
                ? theme === 'light'
                  ? 'text-indigo-600 font-bold'
                  : 'text-indigo-400 font-bold'
                : theme === 'light'
                ? 'text-slate-500 hover:text-slate-800'
                : 'text-slate-400'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Payout</span>
          </button>
          <button
            onClick={() => setActiveTab('agent')}
            className={`flex flex-col items-center gap-1 ${
              activeTab === 'agent'
                ? 'text-pink-500 font-bold'
                : theme === 'light'
                ? 'text-slate-500 hover:text-pink-600'
                : 'text-slate-400'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>AI Agent</span>
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex flex-col items-center gap-1 ${
              activeTab === 'ledger'
                ? theme === 'light'
                  ? 'text-indigo-600 font-bold'
                  : 'text-indigo-400 font-bold'
                : theme === 'light'
                ? 'text-slate-500 hover:text-slate-800'
                : 'text-slate-400'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Ledger</span>
          </button>
          <button
            onClick={() => setActiveTab('webhooks')}
            className={`flex flex-col items-center gap-1 ${
              activeTab === 'webhooks'
                ? theme === 'light'
                  ? 'text-indigo-600 font-bold'
                  : 'text-indigo-400 font-bold'
                : theme === 'light'
                ? 'text-slate-500 hover:text-slate-800'
                : 'text-slate-400'
            }`}
          >
            <Webhook className="w-4 h-4" />
            <span>Webhooks</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex flex-col items-center gap-1 ${
              activeTab === 'audit'
                ? theme === 'light'
                  ? 'text-indigo-600 font-bold'
                  : 'text-indigo-400 font-bold'
                : theme === 'light'
                ? 'text-slate-500 hover:text-slate-800'
                : 'text-slate-400'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Audit</span>
          </button>
          <button
            onClick={() => setActiveTab('gmail')}
            className={`flex flex-col items-center gap-1 relative ${
              activeTab === 'gmail'
                ? theme === 'light'
                  ? 'text-indigo-600 font-bold'
                  : 'text-indigo-400 font-bold'
                : theme === 'light'
                ? 'text-slate-500 hover:text-slate-800'
                : 'text-slate-400'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Gmail</span>
            {user && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute top-0 right-3" />}
          </button>
          <button
            onClick={() => setActiveTab('sandbox')}
            className={`flex flex-col items-center gap-1 ${
              activeTab === 'sandbox'
                ? theme === 'light'
                  ? 'text-indigo-600 font-bold'
                  : 'text-indigo-400 font-bold'
                : theme === 'light'
                ? 'text-slate-500 hover:text-slate-800'
                : 'text-slate-400'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>API</span>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex flex-col items-center gap-1 ${
              activeTab === 'security'
                ? theme === 'light'
                  ? 'text-indigo-600 font-bold'
                  : 'text-indigo-400 font-bold'
                : theme === 'light'
                ? 'text-slate-500 hover:text-slate-800'
                : 'text-slate-400'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Security</span>
          </button>
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <DashboardSummary
            transactions={transactions}
            onNavigateTab={(tab) => setActiveTab(tab as any)}
            lang={lang}
            theme={theme}
          />
        )}

        {activeTab === 'disbursement' && (
          <DisbursementForm
            onTransactionCreated={handleTransactionCreated}
            onRequestGmailReceipt={handleRequestSendReceipt}
            userEmail={user?.email || undefined}
            isGmailConnected={!!accessToken}
            lang={lang}
          />
        )}

        {activeTab === 'agent' && (
          <AiAgentChat
            onTransactionCreated={handleTransactionCreated}
            onNavigateToLedger={() => setActiveTab('ledger')}
            lang={lang}
          />
        )}

        {activeTab === 'ledger' && (
          <TransactionLedger
            transactions={transactions}
            onSelectTransaction={(tx) => setSelectedTransaction(tx)}
            onRequestSendReceipt={(tx) =>
              handleRequestSendReceipt({
                toEmail: tx.gmailRecipient || 'customer@example.com',
                amount: tx.amount,
                currency: tx.currency,
                trxId: tx.trxId,
                invoiceNo: tx.invoiceNo,
                gateway: tx.gateway,
                type: tx.type,
                completedAt: tx.createdAt,
                label: getMappedLabelForGateway(tx.gateway, tx.type),
              })
            }
            onRefresh={() => setTransactions(getTransactions())}
            lang={lang}
          />
        )}

        {activeTab === 'webhooks' && <WebhookManager lang={lang} />}

        {activeTab === 'audit' && (
          <AuditLogView userEmail={user?.email || undefined} lang={lang} />
        )}

        {activeTab === 'gmail' && (
          <GmailHub
            isGmailConnected={!!accessToken}
            userEmail={user?.email || undefined}
            userName={user?.displayName || undefined}
            userPhoto={user?.photoURL || undefined}
            accessToken={accessToken}
            onLogin={handleLogin}
            onLogout={handleLogout}
            onRequestSendReceipt={handleRequestSendReceipt}
            lang={lang}
          />
        )}

        {activeTab === 'sandbox' && <ApiSandbox lang={lang} />}

        {activeTab === 'security' && <SecurityCryptoView lang={lang} />}
      </main>

      {/* Mandatory User Confirmation Dialog for Workspace Mail Dispatch */}
      <GmailConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmSendReceipt}
        params={pendingReceipt}
        senderEmail={user?.email || 'authenticated user'}
        isSending={isSendingReceipt}
        lang={lang}
      />

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        onRequestSendReceipt={(tx) => {
          setSelectedTransaction(null);
          handleRequestSendReceipt({
            toEmail: tx.gmailRecipient || 'customer@example.com',
            amount: tx.amount,
            currency: tx.currency,
            trxId: tx.trxId,
            invoiceNo: tx.invoiceNo,
            gateway: tx.gateway,
            type: tx.type,
            completedAt: tx.createdAt,
            label: getMappedLabelForGateway(tx.gateway, tx.type),
          });
        }}
        lang={lang}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            PayHub Gateway Hub &bull; Stripe, bKash B2C, Nagad RSA &bull; Gmail API
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Idempotency Protected</span>
            <span>&bull;</span>
            <span>RSA-OAEP 2048</span>
            <span>&bull;</span>
            <span>PWA Offline-Ready</span>
          </div>
        </div>
      </footer>
      <SpeedInsights />
    </div>
  );
}
