import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Pause,
  Play,
  ArrowRight,
  Clock,
  X,
  CreditCard,
  Hash,
  Send,
  CheckCircle,
} from 'lucide-react';
import { RetryDisbursementContext } from '../services/retry/smartRetry.service';

interface Props {
  context: RetryDisbursementContext;
  onRetry: () => void;
  onDismiss: () => void;
  onEditParameters: () => void;
  isRetrying: boolean;
  lang?: 'en' | 'bn';
}

export const SmartRetryPrompt: React.FC<Props> = ({
  context,
  onRetry,
  onDismiss,
  onEditParameters,
  isRetrying,
  lang = 'en',
}) => {
  const [countdown, setCountdown] = useState<number>(5);
  const [isAutoRetryPaused, setIsAutoRetryPaused] = useState<boolean>(false);

  // Auto-retry countdown timer
  useEffect(() => {
    if (isAutoRetryPaused || isRetrying) return;

    if (countdown <= 0) {
      onRetry();
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, isAutoRetryPaused, isRetrying, onRetry]);

  return (
    <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-900 p-5 shadow-2xl animate-in fade-in slide-in-from-top-2 relative overflow-hidden">
      {/* Background glowing indicator */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -z-10" />

      {/* Header with Failure Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-amber-500/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white">
                {lang === 'bn' ? 'স্মার্ট রিট্রাই: লেনদেন বাধাগ্রস্ত হয়েছে' : 'Smart Retry: Transaction Interrupted'}
              </h4>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-700/60">
                {context.failureType}
              </span>
            </div>
            <p className="text-xs text-amber-200/80 mt-0.5">
              {context.failureReason}
            </p>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition self-start sm:self-auto cursor-pointer"
          title="Dismiss retry prompt"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Preserved Original Parameters Snapshot Card */}
      <div className="my-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800/80">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>{lang === 'bn' ? 'সংরক্ষিত মূল প্যারামিটার' : 'Preserved Original Parameters'}</span>
          </span>
          <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/50">
            Idempotency Key Active
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-[11px] text-slate-400 block">{lang === 'bn' ? 'গেটওয়ে' : 'Gateway'}</span>
            <span className="font-bold text-white flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  context.gateway === 'BKASH'
                    ? 'bg-pink-500'
                    : context.gateway === 'NAGAD'
                    ? 'bg-orange-500'
                    : 'bg-indigo-500'
                }`}
              />
              {context.gateway}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 block">{lang === 'bn' ? 'ইনভয়েস' : 'Invoice No'}</span>
            <span className="font-mono text-white mt-0.5 block truncate">{context.invoiceNo}</span>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 block">{lang === 'bn' ? 'অ্যামাউন্ট' : 'Amount'}</span>
            <span className="font-mono font-bold text-emerald-400 mt-0.5 block">
              {context.currency === 'BDT' ? '৳' : '$'}
              {context.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {context.currency}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 block">{lang === 'bn' ? 'প্রাপক অ্যাকাউন্ট' : 'Recipient'}</span>
            <span className="font-mono text-white mt-0.5 block truncate">
              {context.receiverPhone || context.customerEmail}
            </span>
          </div>
        </div>

        {/* Idempotency Safe Guarantee Note */}
        <div className="pt-2 text-[11px] text-slate-400 flex items-center gap-1.5 border-t border-slate-800/60 font-mono">
          <Hash className="w-3 h-3 text-slate-500 shrink-0" />
          <span className="truncate">Key: {context.idempotencyKey}</span>
          <span className="text-slate-600 hidden sm:inline">&bull;</span>
          <span className="text-emerald-400/90 hidden sm:inline">Guaranteed Zero Double-Charge</span>
        </div>
      </div>

      {/* Automated Retry Controls & Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
        {/* Countdown Banner */}
        <div className="flex items-center gap-2 text-xs text-slate-300 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            <span>
              {isAutoRetryPaused
                ? lang === 'bn'
                  ? 'অটো-রিট্রাই সাময়িক স্থগিত'
                  : 'Auto-retry paused'
                : lang === 'bn'
                ? `অটো-রিট্রাই হবে ${countdown} সেকেন্ডে...`
                : `Auto-retry in ${countdown}s...`}
            </span>
            <button
              type="button"
              onClick={() => setIsAutoRetryPaused(!isAutoRetryPaused)}
              className="ml-1 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
              title={isAutoRetryPaused ? 'Resume countdown' : 'Pause countdown'}
            >
              {isAutoRetryPaused ? <Play className="w-3 h-3 text-emerald-400" /> : <Pause className="w-3 h-3" />}
            </button>
          </div>

          <span className="text-[11px] text-slate-400 hidden md:inline">
            {lang === 'bn'
              ? `চেষ্টা ${context.attemptCount} / ${context.maxAttempts}`
              : `Attempt ${context.attemptCount} of ${context.maxAttempts}`}
          </span>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onEditParameters}
            disabled={isRetrying}
            className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-300 transition cursor-pointer disabled:opacity-50"
          >
            {lang === 'bn' ? 'প্যারামিটার পরিবর্তন করুন' : 'Edit Parameters'}
          </button>

          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 text-xs font-bold transition shadow-lg shadow-amber-950/50 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>
              {isRetrying
                ? lang === 'bn'
                  ? 'রি-সাবমিট হচ্ছে...'
                  : 'Re-submitting...'
                : lang === 'bn'
                ? 'স্মার্ট রিট্রাই করুন'
                : 'Re-submit with Original Parameters'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
