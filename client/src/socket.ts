import { io, Socket } from 'socket.io-client';
import { getToken } from './api';

let socket: Socket | null = null;

const SERVER_URL = ''; // Use Vite proxy in dev, same origin in prod

export function getSocket(): Socket {
  if (!socket) {
    const token = getToken();
    socket = io(SERVER_URL, {
      auth: { token },
      transports: ['polling', 'websocket'],
    });
    socket.on('auth:error', (data) => {
      console.error('Socket auth error:', data);
    });
    socket.on('connect_error', (err) => {
      console.error('Socket connect error:', err.message);
    });
  }
  return socket;
}

/**
 * Recreate the socket with the current token. Call this after login to ensure
 * the socket authenticates with the fresh token.
 */
export function reconnectSocket(): Socket {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  return getSocket();
}
