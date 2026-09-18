import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { AccountService } from './accounts.js';
import { GameSocketServer } from './gameServer.js';
import { LeaderboardService } from './leaderboard.js';
import { RoomManager } from './rooms.js';

const PORT = Number(process.env.PORT ?? 3001);

const app = express();
app.use(cors());
app.use(express.json());

const accountService = new AccountService();
const roomManager = new RoomManager();
const leaderboard = new LeaderboardService(accountService);

// ---- HTTP API routes ----

app.post('/api/register', (req, res) => {
  const { username, password, gameId } = req.body ?? {};
  const result = accountService.register(username, password, gameId);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ account: result.account });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body ?? {};
  const result = accountService.login(username, password);
  if (!result.ok) {
    res.status(401).json({ error: result.error });
    return;
  }
  res.json({ token: result.token, account: result.account });
});

app.get('/api/leaderboard', (req, res) => {
  const limit = Number(req.query.limit ?? 100);
  res.json({ entries: leaderboard.getTop(limit) });
});

app.get('/api/me', (req, res) => {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
  if (!token) {
    res.status(401).json({ error: '未提供 token' });
    return;
  }
  const account = accountService.verifyToken(token);
  if (!account) {
    res.status(401).json({ error: 'token 无效' });
    return;
  }
  res.json({ account });
});

// ---- Socket.IO ----
const httpServer = createServer(app);
new GameSocketServer(httpServer, accountService, roomManager);

httpServer.listen(PORT, () => {
  console.log(`Junqi Arena server listening on http://localhost:${PORT}`);
});
