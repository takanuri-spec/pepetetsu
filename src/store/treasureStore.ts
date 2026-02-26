import { create } from 'zustand';
import type { GameSettings, LobbyPlayer, PlayerColor } from '../game/types';
import { DEFAULT_SETTINGS } from '../game/types';
import type { TreasureGameState } from '../game/treasureTypes';
import { GAME_MAP } from '../game/mapData';
import type { RouteInfo } from '../game/engine';
import { calcAllRoutes, rollDice } from '../game/engine';
import { createInitialTreasureState, _handleTreasureRouteSelection, _acknowledgeMining, _acknowledgeSteal, _acknowledgeCard, _useCard } from '../game/treasureEngine';

// ========== Store Interface ==========

export interface TreasureStoreState extends TreasureGameState {
    // Lobby state (copied from gameStore but managed purely for the treasure game)
    lobbyPlayers: LobbyPlayer[];

    // Runtime ephemeral state
    routeInfos: RouteInfo[];
    hoveredRouteId: string | null;
    isRollingDice: boolean;
    rollingDiceDisplay: number | null;

    // Actions
    updateLobbyPlayers: (players: LobbyPlayer[]) => void;
    updateSettings: (settings: Partial<GameSettings>) => void;
    startGame: (settings: GameSettings, lobbyPlayers: LobbyPlayer[]) => void;
    rollDiceAction: () => void;
    selectRoute: (routeId: string) => void;
    setHoveredRoute: (routeId: string | null) => void;
    acknowledgeMining: () => void;
    acknowledgeSteal: () => void;
    acknowledgeCard: () => void;
    useCard: (cardId: string, targetPlayerId?: string) => void;
    resetGame: () => void;
}

// ========== Initial State ==========

// Extract the required properties from TreasureGameState that we'll initialize below.
type InitialStateSubset = Omit<TreasureStoreState, 'updateLobbyPlayers' | 'updateSettings' | 'startGame' | 'rollDiceAction' | 'selectRoute' | 'setHoveredRoute' | 'acknowledgeMining' | 'acknowledgeSteal' | 'acknowledgeCard' | 'useCard' | 'resetGame'>;

const INITIAL_STATE: InitialStateSubset = {
    phase: 'playing', // Starts immediately as playing or lobby via App.tsx logic
    settings: { ...DEFAULT_SETTINGS, gameMode: 'treasure' },
    lobbyPlayers: [
        { name: 'プレイヤー1', color: 'red' as PlayerColor, isHuman: true }
    ],
    players: [],
    currentPlayerIndex: 0,
    round: 1,
    totalRounds: 20,
    map: GAME_MAP,
    minedNodes: {},
    currentMiningResult: null,
    currentStealBattle: null,
    currentCardResult: null,
    diceValue: null,
    movingPath: [],
    winner: null,
    routeInfos: [],
    hoveredRouteId: null,
    pendingMoves: 0,
    isAnimating: false,
    isRollingDice: false,
    rollingDiceDisplay: null,
};

export const useTreasureStore = create<TreasureStoreState>((set, get) => ({
    ...INITIAL_STATE,

    updateLobbyPlayers: (players) => set({ lobbyPlayers: players }),
    updateSettings: (settings) => set({ settings: { ...get().settings, ...settings } }),

    startGame: (settings: GameSettings, lobbyPlayers: LobbyPlayer[]) => {
        const initialState = createInitialTreasureState(settings, lobbyPlayers);
        set({ ...initialState, phase: 'playing' });
    },

    rollDiceAction: () => {
        const s = get();
        if (s.phase !== 'playing' || s.isRollingDice) return;

        set({ isRollingDice: true, diceValue: null });

        let ticks = 0;
        const maxTicks = 10;

        const timer = setInterval(() => {
            ticks++;
            if (ticks >= maxTicks) {
                clearInterval(timer);
                const diceValue = rollDice();
                const s2 = get();
                const currentPlayer = s2.players[s2.currentPlayerIndex];
                const routeInfos = calcAllRoutes(
                    currentPlayer.position,
                    diceValue,
                    s2.map,
                    -1 // no specific destination
                );

                set({
                    isRollingDice: false,
                    rollingDiceDisplay: diceValue,
                    diceValue,
                    pendingMoves: diceValue,
                    routeInfos,
                    hoveredRouteId: null,
                    phase: 'route_selection'
                });
            } else {
                set({ rollingDiceDisplay: rollDice() });
            }
        }, 50);
    },

    selectRoute: (routeId: string) => {
        _handleTreasureRouteSelection(set, get, routeId);
    },

    setHoveredRoute: (routeId: string | null) => {
        set({ hoveredRouteId: routeId });
    },

    acknowledgeMining: () => {
        _acknowledgeMining(set, get);
    },

    acknowledgeSteal: () => {
        _acknowledgeSteal(set, get);
    },

    acknowledgeCard: () => {
        _acknowledgeCard(set, get);
    },

    useCard: (cardId: string, targetPlayerId?: string) => {
        _useCard(set, get, cardId, targetPlayerId);
    },

    resetGame: () => {
        set({ ...INITIAL_STATE });
    },
}));
