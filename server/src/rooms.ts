import { v4 as uuidv4 } from 'uuid';
import type { PublicAccount } from './accounts.js';

export type RoomStatus = 'waiting' | 'ready' | 'playing' | 'ended';

export interface RoomPlayer {
  socketId: string;
  account: PublicAccount;
  side: 'red' | 'blue';
  ready: boolean;
  connected: boolean;
}

export interface Room {
  code: string;
  host: string; // username
  players: Record<string, RoomPlayer>; // keyed by username
  status: RoomStatus;
  createdAt: number;
}

/** Generate a 6-character alphanumeric room code. */
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  createRoom(host: PublicAccount, socketId: string): Room {
    let code = generateRoomCode();
    while (this.rooms.has(code)) code = generateRoomCode();
    const room: Room = {
      code,
      host: host.username,
      status: 'waiting',
      createdAt: Date.now(),
      players: {
        [host.username]: {
          socketId,
          account: host,
          side: 'red',
          ready: false,
          connected: true,
        },
      },
    };
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  joinRoom(
    code: string,
    player: PublicAccount,
    socketId: string,
  ): { ok: true; room: Room } | { ok: false; error: string } {
    const room = this.getRoom(code);
    if (!room) return { ok: false, error: '房间不存在' };
    if (Object.keys(room.players).length >= 2 && !room.players[player.username]) {
      return { ok: false, error: '房间已满' };
    }
    if (room.status === 'playing') {
      // Allow reconnection if the player was already in the room.
      if (!room.players[player.username]) {
        return { ok: false, error: '对局已开始' };
      }
    }
    const existingSide = room.players[player.username]?.side;
    const players = Object.values(room.players);
    const hasRed = players.some((p) => p.side === 'red');
    const side: 'red' | 'blue' = existingSide ?? (hasRed ? 'blue' : 'red');
    room.players[player.username] = {
      socketId,
      account: player,
      side,
      ready: room.players[player.username]?.ready ?? false,
      connected: true,
    };
    // If both players joined, status becomes ready (but still waiting for ready-up).
    if (room.status === 'waiting' && Object.keys(room.players).length === 2) {
      room.status = 'ready';
    }
    return { ok: true, room };
  }

  setReady(code: string, username: string, ready: boolean): Room | undefined {
    const room = this.getRoom(code);
    if (!room || !room.players[username]) return undefined;
    room.players[username].ready = ready;
    return room;
  }

  /** Returns true if both players are ready. */
  allReady(code: string): boolean {
    const room = this.getRoom(code);
    if (!room) return false;
    const players = Object.values(room.players);
    return players.length === 2 && players.every((p) => p.ready);
  }

  setStatus(code: string, status: RoomStatus): void {
    const room = this.getRoom(code);
    if (room) room.status = status;
  }

  markDisconnected(code: string, username: string): void {
    const room = this.getRoom(code);
    if (room?.players[username]) {
      room.players[username].connected = false;
    }
  }

  leaveRoom(code: string, username: string): void {
    const room = this.getRoom(code);
    if (room) {
      delete room.players[username];
      if (Object.keys(room.players).length === 0) {
        this.rooms.delete(code);
      }
    }
  }

  listRooms(): Room[] {
    return Array.from(this.rooms.values()).filter((r) => r.status === 'waiting' || r.status === 'ready');
  }

  getRoomByUsername(username: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.players[username]) return room;
    }
    return undefined;
  }
}
