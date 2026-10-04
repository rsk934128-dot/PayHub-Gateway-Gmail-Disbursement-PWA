import React, { useState } from 'react';
import {
  Send,
  CreditCard,
  Lock,
  Mail,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Shield,
  Key,
  HelpCircle,
  FileText,
} from 'lucide-react';
import { executeBkashDisbursement, validateBangladeshiMsisdn } from '../services/bkash/bkash.service';
import { executeNagadDisbursement, generateNagadSignature, encryptNagadPayload, NAGAD_DEFAULT_CREDENTIALS } from '../services/nagad/nagad.service';
import { executeStripeCharge } from '../services/stripe/stripe.service';
import { saveTransaction } from '../services/ledger/ledger.service';
import { getMappedLabelForGateway } from '../services/gmail/labelManager.service';
import { Transaction, PaymentGateway, GmailReceiptRequest } from '../types';

interface Props {
  onTransactionCreated: (trx: Transaction) => void;
  onRequestGmailReceipt: (receiptReq: GmailReceiptRequest) => void;
  userEmail?: string;
  isGmailConnected: boolean;
  lang?: 'en' | 'bn';
}

export const DisbursementForm: React.FC<Props> = ({
  onTransactionCreated,
  onRequestGmailReceipt,
  userEmail,
  isGmailConnected,
  lang = 'en',
}) => {
  const [activeGateway, setActiveGateway] = useState<PaymentGateway>('BKASH');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successTrx, setSuccessTrx] = useState<Transaction | null>(null);

  // Common fields
  const [amount, setAmount] = useState<string>('1500');
  const [invoiceNo, setInvoiceNo] = useState<string>(() => `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [sendGmailReceipt, setSendGmailReceipt] = useState<boolean>(true);
  const [customerEmail, setCustomerEmail] = useState<string>(userEmail || 'customer@example.com');

  // bKash & Nagad specific
  const [receiverPhone, setReceiverPhone] = useState<string>('01712345678');
  const [note, setNote] = useState<string>('Affiliate Commission Payout');

  // Stripe specific
  const [currency, setCurrency] = useState<'USD' | 'EUR' | 'GBP' | 'BDT'>('USD');
  const [customerName, setCustomerName] = useState<string>('Rahim Ahmed');
  const [cardNumber, setCardNumber] = useState<string>('4242 •••• •••• 4242');
  const [expMonth, setExpMonth] = useState<string>('12');
  const [expYear, setExpYear] = useState<string>('28');
  const [cvc, setCvc] = useState<string>('123');

  // Live Nagad Cryptography Preview State
  const [nagadPreviewSig, setNagadPreviewSig] = useState<string>('');
  const [nagadEncryptedPreview, setNagadEncryptedPreview] = useState<string>('');

  React.useEffect(() => {
    if (activeGateway === 'NAGAD') {
      const numAmt = parseFloat(amount) || 0;
      generateNagadSignature(
        NAGAD_DEFAULT_CREDENTIALS.merchantId,
        numAmt.toFixed(2),
        invoiceNo,
        NAGAD_DEFAULT_CREDENTIALS.secretKey
      ).then(setNagadPreviewSig);

      encryptNagadPayload({
        account: NAGAD_DEFAULT_CREDENTIALS.merchantAccount,
        amount: numAmt.toFixed(2),
        receiverMSISDN: receiverPhone,
        merchantInvoice: invoiceNo,
        date: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14),
      }).then(setNagadEncryptedPreview);
    }
  }, [activeGateway, amount, invoiceNo, receiverPhone]);

  const handleRegenerateInvoice = () => {
    setInvoiceNo(`INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessTrx(null);
    setIsProcessing(true);

    try {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        throw new Error(lang === 'bn' ? 'সঠিক টাকার পরিমাণ দিন।' : 'Please enter a valid amount.');
      }

      const idempotencyKey = `idemp_${activeGateway.toLowerCase()}_${Date.now()}`;
      let createdTrx: Transaction;

      if (activeGateway === 'BKASH') {
        const res = await executeBkashDisbursement({
          receiverMsisdn: receiverPhone,
          amount: numAmount,
          currency: 'BDT',
          merchantInvoiceNumber: invoiceNo,
          note,
          idempotencyKey,
        });

        createdTrx = {
          id: 'tx_' + Date.now(),
          trxId: res.trxID,
          invoiceNo: res.merchantInvoiceNumber,
          gateway: 'BKASH',
          type: 'DISBURSEMENT',
          amount: numAmount,
          currency: 'BDT',
          receiver: res.receiverMSISDN,
          sender: 'bKash Merchant Pool (01700000000)',
          status: 'COMPLETED',
          createdAt: res.completedTime,
          idempotencyKey,
          note: note.trim() || undefined,
          gmailReceiptSent: false,
          gmailRecipient: customerEmail,
          metadata: { note: note.trim() || undefined, paymentID: res.paymentID },
        };
      } else if (activeGateway === 'NAGAD') {
        const res = await executeNagadDisbursement({
          receiverMsisdn: receiverPhone,
          amount: numAmount,
          currency: 'BDT',
          merchantInvoiceNumber: invoiceNo,
          idempotencyKey,
        });

        createdTrx = {
          id: 'tx_' + Date.now(),
          trxId: res.response.trxID,
          invoiceNo: res.response.merchantInvoice,
          gateway: 'NAGAD',
          type: 'DISBURSEMENT',
          amount: numAmount,
          currency: 'BDT',
          receiver: res.response.receiverMSISDN,
          sender: 'Nagad Merchant Pool (01899990001)',
          status: 'COMPLETED',
          createdAt: new Date().toISOString(),
          idempotencyKey,
          note: note.trim() || undefined,
          gmailReceiptSent: false,
          gmailRecipient: customerEmail,
          metadata: {
            note: note.trim() || undefined,
            signature: res.signature,
            issuerRef: res.response.issuerPaymentRefNo,
          },
        };
      } else {
        // STRIPE
        const stripeRes = await executeStripeCharge({
          amount: numAmount,
          currency,
          customerEmail,
          customerName,
          cardNumber: cardNumber.replace(/[^\d]/g, '') || '4242424242424242',
          expMonth,
          expYear,
          cvc,
          idempotencyKey,
        });

        createdTrx = {
          id: 'tx_' + Date.now(),
          trxId: stripeRes.id,
          invoiceNo,
          gateway: 'STRIPE',
          type: 'PAYMENT_RECEIVED',
          amount: numAmount,
          currency,
          receiver: 'PayHub Global Merchant Account',
          sender: `${customerName} (${customerEmail})`,
          status: 'COMPLETED',
          createdAt: new Date(stripeRes.created * 1000).toISOString(),
          idempotencyKey,
          note: note.trim() || undefined,
          gmailReceiptSent: false,
          gmailRecipient: customerEmail,
          metadata: {
            note: note.trim() || undefined,
            cardBrand: stripeRes.cardBrand,
            last4: stripeRes.last4,
            receiptUrl: stripeRes.receiptUrl,
          },
        };
      }

      saveTransaction(createdTrx);
      onTransactionCreated(createdTrx);
      setSuccessTrx(createdTrx);

      // Trigger Gmail receipt confirmation flow if checked
      if (sendGmailReceipt && customerEmail) {
        onRequestGmailReceipt({
          toEmail: customerEmail,
          amount: createdTrx.amount,
          currency: createdTrx.currency,
          trxId: createdTrx.trxId,
          invoiceNo: createdTrx.invoiceNo,
          gateway: createdTrx.gateway,
          type: createdTrx.type,
          completedAt: createdTrx.createdAt,
          label: getMappedLabelForGateway(createdTrx.gateway, createdTrx.type),
          note: createdTrx.note,
        });
      }

      // Reset invoice number for next transaction
      handleRegenerateInvoice();
    } catch (err: any) {
      setError(err.message || 'Payment execution failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Gateway Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* bKash Card */}
        <button
          type="button"
          onClick={() => setActiveGateway('BKASH')}
          className={`flex items-start gap-4 p-4 rounded-2xl border text-left transition relative cursor-pointer ${
            activeGateway === 'BKASH'
              ? 'bg-gradient-to-br from-pink-950/60 to-slate-900 border-pink-500 ring-2 ring-pink-500/20 shadow-xl'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-pink-600/20 border border-pink-500/30 flex items-center justify-center text-pink-400 font-extrabold text-base shrink-0">
            bK
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">bKash B2C</span>
              <span className="text-[10px] bg-pink-500/20 text-pink-300 px-2 py-0.5 rounded-full font-mono">
                Disbursement
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {lang === 'bn' ? 'অফিশিয়াল বিটুসি পেআউট এপিআই' : 'Official B2C instant payout'}
            </p>
          </div>
        </button>

        {/* Nagad Card */}
        <button
          type="button"
          onClick={() => setActiveGateway('NAGAD')}
          className={`flex items-start gap-4 p-4 rounded-2xl border text-left transition relative cursor-pointer ${
            activeGateway === 'NAGAD'
              ? 'bg-gradient-to-br from-orange-950/60 to-slate-900 border-orange-500 ring-2 ring-orange-500/20 shadow-xl'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400 font-extrabold text-base shrink-0">
            NG
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">Nagad B2C</span>
              <span className="text-[10px] bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full font-mono">
                RSA &bull; HMAC
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {lang === 'bn' ? 'পাবলিক কি এনক্রিপশন ও সিগনেচার' : 'Encrypted OAEP payout'}
            </p>
          </div>
        </button>

        {/* Stripe Card */}
        <button
          type="button"
          onClick={() => setActiveGateway('STRIPE')}
          className={`flex items-start gap-4 p-4 rounded-2xl border text-left transition relative cursor-pointer ${
            activeGateway === 'STRIPE'
              ? 'bg-gradient-to-br from-indigo-950/60 to-slate-900 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xl'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-extrabold text-base shrink-0">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">Stripe Global</span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-mono">
                Cards / USD
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {lang === 'bn' ? 'আন্তর্জাতিক ক্রেডিট/ডেবিট কার্ড' : 'Global card collection'}
            </p>
          </div>
        </button>
      </div>

      {/* Main Execution Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 shadow-xl backdrop-blur-sm"
      >
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              {activeGateway === 'BKASH' && (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-pulse" />
                  <span>{lang === 'bn' ? 'বিকাশ বিটুসি ডিসবার্সমেন্ট ফর্ম' : 'bKash B2C Disbursement Request'}</span>
                </>
              )}
              {activeGateway === 'NAGAD' && (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
                  <span>{lang === 'bn' ? 'নগদ বিটুসি ডিসবার্সমেন্ট ও RSA এনক্রিপশন' : 'Nagad B2C Disbursement & Signature'}</span>
                </>
              )}
              {activeGateway === 'STRIPE' && (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                  <span>{lang === 'bn' ? 'স্ট্রাইপ গ্লোবাল কার্ড চার্জ' : 'Stripe Card Payment Charge'}</span>
                </>
              )}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeGateway === 'STRIPE'
                ? lang === 'bn'
                  ? 'আন্তর্জাতিক ক্লায়েন্টের কাছ থেকে কার্ড পেমেন্ট গ্রহণ করুন'
                  : 'Receive international card payments directly into ledger'
                : lang === 'bn'
                ? 'মার্চেন্ট অ্যাকাউন্ট থেকে ক্লায়েন্ট/ভেন্ডরের অ্যাকাউন্টে তাৎক্ষণিক ফান্ড ট্রান্সফার'
                : 'Direct payout from merchant wallet to customer account'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              {lang === 'bn' ? 'ইনভয়েস:' : 'Invoice:'}
            </span>
            <span className="font-mono text-xs text-indigo-300 font-semibold bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              {invoiceNo}
            </span>
            <button
              type="button"
              onClick={handleRegenerateInvoice}
              className="text-slate-500 hover:text-slate-300 transition cursor-pointer p-1"
              title="Generate new invoice number"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Input Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Amount field */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              {lang === 'bn' ? 'টাকার পরিমাণ (Amount)' : 'Disbursement Amount'}
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                {activeGateway === 'STRIPE' ? (currency === 'BDT' ? '৳' : currency) : '৳'}
              </span>
              <input
                type="number"
                step="any"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000.00"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-12 pr-4 py-2.5 text-white font-mono text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
          </div>

          {/* Conditional Gateway Fields */}
          {activeGateway !== 'STRIPE' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                {activeGateway === 'BKASH' ? 'bKash Receiver Number' : 'Nagad Receiver Number'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={receiverPhone}
                  onChange={(e) => setReceiverPhone(e.target.value)}
                  placeholder="01712345678"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                />
                {validateBangladeshiMsisdn(receiverPhone) && (
                  <CheckCircle2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {lang === 'bn' ? '১১ ডিজিটের বাংলাদেশি মোবাইল নম্বর (013-019)' : 'Valid 11-digit BD MSISDN (013-019)'}
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                {lang === 'bn' ? 'কারেন্সি নির্বাচন' : 'Currency'}
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              >
                <option value="USD">USD ($) - US Dollar</option>
                <option value="EUR">EUR (€) - Euro</option>
                <option value="GBP">GBP (£) - British Pound</option>
                <option value="BDT">BDT (৳) - Bangladeshi Taka</option>
              </select>
            </div>
          )}

          {/* Stripe Details */}
          {activeGateway === 'STRIPE' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Customer Full Name
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Test Card Number
                </label>
                <input
                  type="text"
                  required
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">Exp Month</label>
                  <input
                    type="text"
                    value={expMonth}
                    onChange={(e) => setExpMonth(e.target.value)}
                    maxLength={2}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-center text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">Exp Year</label>
                  <input
                    type="text"
                    value={expYear}
                    onChange={(e) => setExpYear(e.target.value)}
                    maxLength={2}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-center text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">CVC</label>
                  <input
                    type="text"
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value)}
                    maxLength={4}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-center text-white text-xs font-mono"
                  />
                </div>
              </div>
            </>
          )}

          {/* Note / Memo Field (Optional) */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                {lang === 'bn' ? 'নোট / মেমো (ঐচ্ছিক)' : 'Note / Memo (Optional)'}
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                {lang === 'bn' ? 'লেনদেনের বিবরণ ও অডিট ট্রেইল' : 'Disbursement reference & purpose'}
              </span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                lang === 'bn'
                  ? 'যেমন: রিফান্ড #১০৪২, এফিলিয়েট কমিশন, বেতন...'
                  : 'e.g., Refund for Order #1042, Affiliate commission, Vendor payment...'
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          {/* Email Notification & Receipt Dispatch */}
          <div className="md:col-span-2 p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendGmailReceipt}
                  onChange={(e) => setSendGmailReceipt(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
                />
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-indigo-400" />
                  {lang === 'bn'
                    ? 'জিমেইল এপিআই দিয়ে স্বয়ংক্রিয় রসিদ পাঠান'
                    : 'Dispatch Automated Receipt via Gmail API'}
                </span>
              </label>

              {isGmailConnected ? (
                <span className="text-[11px] text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800">
                  <CheckCircle2 className="w-3 h-3" />
                  {lang === 'bn' ? 'জিমেইল সক্রিয়' : 'Gmail Connected'}
                </span>
              ) : (
                <span className="text-[11px] text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800">
                  {lang === 'bn' ? 'সাইন-ইন প্রয়োজন' : 'Sign in to Send'}
                </span>
              )}
            </div>

            {sendGmailReceipt && (
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  {lang === 'bn' ? 'গ্রাহকের ইমেইল ঠিকানা (রসিদ পাঠাতে):' : 'Recipient Email Address:'}
                </label>
                <input
                  type="email"
                  required={sendGmailReceipt}
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="recipient@example.com"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  {lang === 'bn'
                    ? 'স্বয়ংক্রিয়ভাবে Payments/Disbursed লেবেলে সংরক্ষিত হবে।'
                    : 'Disbursement receipt will be organized automatically into the Payments/Disbursed label.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Nagad Cryptography Preview Box */}
        {activeGateway === 'NAGAD' && (
          <div className="mt-5 p-4 rounded-xl bg-slate-950 border border-orange-900/30 text-xs space-y-2.5">
            <div className="flex items-center justify-between text-orange-400 font-semibold">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                Live Cryptographic Preview (RSA OAEP + HMAC-SHA256)
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Payload Security</span>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 mb-1 flex items-center justify-between">
                <span>Computed HMAC-SHA256 Signature:</span>
                <span className="text-orange-300 font-mono">f"&#123;merchantId&#125;&#123;amount&#125;&#123;invoiceNo&#125;"</span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-orange-300 truncate">
                {nagadPreviewSig || 'Generating...'}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 mb-1">
                Encrypted sensitiveData (RSA Public Key / Base64):
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-400 truncate">
                {nagadEncryptedPreview || 'Generating...'}
              </div>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}

        {/* Success Banner */}
        {successTrx && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold text-emerald-300">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {lang === 'bn' ? 'ডিসবার্সমেন্ট সফলভাবে সম্পন্ন হয়েছে!' : 'Transaction Disbursed Successfully!'}
              </span>
            </div>
            <div className="font-mono text-[11px] text-emerald-400">
              TrxID: {successTrx.trxId} &bull; Invoice: {successTrx.invoiceNo} &bull; Amount: {successTrx.amount} {successTrx.currency}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="mt-6 flex items-center justify-between">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            <span>Idempotency-Key Protected</span>
          </div>

          <button
            type="submit"
            disabled={isProcessing}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold text-white transition shadow-lg cursor-pointer active:scale-95 disabled:opacity-50 ${
              activeGateway === 'BKASH'
                ? 'bg-pink-600 hover:bg-pink-500'
                : activeGateway === 'NAGAD'
                ? 'bg-orange-600 hover:bg-orange-500'
                : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            {isProcessing ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{lang === 'bn' ? 'প্রসেসিং হচ্ছে...' : 'Executing API Call...'}</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>
                  {activeGateway === 'STRIPE'
                    ? lang === 'bn'
                      ? 'পেমেন্ট সম্পন্ন করুন'
                      : 'Charge Payment'
                    : lang === 'bn'
                    ? 'ডিসবার্সমেন্ট পাঠান'
                    : 'Dispatch Disbursement'}
                </span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
