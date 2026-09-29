/**
 * PaynowGateway.ts
 *
 * The HTTP side of Paynow (paynow.co.zw), Zimbabwe's payment gateway. It
 * starts transactions, checks their status and verifies Paynow's messages.
 * What a payment is for, and what happens when it is paid, is ChargeService.
 *
 * Paynow speaks URL-encoded forms. Every message carries a hash: SHA-512 of
 * all its values except the hash, in the order sent, followed by the
 * integration key, as uppercase hex. The same rule signs our requests and
 * verifies Paynow's replies and status updates. See
 * https://developers.paynow.co.zw and the official Node SDK.
 *
 * - Mobile money (EcoCash, OneMoney, InnBucks) uses "express checkout":
 *   Paynow pushes a USSD prompt to the payer's phone (EcoCash, OneMoney),
 *   or returns a code the payer enters in the InnBucks app.
 * - Cards use the web checkout: the payer opens Paynow's page.
 */

import crypto from 'crypto';
import axios from 'axios';
import { config } from '../config';
import type { CurrencyCode } from '../config/region';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

export type PayChannel = 'ecocash' | 'onemoney' | 'innbucks' | 'card';
export const PAY_CHANNELS: PayChannel[] = ['ecocash', 'onemoney', 'innbucks', 'card'];
export const MOBILE_CHANNELS: PayChannel[] = ['ecocash', 'onemoney', 'innbucks'];

/** Where a Paynow transaction stands, reduced to what Poolora acts on */
export type GatewayState = 'pending' | 'paid' | 'failed' | 'refunded' | 'disputed';

export interface GatewayStatus {
  state: GatewayState;
  /** Paynow's own status text, e.g. "Paid", "Cancelled" */
  raw: string;
  reference?: string;
  paynowReference?: string;
  amount?: number;
  pollUrl?: string;
}

export interface StartedTransaction {
  pollUrl: string;
  paynowReference?: string;
  /** Card payments: the page the payer opens */
  redirectUrl?: string;
  /** Paynow's own instructions for the payer, when it sends any */
  instructions?: string;
  /** InnBucks: the code the payer enters or scans in the InnBucks app */
  authorizationCode?: string;
  authorizationExpires?: string;
}

type Fields = Array<[string, string]>;

function integration(currency: CurrencyCode) {
  const i = currency === 'ZWG' ? config.paynow.zwg : config.paynow.usd;
  return i.integrationId && i.integrationKey ? i : null;
}

export function currencyEnabled(currency: CurrencyCode): boolean {
  return Boolean(integration(currency)) && (currency === 'USD' || config.zwgPerUsd > 0);
}

/** SHA-512 of the values (not the hash) in order, then the integration key, as uppercase hex */
export function paynowHash(fields: Fields, integrationKey: string): string {
  const text = fields.filter(([k]) => k.toLowerCase() !== 'hash').map(([, v]) => v).join('') + integrationKey.toLowerCase();
  return crypto.createHash('sha512').update(text, 'utf8').digest('hex').toUpperCase();
}

/** Parses a URL-encoded message, keeping the order the values were sent in */
export function parseMessage(body: string): Fields {
  return [...new URLSearchParams(body).entries()];
}

/** True when the message's hash matches, compared in constant time */
export function verifyMessage(fields: Fields, integrationKey: string): boolean {
  const given = fields.find(([k]) => k.toLowerCase() === 'hash')?.[1] ?? '';
  const expected = paynowHash(fields, integrationKey);
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given.toUpperCase()), Buffer.from(expected));
}

const field = (fields: Fields, name: string) => fields.find(([k]) => k.toLowerCase() === name)?.[1];

/** Paynow's status words, mapped to what we do about them */
export function stateOf(status: string): GatewayState {
  switch (status.trim().toLowerCase()) {
    case 'paid':
    case 'awaiting delivery':
    case 'delivered':
      return 'paid';
    case 'cancelled':
    case 'failed':
      return 'failed';
    case 'refunded':
      return 'refunded';
    case 'disputed':
      return 'disputed';
    default: // created, sent, and anything new
      return 'pending';
  }
}

function toStatus(fields: Fields): GatewayStatus {
  const raw = field(fields, 'status') ?? '';
  const amount = Number(field(fields, 'amount'));
  return {
    state: stateOf(raw),
    raw,
    reference: field(fields, 'reference'),
    paynowReference: field(fields, 'paynowreference'),
    amount: Number.isFinite(amount) ? amount : undefined,
    pollUrl: field(fields, 'pollurl'),
  };
}

async function post(url: string, fields: Fields): Promise<string> {
  const { data } = await axios.post<string>(url, new URLSearchParams(fields).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 30_000,
    responseType: 'text',
    transformResponse: (d) => d,
  });
  return String(data ?? '');
}

/** Turns a transport failure into a message the payer can act on */
function unavailable(operation: string, error: unknown): AppError {
  logger.error('Paynow request failed', { operation, error: (error as Error)?.message });
  return new AppError('Online payments are unavailable right now. Please try again, or pay from your wallet.', 502, 'PAYMENT_PROVIDER_UNAVAILABLE');
}

export class PaynowGateway {
  /**
   * Starts a transaction. Mobile channels need the payer's phone in local
   * format (0771234567). Throws a 4xx AppError with Paynow's reason when
   * Paynow refuses (for example, insufficient balance).
   */
  async start(input: {
    reference: string;
    amount: number;
    currency: CurrencyCode;
    channel: PayChannel;
    description: string;
    email: string;
    phone?: string;
    resultUrl: string;
    returnUrl: string;
  }): Promise<StartedTransaction> {
    const i = integration(input.currency);
    if (!i) throw new AppError(`Payments in ${input.currency === 'ZWG' ? 'ZiG' : 'US dollars'} are not available right now.`, 503, 'PAYMENT_CURRENCY_UNAVAILABLE');

    const mobile = input.channel !== 'card';
    const fields: Fields = [
      ['resulturl', input.resultUrl],
      ['returnurl', input.returnUrl],
      ['reference', input.reference],
      ['amount', input.amount.toFixed(2)],
      ['id', i.integrationId],
      ['additionalinfo', input.description.slice(0, 200)],
      ['authemail', input.email],
      ...(mobile ? ([['phone', input.phone ?? ''], ['method', input.channel]] as Fields) : []),
      ['status', 'Message'],
    ];
    fields.push(['hash', paynowHash(fields, i.integrationKey)]);

    let reply: Fields;
    try {
      reply = parseMessage(await post(mobile ? config.paynow.remoteUrl : config.paynow.initiateUrl, fields));
    } catch (error) {
      throw unavailable('start', error);
    }

    const status = (field(reply, 'status') ?? '').toLowerCase();
    if (status !== 'ok') {
      const reason = field(reply, 'error') || 'Paynow could not start the payment';
      logger.warn('Paynow refused a transaction', { reference: input.reference, channel: input.channel, reason });
      throw new AppError(reason, 422, 'PAYMENT_REFUSED');
    }
    if (!verifyMessage(reply, i.integrationKey)) {
      logger.error('Paynow reply failed the hash check', { reference: input.reference });
      throw new AppError('The payment could not be started safely. Please try again.', 502, 'PAYMENT_PROVIDER_UNAVAILABLE');
    }

    const pollUrl = field(reply, 'pollurl');
    if (!pollUrl) throw unavailable('start', new Error('No poll URL in the reply'));
    return {
      pollUrl,
      paynowReference: field(reply, 'paynowreference'),
      redirectUrl: field(reply, 'browserurl'),
      instructions: field(reply, 'instructions'),
      authorizationCode: field(reply, 'authorizationcode'),
      authorizationExpires: field(reply, 'authorizationexpires'),
    };
  }

  /** Asks Paynow where a transaction stands. Null when the answer cannot be trusted. */
  async poll(pollUrl: string, currency: CurrencyCode): Promise<GatewayStatus | null> {
    const i = integration(currency);
    if (!i) return null;
    if (!/^https:\/\/([a-z0-9-]+\.)*paynow\.co\.zw\//i.test(pollUrl)) {
      logger.error('Refusing to poll a URL outside Paynow', { pollUrl });
      return null;
    }
    try {
      const reply = parseMessage(await post(pollUrl, []));
      if (!verifyMessage(reply, i.integrationKey)) {
        logger.warn('Paynow poll reply failed the hash check', { pollUrl });
        return null;
      }
      return toStatus(reply);
    } catch (error) {
      logger.warn('Paynow poll failed', { pollUrl, error: (error as Error).message });
      return null;
    }
  }

  /**
   * Reads a status update Paynow posted to the result URL. Tries each
   * configured integration's key, since the message does not say which
   * currency it is for. Null when no key verifies it.
   */
  readResult(body: string): { status: GatewayStatus; currency: CurrencyCode } | null {
    const fields = parseMessage(body);
    for (const currency of ['USD', 'ZWG'] as const) {
      const i = integration(currency);
      if (i && verifyMessage(fields, i.integrationKey)) return { status: toStatus(fields), currency };
    }
    return null;
  }
}
