import { io } from 'socket.io-client';
import { getToken } from '../context/auth';

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

let socket = null;

/**
 * Returns a single shared socket connection for the whole app. Connecting
 * once here (rather than per-page) means switching between Chat/ChatThread/
 * Profile doesn't drop and reconnect the socket each time.
 */
export function getSocket() {
  if (socket) return socket;
  socket = io(SOCKET_URL, {
    auth: { token: getToken() },
    autoConnect: true,
    transports: ['websocket', 'polling']
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
