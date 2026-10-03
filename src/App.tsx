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
} from 'lucide-react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, logoutGoogle, getAccessToken } from './services/gmail/auth';
import { sendPaymentReceiptEmail } from './services/gmail/gmail.service';
import { getTransactions, updateTransaction, saveTransaction } from './services/ledger/ledger.service';
import { Transaction, GmailReceiptRequest } from './types';
import { getMappedLabelForGateway } from './services/gmail/labelManager.service';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './hooks/useOnlineStatus';
import { DisbursementForm } from './components/DisbursementForm';
import { TransactionLedger } from './components/TransactionLedger';
import { GmailHub } from './components/GmailHub';
import { ApiSandbox } from './components/ApiSandbox';
import { SecurityCryptoView } from './components/SecurityCryptoView';
import { GmailConfirmModal } from './components/GmailConfirmModal';
import { TransactionDetailModal } from './components/TransactionDetailModal';

type NavTab = 'disbursement' | 'ledger' | 'gmail' | 'sandbox' | 'security';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('disbursement');
  const [lang, setLang] = useState<'en' | 'bn'>('en');

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
    setTransactions(getTransactions());

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
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
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-400 p-0.5 shadow-md">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Wallet className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base text-white tracking-tight">PayHub</span>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-mono font-bold px-1.5 py-0.5 rounded border border-indigo-500/30">
                  B2C PWA
                </span>
              </div>
              <div className="hidden sm:block text-[11px] text-slate-400">
                Stripe &bull; bKash B2C &bull; Nagad &bull; Gmail API
              </div>
            </div>
          </div>

          {/* Center Tabs for Desktop */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('disbursement')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'disbursement'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'পেআউট ও পেমেন্ট' : 'Disburse & Pay'}</span>
            </button>

            <button
              onClick={() => setActiveTab('ledger')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'ledger'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'লেনদেন লেজার' : 'Ledger'}</span>
            </button>

            <button
              onClick={() => setActiveTab('gmail')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer relative ${
                activeTab === 'gmail'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'জিমেইল রসিদ' : 'Gmail Hub'}</span>
              {user && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute top-1.5 right-1.5" />}
            </button>

            <button
              onClick={() => setActiveTab('sandbox')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'sandbox'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'এপিআই স্যান্ডবক্স' : 'API Sandbox'}</span>
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'security'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'নিরাপত্তা ও টেস্ট' : 'Security & Tests'}</span>
            </button>
          </nav>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2.5">
            {/* Language Switcher */}
            <button
              onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 text-xs text-slate-300 hover:text-white transition cursor-pointer"
              title="Switch Language / ভাষা পরিবর্তন"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-semibold">{lang === 'en' ? 'বাংলা' : 'EN'}</span>
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
        <div className="md:hidden flex items-center justify-around border-t border-slate-800 bg-slate-950 py-2 px-1 text-[11px]">
          <button
            onClick={() => setActiveTab('disbursement')}
            className={`flex flex-col items-center gap-1 ${
              activeTab === 'disbursement' ? 'text-indigo-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Payout</span>
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex flex-col items-center gap-1 ${
              activeTab === 'ledger' ? 'text-indigo-400 font-bold' : 'text-slate-400'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Ledger</span>
          </button>
          <button
            onClick={() => setActiveTab('gmail')}
            className={`flex flex-col items-center gap-1 relative ${
              activeTab === 'gmail' ? 'text-indigo-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Gmail</span>
            {user && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute top-0 right-3" />}
          </button>
          <button
            onClick={() => setActiveTab('sandbox')}
            className={`flex flex-col items-center gap-1 ${
              activeTab === 'sandbox' ? 'text-indigo-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>API</span>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex flex-col items-center gap-1 ${
              activeTab === 'security' ? 'text-indigo-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Security</span>
          </button>
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'disbursement' && (
          <DisbursementForm
            onTransactionCreated={handleTransactionCreated}
            onRequestGmailReceipt={handleRequestSendReceipt}
            userEmail={user?.email || undefined}
            isGmailConnected={!!accessToken}
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
    </div>
  );
}
