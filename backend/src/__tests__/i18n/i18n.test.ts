/**
 * What the server says, in each person's language (UC-X03): English when a
 * phrase is missing, values filled in, the English beneath SOS texts, and a
 * notification stored in the recipient's language. A guard checks that
 * every key the code uses is in the catalogues.
 */
import fs from 'fs';
import path from 'path';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import en from '../../i18n/locales/en.json';
import sn from '../../i18n/locales/sn.json';
import { phrase, render, supportedLanguage, translate, withEnglish } from '../../i18n';
import { User } from '../../models/User';
import { Notification } from '../../models/Notification';
import { NotificationService } from '../../services/NotificationService';

jest.setTimeout(60_000);

/** A Shona phrase for the test, as a translator would add one */
const shona = sn as Record<string, unknown>;
beforeAll(() => {
  shona.booking = { confirmed: { title: '[sn] Chigaro chako chasimbiswa' } };
});
afterAll(() => {
  delete shona.booking;
});

describe('translate', () => {
  it('uses the language when it has the phrase, and English when it does not', () => {
    expect(translate('sn', 'booking.confirmed.title')).toBe('[sn] Chigaro chako chasimbiswa');
    expect(translate('sn', 'booking.cancelled.title')).toBe('Booking Cancelled');
    expect(translate(undefined, 'booking.cancelled.title')).toBe('Booking Cancelled');
  });

  it('only uses languages this market offers', () => {
    expect(supportedLanguage('sn')).toBe('sn');
    expect(supportedLanguage('fr')).toBe('en');
    expect(supportedLanguage(null)).toBe('en');
  });

  it('fills in values, phrases inside phrases, and lists', () => {
    expect(translate('en', 'booking.arrived.body', { minutes: 10 })).toContain('will wait 10 minutes');
    expect(translate('en', 'booking.expired.body', { reason: phrase('booking.expired.defaultReason') }))
      .toBe('Your ride request was closed. Anything you paid is refunded.');
    expect(translate('en', 'trip.youOwe', { list: [phrase('trip.payTo', { amount: 'US$5', name: 'Tendai' }), 'US$2 to Rudo'] }))
      .toBe('You owe US$5 to Tendai, US$2 to Rudo.');
  });

  it('leaves plain text as it is', () => {
    expect(render('sn', 'Hello')).toBe('Hello');
  });
});

describe('SOS texts keep the English', () => {
  it('adds the English beneath a text in another language, and nothing in English', () => {
    shona.sos = { contacts: { safe: '[sn] {{name}} vaneta zvakanaka' } };
    try {
      const text = phrase('sos.contacts.safe', { name: 'Rudo' });
      expect(withEnglish('sn', text)).toBe('[sn] Rudo vaneta zvakanaka\n\nSiham: Rudo says they are safe now. Our safety team is checking with them.');
      expect(withEnglish('en', text)).toBe('Siham: Rudo says they are safe now. Our safety team is checking with them.');
    } finally {
      delete shona.sos;
    }
  });
});

describe('a notification is stored in the recipient\'s language (real MongoDB)', () => {
  let mongo: MongoMemoryServer;
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  it('writes the same phrase in Shona for one user and English for another', async () => {
    const shonaReader = new Types.ObjectId();
    const englishReader = new Types.ObjectId();
    await User.collection.insertMany([
      { _id: shonaReader, name: 'Tendai', phone: '+263771000011', language: 'sn', stats: {} },
      { _id: englishReader, name: 'Rudo', phone: '+263771000012', stats: {} },
    ]);
    const n = new NotificationService();
    for (const id of [shonaReader, englishReader]) {
      await n.createNotification(id.toString(), phrase('booking.confirmed.title'), phrase('booking.cancelled.body'), 'ride');
    }
    const stored = await Notification.find().lean();
    const of = (id: Types.ObjectId) => stored.find((x) => String(x.user) === String(id));
    expect(of(shonaReader)?.title).toBe('[sn] Chigaro chako chasimbiswa');
    expect(of(shonaReader)?.message).toBe('Your booking has been cancelled.');
    expect(of(englishReader)?.title).toBe('Booking Confirmed');
  });
});

describe('the catalogues', () => {
  const sourceFiles = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return e.name === '__tests__' ? [] : sourceFiles(full);
      return /\.ts$/.test(e.name) ? [full] : [];
    });
  const has = (catalogue: unknown, key: string) =>
    typeof key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], catalogue) === 'string';

  it('have every phrase the server uses, in English', () => {
    const missing: string[] = [];
    for (const file of sourceFiles(path.join(__dirname, '..', '..'))) {
      // Every dotted key on a line that makes a phrase, including those picked with ? :
      for (const line of fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.includes('phrase('))) {
        for (const m of line.matchAll(/'([a-z][a-zA-Z0-9]*\.[a-zA-Z0-9_.]+)'/g)) {
          if (!has(en, m[1])) missing.push(`${path.basename(file)}: ${m[1]}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('let the app translate every message key the server sends it', () => {
    const app = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../../frontend/src/i18n/locales/en.json'), 'utf8'));
    const keys = [
      ...fs.readFileSync(path.join(__dirname, '../../sockets/SocketGateway.ts'), 'utf8').matchAll(/messageKey: '([a-zA-Z0-9_.]+)'/g),
    ].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(0);
    for (const channel of ['mobile', 'innbucks', 'card']) keys.push(`payment.instructions.${channel}`);
    expect(keys.filter((k) => !has(app, k))).toEqual([]);
  });
});
