# 斗棋竞技场 - 游戏引擎

纯逻辑军棋游戏引擎，不涉及网络、账号、UI。可被服务端和客户端共享。

## 目录结构

```
engine/
├── data/
│   ├── board-config.json    # 棋盘配置（12×5 共 60 点）
│   └── piece-rules.json     # 棋子规则数据表
├── src/
│   ├── types.ts             # 核心类型定义
│   ├── board.ts             # 棋盘加载与查询
│   ├── pieces.ts            # 棋子工厂（数据驱动）
│   ├── movement.ts          # 移动规则引擎
│   ├── combat.ts            # 碰撞结算引擎
│   ├── layout.ts            # 布局校验与等级分配
│   ├── rename.ts            # 改名功能
│   ├── serialization.ts     # 状态序列化（暗棋隔离）
│   ├── engine.ts            # 游戏状态机
│   └── index.ts             # 导出入口
└── tests/                   # 54 个单元测试
```

## 核心数据结构

### 棋子 (Piece)

```typescript
interface Piece {
  id: string;                    // 唯一标识，如 "red-blank-1"
  type: PieceType;               // 'flag' | 'mine' | 'bomb' | 'sapper' | 'blank'
  side: Side;                    // 'red' | 'blue'
  name: string;                  // 玩家自定义名称（≤3字），仅己方可见
  attributes: PieceAttributes;   // 可扩展属性结构
  alive: boolean;
  position: Position | null;     // null 表示未放置或已被吃
  revealedType?: PieceType;      // 参战后暴露的类型
}

interface PieceAttributes {
  rank: number;                  // 白板棋子等级 0-9
  [key: string]: unknown;        // 预留扩展位（攻击/攻速/护甲/穿甲/暴击/速度/符文效果）
}
```

### 棋盘位置

```typescript
interface Position {
  row: number;  // 0-11
  col: number;  // 0-4
}
```

### 游戏状态

```typescript
interface GameState {
  phase: 'setup' | 'playing' | 'ended';
  turn: Side;
  pieces: Piece[];
  winner: Side | null;
  levelAllocations: Record<string, number>;
  remainingPoints: Record<Side, number>;  // 每方剩余等级点（默认100）
}
```

## 规则引擎接口

### GameEngine

```typescript
class GameEngine {
  constructor(board?: Board, rules?: PieceRules);

  // 布阵阶段
  submitLayout(side: Side, layout: LayoutEntry[]): { ok: boolean; errors: string[] };
  allocateLevels(side: Side, allocations: Record<string, number>): { ok: boolean; errors: string[] };

  // 改名（随时可改，不消耗资源）
  rename(side: Side, pieceId: string, newName: string): { ok: boolean; error?: string };

  // 开始对局
  start(): { ok: boolean; error?: string };

  // 行棋
  move(side: Side, from: Position, to: Position): MoveOutcome;

  // 获取某方可见状态（暗棋隔离）
  getStateFor(side: Side): VisibleState;
}
```

### 碰撞结算 (resolveCombat)

统一接口，后续可替换为多维数值对砍：

```typescript
function resolveCombat(attacker: Piece, defender: Piece): CombatResult;
```

**结算规则**：
| 攻击方 | 防守方 | 结果 |
|--------|--------|------|
| 白板(等级高) | 白板(等级低) | 攻击方胜 |
| 白板(等级低) | 白板(等级高) | 防守方胜 |
| 白板(同级) | 白板(同级) | 同归于尽 |
| 炸弹 | 任何 | 同归于尽 |
| 工兵 | 地雷 | 工兵胜（地雷死） |
| 炸弹 | 地雷 | 同归于尽 |
| 其他 | 地雷 | 防守方（地雷）胜 |
| 任何 | 军旗 | 夺旗（游戏结束） |

### 移动规则 (getValidMoves)

- **公路**：相邻正交格子走一格
- **铁路**：同行/同列直线不限格，但路径上有任何棋子阻挡时不能越过（包括工兵）
- **工兵拐弯**：在铁路网上通过 BFS 可达任意铁路点，可多次拐弯，但拐弯路径上不能有棋子阻挡
- **地雷/军旗**：不可移动
- **行营安全区**：敌方棋子不可攻击行营内的棋子

## 数据配置

### piece-rules.json

棋子定义完全数据驱动，不硬编码等级链：

```json
{
  "pieces": [
    { "type": "flag",   "count": 1, "defaultName": "军旗", "movable": false, "attributes": { "rank": -1 } },
    { "type": "mine",   "count": 3, "defaultName": "地雷", "movable": false, "attributes": { "rank": -1 } },
    { "type": "bomb",   "count": 2, "defaultName": "炸弹", "movable": true,  "attributes": { "rank": -1 } },
    { "type": "sapper", "count": 3, "defaultName": "工兵", "movable": true,  "canTurnOnRailway": true, "attributes": { "rank": 1 } },
    { "type": "blank",  "count": 16, "defaultName": "白板", "movable": true, "attributes": { "rank": 0 } }
  ],
  "levelBudget": 100,
  "maxRank": 9,
  "minRank": 0,
  "maxNameLength": 3
}
```

### board-config.json

12 行 × 5 列棋盘，每点标注类型：`road`（公路）、`railway`（铁路）、`camp`（行营）、`base`（大本营）。

## 暗棋信息隔离

`serializeStateFor(state, viewer)` 是唯一的信息隔离强制点：

- **己方棋子**：完整数据（name、attributes、type）
- **敌方棋子**：仅 `{ id, side, alive, position, revealedType? }`，**不含 name、rank、attributes**
- `revealedType` 仅在该棋子参战后才设置

服务端发送状态前**必须**调用此函数。

## 扩展点

1. **多维属性**：`PieceAttributes` 的 `[key: string]: unknown` 索引签名允许后续添加 `attack`、`speed`、`armor`、`crit`、`rune` 等字段
2. **自定义棋子**：修改 `piece-rules.json` 即可添加新棋子类型
3. **碰撞系统替换**：`resolveCombat` 统一接口，可替换为多维数值对砍
4. **布局阶段扩展**：`allocateLevels` 可扩展为"资源分配 + 成长方向选择"
5. **棋盘配置**：`board-config.json` 可自定义棋盘布局

## 测试

```bash
cd engine
npx vitest run
```

54 个测试覆盖：棋盘、棋子、移动、碰撞、布局、改名、序列化、整局流程。
