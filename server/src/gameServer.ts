import { Server as HttpServer } from 'node:http';
import { Server, Socket } from 'socket.io';
import { GameEngine } from '@junqi/engine';
import type { LayoutEntry, Position, VisibleState } from '@junqi/engine';
import type { AccountService, PublicAccount } from './accounts.js';
import { LeaderboardService } from './leaderboard.js';
import type { Room, RoomManager } from './rooms.js';

const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';

/** Active game instances keyed by room code. */
interface ActiveGame {
  engine: GameEngine;
  roomCode: string;
  submittedLayouts: Set<string>;
}

export class GameSocketServer {
  private io: Server;
  private accountService: AccountService;
  private roomManager: RoomManager;
  private leaderboard: LeaderboardService;
  private games: Map<string, ActiveGame> = new Map();

  constructor(
    httpServer: HttpServer,
    accountService: AccountService,
    roomManager: RoomManager,
  ) {
    this.accountService = accountService;
    this.roomManager = roomManager;
    this.leaderboard = new LeaderboardService(accountService);
    this.io = new Server(httpServer, {
      cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'] },
    });
    this.setup();
  }

  private setup(): void {
    this.io.on('connection', (socket) => {
      // Auth middleware: verify token from handshake.
      const token = socket.handshake.auth?.token;
      const account = token ? this.accountService.verifyToken(token) : null;
      if (!account) {
        socket.emit('auth:error', { error: '未登录或 token 无效' });
        socket.disconnect(true);
        return;
      }
      socket.data.account = account;
      socket.data.username = account.username;
      console.log(`[socket] connected: ${account.username} (${socket.id})`);

      socket.on('room:create', () => { console.log(`[socket] room:create from ${account.username}`); this.handleCreateRoom(socket); });
      socket.on('room:join', (code: string) => { console.log(`[socket] room:join ${code} from ${account.username}`); this.handleJoinRoom(socket, code); });
      socket.on('room:leave', () => this.handleLeaveRoom(socket));
      socket.on('room:ready', (ready: boolean) => this.handleReady(socket, ready));
      socket.on('room:list', () => this.handleListRooms(socket));
      socket.on('layout:submit', (layout: LayoutEntry[], levels: Record<string, number>) => this.handleLayoutSubmit(socket, layout, levels));
      socket.on('move', (from: Position, to: Position) => this.handleMove(socket, from, to));
      socket.on('rename', (pieceId: string, newName: string) => this.handleRename(socket, pieceId, newName));
      socket.on('chat', (msg: string) => this.handleChat(socket, msg));
      socket.on('disconnect', () => this.handleDisconnect(socket));
    });
  }

  private getAccount(socket: Socket): PublicAccount {
    return socket.data.account as PublicAccount;
  }

  private getPlayerRoom(socket: Socket): Room | undefined {
    return this.roomManager.getRoomByUsername(this.getAccount(socket).username);
  }

  private broadcastRoomState(room: Room): void {
    const summary = {
      code: room.code,
      host: room.host,
      status: room.status,
      players: Object.values(room.players).map((p) => ({
        gameId: p.account.gameId,
        side: p.side,
        ready: p.ready,
        connected: p.connected,
      })),
    };
    for (const p of Object.values(room.players)) {
      this.io.to(p.socketId).emit('room:state', summary);
    }
  }

  private broadcastGameState(roomCode: string): void {
    const game = this.games.get(roomCode);
    const room = this.roomManager.getRoom(roomCode);
    if (!game || !room) return;
    for (const p of Object.values(room.players)) {
      const state: VisibleState = game.engine.getStateFor(p.side);
      const ownPos = state.pieces.filter((x) => x.position).length;
      const enemyPos = state.enemyPieces.filter((x) => x.position).length;
      console.log(`[socket] broadcast to ${p.account.username} (${p.side}): phase=${state.phase} ownPos=${ownPos} enemyPos=${enemyPos}`);
      this.io.to(p.socketId).emit('game:state', state);
    }
  }

  private handleCreateRoom(socket: Socket): void {
    const account = this.getAccount(socket);
    // Leave any existing room first.
    const existing = this.roomManager.getRoomByUsername(account.username);
    if (existing) this.roomManager.leaveRoom(existing.code, account.username);

    const room = this.roomManager.createRoom(account, socket.id);
    socket.join(room.code);
    console.log(`[socket] room created: ${room.code} for ${account.username}`);
    socket.emit('room:created', { code: room.code });
    this.broadcastRoomState(room);
  }

  private handleJoinRoom(socket: Socket, code: string): void {
    const account = this.getAccount(socket);
    const existing = this.roomManager.getRoomByUsername(account.username);
    // Only leave if joining a different room.
    if (existing && existing.code.toUpperCase() !== code.toUpperCase()) {
      this.roomManager.leaveRoom(existing.code, account.username);
    }

    const result = this.roomManager.joinRoom(code, account, socket.id);
    console.log(`[socket] join result: ${result.ok ? 'ok' : 'fail: ' + (result as any).error}`);
    if (!result.ok) {
      socket.emit('room:error', { error: result.error });
      return;
    }
    socket.join(result.room.code);
    socket.emit('room:joined', { code: result.room.code });
    this.broadcastRoomState(result.room);

    // If reconnecting to an in-progress game, send the current state.
    if (result.room.status === 'playing') {
      const game = this.games.get(result.room.code);
      if (game) {
        const player = result.room.players[account.username];
        const state = game.engine.getStateFor(player.side);
        socket.emit('game:state', state);
      }
    }
  }

  private handleLeaveRoom(socket: Socket): void {
    const account = this.getAccount(socket);
    const room = this.roomManager.getRoomByUsername(account.username);
    if (room) {
      this.roomManager.leaveRoom(room.code, account.username);
      socket.leave(room.code);
      socket.emit('room:left');
      this.broadcastRoomState(room);
    }
  }

  private handleReady(socket: Socket, ready: boolean): void {
    const room = this.getPlayerRoom(socket);
    if (!room) return;
    const account = this.getAccount(socket);
    this.roomManager.setReady(room.code, account.username, ready);
    this.broadcastRoomState(room);

    // If both ready, start the game.
    if (this.roomManager.allReady(room.code)) {
      this.startGame(room.code);
    }
  }

  private handleListRooms(socket: Socket): void {
    const rooms = this.roomManager.listRooms().map((r) => ({
      code: r.code,
      host: Object.values(r.players).find((p) => p.account.username === r.host)?.account.gameId ?? r.host,
      playerCount: Object.keys(r.players).length,
    }));
    socket.emit('room:list', rooms);
  }

  private startGame(roomCode: string): void {
    const room = this.roomManager.getRoom(roomCode);
    if (!room) return;
    // Guard: only start once per room.
    if (this.games.has(roomCode)) return;
    const engine = new GameEngine();
    this.games.set(roomCode, {
      engine,
      roomCode,
      submittedLayouts: new Set(),
    });
    this.roomManager.setStatus(roomCode, 'playing');
    this.broadcastRoomState(room);
    // Send initial state to both players (setup phase).
    this.broadcastGameState(roomCode);
  }

  private handleLayoutSubmit(socket: Socket, layout: LayoutEntry[], levels: Record<string, number>): void {
    const room = this.getPlayerRoom(socket);
    if (!room) return;
    const game = this.games.get(room.code);
    if (!game) {
      socket.emit('game:error', { error: '对局未开始' });
      return;
    }
    const account = this.getAccount(socket);
    const player = room.players[account.username];
    console.log(`[socket] layout submit from ${account.username}: ${layout.length} entries, levels: ${Object.keys(levels).length}`);
    const result = game.engine.submitLayout(player.side, layout);
    console.log(`[socket] layout result: ${result.ok ? 'ok' : 'fail: ' + JSON.stringify(result.errors)}`);
    if (!result.ok) {
      socket.emit('layout:error', { errors: result.errors });
      return;
    }
    // Apply level allocations for blank pieces.
    const levelResult = game.engine.allocateLevels(player.side, levels ?? {});
    if (!levelResult.ok) {
      socket.emit('layout:error', { errors: levelResult.errors });
      return;
    }
    game.submittedLayouts.add(account.username);
    socket.emit('layout:accepted');

    // If both submitted, auto-start playing phase.
    const allSubmitted = Object.keys(room.players).every((u) => game.submittedLayouts.has(u));
    if (allSubmitted) {
      game.engine.start();
    }
    this.broadcastGameState(room.code);
  }

  private handleMove(socket: Socket, from: Position, to: Position): void {
    const room = this.getPlayerRoom(socket);
    if (!room) return;
    const game = this.games.get(room.code);
    if (!game) {
      socket.emit('game:error', { error: '对局未开始' });
      return;
    }
    const account = this.getAccount(socket);
    const player = room.players[account.username];
    console.log(`[socket] move from ${account.username}: (${from.row},${from.col}) -> (${to.row},${to.col})`);
    const outcome = game.engine.move(player.side, from, to);
    console.log(`[socket] move result: ${outcome.ok ? 'ok' : 'fail: ' + (outcome as any).error}`);
    if (!outcome.ok) {
      socket.emit('move:error', { error: outcome.error });
      return;
    }
    // Broadcast combat result (does not leak piece info).
    if (outcome.combat) {
      this.io.to(room.code).emit('combat:result', outcome.combat);
    }
    this.broadcastGameState(room.code);

    // Check win.
    if (outcome.winner) {
      const winnerUsername = Object.values(room.players).find(
        (p) => p.side === outcome.winner,
      )?.account.username;
      if (winnerUsername) {
        this.accountService.addWin(winnerUsername);
      }
      this.roomManager.setStatus(room.code, 'ended');
      this.io.to(room.code).emit('game:ended', { winner: outcome.winner });
    }
  }

  private handleRename(socket: Socket, pieceId: string, newName: string): void {
    const room = this.getPlayerRoom(socket);
    if (!room) return;
    const game = this.games.get(room.code);
    if (!game) return;
    const account = this.getAccount(socket);
    const player = room.players[account.username];
    const result = game.engine.rename(player.side, pieceId, newName);
    if (!result.ok) {
      socket.emit('rename:error', { error: result.error });
      return;
    }
    // Only update the renaming player's view (names are private).
    const state = game.engine.getStateFor(player.side);
    socket.emit('game:state', state);
  }

  private handleChat(socket: Socket, msg: string): void {
    const room = this.getPlayerRoom(socket);
    if (!room) return;
    const account = this.getAccount(socket);
    this.io.to(room.code).emit('chat:message', {
      gameId: account.gameId,
      message: String(msg).slice(0, 200),
    });
  }

  private handleDisconnect(socket: Socket): void {
    const account = socket.data.account as PublicAccount | undefined;
    if (!account) return;
    const room = this.roomManager.getRoomByUsername(account.username);
    if (room) {
      this.roomManager.markDisconnected(room.code, account.username);
      this.broadcastRoomState(room);
    }
  }

  getLeaderboard() {
    return this.leaderboard;
  }
}
