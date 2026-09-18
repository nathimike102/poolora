import { io, Socket } from 'socket.io-client';
import { getCurrentAccessToken } from '../services/authService';
import { API_CONFIG } from '../api/constants';

let socket: Socket | null = null;

export function initSocket(): Socket {
  if (socket && socket.connected) return socket;

  const token = getCurrentAccessToken();
  const url = API_CONFIG.baseUrl.replace(/^http/, 'ws');
  socket = io(url, {
    auth: {
      token: token || undefined,
    },
    transports: ['websocket'],
    autoConnect: true,
  });

  socket.on('connect', () => {
    // reconnect logic
    // console.log('Socket connected', socket?.id);
  });

  socket.on('disconnect', () => {
    // console.log('Socket disconnected');
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export async function joinAdminSosRoom(): Promise<void> {
  const s = initSocket();
  if (!s) return;
  s.emit('admin:sos:join');
}
