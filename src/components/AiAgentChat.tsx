import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  Shield,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  Clock,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Transaction } from '../types';
import { saveTransaction } from '../services/ledger/ledger.service';

interface Props {
  onTransactionCreated: (trx: Transaction) => void;
  onNavigateToLedger: () => void;
  lang?: 'en' | 'bn';
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  pendingConfirmation?: {
    receiverPhone: string;
    amount: number;
    reason: string;
  };
  transactionData?: {
    trxID: string;
    paymentID?: string;
    amount: number;
    receiverMSISDN: string;
    completedTime: string;
    note?: string;
  };
}

export const AiAgentChat: React.FC<Props> = ({
  onTransactionCreated,
  onNavigateToLedger,
  lang = 'en',
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      text:
        lang === 'bn'
          ? 'আসসালামু আলাইকুম! আমি PayHub এআই অ্যাসিস্ট্যান্ট। আমি সরাসরি জেমিনি ফাংশন কলিংয়ের মাধ্যমে বিকাশ বিটুসি (B2C) পেআউট, রিফান্ড ও ক্যাশব্যাক প্রসেস করতে পারি। আপনি কার বিকাশ নাম্বারে কত টাকা পাঠাতে চান আমাকে বলুন।'
          : 'Hello! I am PayHub AI Agent. Powered by Gemini Function Calling, I can automate and process bKash B2C payouts, refunds, and cashbacks. Tell me the recipient number and amount to get started.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedTrxId, setCopiedTrxId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleCopy = (trxId: string) => {
    navigator.clipboard.writeText(trxId);
    setCopiedTrxId(trxId);
    setTimeout(() => setCopiedTrxId(null), 2000);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          chatHistory: messages.map((m) => ({ role: m.role, text: m.text })),
        }),
      });

      const data = await response.json();

      const assistantMsg: ChatMessage = {
        id: 'msg-' + Date.now() + 1,
        role: 'assistant',
        text: data.reply || 'Request processed',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        pendingConfirmation: data.requiresConfirmation ? data.pendingData : undefined,
        transactionData: data.transactionData,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'msg-' + Date.now() + 1,
          role: 'assistant',
          text:
            lang === 'bn'
              ? '❌ সার্ভারের সাথে সংযোগে ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।'
              : '❌ Error connecting to server. Please try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmPayout = async (pendingData: { receiverPhone: string; amount: number; reason: string }, messageId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'CONFIRMED_PAYOUT',
          confirmedExecution: true,
          pendingData,
        }),
      });

      const data = await response.json();

      // Create ledger transaction
      if (data.transactionData) {
        const newTx: Transaction = {
          id: 'tx_' + Date.now(),
          trxId: data.transactionData.trxID,
          invoiceNo: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          gateway: 'BKASH',
          type: 'DISBURSEMENT',
          amount: data.transactionData.amount,
          currency: 'BDT',
          receiver: data.transactionData.receiverMSISDN,
          sender: 'PayHub AI Agent (Merchant Pool)',
          status: 'COMPLETED',
          createdAt: data.transactionData.completedTime || new Date().toISOString(),
          idempotencyKey: `idemp_ai_bkash_${Date.now()}`,
          note: data.transactionData.note,
          gmailReceiptSent: false,
          metadata: {
            source: 'GEMINI_AI_AGENT',
            note: data.transactionData.note,
            paymentID: data.transactionData.paymentID,
          },
        };

        saveTransaction(newTx);
        onTransactionCreated(newTx);
      }

      // Update message list to remove pending confirmation and attach transaction slip
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === messageId) {
            return {
              ...m,
              pendingConfirmation: undefined,
            };
          }
          return m;
        }).concat({
          id: 'msg-' + Date.now() + 2,
          role: 'assistant',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          transactionData: data.transactionData,
        })
      );
    } catch (err: any) {
      console.error('Confirmation failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelPayout = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === messageId) {
          return {
            ...m,
            pendingConfirmation: undefined,
          };
        }
        return m;
      }).concat({
        id: 'msg-' + Date.now() + 3,
        role: 'assistant',
        text:
          lang === 'bn'
            ? '🚫 বিকাশ পেআউট রিকুয়েস্টটি বাতিল করা হয়েছে। কোনো ফান্ড স্থানান্তর করা হয়নি।'
            : '🚫 bKash payout cancelled. No funds were transferred.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      })
    );
  };

  const PROMPT_SUGGESTIONS = [
    {
      label: lang === 'bn' ? '০১৭১২৩৪৫৬৭৮ এ ৫০০ টাকা রিফান্ড' : 'Refund 500 BDT to 01712345678',
      prompt: lang === 'bn' ? 'আমার গ্রাহকের 01712345678 নম্বরে ৫০০ টাকা রিফান্ড পাঠান' : 'Please send a 500 BDT refund to 01712345678 via bKash',
    },
    {
      label: lang === 'bn' ? '০১৮৯৯১২৩৪৫৬ এ ১২০০ টাকা ক্যাশব্যাক' : 'Send 1200 BDT Cashback to 01899123456',
      prompt: lang === 'bn' ? '01899123456 নম্বরে ১২০০ টাকা ক্যাশব্যাক পেআউট করুন' : 'Send 1200 BDT cashback payout to 01899123456',
    },
    {
      label: lang === 'bn' ? 'নিরাপত্তা ও দৈনিক লিমিট জানুন' : 'Check Payout Security & Limits',
      prompt: lang === 'bn' ? 'বিকাশ এআই পেআউটের সিকিউরিটি ও লিমিট কত?' : 'What are the safety limits and verification steps for AI bKash payouts?',
    },
  ];

  return (
    <div className="bg-slate-900/80 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col h-[650px]">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-600 to-indigo-600 flex items-center justify-center text-white shadow-lg">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base">
                {lang === 'bn' ? 'PayHub এআই বিকাশ এজেন্ট' : 'PayHub AI bKash Agent'}
              </h3>
              <span className="text-[10px] bg-pink-500/20 text-pink-300 border border-pink-500/30 px-2 py-0.5 rounded-full font-mono">
                Gemini 3.8 Flash
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {lang === 'bn'
                ? 'ফাংশন কলিং ও দুই-ধাপের ভেরিফিকেশন সহ অটোমেটেড পেআউট'
                : 'Automated B2C disbursement with Function Calling & 2-Step Verification'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 px-2.5 py-1 rounded-lg font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Tool Calling Active
          </span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 max-w-[85%] ${
              msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
            }`}
          >
            {/* Avatar */}
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-pink-600/20 border border-pink-500/30 text-pink-400'
              }`}
            >
              {msg.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            {/* Bubble */}
            <div
              className={`rounded-2xl p-4 text-xs sm:text-sm leading-relaxed shadow-md ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-none'
                  : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none'
              }`}
            >
              <p className="whitespace-pre-line">{msg.text}</p>

              {/* Two-Step Verification Confirmation Card */}
              {msg.pendingConfirmation && (
                <div className="mt-4 p-4 rounded-xl bg-slate-900 border border-pink-500/30 shadow-lg space-y-3">
                  <div className="flex items-center gap-2 text-pink-400 font-semibold text-xs border-b border-slate-800 pb-2">
                    <Shield className="w-4 h-4" />
                    <span>
                      {lang === 'bn' ? 'নিরাপত্তা অনুমোদন প্রয়োজন (২-স্টেপ ভেরিফিকেশন)' : 'Security Confirmation Required'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Recipient Phone</span>
                      <span className="text-white font-bold">{msg.pendingConfirmation.receiverPhone}</span>
                    </div>
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Payout Amount</span>
                      <span className="text-pink-400 font-black">৳{msg.pendingConfirmation.amount.toLocaleString()} BDT</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleConfirmPayout(msg.pendingConfirmation!, msg.id)}
                      className="flex-1 bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-500 hover:to-pink-600 text-white font-bold py-2 px-3 rounded-lg text-xs transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{lang === 'bn' ? 'অনুমোদন দিন ও পাঠান' : 'Authorize & Send Payout'}</span>
                    </button>
                    <button
                      onClick={() => handleCancelPayout(msg.id)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2 px-3 rounded-lg text-xs transition cursor-pointer"
                    >
                      {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                  </div>
                </div>
              )}

              {/* Transaction Slip Card */}
              {msg.transactionData && (
                <div className="mt-4 p-4 rounded-xl bg-slate-900 border border-emerald-500/40 shadow-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{lang === 'bn' ? 'অফিশিয়াল বিকাশ ট্রানজ্যাকশন স্লিপ' : 'Official bKash Transaction Slip'}</span>
                    </div>
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded font-mono font-bold">
                      SUCCESS
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300 font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">TrxID:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-white font-bold">{msg.transactionData.trxID}</span>
                        <button
                          onClick={() => handleCopy(msg.transactionData!.trxID)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                          title="Copy TrxID"
                        >
                          {copiedTrxId === msg.transactionData.trxID ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Recipient MSISDN:</span>
                      <span className="text-white">{msg.transactionData.receiverMSISDN}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Disbursed Amount:</span>
                      <span className="text-emerald-400 font-black text-sm">
                        ৳{msg.transactionData.amount.toLocaleString()} BDT
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Completed At:</span>
                      <span>{new Date(msg.transactionData.completedTime).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800">
                    <button
                      onClick={onNavigateToLedger}
                      className="w-full flex items-center justify-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 py-1.5 font-semibold transition cursor-pointer"
                    >
                      <span>{lang === 'bn' ? 'ট্রানজ্যাকশন লেজারে দেখুন' : 'View in Transaction Ledger'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-1 text-[10px] text-slate-400 text-right font-mono">
                {msg.timestamp}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-3 mr-auto">
            <div className="w-8 h-8 rounded-lg bg-pink-600/20 border border-pink-500/30 text-pink-400 flex items-center justify-center">
              <Bot className="w-4 h-4 animate-bounce" />
            </div>
            <div className="p-3.5 rounded-2xl rounded-tl-none bg-slate-950 border border-slate-800 text-slate-400 text-xs flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-pink-400" />
              <span>{lang === 'bn' ? 'এজেন্ট টুল কলিং ও ভ্যালিডেশন প্রসেস করছে...' : 'Agent processing tool invocation...'}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts */}
      <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/40 flex items-center gap-2 overflow-x-auto">
        <span className="text-[11px] text-slate-400 shrink-0 font-medium">
          {lang === 'bn' ? 'সাজেস্ট করা প্রম্পট:' : 'Quick Prompts:'}
        </span>
        {PROMPT_SUGGESTIONS.map((item, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(item.prompt)}
            disabled={isLoading}
            className="text-[11px] text-slate-300 bg-slate-900 hover:bg-slate-800 hover:text-white border border-slate-800 px-2.5 py-1 rounded-lg transition whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div className="p-4 border-t border-slate-800 bg-slate-950">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              lang === 'bn'
                ? 'উদাহরণ: 01712345678 নম্বরে ৫০০ টাকা রিফান্ড পাঠান...'
                : 'e.g. Send 500 BDT refund to 01712345678...'
            }
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-xs sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500 transition"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="p-3 rounded-xl bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-bold transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
