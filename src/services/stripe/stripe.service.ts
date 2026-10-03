import { StripeChargeParams } from '../../types';

export interface StripePaymentIntentResponse {
  id: string;
  object: 'payment_intent';
  amount: number;
  currency: string;
  status: 'succeeded' | 'requires_action' | 'canceled';
  clientSecret: string;
  created: number;
  customerEmail: string;
  customerName: string;
  last4: string;
  cardBrand: string;
  receiptUrl: string;
}

export function validateCardNumber(num: string): { valid: boolean; brand: string } {
  const clean = num.replace(/\D/g, '');
  if (clean.length < 13 || clean.length > 19) return { valid: false, brand: 'Unknown' };

  // Luhn algorithm
  let sum = 0;
  let alternate = false;
  for (let i = clean.length - 1; i >= 0; i--) {
    let n = parseInt(clean.charAt(i), 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n = (n % 10) + 1;
    }
    sum += n;
    alternate = !alternate;
  }

  const valid = sum % 10 === 0;

  let brand = 'Generic Card';
  if (/^4/.test(clean)) brand = 'Visa';
  else if (/^(5[1-5]|2[2-7])/.test(clean)) brand = 'Mastercard';
  else if (/^3[47]/.test(clean)) brand = 'American Express';
  else if (/^6011|65|64[4-9]/.test(clean)) brand = 'Discover';

  return { valid, brand };
}

/**
 * Simulates / executes Stripe charge payment intent
 */
export async function executeStripeCharge(
  params: StripeChargeParams
): Promise<StripePaymentIntentResponse> {
  const cleanCard = params.cardNumber.replace(/\D/g, '');
  const { valid, brand } = validateCardNumber(cleanCard);

  if (!valid && cleanCard !== '4242424242424242') {
    throw new Error('Invalid card number. Please provide a valid card or use Stripe test card 4242 4242 4242 4242.');
  }

  if (params.amount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }

  // Network delay simulation
  await new Promise((r) => setTimeout(r, 600));

  const id = 'pi_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now().toString(36);
  const last4 = cleanCard.slice(-4) || '4242';

  return {
    id,
    object: 'payment_intent',
    amount: Math.round(params.amount * 100), // in cents
    currency: params.currency.toLowerCase(),
    status: 'succeeded',
    clientSecret: `${id}_secret_${Math.random().toString(36).substring(2, 10)}`,
    created: Math.floor(Date.now() / 1000),
    customerEmail: params.customerEmail,
    customerName: params.customerName,
    last4,
    cardBrand: brand,
    receiptUrl: `https://pay.stripe.com/receipts/acct_payhub/${id}`,
  };
}
