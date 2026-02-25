import type {
  GameState,
  Player,
  GameMap,
  MapNode,
  NodeActionInfo,
  RentPayment,
  SettlementInfo,
  GameSettings,
} from './types';
import { GAME_MAP, DESTINATION_CANDIDATES, isGroupOwned, GROUP_BONUS_MULTIPLIER } from './mapData';

// ========== サイコロ ==========
export function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

// ========== 移動経路計算 ==========
// 現在位置から steps マス進む経路を返す（分岐がある場合は最初の候補を選ぶ）
// 分岐選択はストア側で処理するため、ここでは単純に "最短経路" を返す
export function calcPath(
  startNodeId: number,
  steps: number,
  map: GameMap,
  branchChoices: number[] = [] // 分岐時の選択順
): number[] {
  const path: number[] = [];
  let current = startNodeId;
  let choiceIdx = 0;

  for (let i = 0; i < steps; i++) {
    const node = map.nodes[current];
    if (!node || node.next.length === 0) break;

    if (node.next.length === 1) {
      current = node.next[0];
    } else {
      // 分岐: branchChoices が渡されていればそれを使う
      current = branchChoices[choiceIdx] ?? node.next[0];
      choiceIdx++;
    }
    path.push(current);
  }

  return path;
}

// 次のノードに分岐があるか確認
export function hasBranchAt(nodeId: number, map: GameMap): boolean {
  const node = map.nodes[nodeId];
  return node ? node.next.length > 1 : false;
}

// ========== BFS: ノード間の最短ステップ数 ==========
// グラフは有向なので前方探索のみ。到達不能な場合は null を返す
export function calcDistanceToNode(fromId: number, toId: number, map: GameMap): number | null {
  if (fromId === toId) return 0;
  const visited = new Set<number>();
  const queue: Array<{ id: number; dist: number }> = [{ id: fromId, dist: 0 }];

  while (queue.length > 0) {
    const { id, dist } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const node = map.nodes[id];
    if (!node) continue;

    for (const nextId of node.next) {
      if (nextId === toId) return dist + 1;
      if (!visited.has(nextId)) {
        queue.push({ id: nextId, dist: dist + 1 });
      }
    }
  }
  return null; // 到達不能
}

// ========== BFS: 目的地から全てのノードへの距離を一括計算 ==========
export function calcDistancesFromTarget(targetId: number, map: GameMap): Record<number, number> {
  const distances: Record<number, number> = {};
  const queue: Array<{ id: number; dist: number }> = [{ id: targetId, dist: 0 }];
  distances[targetId] = 0;

  while (queue.length > 0) {
    const { id, dist } = queue.shift()!;
    const node = map.nodes[id];
    if (!node) continue;

    for (const nextId of node.next) {
      if (distances[nextId] === undefined) {
        distances[nextId] = dist + 1;
        queue.push({ id: nextId, dist: dist + 1 });
      }
    }
  }
  return distances;
}

// ========== 経路（ルート）ごとの着地情報を計算 ==========
export interface RouteInfo {
  id: string;                // ルートの識別子
  path: number[];            // サイコロの目数だけ進んだ全経路
  landingNodeId: number;     // 着地ノード
  distToDestination: number | null; // 着地から目的地までの距離
}

export function calcAllRoutes(
  startNodeId: number,
  steps: number,
  map: GameMap,
  destinationNodeId: number | null
): RouteInfo[] {
  if (steps === 0) return [];

  let paths: number[][] = [[]];
  let currentNodes = [startNodeId];

  for (let i = 0; i < steps; i++) {
    const nextPaths: number[][] = [];
    const nextNodes: number[] = [];

    for (let pIdx = 0; pIdx < paths.length; pIdx++) {
      const path = paths[pIdx];
      const current = currentNodes[pIdx];
      const node = map.nodes[current];

      if (!node || node.next.length === 0) {
        // 行き止まりの場合
        nextPaths.push(path);
        nextNodes.push(current);
        continue;
      }

      // Uターン防止用の1つ前のノードを取得
      const previousNodeId = path.length >= 2 ? path[path.length - 2] : (path.length === 1 ? startNodeId : -1);

      let validNext = node.next;
      if (previousNodeId !== -1) {
        validNext = node.next.filter(id => id !== previousNodeId);
      }

      // 他に行き場がなければ引き返す（行き止まり仕様）
      if (validNext.length === 0) {
        validNext = node.next;
      }

      for (const nextId of validNext) {
        nextPaths.push([...path, nextId]);
        nextNodes.push(nextId);
      }
    }
    paths = nextPaths;
    currentNodes = nextNodes;
  }

  // RouteInfo の生成
  return paths.map((path, idx) => {
    const landingNodeId = currentNodes[idx];
    const distToDestination = destinationNodeId != null
      ? calcDistanceToNode(landingNodeId, destinationNodeId, map)
      : null;
    return {
      id: `route-${idx}`,
      path,
      landingNodeId,
      distToDestination
    };
  });
}

// ========== 物件アクション判定 ==========
export function getNodeAction(
  node: MapNode,
  currentPlayer: Player,
  players: Player[]
): NodeActionInfo | null {
  if (node.type !== 'property' || !node.properties) return null;

  const rentPayments: RentPayment[] = [];
  let canBuy = false;

  // 各物件についてチェック
  for (const prop of node.properties) {
    const owner = players.find(p => p.ownedProperties.includes(prop.id));

    if (!owner) {
      // 誰の所有でもない場合、まだ買える
      canBuy = true;
    } else if (owner.id !== currentPlayer.id) {
      // 他人の所有物件なら家賃発生
      const hasGroupBonus = node.groupId
        ? isGroupOwned(owner.ownedProperties, node.groupId)
        : false;
      const rentAmount = Math.round(prop.baseIncome * (hasGroupBonus ? GROUP_BONUS_MULTIPLIER : 1));

      // 既存の支払先を探して加算するか、新規追加
      const existingPayment = rentPayments.find(rp => rp.toPlayerId === owner.id);
      if (existingPayment) {
        existingPayment.amount += rentAmount;
      } else {
        rentPayments.push({ toPlayerId: owner.id, amount: rentAmount });
      }
    }
  }

  // 払う家賃もなく、買える物件もない（自分が全て所有しているか、買えない状態）場合でも
  // とりあえず NodeActionInfo は返す。UI側でスキップさせる。
  return {
    nodeId: node.id,
    rentPayments,
    canBuy,
  };
}

// ========== 決算処理 ==========
export function calcSettlement(
  players: Player[],
  map: GameMap,
  round: number,
  cycleNumber: number
): SettlementInfo {
  const incomes = players.map(player => {
    const breakdown: Array<{ nodeName: string; income: number }> = [];

    // 所有している全てのプロパティ（物件IDごと）を舐める
    player.ownedProperties.forEach(propId => {
      // どのノードかを探す
      const node = Object.values(map.nodes).find(n => n.properties?.some(p => p.id === propId));
      if (!node || !node.properties) return;

      const prop = node.properties.find(p => p.id === propId);
      if (!prop) return;

      const hasGroupBonus = node.groupId
        ? isGroupOwned(player.ownedProperties, node.groupId)
        : false;
      const income = Math.round(prop.baseIncome * (hasGroupBonus ? GROUP_BONUS_MULTIPLIER : 1));

      breakdown.push({ nodeName: prop.name, income });
    });

    const amount = breakdown.reduce((sum, b) => sum + b.income, 0);
    return { playerId: player.id, amount, breakdown };
  });

  return { round, cycleNumber, incomes };
}

// ========== 総資産計算 ==========
export function calcTotalAssets(player: Player, map: GameMap): number {
  let propertyValue = 0;
  player.ownedProperties.forEach(propId => {
    const node = Object.values(map.nodes).find(n => n.properties?.some(p => p.id === propId));
    if (node && node.properties) {
      const prop = node.properties.find(p => p.id === propId);
      if (prop) propertyValue += prop.price;
    }
  });

  return player.money + propertyValue;
}

// ========== 目的地ランダム選択 ==========
export function chooseNextDestination(
  currentDestination: number | null,
  players: Player[]
): number {
  // 全プレイヤーの現在地を除外
  const playerPositions = players.map(p => p.position);
  const candidates = DESTINATION_CANDIDATES.filter(
    id => id !== currentDestination && !playerPositions.includes(id)
  );

  if (candidates.length === 0) return DESTINATION_CANDIDATES[0];
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ========== ゲーム初期状態生成 ==========
export function createInitialGameState(settings: GameSettings, lobbyPlayers: Array<{
  name: string;
  color: import('./types').PlayerColor;
  isHuman: boolean;
}>): GameState {
  const players: Player[] = lobbyPlayers.map((lp, index) => ({
    id: `player_${index}`,
    name: lp.name,
    color: lp.color,
    position: GAME_MAP.startNodeId,
    money: settings.startingMoney,
    ownedProperties: [],
    isHuman: lp.isHuman,
    totalAssets: settings.startingMoney,
    lapsCompleted: 0,
  }));

  const firstDestination = chooseNextDestination(null, players);

  return {
    phase: 'playing',
    players,
    currentPlayerIndex: 0,
    round: 1,
    totalRounds: settings.totalRounds,
    cycleLength: settings.cycleLength,
    map: GAME_MAP,
    destinationNodeId: firstDestination,
    destinationReachCount: 0,
    diceValue: null,
    movingPath: [],
    currentNodeAction: null,
    lastSettlement: null,
    winner: null,
    settings,
    pendingMoves: 0,
    isAnimating: false,
  };
}

// ========== ゲーム終了チェック ==========
export function checkGameOver(state: GameState): Player | null {
  if (state.round > state.totalRounds) {
    // 総資産1位が勝者
    const ranked = [...state.players].sort((a, b) => b.totalAssets - a.totalAssets);
    return ranked[0];
  }
  return null;
}

// ========== ターン終了処理: 次のプレイヤーへ ==========
export function advanceTurn(state: GameState): Partial<GameState> {
  const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  const isNewRound = nextPlayerIndex === 0;
  const nextRound = isNewRound ? state.round + 1 : state.round;

  return {
    currentPlayerIndex: nextPlayerIndex,
    round: nextRound,
    diceValue: null,
    movingPath: [],
    pendingMoves: 0,
  };
}

// ========== スタートノード通過チェック ==========
// 経路にスタートが含まれているかを確認
export function didPassStart(path: number[], map: GameMap): boolean {
  return path.includes(map.startNodeId);
}
