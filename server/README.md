# 斗棋竞技场 - 服务端

Express + Socket.IO 服务端，负责账号、房间、权威裁定、状态同步。

## 目录结构

```
server/
├── src/
│   ├── index.ts        # Express 入口 + HTTP API
│   ├── accounts.ts     # 账号系统（BCrypt + JWT）
│   ├── rooms.ts        # 房间管理
│   ├── gameServer.ts   # Socket.IO 游戏服务
│   ├── leaderboard.ts  # 排行榜
│   └── storage.ts      # JSON 文件存储
├── data/
│   └── accounts.json   # 账号持久化
└── dist/               # 编译输出
```

## 账号系统

### 字段

```typescript
interface Account {
  username: string;       // 登录用
  gameId: string;         // 展示用（唯一，可自定义）
  passwordHash: string;   // BCrypt 哈希
  luck: number;           // 气运值（排位分），默认 0
  wins: number;           // 胜场数，默认 0
  matchHistory: string[]; // 战绩扩展位（对局记录 ID 列表）
  createdAt: number;
}
```

### HTTP API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/register` | 注册 `{ username, password, gameId }` |
| POST | `/api/login` | 登录 `{ username, password }` → `{ token, account }` |
| GET | `/api/leaderboard` | 排行榜 `{ entries: [{ rank, gameId, luck, wins }] }` |
| GET | `/api/me` | 当前账号信息（需 Bearer token） |

## Socket 事件

### 连接

客户端连接时需在 `auth.token` 中携带 JWT：

```javascript
const socket = io(SERVER_URL, { auth: { token } });
```

### 房间事件

| 事件 | 方向 | 参数 | 说明 |
|------|------|------|------|
| `room:create` | C→S | - | 创建房间，返回 `room:created { code }` |
| `room:join` | C→S | `code` | 加入房间，返回 `room:joined { code }` |
| `room:leave` | C→S | - | 离开房间 |
| `room:ready` | C→S | `ready: boolean` | 准备/取消准备 |
| `room:list` | C→S | - | 请求房间列表 |
| `room:state` | S→C | `RoomState` | 房间状态广播 |

### 对局事件

| 事件 | 方向 | 参数 | 说明 |
|------|------|------|------|
| `layout:submit` | C→S | `layout: LayoutEntry[], levels: Record<string, number>` | 提交布阵 + 等级分配 |
| `layout:accepted` | S→C | - | 布阵通过 |
| `layout:error` | S→C | `{ errors: string[] }` | 布阵错误 |
| `move` | C→S | `from: Position, to: Position` | 走子请求 |
| `move:error` | S→C | `{ error: string }` | 非法走子 |
| `game:state` | S→C | `VisibleState` | 游戏状态（暗棋隔离） |
| `combat:result` | S→C | `CombatNotification` | 碰撞结果广播 |
| `game:ended` | S→C | `{ winner: Side }` | 对局结束 |
| `rename` | C→S | `pieceId, newName` | 改名（仅己方可见） |
| `chat` | C→S | `message: string` | 聊天消息 |
| `chat:message` | S→C | `{ gameId, message }` | 聊天广播 |

## 服务端权威裁定

所有操作由服务端校验，客户端只发请求：

1. **走子**：服务端调用 `engine.move(side, from, to)`，校验合法性、执行碰撞、切换回合
2. **布阵**：服务端调用 `engine.submitLayout()` + `engine.allocateLevels()`，校验规则
3. **改名**：服务端调用 `engine.rename()`，校验名字长度

客户端的本地移动计算（`computeValidMoves`）仅用于 UI 反馈，不具有裁定权。

## 状态同步与信息隔离

每次操作后，服务端调用 `broadcastGameState()`，向双方**分别**发送各自可见的状态：

```
broadcastGameState(roomCode):
  for each player in room:
    state = engine.getStateFor(player.side)  // serializeStateFor
    io.to(player.socketId).emit('game:state', state)
```

**隔离保证**：
- 敌方棋子只发送 `{ id, side, alive, position, revealedType? }`
- **绝不**发送敌方棋子的 `name`、`attributes.rank`、完整 `type`
- 碰撞结果 `combat:result` 只通知类型（attacker_wins/defender_wins/mutual/flag_captured）和双方 ID，不暴露被吃棋子的完整信息
- 改名只更新改名者自己的视图，不广播给对方

## 排行榜

```typescript
// GET /api/leaderboard?limit=100
{
  entries: [
    { rank: 1, gameId: "玩家A", luck: 1500, wins: 42 },
    ...
  ]
}
```

按 `luck`（气运值）降序排列。胜场在对局结束时自动 `+1`。

## 断线重连

- 玩家断开后，房间保留状态，`connected` 标记为 `false`
- 重新连接后凭 token + 房间码 `room:join` 即可恢复
- 服务端会发送当前游戏状态

## 运行

```bash
cd server
npm install
npm run build
node dist/index.js    # 默认端口 3001
```

环境变量：
- `PORT`：服务端口（默认 3001）
- `JWT_SECRET`：JWT 密钥
- `CORS_ORIGIN`：CORS 允许的来源（默认 `*`）
