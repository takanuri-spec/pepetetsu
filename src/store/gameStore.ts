import { create } from 'zustand';
import type {
  GameSettings,
  Player,
  LobbyPlayer,
  NodeActionInfo,
  SettlementInfo,
  GamePhase,
  GameMap,
  PlayerColor,
} from '../game/types';
import { DEFAULT_SETTINGS } from '../game/types';
import {
  rollDice,
  calcPath,
  getNodeAction,
  calcSettlement,
  calcTotalAssets,
  chooseNextDestination,
  createInitialGameState,
  advanceTurn,
  checkGameOver,
  didPassStart,
  calcAllRoutes,
  type RouteInfo,
} from '../game/engine';
import { GAME_MAP } from '../game/mapData';
import { decideBuy, decideRoute } from '../game/cpu';

// ========== フラットなストア型 ==========

export interface StoreState {
  // Phase (lobby or game phases)
  phase: GamePhase | 'lobby';

  // Lobby state
  settings: GameSettings;
  lobbyPlayers: LobbyPlayer[];

  // Game state (undefined when in lobby)
  players: Player[];
  currentPlayerIndex: number;
  round: number;
  totalRounds: number;
  cycleLength: number;
  map: GameMap;
  destinationNodeId: number | null;
  nextDestinationNodeId: number | null;
  destinationReachCount: number;
  diceValue: number | null;
  movingPath: number[];
  currentNodeAction: NodeActionInfo | null;
  lastSettlement: SettlementInfo | null;
  winner: Player | null;
  routeInfos: RouteInfo[];          // サイコロの目で進める全ルート情報
  hoveredRouteId: string | null;    // ホバー中のルート（ボードハイライト用）
  pendingMoves: number;
  isAnimating: boolean;
  isRollingDice: boolean;
  rollingDiceDisplay: number | null;

  // Actions
  updateSettings: (settings: Partial<GameSettings>) => void;
  updateLobbyPlayers: (players: LobbyPlayer[]) => void;
  startGame: () => void;
  rollDiceAction: () => void;
  selectRoute: (routeId: string) => void;
  setHoveredRoute: (routeId: string | null) => void;
  buyProperty: (propId?: string) => void;
  skipBuy: () => void;
  acknowledgeAction: () => void;
  resetGame: () => void;
}

// ========== 初期状態 ==========

const INITIAL_STATE: Omit<StoreState, 'updateSettings' | 'updateLobbyPlayers' | 'startGame' | 'rollDiceAction' | 'selectRoute' | 'setHoveredRoute' | 'buyProperty' | 'skipBuy' | 'acknowledgeAction' | 'resetGame'> = {
  phase: 'lobby',
  settings: DEFAULT_SETTINGS,
  lobbyPlayers: [
    { name: 'プレイヤー1', color: 'red' as PlayerColor, isHuman: true },
    { name: 'CPU1', color: 'blue' as PlayerColor, isHuman: false },
    { name: 'CPU2', color: 'green' as PlayerColor, isHuman: false },
    { name: 'CPU3', color: 'yellow' as PlayerColor, isHuman: false },
  ],
  players: [],
  currentPlayerIndex: 0,
  round: 1,
  totalRounds: 20,
  cycleLength: 4,
  map: GAME_MAP,
  destinationNodeId: null,
  nextDestinationNodeId: null,
  destinationReachCount: 0,
  diceValue: null,
  movingPath: [],
  currentNodeAction: null,
  lastSettlement: null,
  winner: null,
  routeInfos: [],
  hoveredRouteId: null,
  pendingMoves: 0,
  isAnimating: false,
  isRollingDice: false,
  rollingDiceDisplay: null,
};

// ========== ストア ==========

export const useGameStore = create<StoreState>((set, get) => ({
  ...INITIAL_STATE,

  updateSettings: (newSettings) => {
    set(s => ({ settings: { ...s.settings, ...newSettings } }));
  },

  updateLobbyPlayers: (players) => {
    set({ lobbyPlayers: players });
  },

  startGame: () => {
    const { settings, lobbyPlayers } = get();
    const gameState = createInitialGameState(settings, lobbyPlayers);
    set({ ...gameState, lobbyPlayers, settings });

    // 最初のプレイヤーがCPUなら自動ターン
    if (!lobbyPlayers[0].isHuman) {
      setTimeout(() => _cpuTurn(set, get), 800);
    }
  },

  rollDiceAction: () => {
    const s = get();
    if (s.phase !== 'playing' || s.isRollingDice) return;

    set({ isRollingDice: true, diceValue: null });

    let ticks = 0;
    const maxTicks = 10;

    // サイコロアニメーションタイマー
    const timer = setInterval(() => {
      ticks++;
      if (ticks >= maxTicks) {
        clearInterval(timer);

        const diceValue = rollDice();
        const s2 = get(); // 最新のステートを取得
        const currentPlayer = s2.players[s2.currentPlayerIndex];
        const routeInfos = calcAllRoutes(
          currentPlayer.position,
          diceValue,
          s2.map,
          s2.destinationNodeId
        );

        set({
          isRollingDice: false,
          rollingDiceDisplay: diceValue,
          diceValue,
          pendingMoves: diceValue,
          routeInfos,
          hoveredRouteId: null,
          phase: 'branch_selection'
        });
      } else {
        // 1から6までのランダムな目を表示
        const randomDice = Math.floor(Math.random() * 6) + 1;
        set({ rollingDiceDisplay: randomDice });
      }
    }, 100);
  },

  setHoveredRoute: (routeId: string | null) => {
    set({ hoveredRouteId: routeId });
  },

  selectRoute: (routeId: string) => {
    const s = get();
    if (s.phase !== 'branch_selection') return;

    const currentPlayer = s.players[s.currentPlayerIndex];
    const diceValue = s.diceValue!;

    const info = s.routeInfos.find(r => r.id === routeId);
    const fullPath = info ? info.path : calcPath(currentPlayer.position, diceValue, s.map);

    set({ phase: 'playing', hoveredRouteId: null, routeInfos: [] });
    _doMove(set, get, currentPlayer, diceValue, fullPath);
  },

  buyProperty: (propId?: string) => {
    const s = get();
    if (s.phase !== 'property_action') return;
    const action = s.currentNodeAction;
    if (!action || !action.canBuy || !propId) return;

    const node = s.map.nodes[action.nodeId];
    if (!node || !node.properties) return;
    const prop = node.properties.find(p => p.id === propId);
    if (!prop) return;

    const currentPlayer = s.players[s.currentPlayerIndex];
    if (currentPlayer.money < prop.price) return;

    const updatedPlayers = s.players.map(p => {
      if (p.id !== currentPlayer.id) return p;
      const newOwned = [...p.ownedProperties, prop.id];
      const newMoney = p.money - prop.price;
      return {
        ...p,
        money: newMoney,
        ownedProperties: newOwned,
        totalAssets: calcTotalAssets({ ...p, money: newMoney, ownedProperties: newOwned }, s.map),
      };
    });

    const remainingUnowned = node.properties.some(p => {
      if (p.id === prop.id) return false;
      return !updatedPlayers.some(pl => pl.ownedProperties.includes(p.id));
    });

    set({ players: updatedPlayers, currentNodeAction: { ...action, canBuy: remainingUnowned } });
  },

  skipBuy: () => {
    const s = get();
    if (s.phase !== 'property_action') return;
    _endTurnOrSettlement(set, get);
  },

  acknowledgeAction: () => {
    const s = get();

    if (s.phase === 'destination_reached') {
      const newDest = s.nextDestinationNodeId ?? chooseNextDestination(s.destinationNodeId, s.players);
      set({
        destinationNodeId: newDest,
        nextDestinationNodeId: null,
        destinationReachCount: s.destinationReachCount + 1
      });

      // 引き続き物件購入フェーズへ移行するか判定
      const finalNode = s.map.nodes[s.players[s.currentPlayerIndex].position];
      _handleLandingProperty(set, get, finalNode);
      return;
    }

    if (s.phase === 'settlement') {
      const winner = checkGameOver(get() as unknown as import('../game/types').GameState);
      if (winner) {
        set({ phase: 'game_over', winner });
        return;
      }
      set({ phase: 'playing', lastSettlement: null });

      // 次のプレイヤーがCPUなら自動ターン
      const updated = get();
      const nextPlayer = updated.players[updated.currentPlayerIndex];
      if (!nextPlayer.isHuman) {
        setTimeout(() => _cpuTurn(set, get), 800);
      }
      return;
    }

    if (s.phase === 'property_action') {
      _endTurnOrSettlement(set, get);
    }
  },

  resetGame: () => {
    set({ ...INITIAL_STATE });
  },
}));

// ========== 内部ヘルパー ==========

type SetFn = (partial: Partial<StoreState> | ((s: StoreState) => Partial<StoreState>)) => void;
type GetFn = () => StoreState;

function _doMove(set: SetFn, get: GetFn, currentPlayer: Player, diceValue: number, forcedPath: number[]) {
  const s = get();
  const path = forcedPath.length > 0
    ? forcedPath
    : calcPath(currentPlayer.position, diceValue, s.map);

  const finalNodeId = path[path.length - 1] ?? currentPlayer.position;
  const passedStart = didPassStart(path, s.map);

  const updatedPlayers = s.players.map(p => {
    if (p.id !== currentPlayer.id) return p;
    return { ...p, position: finalNodeId, lapsCompleted: p.lapsCompleted + (passedStart ? 1 : 0) };
  });

  set({ movingPath: path, players: updatedPlayers, isAnimating: true });

  setTimeout(() => {
    set({ isAnimating: false });
    const finalNode = get().map.nodes[finalNodeId];
    _handleLanding(set, get, finalNode);
  }, Math.max(400 * path.length + 200, 600));
}

function _handleLanding(set: SetFn, get: GetFn, node: ReturnType<typeof get>['map']['nodes'][number] | undefined) {
  const s = get();
  const currentPlayer = s.players[s.currentPlayerIndex];

  if (!node) {
    _endTurnOrSettlement(set, get);
    return;
  }

  // 目的地チェック
  if (node.id === s.destinationNodeId) {
    const bonus = s.settings.destinationBonusAmount;
    const updatedPlayers = s.players.map(p => {
      if (p.id !== currentPlayer.id) return p;
      return {
        ...p,
        money: p.money + bonus,
        totalAssets: calcTotalAssets({ ...p, money: p.money + bonus }, s.map),
      };
    });
    // 次の目的地を事前に選んでおく
    const nextDest = chooseNextDestination(s.destinationNodeId, updatedPlayers);
    set({ players: updatedPlayers, phase: 'destination_reached', nextDestinationNodeId: nextDest });
    return;
  }

  switch (node.type) {
    case 'start':
      _endTurnOrSettlement(set, get);
      break;

    case 'bonus': {
      const amount = node.amount ?? 100;
      const updatedPlayers = s.players.map(p => {
        if (p.id !== currentPlayer.id) return p;
        return {
          ...p,
          money: p.money + amount,
          totalAssets: calcTotalAssets({ ...p, money: p.money + amount }, s.map),
        };
      });
      set({
        players: updatedPlayers,
        currentNodeAction: { nodeId: node.id, rentPayments: [], canBuy: false },
        phase: 'property_action',
      });
      break;
    }

    case 'penalty': {
      const amount = node.amount ?? -100;
      const updatedPlayers = s.players.map(p => {
        if (p.id !== currentPlayer.id) return p;
        return {
          ...p,
          money: Math.max(0, p.money + amount),
          totalAssets: calcTotalAssets({ ...p, money: Math.max(0, p.money + amount) }, s.map),
        };
      });
      set({
        players: updatedPlayers,
        currentNodeAction: { nodeId: node.id, rentPayments: [], canBuy: false },
        phase: 'property_action',
      });
      break;
    }

    case 'property': {
      _handleLandingProperty(set, get, node);
      break;
    }

    default:
      _endTurnOrSettlement(set, get);
  }
}

function _endTurnOrSettlement(set: SetFn, get: GetFn) {
  const s = get();
  const turnResult = advanceTurn(s as unknown as import('../game/types').GameState);
  const newRound = turnResult.round!;
  const isCycleEnd = newRound > s.round && s.round % s.cycleLength === 0;

  if (isCycleEnd) {
    const cycleNumber = s.round / s.cycleLength;
    const settlement = calcSettlement(s.players, s.map, s.round, cycleNumber);

    const updatedPlayers = s.players.map(player => {
      const income = settlement.incomes.find(i => i.playerId === player.id);
      if (!income) return player;
      const newMoney = player.money + income.amount;
      return { ...player, money: newMoney, totalAssets: calcTotalAssets({ ...player, money: newMoney }, s.map) };
    });

    set({
      ...turnResult,
      players: updatedPlayers,
      phase: 'settlement',
      lastSettlement: settlement,
      currentNodeAction: null,
    });
    return;
  }

  if (newRound > s.totalRounds) {
    // 最終ランキング
    const ranked = [...s.players].sort((a, b) => b.totalAssets - a.totalAssets);
    set({ ...turnResult, phase: 'game_over', winner: ranked[0], currentNodeAction: null });
    return;
  }

  set({ ...turnResult, phase: 'playing', currentNodeAction: null });

  const updated = get();
  const nextPlayer = updated.players[updated.currentPlayerIndex];
  if (!nextPlayer.isHuman) {
    setTimeout(() => _cpuTurn(set, get), 800);
  }
}

function _handleLandingProperty(set: SetFn, get: GetFn, node: ReturnType<typeof get>['map']['nodes'][number]) {
  const s = get();
  const currentPlayer = s.players[s.currentPlayerIndex];
  const action = getNodeAction(node, currentPlayer, s.players);

  if (!action || (!action.canBuy && action.rentPayments.length === 0)) {
    _endTurnOrSettlement(set, get);
    return;
  }

  // Handle rent payments
  if (action.rentPayments.length > 0) {
    let updatedPlayers = s.players;
    let newCurrentMoney = currentPlayer.money;

    action.rentPayments.forEach(rp => {
      newCurrentMoney = Math.max(0, newCurrentMoney - rp.amount);
      updatedPlayers = updatedPlayers.map(p => {
        if (p.id === rp.toPlayerId) return { ...p, money: p.money + rp.amount };
        return p;
      });
    });

    updatedPlayers = updatedPlayers.map(p => {
      if (p.id === currentPlayer.id) return { ...p, money: newCurrentMoney, totalAssets: calcTotalAssets({ ...p, money: newCurrentMoney }, s.map) };
      if (action.rentPayments.some(rp => rp.toPlayerId === p.id)) {
        return { ...p, totalAssets: calcTotalAssets(p, s.map) };
      }
      return p;
    });

    set({ players: updatedPlayers });
  }

  // Re-fetch current state to evaluate property buying
  const curState = get();
  const curPlayer = curState.players[curState.currentPlayerIndex];

  if (action.canBuy) {
    if (!curPlayer.isHuman) {
      // CPU logic
      const currentOwned = [...curPlayer.ownedProperties];
      let currentMoney = curPlayer.money;

      const availableProps = (node.properties ?? []).filter(prop =>
        !curState.players.some(p => p.ownedProperties.includes(prop.id))
      );

      for (const prop of availableProps) {
        const shouldBuy = decideBuy(curPlayer, prop, curState.map);
        if (shouldBuy && currentMoney >= prop.price) {
          currentOwned.push(prop.id);
          currentMoney -= prop.price;
        }
      }

      if (currentOwned.length > curPlayer.ownedProperties.length) {
        const updatedPlayers = curState.players.map(p =>
          p.id !== curPlayer.id ? p : {
            ...p,
            money: currentMoney,
            ownedProperties: currentOwned,
            totalAssets: calcTotalAssets({ ...p, money: currentMoney, ownedProperties: currentOwned }, curState.map)
          }
        );
        set({ players: updatedPlayers });
      }
      _endTurnOrSettlement(set, get);
      return;
    }
    set({ currentNodeAction: action, phase: 'property_action' });
  } else if (action.rentPayments.length > 0 && curPlayer.isHuman) {
    // 支払う家賃だけあった場合
    set({ currentNodeAction: { ...action, canBuy: false }, phase: 'property_action' });
  } else {
    _endTurnOrSettlement(set, get);
  }
}

function _cpuTurn(set: SetFn, get: GetFn) {
  const s = get();
  if (s.phase !== 'playing') return;

  const currentPlayer = s.players[s.currentPlayerIndex];
  if (currentPlayer.isHuman) return;

  if (s.isRollingDice) return;
  set({ isRollingDice: true, diceValue: null });

  let ticks = 0;
  const maxTicks = 10;

  const timer = setInterval(() => {
    ticks++;
    if (ticks >= maxTicks) {
      clearInterval(timer);

      const diceValue = rollDice();
      const s2 = get();
      const cp = s2.players[s2.currentPlayerIndex];

      const routeInfos = calcAllRoutes(
        cp.position,
        diceValue,
        s2.map,
        s2.destinationNodeId
      );

      set({
        isRollingDice: false,
        rollingDiceDisplay: diceValue,
        diceValue
      });

      // CPU はルート決定を自動で行う(アニメーションのため少しラグを入れる)
      setTimeout(() => {
        let path: number[];
        if (routeInfos.length > 1) {
          const chosen = decideRoute(routeInfos);
          path = chosen.path;
        } else {
          path = routeInfos[0]?.path ?? [];
        }
        _doMove(set, get, cp, diceValue, path);
      }, 500);

    } else {
      set({ rollingDiceDisplay: Math.floor(Math.random() * 6) + 1 });
    }
  }, 100);
}
