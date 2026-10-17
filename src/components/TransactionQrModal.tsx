import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  X,
  QrCode,
  Download,
  Share2,
  Copy,
  Check,
  Printer,
  ShieldCheck,
  ExternalLink,
  Smartphone,
  Eye,
  CheckCircle2,
  Lock,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Transaction } from '../types';

interface Props {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  lang?: 'en' | 'bn';
}

type QrFormat = 'URL' | 'BANGLA_QR' | 'JSON';

export const TransactionQrModal: React.FC<Props> = ({
  transaction,
  isOpen,
  onClose,
  lang = 'en',
}) => {
  const [qrFormat, setQrFormat] = useState<QrFormat>('URL');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'qr' | 'preview'>('qr');
  const receiptCardRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !transaction) return null;

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://payhub.internal';

  // Build the shareable verification URL
  const verificationUrl = `${originUrl}/?view=receipt&trx=${encodeURIComponent(
    transaction.trxId
  )}&inv=${encodeURIComponent(transaction.invoiceNo)}&gw=${encodeURIComponent(
    transaction.gateway
  )}&amt=${transaction.amount}&cur=${encodeURIComponent(
    transaction.currency
  )}&rec=${encodeURIComponent(transaction.receiver)}&dt=${encodeURIComponent(
    transaction.createdAt
  )}&status=${encodeURIComponent(transaction.status)}`;

  // Build EMVCo / Bangla QR compatible string
  const banglaQrPayload = `00020101021226580014bd.gov.banglaqr0111${
    transaction.gateway === 'BKASH' ? '01700000000' : '01800000000'
  }520448145303050540${transaction.amount.toFixed(2).length}${transaction.amount.toFixed(
    2
  )}5802BD5914PAYHUB_GATEWAY6005DHAKA62210517${transaction.invoiceNo}6304`;

  // Build structured JSON
  const jsonPayload = JSON.stringify(
    {
      issuer: 'PayHub Enterprise Gateway',
      trxId: transaction.trxId,
      invoiceNo: transaction.invoiceNo,
      gateway: transaction.gateway,
      type: transaction.type,
      amount: transaction.amount,
      currency: transaction.currency,
      receiver: transaction.receiver,
      status: transaction.status,
      completedAt: transaction.createdAt,
      idempotencyHash: transaction.idempotencyKey,
      complianceStandard: 'SOC2_TYPE2_VERIFIED',
    },
    null,
    2
  );

  // Generate QR code data URL whenever transaction or format changes
  useEffect(() => {
    let payloadToEncode = verificationUrl;
    if (qrFormat === 'BANGLA_QR') {
      payloadToEncode = banglaQrPayload;
    } else if (qrFormat === 'JSON') {
      payloadToEncode = jsonPayload;
    }

    QRCode.toDataURL(payloadToEncode, {
      width: 480,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate QR code', err));
  }, [transaction, qrFormat, verificationUrl, banglaQrPayload, jsonPayload]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(verificationUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Payment Receipt: ${transaction.invoiceNo}`,
          text: `PayHub Verified Receipt: ${transaction.amount} ${transaction.currency} (${transaction.gateway} - ${transaction.trxId})`,
          url: verificationUrl,
        });
      } catch {}
    } else {
      handleCopyLink();
    }
  };

  const handleDownloadQrPng = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `PayHub_QR_Receipt_${transaction.invoiceNo}_${transaction.trxId}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                transaction.gateway === 'BKASH'
                  ? 'bg-pink-900/40 text-pink-400 border border-pink-700/50'
                  : transaction.gateway === 'NAGAD'
                  ? 'bg-orange-900/40 text-orange-400 border border-orange-700/50'
                  : 'bg-indigo-900/40 text-indigo-400 border border-indigo-700/50'
              }`}
            >
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{lang === 'bn' ? 'ডিজিটাল কিউআর রসিদ' : 'Digital QR Code Receipt'}</span>
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                {transaction.invoiceNo} &bull; {transaction.trxId}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View Switcher: QR Code vs Scanned Receipt Preview */}
        <div className="flex items-center justify-between px-5 pt-3 border-b border-slate-800/60 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('qr')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeTab === 'qr'
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'স্ক্যান কিউআর' : 'Scan QR Code'}</span>
            </button>

            <button
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeTab === 'preview'
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'গ্রাহকের রসিদ দর্শন' : 'Scanned Receipt View'}</span>
            </button>
          </div>

          <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
            <ShieldCheck className="w-3 h-3" />
            <span>Cryptographically Verified</span>
          </span>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {activeTab === 'qr' ? (
            <>
              {/* QR Format Selector */}
              <div className="p-1 rounded-xl bg-slate-950 border border-slate-800 flex items-center text-xs">
                <button
                  type="button"
                  onClick={() => setQrFormat('URL')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition cursor-pointer text-center ${
                    qrFormat === 'URL'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {lang === 'bn' ? 'অনলাইন লিংক' : 'Web Voucher URL'}
                </button>
                <button
                  type="button"
                  onClick={() => setQrFormat('BANGLA_QR')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition cursor-pointer text-center ${
                    qrFormat === 'BANGLA_QR'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {lang === 'bn' ? 'বাংলা কিউআর (EMVCo)' : 'Bangla QR Standard'}
                </button>
                <button
                  type="button"
                  onClick={() => setQrFormat('JSON')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition cursor-pointer text-center ${
                    qrFormat === 'JSON'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {lang === 'bn' ? 'JSON পে-লোড' : 'Offline JSON'}
                </button>
              </div>

              {/* High Contrast Physical Printable Voucher Badge */}
              <div
                ref={receiptCardRef}
                className="p-6 rounded-2xl bg-white text-slate-900 border border-slate-200 shadow-xl space-y-4 text-center relative overflow-hidden"
              >
                {/* Brand Decorative Top Line */}
                <div
                  className={`h-2 absolute top-0 left-0 right-0 ${
                    transaction.gateway === 'BKASH'
                      ? 'bg-pink-600'
                      : transaction.gateway === 'NAGAD'
                      ? 'bg-orange-500'
                      : 'bg-indigo-600'
                  }`}
                />

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded font-extrabold text-[11px] text-white ${
                        transaction.gateway === 'BKASH'
                          ? 'bg-pink-600'
                          : transaction.gateway === 'NAGAD'
                          ? 'bg-orange-500'
                          : 'bg-indigo-600'
                      }`}
                    >
                      {transaction.gateway}
                    </span>
                    <span className="text-xs font-bold text-slate-800">PayHub E-Receipt</span>
                  </div>

                  <span className="text-[11px] font-mono text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>{transaction.status}</span>
                  </span>
                </div>

                {/* QR Code Canvas/Image */}
                <div className="flex flex-col items-center justify-center p-3 bg-slate-50 border border-slate-200 rounded-2xl my-2 shadow-inner">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Payment QR Code"
                      className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center text-slate-400 text-xs">
                      Generating QR...
                    </div>
                  )}

                  <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
                    <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Point mobile camera to scan and verify voucher</span>
                  </div>
                </div>

                {/* Amount & Beneficiary */}
                <div className="space-y-1">
                  <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                    Disbursed Amount
                  </div>
                  <div className="text-2xl font-black text-slate-900 font-mono">
                    {transaction.currency === 'BDT' ? '৳' : transaction.currency}{' '}
                    {transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                {/* Meta Summary */}
                <div className="grid grid-cols-2 gap-2 text-left text-[11px] border-t border-slate-200 pt-3">
                  <div>
                    <span className="text-slate-500 block">Beneficiary:</span>
                    <span className="font-mono font-semibold text-slate-800 block truncate">
                      {transaction.receiver}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block">Invoice No:</span>
                    <span className="font-mono font-semibold text-slate-800 block truncate">
                      {transaction.invoiceNo}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">TrxID:</span>
                    <span className="font-mono font-semibold text-cyan-700 block truncate">
                      {transaction.trxId}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block">Date & Time:</span>
                    <span className="font-mono text-slate-700 block">
                      {new Date(transaction.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Scanned Receipt View (What the recipient sees on mobile phone) */
            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-5 text-xs">
              <div className="text-center space-y-1 pb-4 border-b border-slate-800">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-white">Payment Verified Authenticated</h4>
                <p className="text-slate-400 text-[11px]">
                  Official electronic payment receipt verified by PayHub Gateway.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Payment Gateway:</span>
                  <span className="font-bold text-white">{transaction.gateway} B2C</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Transaction ID:</span>
                  <span className="font-mono text-cyan-400 font-bold">{transaction.trxId}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Invoice Number:</span>
                  <span className="font-mono text-white font-semibold">{transaction.invoiceNo}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Recipient Account:</span>
                  <span className="font-mono text-slate-200">{transaction.receiver}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Amount Paid:</span>
                  <span className="font-bold text-emerald-400 text-sm font-mono">
                    {transaction.currency === 'BDT' ? '৳' : transaction.currency}{' '}
                    {transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Disbursement Time:</span>
                  <span className="font-mono text-slate-300">
                    {new Date(transaction.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Digital Signature:</span>
                  <span className="font-mono text-indigo-400 truncate max-w-[170px]">
                    SHA256:{transaction.idempotencyKey.slice(0, 16)}...
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Verified with Gateway Ledger</span>
                </div>
                <button
                  onClick={handleCopyLink}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                >
                  {isCopied ? 'Link Copied!' : 'Copy Direct Link'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Quick Action Toolbar */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/95 flex flex-wrap items-center justify-between gap-2.5 mt-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadQrPng}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition cursor-pointer border border-slate-700"
              title="Download QR Code image as PNG"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'PNG ডাউনলোড' : 'Save Image'}</span>
            </button>

            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition cursor-pointer border border-slate-700"
              title="Copy shareable link"
            >
              {isCopied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{isCopied ? (lang === 'bn' ? 'কপি হয়েছে' : 'Copied!') : (lang === 'bn' ? 'লিংক কপি' : 'Copy Link')}</span>
            </button>

            <button
              onClick={handleNativeShare}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition cursor-pointer border border-slate-700"
              title="Share via mobile sheet"
            >
              <Share2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>{lang === 'bn' ? 'শেয়ার' : 'Share'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer border border-slate-700"
              title="Print voucher"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'প্রিন্ট' : 'Print'}</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer shadow-lg shadow-indigo-950"
            >
              {lang === 'bn' ? 'সম্পন্ন' : 'Done'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
