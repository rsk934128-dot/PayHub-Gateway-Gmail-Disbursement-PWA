import React, { useState } from 'react';
import { Play, Copy, Check, Code2, Terminal, Server, FileText, ArrowRight } from 'lucide-react';
import { executeBkashDisbursement } from '../services/bkash/bkash.service';
import { executeNagadDisbursement } from '../services/nagad/nagad.service';
import { executeStripeCharge } from '../services/stripe/stripe.service';

interface Props {
  lang?: 'en' | 'bn';
}

interface EndpointDef {
  id: string;
  name: string;
  method: 'POST' | 'GET';
  path: string;
  tag: string;
  description: string;
  defaultPayload: string;
  pythonFastApiSnippet: string;
  nodeSnippet: string;
}

const ENDPOINTS: EndpointDef[] = [
  {
    id: 'nagad-payout',
    name: 'Nagad B2C Disbursement',
    method: 'POST',
    path: '/api/payout/nagad',
    tag: 'Disbursement',
    description: 'Executes Nagad B2C payout using RSA OAEP payload encryption and HMAC-SHA256 signature.',
    defaultPayload: JSON.stringify(
      {
        account: '01899990001',
        amount: '1200.00',
        receiverMSISDN: '01812345678',
        merchantInvoice: 'INV-2026-NAGAD-01',
      },
      null,
      2
    ),
    pythonFastApiSnippet: `@app.post("/api/payout/nagad", response_model=PayoutResponse)
async def nagad_payout(payout: PayoutRequest):
    # 1. RSA encrypt sensitive payload
    sensitive_data = encrypt_nagad_payload(payout.dict(), "public_key.pem")
    
    # 2. HMAC-SHA256 signature
    signature = generate_nagad_signature(MERCHANT_ID, str(payout.amount), payout.invoice_no, SECRET_KEY)
    
    # 3. Dispatch to Nagad B2C
    async with httpx.AsyncClient() as client:
        res = await client.post("https://api.nagad.com.bd/api/b2c/payment", json={
            "merchantId": MERCHANT_ID,
            "sensitiveData": sensitive_data,
            "signature": signature
        })
    return res.json()`,
    nodeSnippet: `// TypeScript / Express
app.post('/api/payout/nagad', async (req, res) => {
  const { amount, receiverMSISDN, merchantInvoice } = req.body;
  const sensitiveData = await encryptNagadPayload(req.body, publicKey);
  const signature = generateNagadSignature(MERCHANT_ID, amount, merchantInvoice, SECRET_KEY);
  
  const response = await axios.post('https://api.nagad.com.bd/api/b2c/payment', {
    merchantId: MERCHANT_ID,
    sensitiveData,
    signature,
  });
  res.json(response.data);
});`,
  },
  {
    id: 'bkash-payout',
    name: 'bKash B2C Disbursement',
    method: 'POST',
    path: '/api/payout/bkash',
    tag: 'Disbursement',
    description: 'Official bKash B2C disbursement call with JWT grant token and Idempotency key protection.',
    defaultPayload: JSON.stringify(
      {
        receiverMSISDN: '01712345678',
        amount: '2000.00',
        currency: 'BDT',
        merchantInvoiceNumber: 'INV-2026-BKASH-01',
        intent: 'sale',
      },
      null,
      2
    ),
    pythonFastApiSnippet: `@app.post("/api/payout/bkash")
async def bkash_payout(payout: BkashPayoutRequest):
    token = await get_bkash_grant_token()
    headers = {"Authorization": token, "X-APP-Key": BKASH_APP_KEY}
    
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{BKASH_BASE_URL}/checkout/payment/b2c/payment",
            json=payout.dict(),
            headers=headers
        )
    return res.json()`,
    nodeSnippet: `// TypeScript bKash B2C Call
export async function processBkashDisbursement(payoutData) {
  const idToken = await getBkashAuthToken();
  const response = await axios.post(
    \`\${process.env.BKASH_BASE_URL}/checkout/payment/b2c/payment\`,
    payoutData,
    { headers: { Authorization: idToken, 'X-APP-Key': process.env.BKASH_APP_KEY } }
  );
  return response.data;
}`,
  },
  {
    id: 'stripe-charge',
    name: 'Stripe PaymentIntent Charge',
    method: 'POST',
    path: '/api/payments/stripe/charge',
    tag: 'Stripe',
    description: 'Charges international credit/debit card and records ledger transaction.',
    defaultPayload: JSON.stringify(
      {
        amount: 85.0,
        currency: 'usd',
        customerEmail: 'client@global.com',
        customerName: 'Sarah Jenkins',
      },
      null,
      2
    ),
    pythonFastApiSnippet: `import stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

@app.post("/api/payments/stripe/charge")
async def stripe_charge(req: StripeChargeRequest):
    intent = stripe.PaymentIntent.create(
        amount=int(req.amount * 100),
        currency=req.currency,
        receipt_email=req.customerEmail,
        metadata={"customerName": req.customerName}
    )
    return intent`,
    nodeSnippet: `import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.post('/api/payments/stripe/charge', async (req, res) => {
  const { amount, currency, customerEmail } = req.body;
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency,
    receipt_email: customerEmail,
  });
  res.json(paymentIntent);
});`,
  },
  {
    id: 'nagad-webhook',
    name: 'Nagad IPN Webhook Receiver',
    method: 'POST',
    path: '/api/webhooks/nagad',
    tag: 'Webhooks',
    description: 'Validates webhook signature from Nagad and triggers background ledger update & Gmail receipt.',
    defaultPayload: JSON.stringify(
      {
        trx_id: 'NGD98201948',
        invoice_no: 'INV-2026-NAGAD-01',
        amount: '1200.00',
        status: 'SUCCESS',
        signature: 'A98F7C66B92841E...',
      },
      null,
      2
    ),
    pythonFastApiSnippet: `@app.post("/api/webhooks/nagad")
async def nagad_webhook(request: Request, background_tasks: BackgroundTasks):
    data = await request.json()
    if not verify_signature(data):
        raise HTTPException(status_code=400, detail="Invalid Signature")
    
    # Process asynchronously to return 200 OK immediately
    background_tasks.add_task(process_webhook_data, data)
    return {"status": "received", "trx_id": data["trx_id"]}`,
    nodeSnippet: `app.post('/api/webhooks/nagad', async (req, res) => {
  const verified = verifyNagadHmac(req.body, req.headers['x-signature']);
  if (!verified) return res.status(401).send('Bad Signature');
  
  // Update ledger and trigger Gmail
  await updateLedgerStatus(req.body.trx_id, 'COMPLETED');
  res.status(200).json({ received: true });
});`,
  },
];

export const ApiSandbox: React.FC<Props> = ({ lang = 'en' }) => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointDef>(ENDPOINTS[0]);
  const [payload, setPayload] = useState<string>(selectedEndpoint.defaultPayload);
  const [activeSnippetLang, setActiveSnippetLang] = useState<'python' | 'node'>('python');
  const [responseOutput, setResponseOutput] = useState<any>(null);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSelectEndpoint = (ep: EndpointDef) => {
    setSelectedEndpoint(ep);
    setPayload(ep.defaultPayload);
    setResponseOutput(null);
    setResponseStatus(null);
    setLatencyMs(null);
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    const start = performance.now();

    try {
      const parsed = JSON.parse(payload);
      let result: any;

      if (selectedEndpoint.id === 'nagad-payout') {
        const res = await executeNagadDisbursement({
          receiverMsisdn: parsed.receiverMSISDN || '01812345678',
          amount: parseFloat(parsed.amount) || 1000,
          currency: 'BDT',
          merchantInvoiceNumber: parsed.merchantInvoice || 'INV-TEST',
        });
        result = res;
      } else if (selectedEndpoint.id === 'bkash-payout') {
        const res = await executeBkashDisbursement({
          receiverMsisdn: parsed.receiverMSISDN || '01712345678',
          amount: parseFloat(parsed.amount) || 1000,
          currency: 'BDT',
          merchantInvoiceNumber: parsed.merchantInvoiceNumber || 'INV-TEST',
        });
        result = res;
      } else if (selectedEndpoint.id === 'stripe-charge') {
        const res = await executeStripeCharge({
          amount: parseFloat(parsed.amount) || 50,
          currency: (parsed.currency || 'usd').toUpperCase() as any,
          customerEmail: parsed.customerEmail || 'test@example.com',
          customerName: parsed.customerName || 'Test Customer',
          cardNumber: '4242424242424242',
          expMonth: '12',
          expYear: '28',
          cvc: '123',
        });
        result = res;
      } else {
        // Webhook receiver simulation
        await new Promise((r) => setTimeout(r, 300));
        result = {
          status: 'received',
          webhookEvent: 'payment_disbursed',
          verified: true,
          processedAt: new Date().toISOString(),
          ledgerStatus: 'COMPLETED',
        };
      }

      const elapsed = Math.round(performance.now() - start);
      setLatencyMs(elapsed);
      setResponseStatus(200);
      setResponseOutput(result);
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - start);
      setLatencyMs(elapsed);
      setResponseStatus(400);
      setResponseOutput({ error: err.message || 'Execution error' });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopyCode = () => {
    const code =
      activeSnippetLang === 'python'
        ? selectedEndpoint.pythonFastApiSnippet
        : selectedEndpoint.nodeSnippet;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-indigo-400" />
            <span>{lang === 'bn' ? 'সোয়েগার / ওপেনএপিআই স্যান্ডবক্স' : 'OpenAPI / Swagger Interactive Sandbox'}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {lang === 'bn'
              ? 'বিকাশ, নগদ ও স্ট্রাইপের বিটুসি এপিআই সরাসরি টেস্ট করুন এবং পাইথন/নোডজেএস কোড স্নsnippet সংগ্রহ করুন।'
              : 'Test B2C disbursement and webhook endpoints interactively with production code samples.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-800">
            OpenAPI 3.1.0 Compatible
          </span>
        </div>
      </div>

      {/* Main Sandbox Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Endpoint Selector Menu */}
        <div className="lg:col-span-4 space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2">
            {lang === 'bn' ? 'এন্ডপয়েন্টসমূহ' : 'Available Endpoints'}
          </div>
          {ENDPOINTS.map((ep) => {
            const isSelected = ep.id === selectedEndpoint.id;
            return (
              <button
                key={ep.id}
                onClick={() => handleSelectEndpoint(ep)}
                className={`w-full p-3.5 rounded-xl border text-left transition cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800/90 border-indigo-500 shadow-md ring-1 ring-indigo-500/30'
                    : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/50 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs text-white">{ep.name}</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                    {ep.method}
                  </span>
                </div>
                <div className="font-mono text-[11px] text-indigo-300 truncate">{ep.path}</div>
              </button>
            );
          })}
        </div>

        {/* Request / Response / Code Panel */}
        <div className="lg:col-span-8 space-y-6">
          {/* Active Endpoint Info & Try It Out */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold font-mono bg-emerald-950 text-emerald-400 border border-emerald-800">
                  {selectedEndpoint.method}
                </span>
                <span className="font-mono text-sm font-bold text-white">{selectedEndpoint.path}</span>
              </div>
              <button
                onClick={handleExecute}
                disabled={isExecuting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold shadow-lg transition active:scale-95 disabled:opacity-50 cursor-pointer self-start sm:self-auto"
              >
                {isExecuting ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                <span>{lang === 'bn' ? 'টেস্ট রান করুন' : 'Execute Test Call'}</span>
              </button>
            </div>

            <p className="text-xs text-slate-300">{selectedEndpoint.description}</p>

            {/* Request Payload Editor */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span>Request Body (JSON):</span>
                <span className="text-[10px] font-mono text-slate-500">application/json</span>
              </div>
              <textarea
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                rows={7}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 font-mono text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              />
            </div>

            {/* Response Section */}
            {responseOutput && (
              <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Response:</span>
                    <span
                      className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                        responseStatus === 200
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}
                    >
                      {responseStatus} OK
                    </span>
                  </div>
                  {latencyMs && (
                    <span className="font-mono text-slate-400 text-[11px]">{latencyMs} ms latency</span>
                  )}
                </div>
                <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-300 overflow-x-auto max-h-60">
                  {JSON.stringify(responseOutput, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Integration Code Snippets (Python & Node.js) */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  {lang === 'bn' ? 'প্রোডাকশন কোড স্নsnippet' : 'Backend Implementation Snippet'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-[11px]">
                  <button
                    onClick={() => setActiveSnippetLang('python')}
                    className={`px-3 py-1 rounded-md transition ${
                      activeSnippetLang === 'python'
                        ? 'bg-indigo-600 text-white font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Python (FastAPI)
                  </button>
                  <button
                    onClick={() => setActiveSnippetLang('node')}
                    className={`px-3 py-1 rounded-md transition ${
                      activeSnippetLang === 'node'
                        ? 'bg-indigo-600 text-white font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Node.js / TS
                  </button>
                </div>
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition cursor-pointer"
                  title="Copy Code"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed">
              {activeSnippetLang === 'python'
                ? selectedEndpoint.pythonFastApiSnippet
                : selectedEndpoint.nodeSnippet}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
