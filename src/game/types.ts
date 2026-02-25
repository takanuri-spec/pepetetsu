// ========== Map Types ==========

export type NodeType = 'property' | 'start' | 'bonus' | 'penalty' | 'destination_hint';

export interface StationProperty {
  id: string;
  name: string;
  price: number;
  baseIncome: number;
}

export interface MapNode {
  id: number;
  name: string;
  type: NodeType;
  x: number;
  y: number;
  next: number[]; // 接続先ノードID（分岐あり）
  // property only
  properties?: StationProperty[];
  groupId?: string;
  color?: string; // グループカラー
  // bonus/penalty
  amount?: number; // +/- 金額
}

export interface MapEdge {
  from: number;
  to: number;
}

export interface GameMap {
  nodes: Record<number, MapNode>;
  edges: MapEdge[];
  startNodeId: number;
}

// ========== Player Types ==========

export type PlayerColor = 'red' | 'blue' | 'green' | 'yellow';

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  position: number; // current node ID
  money: number;
  ownedProperties: string[]; // owned property IDs
  isHuman: boolean;
  totalAssets: number; // money + property values
  lapsCompleted: number; // スタートを通過した回数
}

// ========== Game State Types ==========

export type GamePhase =
  | 'lobby'
  | 'playing'
  | 'branch_selection'
  | 'property_action'
  | 'settlement'
  | 'destination_reached'
  | 'game_over';

export interface RentPayment {
  toPlayerId: string;
  amount: number;
}

export interface NodeActionInfo {
  nodeId: number;
  rentPayments: RentPayment[]; // 支払うべき家賃
  canBuy: boolean; // まだ買える物件があるか
}

export interface SettlementInfo {
  round: number;
  cycleNumber: number;
  incomes: Array<{
    playerId: string;
    amount: number;
    breakdown: Array<{ nodeName: string; income: number }>;
  }>;
}

export interface GameSettings {
  playerCount: number;
  totalRounds: number;
  cycleLength: number; // 何ラウンドで1決算（デフォルト4）
  startingMoney: number;
  destinationBonusAmount: number;
}

export interface GameState {
  phase: GamePhase;
  players: Player[];
  currentPlayerIndex: number;
  round: number;
  totalRounds: number;
  cycleLength: number;
  map: GameMap;
  destinationNodeId: number | null;
  destinationReachCount: number; // 目的地到達回数（次の目的地設定用）
  diceValue: number | null;
  movingPath: number[]; // アニメーション用移動経路
  currentNodeAction: NodeActionInfo | null;
  lastSettlement: SettlementInfo | null;
  winner: Player | null;
  settings: GameSettings;
  // UI state
  pendingMoves: number; // 残り移動マス数
  isAnimating: boolean;
}

// ========== Lobby Types ==========

export interface LobbyPlayer {
  name: string;
  color: PlayerColor;
  isHuman: boolean;
}

export const PLAYER_COLORS: PlayerColor[] = ['red', 'blue', 'green', 'yellow'];

export const COLOR_LABELS: Record<PlayerColor, string> = {
  red: '赤',
  blue: '青',
  green: '緑',
  yellow: '黄',
};

export const COLOR_HEX: Record<PlayerColor, string> = {
  red: '#EF4444',
  blue: '#3B82F6',
  green: '#22C55E',
  yellow: '#EAB308',
};

export const DEFAULT_SETTINGS: GameSettings = {
  playerCount: 2,
  totalRounds: 20,
  cycleLength: 4,
  startingMoney: 1000,
  destinationBonusAmount: 500,
};
