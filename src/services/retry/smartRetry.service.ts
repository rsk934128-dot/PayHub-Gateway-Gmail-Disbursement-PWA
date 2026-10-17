import { PaymentGateway, Transaction } from '../../types';

export type FailureType =
  | 'GATEWAY_TIMEOUT'
  | 'NETWORK_TIMEOUT'
  | 'CONNECTION_DROP'
  | 'SERVER_ERROR'
  | 'THROTTLED'
  | 'UNKNOWN';

export interface RetryDisbursementContext {
  id: string;
  gateway: PaymentGateway;
  amount: number;
  currency: 'BDT' | 'USD' | 'EUR' | 'GBP';
  invoiceNo: string;
  receiverPhone: string;
  customerEmail: string;
  customerName?: string;
  note: string;
  cardNumber?: string;
  expMonth?: string;
  expYear?: string;
  cvc?: string;
  sendGmailReceipt: boolean;
  idempotencyKey: string;
  failureType: FailureType;
  failureReason: string;
  failedAt: Date;
  attemptCount: number;
  maxAttempts: number;
}

/**
 * Classifies runtime errors to identify retryable network / API timeouts
 */
export function classifyFailure(error: any): {
  isRetryable: boolean;
  type: FailureType;
  title: string;
  description: string;
} {
  const msg = (error?.message || String(error || '')).toLowerCase();

  if (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('504') ||
    msg.includes('time out') ||
    msg.includes('gateway timeout')
  ) {
    return {
      isRetryable: true,
      type: 'GATEWAY_TIMEOUT',
      title: 'Gateway API Timeout (504)',
      description: 'The payment processor took too long to acknowledge the payout. Idempotency protection prevents double disbursement.',
    };
  }

  if (
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('failed to fetch') ||
    msg.includes('offline') ||
    msg.includes('econnrefused') ||
    msg.includes('connection reset') ||
    msg.includes('abort')
  ) {
    return {
      isRetryable: true,
      type: 'NETWORK_TIMEOUT',
      title: 'Network Connection Interrupted',
      description: 'Local connection to the payment gateway cluster was lost mid-transit.',
    };
  }

  if (
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('service unavailable') ||
    msg.includes('bad gateway') ||
    msg.includes('busy') ||
    msg.includes('high load')
  ) {
    return {
      isRetryable: true,
      type: 'SERVER_ERROR',
      title: 'Payment Server Unavailable (503)',
      description: 'Upstream gateway servers are experiencing high traffic. Retry recommended with exponential backoff.',
    };
  }

  if (msg.includes('rate limit') || msg.includes('429') || msg.includes('too many requests')) {
    return {
      isRetryable: true,
      type: 'THROTTLED',
      title: 'API Request Throttled (429)',
      description: 'Transaction burst threshold exceeded. Automatically pausing before smart re-submission.',
    };
  }

  return {
    isRetryable: true,
    type: 'UNKNOWN',
    title: 'Disbursement Interruption',
    description: error?.message || 'Transaction could not be verified by the processor.',
  };
}

/**
 * Computes suggested backoff delay in seconds based on attempt count
 */
export function getSuggestedBackoffSeconds(attemptCount: number): number {
  switch (attemptCount) {
    case 1:
      return 5;
    case 2:
      return 10;
    case 3:
      return 20;
    default:
      return 30;
  }
}
