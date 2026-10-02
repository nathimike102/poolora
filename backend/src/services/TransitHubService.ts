/**
 * TransitHubService.ts
 *
 * Kombi ranks and bus termini (UC-R12). Admins place each one on the map
 * and switch it on; riders then find it first in place search, and a booking
 * that drops them at a bus terminus can carry the time their bus leaves, so
 * the driver knows not to be late.
 */

import { Types } from 'mongoose';
import { REGION } from '../config/region';
import { TransitHub, ITransitHub } from '../models/TransitHub';
import { AppError, ConflictError, NotFoundError } from '../utils/AppError';
import { audit } from './AuditService';

/** How close a drop must be to count as at a rank or terminus */
export const HUB_RADIUS_KM = 0.6;

const KIND_LABEL: Record<ITransitHub['kind'], string> = { kombi_rank: 'Kombi rank', bus_terminus: 'Bus terminus' };
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function hubView(h: ITransitHub | (Record<string, unknown> & { _id: Types.ObjectId })) {
  const v = h as ITransitHub;
  return {
    _id: v._id.toString(),
    name: v.name,
    kind: v.kind,
    city: v.city,
    address: v.address,
    aliases: v.aliases,
    lat: v.location.coordinates[1],
    lng: v.location.coordinates[0],
    active: v.active,
  };
}

type HubInput = { name?: unknown; kind?: unknown; city?: unknown; address?: unknown; aliases?: unknown; lat?: unknown; lng?: unknown; active?: unknown };

export class TransitHubService {
  // ── Riders ───────────────────────────────────────────────────────────────

  /** Switched-on hubs whose name or another name starts a word with what was typed, nearest first */
  async match(input: string, near?: { lat: number; lng: number }, limit = 2) {
    const text = input.trim();
    if (text.length < 3) return [];
    const word = new RegExp(`(^|\\s)${escapeRegex(text)}`, 'i');
    const hubs = await TransitHub.find({ market: REGION.country, active: true, $or: [{ name: word }, { aliases: word }, { city: word }] }).limit(20).lean();
    const dist = (h: { location: { coordinates: number[] } }) => (near ? Math.hypot(h.location.coordinates[1] - near.lat, h.location.coordinates[0] - near.lng) : 0);
    return hubs.sort((a, b) => dist(a) - dist(b)).slice(0, limit).map((h) => ({
      description: `${h.name}, ${h.city}`,
      placeId: `hub:${h._id}`,
      mainText: h.name,
      secondaryText: `${KIND_LABEL[h.kind]} · ${h.city}`,
      lat: h.location.coordinates[1],
      lng: h.location.coordinates[0],
      hub: h.kind,
    }));
  }

  /** The switched-on hub at this point, if any */
  async at(point: { lat: number; lng: number }): Promise<ITransitHub | null> {
    return TransitHub.findOne({
      market: REGION.country,
      active: true,
      location: { $nearSphere: { $geometry: { type: 'Point', coordinates: [point.lng, point.lat] }, $maxDistance: HUB_RADIUS_KM * 1000 } },
    });
  }

  // ── Admins ───────────────────────────────────────────────────────────────

  async list() {
    const hubs = await TransitHub.find({ market: REGION.country }).sort({ city: 1, name: 1 }).lean();
    const have = new Set(hubs.map((h) => `${h.city}|${h.name}`.toLowerCase()));
    return {
      hubs: hubs.map((h) => hubView(h)),
      // Names in the market registry not added yet, to add with one click
      suggestions: REGION.transitHubs.filter((s) => !have.has(`${s.city}|${s.name}`.toLowerCase())),
    };
  }

  async create(input: HubInput, adminId: string) {
    const fields = await this.clean(input, true);
    try {
      const hub = await TransitHub.create({ ...fields, market: REGION.country, createdBy: adminId });
      await audit(adminId, 'hub.create', 'settings', hub._id.toString(), undefined, { name: hub.name, city: hub.city });
      return { hub: hubView(hub) };
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw new ConflictError('That rank or terminus is already listed');
      throw error;
    }
  }

  async update(id: string, input: HubInput, adminId: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Rank or terminus');
    const hub = await TransitHub.findById(id);
    if (!hub) throw new NotFoundError('Rank or terminus');
    Object.assign(hub, await this.clean({ name: hub.name, kind: hub.kind, city: hub.city, ...input }, false, hub));
    await hub.save();
    await audit(adminId, 'hub.update', 'settings', id, undefined, { name: hub.name, active: hub.active });
    return { hub: hubView(hub) };
  }

  async remove(id: string, adminId: string) {
    const hub = await TransitHub.findByIdAndDelete(id);
    if (!hub) throw new NotFoundError('Rank or terminus');
    await audit(adminId, 'hub.remove', 'settings', id, undefined, { name: hub.name });
    return { removed: true };
  }

  /** Checks a hub, finding it on the map from its address when no position is given */
  private async clean(input: HubInput, creating: boolean, current?: ITransitHub) {
    const name = String(input.name ?? '').trim();
    const city = String(input.city ?? '').trim();
    const kind = input.kind;
    if (name.length < 2 || city.length < 2) throw new AppError('Give its name and city', 422, 'VALIDATION_ERROR');
    if (kind !== 'kombi_rank' && kind !== 'bus_terminus') throw new AppError('Say whether it is a kombi rank or a bus terminus', 422, 'VALIDATION_ERROR');
    const address = input.address === undefined ? current?.address : String(input.address).trim().slice(0, 200) || undefined;
    const aliases = input.aliases === undefined
      ? current?.aliases ?? []
      : (Array.isArray(input.aliases) ? input.aliases : String(input.aliases).split(','))
        .map((a) => String(a).trim()).filter((a) => a.length >= 2).slice(0, 10);
    let location = current?.location;
    const lat = Number(input.lat);
    const lng = Number(input.lng);
    if (input.lat !== undefined && input.lng !== undefined && Number.isFinite(lat) && Number.isFinite(lng)) {
      const [minLng, minLat, maxLng, maxLat] = REGION.bbox;
      if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) throw new AppError(`That position is outside ${REGION.countryName}`, 422, 'OUTSIDE_MARKET');
      location = { type: 'Point', coordinates: [lng, lat] };
    } else if (creating || (input.address !== undefined && input.address !== current?.address)) {
      const { geocodeAddress } = await import('./MapsService');
      const found = await geocodeAddress(address ? `${address}, ${city}` : `${name}, ${city}`).catch(() => null);
      if (!found) throw new AppError(`Could not find "${name}" on the map. Give its address, or its position.`, 422, 'HUB_NOT_FOUND');
      location = { type: 'Point', coordinates: [found.lng, found.lat] };
    }
    if (!location) throw new AppError('Give its position', 422, 'VALIDATION_ERROR');
    // A new hub starts switched off, so an admin checks the pin before riders see it
    const active = input.active === undefined ? (creating ? false : current?.active ?? false) : input.active === true;
    return { name, city, kind, address, aliases, location, active };
  }
}
