import React from 'react';
import { X, CheckCircle2, Clock, AlertCircle, Copy, Mail, ExternalLink, ShieldCheck, FileText } from 'lucide-react';
import { Transaction } from '../types';
import { buildReceiptHtml } from '../services/gmail/gmail.service';
import { getMappedLabelForGateway } from '../services/gmail/labelManager.service';

interface Props {
  transaction: Transaction | null;
  onClose: () => void;
  onRequestSendReceipt: (tx: Transaction) => void;
  lang?: 'en' | 'bn';
}

export const TransactionDetailModal: React.FC<Props> = ({
  transaction,
  onClose,
  onRequestSendReceipt,
  lang = 'en',
}) => {
  const [copied, setCopied] = React.useState(false);
  const [showHtmlPreview, setShowHtmlPreview] = React.useState(false);

  if (!transaction) return null;

  const handleCopyTrx = () => {
    navigator.clipboard.writeText(transaction.trxId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const receiptHtml = buildReceiptHtml({
    toEmail: transaction.gmailRecipient || 'customer@example.com',
    amount: transaction.amount,
    currency: transaction.currency,
    trxId: transaction.trxId,
    invoiceNo: transaction.invoiceNo,
    gateway: transaction.gateway,
    type: transaction.type,
    completedAt: transaction.createdAt,
    label: getMappedLabelForGateway(transaction.gateway, transaction.type),
    note: transaction.note || transaction.metadata?.note,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <span
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                transaction.gateway === 'BKASH'
                  ? 'bg-pink-900/40 text-pink-400 border border-pink-700/50'
                  : transaction.gateway === 'NAGAD'
                  ? 'bg-orange-900/40 text-orange-400 border border-orange-700/50'
                  : 'bg-indigo-900/40 text-indigo-400 border border-indigo-700/50'
              }`}
            >
              {transaction.gateway.slice(0, 3)}
            </span>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>{transaction.invoiceNo}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-normal">
                  {transaction.type}
                </span>
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="font-mono text-cyan-400">{transaction.trxId}</span>
                <button
                  onClick={handleCopyTrx}
                  className="hover:text-white cursor-pointer transition text-slate-500"
                  title="Copy TrxID"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                {copied && <span className="text-[10px] text-emerald-400">Copied!</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Main Amount Card */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 rounded-xl bg-slate-950/70 border border-slate-800 gap-4">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                {lang === 'bn' ? 'লেনদেনের পরিমাণ' : 'Transaction Amount'}
              </div>
              <div className="text-3xl font-extrabold text-white font-mono mt-1">
                {transaction.currency === 'BDT' ? '৳' : transaction.currency}{' '}
                {transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {new Date(transaction.createdAt).toLocaleString()}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                  transaction.status === 'COMPLETED'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : transaction.status === 'PENDING'
                    ? 'bg-amber-950 text-amber-400 border border-amber-800'
                    : 'bg-rose-950 text-rose-400 border border-rose-800'
                }`}
              >
                {transaction.status === 'COMPLETED' ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : transaction.status === 'PENDING' ? (
                  <Clock className="w-3.5 h-3.5" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5" />
                )}
                {transaction.status}
              </span>
              <div className="text-[11px] text-slate-400">
                {lang === 'bn' ? 'গেটওয়ে মেথড: ' : 'Gateway: '}
                <strong className="text-slate-200">{transaction.gateway} B2C API</strong>
              </div>
            </div>
          </div>

          {/* Note / Memo Display */}
          {(transaction.note || transaction.metadata?.note) && (
            <div className="p-4 rounded-xl bg-slate-950/70 border border-indigo-500/30 shadow-md flex items-start gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0 mt-0.5">
                <FileText className="w-4 h-4" />
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>{lang === 'bn' ? 'নোট / মেমো' : 'Note / Memo'}</span>
                  <span className="text-[10px] text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded font-mono">Reference</span>
                </div>
                <p className="text-sm text-slate-200 font-medium break-words leading-relaxed">
                  {transaction.note || transaction.metadata?.note}
                </p>
              </div>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-2">
              <div className="text-slate-400 font-semibold mb-2">{lang === 'bn' ? 'অ্যাকাউন্ট তথ্য' : 'Account Parties'}</div>
              <div className="flex justify-between">
                <span className="text-slate-500">{lang === 'bn' ? 'প্রেরক (Sender):' : 'Sender:'}</span>
                <span className="text-slate-200 font-mono">{transaction.sender}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{lang === 'bn' ? 'প্রাপক (Receiver):' : 'Receiver:'}</span>
                <span className="text-indigo-300 font-mono font-medium">{transaction.receiver}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{lang === 'bn' ? 'ইনভয়েস রেফারেন্স:' : 'Invoice Ref:'}</span>
                <span className="text-slate-200 font-mono">{transaction.invoiceNo}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-2">
              <div className="text-slate-400 font-semibold mb-2">{lang === 'bn' ? 'নিরাপত্তা ও ইন্টিগ্রিটি' : 'Security & Idempotency'}</div>
              <div className="flex justify-between">
                <span className="text-slate-500">Idempotency Key:</span>
                <span className="text-slate-200 font-mono truncate max-w-[150px]" title={transaction.idempotencyKey}>
                  {transaction.idempotencyKey || 'None'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{lang === 'bn' ? 'জিমেইল রসিদ স্ট্যাটাস:' : 'Gmail Receipt:'}</span>
                {transaction.gmailReceiptSent ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Sent
                  </span>
                ) : (
                  <span className="text-slate-400">Not Dispatched</span>
                )}
              </div>
              {transaction.gmailMessageId && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Message ID:</span>
                  <span className="text-indigo-300 font-mono">{transaction.gmailMessageId}</span>
                </div>
              )}
            </div>
          </div>

          {/* HTML Receipt Preview Toggle */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-indigo-400" />
                {lang === 'bn' ? 'জিমেইল রসিদ প্রিভিউ' : 'Gmail Receipt Layout'}
              </span>
              <button
                onClick={() => setShowHtmlPreview(!showHtmlPreview)}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
              >
                {showHtmlPreview ? (lang === 'bn' ? 'লুকান' : 'Hide Preview') : (lang === 'bn' ? 'প্রিভিউ দেখুন' : 'Show Preview')}
              </button>
            </div>

            {showHtmlPreview && (
              <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-950">
                <div className="p-3 bg-slate-800 text-[11px] text-slate-400 border-b border-slate-700 flex justify-between items-center">
                  <span>Simulated HTML email sent via users/me/messages/send</span>
                  <span className="font-mono text-slate-300">RFC 2822 UTF-8</span>
                </div>
                <div
                  className="p-4 max-h-72 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: receiptHtml }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between mt-auto">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Audit Trail Verified</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onRequestSendReceipt(transaction)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer shadow-md"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{transaction.gmailReceiptSent ? (lang === 'bn' ? 'পুনরায় রসিদ পাঠান' : 'Resend Gmail Receipt') : (lang === 'bn' ? 'জিমেইল রসিদ পাঠান' : 'Dispatch Gmail Receipt')}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
            >
              {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
