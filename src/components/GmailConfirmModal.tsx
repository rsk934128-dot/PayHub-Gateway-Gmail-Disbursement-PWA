import React from 'react';
import { Mail, AlertTriangle, ShieldCheck, X } from 'lucide-react';
import { GmailReceiptRequest } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  params: GmailReceiptRequest | null;
  senderEmail: string;
  isSending: boolean;
  lang?: 'en' | 'bn';
}

export const GmailConfirmModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onConfirm,
  params,
  senderEmail,
  isSending,
  lang = 'en',
}) => {
  if (!isOpen || !params) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-slate-100 relative">
        <button
          onClick={onClose}
          disabled={isSending}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              {lang === 'bn' ? 'জিমেইল রসিদ নিশ্চিতকরণ' : 'Confirm Gmail Receipt Dispatch'}
            </h3>
            <p className="text-xs text-slate-400">
              {lang === 'bn' ? 'ব্যবহারকারীর অনুমতি নিয়ে স্বয়ংক্রিয় মেইল পাঠানো হবে' : 'Workspace API requires user confirmation to send emails'}
            </p>
          </div>
        </div>

        <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 space-y-2.5 text-xs">
          <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
            <span className="text-slate-400">{lang === 'bn' ? 'প্রেরক (Sender):' : 'Sender:'}</span>
            <span className="font-mono text-slate-200">{senderEmail}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
            <span className="text-slate-400">{lang === 'bn' ? 'প্রাপক (Recipient):' : 'Recipient:'}</span>
            <span className="font-mono text-indigo-300 font-semibold">{params.toEmail}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
            <span className="text-slate-400">{lang === 'bn' ? 'গেটওয়ে (Gateway):' : 'Gateway:'}</span>
            <span className="font-semibold text-emerald-400">{params.gateway}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
            <span className="text-slate-400">{lang === 'bn' ? 'অ্যামাউন্ট (Amount):' : 'Amount:'}</span>
            <span className="font-mono font-bold text-white text-sm">
              {params.currency === 'BDT' ? '৳' : params.currency} {params.amount.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
            <span className="text-slate-400">{lang === 'bn' ? 'ট্রানজেকশন আইডি (TrxID):' : 'TrxID:'}</span>
            <span className="font-mono text-cyan-400">{params.trxId}</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-slate-400">{lang === 'bn' ? 'জিমেইল লেবেল (Label):' : 'Target Label:'}</span>
            <span className="bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded text-[11px] font-mono border border-indigo-800">
              {params.label || 'Payments/Disbursed'}
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 text-[11px] text-amber-300/90 bg-amber-950/30 p-2.5 rounded-lg border border-amber-800/40">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
          <span>
            {lang === 'bn'
              ? 'আপনার অনুমোদনের সাথে এই ইমেলটি সরাসরি গ্রাহকের কাছে পাঠানো হবে এবং আপনার ইনবক্সে লেবেল করা থাকবে।'
              : 'This email will be dispatched directly to the customer and tagged under the designated Gmail label on your behalf.'}
          </span>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition disabled:opacity-50 cursor-pointer"
          >
            {lang === 'bn' ? 'বাতিল করুন' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSending}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 transition shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isSending ? (
              <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            <span>{lang === 'bn' ? 'অনুমোদন ও প্রেরণ করুন' : 'Confirm & Send Email'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
