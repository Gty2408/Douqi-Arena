# 斗棋竞技场（军棋白板版）- 实现计划

## Task 1: 项目骨架与引擎包初始化
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 建立 monorepo 目录结构：`engine/`（纯 TS 游戏引擎）、`server/`（Node 后端）、`client/`（React 前端）
  - 初始化 engine 包：`package.json`、`tsconfig.json`、Vitest 测试配置
  - 定义核心 TypeScript 类型：`PieceType`、`CellType`、`Side`、`Piece`、`BoardCell`、`Position`、`GameState`、`CombatResult`
  - 定义可扩展属性结构：`PieceAttributes = { rank: number }`，后续可扩展为多维属性
- **Acceptance Criteria Addressed**: AC-1, AC-9, AC-13
- **Test Requirements**:
  - `rule` TR-1.1: `engine/` 包可编译，类型定义完整；证据：`tsc --noEmit` 通过
- **Notes**: 引擎包零运行时依赖，纯 TS

## Task 2: 棋盘配置与数据结构
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 创建 `engine/data/board-config.json`：12×5 共 60 点，标注每点类型（公路/铁路/行营/大本营）和连接关系
  - 实现 `Board` 类：从配置加载，提供 `getCell(pos)`、`getNeighbors(pos)`、`isConnected(a,b,type)`
  - 行营位置、大本营位置、双方阵地划分
  - 连接线：公路相邻、铁路直线（同行/同列连续铁路点）、工兵铁路拐弯路径
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `rule` TR-2.1: 棋盘 60 点，类型分布正确（公路/铁路/行营/大本营数量）；证据：`board.test.ts`
  - `rule` TR-2.2: 大本营 2 个、行营数量正确；证据：同上
  - `rule` TR-2.3: 连接关系可正确查询；证据：同上

## Task 3: 棋子规则数据表
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 创建 `engine/data/piece-rules.json`：定义棋子类型（军旗/地雷/炸弹/工兵/白板）、每方数量、是否可移动、默认属性
  - 实现 `PieceFactory`：根据数据表生成每方 25 枚棋子实例
  - 白板棋子默认 `attributes = { rank: 0 }`
  - 不硬编码等级链，等级碰撞通过 `attributes.rank` 比较
- **Acceptance Criteria Addressed**: AC-2, AC-4
- **Test Requirements**:
  - `rule` TR-3.1: 每方生成 25 枚（军旗1+地雷3+炸弹2+工兵3+白板16）；证据：`piece.test.ts`
  - `rule` TR-3.2: 白板棋子初始 rank=0；证据：同上
  - `rule` TR-3.3: 棋子定义来自 JSON，代码无类型硬编码等级；证据：代码审查

## Task 4: 移动规则引擎
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2, Task 3
- **Description**:
  - 实现 `movement.ts`：`getValidMoves(board, piece, from)`
  - 公路：相邻公路点走一格
  - 铁路：同一直线（行或列）上连续铁路点不限格，但路径上有任何棋子阻挡时不能越过（包括工兵）
  - 工兵铁路拐弯：在铁路网上通过 BFS 可达任意铁路点，可多次拐弯，但拐弯路径上不能有棋子阻挡
  - 地雷不可移动
  - 行营安全区：敌方棋子不可进入/攻击行营内棋子
  - 阻挡规则统一：铁路直线和工兵拐弯路径上有棋子即停，不允许越过任何棋子
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `rule` TR-4.1: 公路只能走相邻一格；证据：`movement.test.ts`
  - `rule` TR-4.2: 铁路直线不限格（无阻挡时）；证据：同上
  - `rule` TR-4.3: 工兵可铁路拐弯到达任意铁路网点；证据：同上
  - `rule` TR-4.4: 地雷无合法移动；证据：同上
  - `rule` TR-4.5: 行营内棋子不可被敌方攻击；证据：同上
  - `rule` TR-4.6: 铁路直线有棋子阻挡时不能越过（含工兵）；证据：同上
  - `rule` TR-4.7: 工兵拐弯路径上有棋子阻挡时不能通过；证据：同上

## Task 5: 碰撞结算引擎
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3
- **Description**:
  - 实现 `resolveCombat(attacker: Piece, defender: Piece): CombatResult` 统一接口
  - 结果类型：`ATTACKER_WINS`（攻击方存活）、`DEFENDER_WINS`（防守方存活）、`MUTUAL_DESTRUCTION`（同归于尽）、`FLAG_CAPTURED`（夺旗）
  - 规则：
    - 白板 vs 白板：rank 高者胜，同级同归
    - 炸弹碰任何：同归
    - 地雷 vs 工兵：工兵胜（地雷死）
    - 地雷 vs 炸弹：同归
    - 地雷 vs 其他（非工兵非炸弹）：防守方（地雷）胜，来犯者死
    - 军旗被碰：FLAG_CAPTURED
- **Acceptance Criteria Addressed**: AC-3, AC-4, AC-7
- **Test Requirements**:
  - `rule` TR-5.1: 白板 rank 比较三态（高/低/等）；证据：`combat.test.ts`
  - `rule` TR-5.2: 炸弹同归所有情况；证据：同上
  - `rule` TR-5.3: 地雷三态规则（工兵/炸弹/其他）；证据：同上
  - `rule` TR-5.4: 军旗被碰返回 FLAG_CAPTURED；证据：同上

## Task 6: 布局合法性校验与等级分配
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2, Task 3
- **Description**:
  - 实现 `validateLayout(layout, side)`：
    - 军旗必须在大本营
    - 地雷必须在后两排
    - 炸弹不能在第一排
    - 行营不能放子
    - 25 枚棋子齐全
  - 实现等级分配：`allocateLevels(allocations)` 校验总和 ≤ 100，每枚 rank ∈ [0,9]
  - 布局阶段接口预留：`LayoutPhase` 支持后续"资源分配 + 成长方向选择"
- **Acceptance Criteria Addressed**: AC-6, AC-7, AC-14
- **Test Requirements**:
  - `rule` TR-6.1: 合法布局通过、非法布局（军旗不在大本营等）被拒；证据：`layout.test.ts`
  - `rule` TR-6.2: 等级总和超 100 被拒、单枚超 9 被拒；证据：同上
  - `rule` TR-6.3: 行营放子被拒；证据：同上

## Task 7: 改名功能
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 3
- **Description**:
  - 实现 `renamePiece(pieceId, newName)`：名字 ≤ 3 字（UTF-8 字符数），可随时改，不消耗资源
  - 名字仅己方可见：在状态序列化时，对方棋子 `name` 字段被移除/置空
- **Acceptance Criteria Addressed**: AC-8
- **Test Requirements**:
  - `rule` TR-7.1: 改名成功（≤3字）、超长被拒；证据：`rename.test.ts`
  - `rule` TR-7.2: 对方视图序列化不包含己方棋子名字；证据：`serialization.test.ts`

## Task 8: 游戏状态机与整局流程
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 4, Task 5, Task 6
- **Description**:
  - 实现 `GameEngine` 类：状态 `setup → playing → ended`
  - 方法：`submitLayout(side, layout)`、`start()`、`move(side, from, to)`、`getStateFor(side)`
  - 回合切换、胜负判定（军旗被碰）
  - 整局模拟测试：双方布局 → 轮流走子 → 夺旗结束
- **Acceptance Criteria Addressed**: AC-16
- **Test Requirements**:
  - `rule` TR-8.1: 状态机转换正确（setup→playing→ended）；证据：`game.test.ts`
  - `rule` TR-8.2: 整局模拟可走完并正确判定胜负；证据：同上

## Task 9: 后端项目骨架与账号系统
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 初始化 `server/`：Express + Socket.IO + TypeScript，JSON 文件存储
  - 账号系统：`register(username, password, gameId)`、`login(username, password)`
  - 密码 BCrypt 哈希（bcryptjs），生成 JWT token
  - 游戏ID 唯一性校验
  - 账号字段：username、gameId、passwordHash、luck（气运值，默认 0）、wins（胜场，默认 0）、matchHistory（留空数组）
  - 存储层 `AccountStore` 接口，JSON 文件实现，预留 SQLite 扩展
- **Acceptance Criteria Addressed**: AC-10
- **Test Requirements**:
  - `rule` TR-9.1: 注册成功、重复用户名/游戏ID 被拒；证据：`account.test.ts`
  - `rule` TR-9.2: 密码哈希存储、登录校验正确；证据：同上
  - `rule` TR-9.3: 登录返回 JWT token；证据：同上

## Task 10: 房间系统
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 9
- **Description**:
  - 房间管理：`createRoom(host)`、`joinRoom(roomCode, player)`、`leaveRoom`、`ready(roomCode, player)`
  - 房间状态：`waiting → ready → playing → ended`
  - 房主准备后开始（双方都 ready）
  - 房间码生成（6位）
  - 房间列表查询
  - 断线重连：玩家断开后保留房间状态，凭 token + 房间码重连
- **Acceptance Criteria Addressed**: AC-11
- **Test Requirements**:
  - `rule` TR-10.1: 创建/加入/离开房间正确；证据：`room.test.ts`
  - `rule` TR-10.2: 双方 ready 后状态变为 playing；证据：同上
  - `rule` TR-10.3: 断线后可重连恢复；证据：同上

## Task 11: 服务端权威裁定与状态同步
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 8, Task 10
- **Description**:
  - Socket.IO 事件：`layout:submit`、`move`、`rename`、`ready`、`chat`
  - 服务端持有 `GameEngine` 实例，客户端只发操作请求
  - 服务端校验操作合法性，调用引擎，裁定结果
  - 状态同步：`getVisibleState(side)` 序列化，只包含己方完整数据 + 敌方占位数据
  - 碰撞结果广播：`combat:result` 只通知类型（谁吃谁/同归/被地雷炸），不暴露被吃棋子完整信息
- **Acceptance Criteria Addressed**: AC-12, AC-13
- **Test Requirements**:
  - `rule` TR-11.1: 非法操作被服务端拒绝；证据：`authority.test.ts`
  - `rule` TR-11.2: 状态序列化不含敌方暗子 name/rank；证据：`serialization.test.ts`
  - `rule` TR-11.3: 碰撞结果不泄露被吃棋子完整信息；证据：同上

## Task 12: 排行榜
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 9
- **Description**:
  - `GET /api/leaderboard`：从账号存储读取，按气运值降序，返回排名、游戏ID、气运值、胜场
  - 分页支持（基础版可选）
  - 胜场更新：对局结束时胜者 wins+1
- **Acceptance Criteria Addressed**: AC-14
- **Test Requirements**:
  - `rule` TR-12.1: 排行榜按气运值降序、字段完整；证据：`leaderboard.test.ts`

## Task 13: 前端项目骨架与登录注册
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 9
- **Description**:
  - 初始化 `client/`：React + Vite + TypeScript
  - 全局暗黑魔幻主题（CSS 变量：深灰黑底、暗金线条等）
  - 登录/注册页：中央暗金边框卡片，输入框微光
  - 对接后端 `/api/register`、`/api/login`，存储 token
  - Socket.IO 客户端初始化
- **Acceptance Criteria Addressed**: AC-15, AC-10
- **Test Requirements**:
  - `rule` TR-13.1: 登录注册流程可用；证据：浏览器实测
  - `rubric` TR-13.2: 暗黑魔幻主题还原度；scale 1-5；anchors 1/3/5；threshold >= 4；证据：截图

## Task 14: 前端大厅与房间
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 13
- **Description**:
  - 大厅页：房间列表、创建房间按钮、房间码输入加入
  - 房间等待页：双方游戏ID、准备按钮、开始（房主）
  - 排行榜页入口
  - 对接 Socket 事件 `room:create`、`room:join`、`room:ready`、`room:state`
- **Acceptance Criteria Addressed**: AC-11
- **Test Requirements**:
  - `rule` TR-14.1: 创建/加入房间流程可用；证据：浏览器实测

## Task 15: 前端棋盘渲染（Canvas + 暗黑风格）
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2, Task 13
- **Description**:
  - Canvas 绘制 12×5 棋盘：石质底纹、公路暗金线、铁路亮金粗线+流光粒子、行营蓝微光、大本营暗红高台
  - 停靠点圆形凹槽
  - 棋子渲染：己方玉质底座+发光刻印（等级越高越亮）、敌方暗子统一背面、白板未分配灰色无光、军旗金色旗帜+暗红脉冲、地雷暗紫裂纹+锁链、炸弹橙红燃烧符文、工兵青蓝齿轮
  - 行营护盾光效
- **Acceptance Criteria Addressed**: AC-15
- **Test Requirements**:
  - `rubric` TR-15.1: 棋盘视觉还原度；scale 1-5；anchors 1/3/5；threshold >= 4；证据：截图
  - `rule` TR-15.2: 棋盘 60 点渲染正确、铁路/公路/行营/大本营区分明显；证据：截图

## Task 16: 前端对局交互与操作面板
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 15, Task 11
- **Description**:
  - 布阵阶段：拖动/点击放置棋子，等级点分配面板（剩余点数、点击 +/- 调整等级）
  - 行棋阶段：点击己方棋子显示可移动点，点击目标移动/碰撞
  - 右侧操作面板：剩余等级点、已选棋子详情（名称/等级/位置，可改名）、操作按钮
  - 顶部栏：双方游戏ID、剩余棋子数、回合、计时
  - 底部聊天栏
  - 碰撞动画：吞噬/湮灭/夺旗（地雷触发不做特殊特效）
  - 改名弹窗（≤3字限制）
- **Acceptance Criteria Addressed**: AC-8, AC-16
- **Test Requirements**:
  - `rule` TR-16.1: 布阵-行棋-碰撞全流程可用；证据：浏览器实测
  - `rule` TR-16.2: 改名功能可用且对方不可见；证据：双窗口实测

## Task 17: 前端排行榜与个人主页
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 12, Task 13
- **Description**:
  - 排行榜页：暗色列表，前三名金/银/铜光效，每行排名/游戏ID/气运值/胜场
  - 个人主页：游戏ID、气运值、近期战绩、胜率
- **Acceptance Criteria Addressed**: AC-14
- **Test Requirements**:
  - `rule` TR-17.1: 排行榜数据正确显示；证据：浏览器实测

## Task 18: 端到端联调与文档
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 12, Task 16, Task 17
- **Description**:
  - 两浏览器窗口完整流程：注册→登录→创建/加入房间→布阵→对弈→结束→排行榜
  - 验证暗棋隔离：A 窗口看不到 B 的棋子名字和等级
  - 断线重连验证
  - 编写 `engine/README.md`：数据结构、规则引擎接口、扩展点
  - 编写 `server/README.md`：Socket 事件、状态同步逻辑、信息隔离实现
  - 编写根 `README.md`：项目启动说明
- **Acceptance Criteria Addressed**: AC-11, AC-13, AC-16
- **Test Requirements**:
  - `rule` TR-18.1: 双窗口完整对局流程通过；证据：实测记录
  - `rule` TR-18.2: 暗棋隔离验证通过；证据：实测记录
  - `rule` TR-18.3: README 文档完整；证据：文件存在
