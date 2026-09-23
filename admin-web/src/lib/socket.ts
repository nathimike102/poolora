/**
 * Live SOS alerts over Socket.IO (the admin:sos room). The dashboard shows a
 * red ticker and the incident page moves its map as positions arrive.
 */
import { io, type Socket } from 'socket.io-client';
import { API_URL, tokens } from './api';

export interface SosEvent {
  kind: 'alert' | 'location';
  emergencyId: string;
  location?: { lng: number; lat: number };
}

let socket: Socket | null = null;
const listeners = new Set<(e: SosEvent) => void>();

/** Both direct socket alerts and Kafka-relayed ones ({ eventType, data }) arrive here */
function normalise(kind: SosEvent['kind'], payload: Record<string, unknown>): SosEvent | null {
  const data = (payload.data as Record<string, unknown> | undefined) ?? payload;
  const emergencyId = String(data.emergencyId ?? payload.emergencyId ?? '');
  if (!emergencyId) return null;
  const eventType = payload.eventType as string | undefined;
  return {
    kind: eventType === 'sos.location.updated' ? 'location' : kind,
    emergencyId,
    location: (data.location ?? payload.location) as SosEvent['location'],
  };
}

export function subscribeSos(fn: (e: SosEvent) => void): () => void {
  listeners.add(fn);
  if (!socket && tokens.access) {
    socket = io(API_URL, { auth: { token: tokens.access }, transports: ['websocket'] });
    socket.on('connect', () => socket?.emit('admin:sos:join'));
    const emit = (kind: SosEvent['kind']) => (payload: Record<string, unknown>) => {
      const event = normalise(kind, payload ?? {});
      if (event) listeners.forEach((l) => l(event));
    };
    socket.on('sos:alert', emit('alert'));
    socket.on('sos:location:updated', emit('location'));
    socket.on('connect_error', () => {
      // A refreshed token is picked up on the next connect attempt
      if (socket) socket.auth = { token: tokens.access };
    });
  }
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) {
      socket?.disconnect();
      socket = null;
    }
  };
}
