/**
 * SupportBotService.ts
 *
 * The in-app support assistant (UC-X02 chatbot). It answers from Poolora's
 * help answers and the user's own recent bookings, works out refunds with
 * the real cancellation policy, and hands anything it cannot settle to a
 * person by opening a support request. It never changes a booking or moves
 * money itself.
 *
 * Runs on Claude (ANTHROPIC_API_KEY; model SUPPORT_BOT_MODEL, default
 * claude-opus-5). Without a key the endpoint says so and the app offers the
 * FAQ and the contact form instead. The conversation is kept by the app and
 * sent with each message; tool calls happen inside a single turn.
 */

import Anthropic from '@anthropic-ai/sdk';
import { Types } from 'mongoose';
import { Booking } from '../models/Booking';
import { User } from '../models/User';
import { SUPPORT_CATEGORIES, SupportCategory } from '../models/SupportTicket';
import { BookingService } from './BookingService';
import { SupportService } from './SupportService';
import { getRedisClient } from '../config/redis';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

const MODEL = process.env.SUPPORT_BOT_MODEL || 'claude-opus-5';
const MAX_TOOL_ROUNDS = 5;
const MAX_HISTORY = 20;
const MESSAGES_PER_HOUR = 40;

export function supportBotEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Keep in line with the FAQ in frontend/src/screens/shared/HelpScreen.tsx
const HELP = `
Booking and payment
- A seat is confirmed when the driver accepts the request. Drivers have 6 hours to answer; a request not answered in time, or once the ride has left, expires and any payment is refunded in full.
- A request paid online (EcoCash, OneMoney, InnBucks or card) that is not paid within 15 minutes is cancelled and nothing is charged. A payment that arrives after that goes to the Poolora wallet.
- Rider cancellation refunds (defaults; the exact amount comes from the get_cancellation_quote tool): everything 24 hours or more before departure, half from 12 hours, a quarter from 6 hours, nothing after. If the driver changes the time or cancels, the rider gets everything back.
- Refunds go to the Poolora wallet at once, however the rider paid. From the wallet they can withdraw to EcoCash, OneMoney or InnBucks (Wallet, Withdraw); a person sends it, usually within one working day.

During a ride
- Share trip on the ride screen gives a link anyone can follow until an hour after arrival.
- SOS alerts the Poolora safety team at once and texts emergency contacts a live-location link. In danger: call 999 (police 995, ambulance 994).
- Riders are asked "Are you OK?" every 30 minutes on longer rides; two unanswered prompts raise an SOS.
- If the driver cancels, the rider is refunded in full automatically. If they never arrived: My rides, the trip, Report a problem.

After a ride
- Ratings: right after the ride or later from My rides, for 7 days. Written reviews appear after a check.
- Receipts: My rides, the trip, Receipt; it can be emailed.
- Problems with a trip: My rides, the trip, Report a problem. Reviewed within 48 to 72 hours.
- Suspended or blocked accounts can appeal within 30 days from Help, Appeal a suspension or block.

Parcels
- Drivers photograph the parcel at pickup and delivery. Damage can be claimed within 7 days of delivery, and a parcel 24 hours overdue can be reported lost, from the parcel's tracking screen. Insured parcels are covered up to their declared value, others up to the delivery charge.

Driving with Poolora
- Verification of licence, registration and insurance takes up to 48 hours.
- Seat prices: Poolora suggests one from distance and vehicle; drivers choose within 30% of it.
- Verified badge: approved documents, 20 trips, rating 4.7+ from at least 10 riders, few cancellations, 90 days, clean record.
- Drivers are paid their share when they complete the ride; monthly statements are on the Earnings screen.
`.trim();

const SYSTEM = `You are Poolora's support assistant, inside the Poolora ride-sharing app in Zimbabwe. You talk with one signed-in user.

What you can do:
- Answer questions from the help answers below. Do not invent policies, amounts or timelines that are not there or in a tool result.
- Look up the user's own recent bookings with get_my_recent_bookings, and the exact refund for cancelling one with get_cancellation_quote.
- Hand the conversation to a person with create_support_request when the user asks for a human, when a payment is missing or wrong, for disputes about a trip, or whenever you cannot settle it from the answers and tools. Tell the user you have done so and that replies appear under Help, Your requests.

What you cannot do: cancel, change or refund bookings, move money, or change accounts. Explain where in the app the user does it, or open a support request.

Safety comes first: if the user may be in danger now, tell them to press SOS in the app and call 999 (police 995, ambulance 994), then open a safety support request.

Write short, plain answers (a few sentences), in the language the user writes in (English, Shona or Ndebele). Amounts are in US dollars, written US$5. Never show internal ids to the user.

Help answers:
${HELP}`;

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'get_my_recent_bookings',
    description: "The signed-in user's 10 most recent bookings as a rider or driver: id, role, status, route, departure, fare, refund. Use it before answering anything about their trips or payments.",
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
    strict: true,
  },
  {
    name: 'get_cancellation_quote',
    description: 'How much the user would get back if they cancelled one of their bookings now, under the current policy.',
    input_schema: {
      type: 'object',
      properties: { booking_id: { type: 'string', description: 'The id from get_my_recent_bookings' } },
      required: ['booking_id'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'create_support_request',
    description: 'Open a support request so a person from Poolora takes over. Include everything the user said that the team needs, so they do not have to repeat it.',
    input_schema: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: [...SUPPORT_CATEGORIES] },
        subject: { type: 'string', description: 'A short title, under 100 characters' },
        message: { type: 'string', description: "The user's problem in full, in their words where possible" },
        booking_id: { type: 'string', description: 'The booking it is about, if any; empty string if none' },
      },
      required: ['category', 'subject', 'message', 'booking_id'],
      additionalProperties: false,
    },
    strict: true,
  },
];

export type ChatTurn = { role: 'user' | 'assistant'; text: string };

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

export class SupportBotService {
  private bookings = new BookingService();
  private support = new SupportService();

  /** One user message in; the assistant's reply out, with any support request it opened */
  async reply(userId: string, history: ChatTurn[]): Promise<{ reply: string; ticketId?: string }> {
    if (!supportBotEnabled()) throw new AppError('The support assistant is not available; use the help answers or contact us', 503, 'CHATBOT_UNAVAILABLE');
    await this.rateLimit(userId);

    const turns = history.slice(-MAX_HISTORY).filter((t) => t.text?.trim());
    if (!turns.length || turns[turns.length - 1].role !== 'user') throw new AppError('Send a message', 422, 'VALIDATION_ERROR');
    // The API needs the conversation to start with the user
    while (turns.length && turns[0].role !== 'user') turns.shift();
    const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((t) => ({ role: t.role, content: t.text.trim().slice(0, 4000) }));

    let ticketId: string | undefined;
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      let response: Anthropic.Beta.BetaMessage;
      try {
        response = await anthropic().beta.messages.create({
          model: MODEL,
          max_tokens: 4000,
          // Chat: answer quickly; this route does not need deep reasoning
          output_config: { effort: 'low' },
          // A declined request is re-run on Anthropic's recommended fallback model
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          // Tools and this system prompt are the same for every user, so they are cached
          system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
          tools: TOOLS,
          messages,
        });
      } catch (error) {
        if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError || error instanceof Anthropic.APIConnectionError) {
          logger.warn('Support assistant temporarily unavailable', { error: (error as Error).message });
          throw new AppError('The assistant is busy right now. Try again in a minute, or contact us.', 503, 'CHATBOT_BUSY');
        }
        logger.error('Support assistant request failed', { error: (error as Error).message });
        throw new AppError('The assistant could not answer. Contact us instead.', 502, 'CHATBOT_FAILED');
      }

      if (response.stop_reason === 'refusal') {
        return { reply: "I can't help with that here. Use Contact us in Help and a person from our team will reply.", ticketId };
      }
      const text = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('\n').trim();
      const calls = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
      if (response.stop_reason !== 'tool_use' || !calls.length) {
        return { reply: text || 'Sorry, I lost my train of thought. Could you ask that again?', ticketId };
      }

      // Keep the full assistant turn (fallback and thinking blocks included), then answer every tool call in one message
      messages.push({ role: 'assistant', content: response.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const call of calls) {
        try {
          const out = await this.runTool(userId, call.name, call.input as Record<string, unknown>);
          if (out.ticketId) ticketId = out.ticketId;
          results.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(out.result) });
        } catch (error) {
          results.push({ type: 'tool_result', tool_use_id: call.id, content: (error as Error).message, is_error: true });
        }
      }
      messages.push({ role: 'user', content: results });
    }
    return { reply: 'This needs a person from our team. Use Contact us in Help and we will pick it up.', ticketId };
  }

  private async runTool(userId: string, name: string, input: Record<string, unknown>): Promise<{ result: unknown; ticketId?: string }> {
    switch (name) {
      case 'get_my_recent_bookings': {
        const id = new Types.ObjectId(userId);
        const list = await Booking.find({ $or: [{ rider: id }, { driver: id }] })
          .sort({ createdAt: -1 })
          .limit(10)
          .populate<{ ride: { pickup?: { address?: string }; dropoff?: { address?: string }; departureTime?: Date } | null }>('ride', 'pickup.address dropoff.address departureTime')
          .lean();
        return {
          result: list.map((b) => ({
            booking_id: b._id.toString(),
            role: b.rider.toString() === userId ? 'rider' : 'driver',
            status: b.status,
            from: b.pickup?.address ?? b.ride?.pickup?.address,
            to: b.dropoff?.address ?? b.ride?.dropoff?.address,
            departure: b.ride?.departureTime,
            fare: b.estimatedFare,
            paid_by: b.paymentMethod === 'online' ? 'EcoCash, OneMoney, InnBucks or card' : 'Poolora wallet',
            refunded: b.refundAmount ?? 0,
            cancelled_reason: b.cancellationReason,
          })),
        };
      }
      case 'get_cancellation_quote': {
        const bookingId = String(input.booking_id ?? '');
        if (!Types.ObjectId.isValid(bookingId)) throw new Error('Unknown booking id');
        return { result: await this.bookings.getCancellationQuote(bookingId, userId) };
      }
      case 'create_support_request': {
        const category = SUPPORT_CATEGORIES.includes(input.category as SupportCategory) ? (input.category as SupportCategory) : 'feedback';
        const bookingId = Types.ObjectId.isValid(String(input.booking_id ?? '')) ? String(input.booking_id) : undefined;
        const user = await User.findById(userId).select('name').lean();
        const ticket = await this.support.create(userId, {
          category,
          subject: String(input.subject ?? 'Help from the assistant').slice(0, 120),
          message: `${String(input.message ?? '').slice(0, 3800)}\n\n(Opened by the in-app assistant for ${user?.name ?? 'the user'}.)`,
          bookingId,
          appInfo: 'support-assistant',
        });
        return { result: { opened: true, reference: ticket._id.toString().slice(-6).toUpperCase() }, ticketId: ticket._id.toString() };
      }
      default:
        throw new Error(`Unknown tool ${name}`);
    }
  }

  private async rateLimit(userId: string) {
    const redis = getRedisClient();
    if (!redis) return;
    const key = `support-bot:${userId}:${Math.floor(Date.now() / 3_600_000)}`;
    const count = await redis.incr(key).catch(() => 0);
    if (count === 1) await redis.expire(key, 3600).catch(() => undefined);
    if (count > MESSAGES_PER_HOUR) throw new AppError('You have sent a lot of messages; use Contact us and a person will reply.', 429, 'CHATBOT_LIMIT');
  }
}
