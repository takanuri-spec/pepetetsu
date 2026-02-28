import type { GameSettings, LobbyPlayer, GameMap } from './types';
import type { TreasureGameState, TreasurePlayer, MiningRecord, GameToast } from './treasureTypes';
import { COLOR_HEX } from './types';
import { GAME_MAP } from './mapData';
import { getTreasureMap } from './treasureMaps';
import { PLAYER_COLORS } from './types';
import { calcAllRoutes, rollDice } from './engine';

// ==========================================
// Initialization
// ==========================================

export function createInitialTreasureState(
    settings: GameSettings,
    lobbyPlayers: LobbyPlayer[]
): Omit<TreasureGameState, 'phase' | 'isAnimating' | 'pendingMoves' | 'routeInfos' | 'hoveredRouteId' | 'isRollingDice' | 'rollingDiceDisplay' | 'currentMiningResult' | 'currentStealBattle' | 'currentCardResult' | 'toasts' | 'gameLogs'> {

    // Enforce at least 4 players. If there's 1 human, add 3 CPUs.
    let finalPlayers = [...lobbyPlayers];
    if (finalPlayers.length < 4) {
        const usedColors = finalPlayers.map(p => p.color);
        let cpuCount = 1;
        while (finalPlayers.length < 4) {
            const availableColor = PLAYER_COLORS.find(c => !usedColors.includes(c)) || 'red';
            usedColors.push(availableColor);
            finalPlayers.push({
                name: `NPC盗賊${cpuCount}`, // Giving them a fun name
                color: availableColor,
                isHuman: false
            });
            cpuCount++;
        }
    }

    // トレジャーモード専用マップを取得（選択されたマップIDに応じて）
    const treasureMap = getTreasureMap(settings.treasureMapId);

    const allNodeIds = Object.keys(treasureMap.nodes).map(Number);
    const shuffledIds = [...allNodeIds].sort(() => Math.random() - 0.5);

    const players: TreasurePlayer[] = finalPlayers.map((lp, index) => {
        let cpuPersonality = undefined;
        if (!lp.isHuman) {
            // それぞれの指向にランダムな重みを振り、時に特化させるために累乗をかける
            let w1 = Math.random();
            let w2 = Math.random();
            let w3 = Math.random();
            const p = 1 + Math.random() * 2; // 1~3乗することで偏り（特化キャラ）を生む
            w1 = Math.pow(w1, p);
            w2 = Math.pow(w2, p);
            w3 = Math.pow(w3, p);
            const sum = w1 + w2 + w3 || 1;

            cpuPersonality = {
                cardLover: w1 / sum,
                miner: w2 / sum,
                stalker: w3 / sum
            };
        }

        return {
            id: `player_${index}`,
            name: lp.name,
            color: lp.color,
            position: shuffledIds[index] ?? treasureMap.startNodeId,
            isHuman: lp.isHuman,
            lapsCompleted: 0,
            treasures: 0,
            cards: [],
            activeEffects: [],
            cpuPersonality,
        };
    });

    return {
        players,
        currentPlayerIndex: 0,
        round: 1,
        totalRounds: settings.totalRounds,
        map: treasureMap,
        minedNodes: {},
        diceValue: null,
        movingPath: [],
        winner: null,
        settings,
        pendingCardAction: null,
        pendingMovement: null,
        pendingStealTargetIds: [],
    };
}

// ==========================================
// Toast Queue Helpers
// ==========================================

/** トーストを追加し3秒後に自動削除する。 */
function pushToast(set: any, _get: any, toast: Omit<GameToast, 'id'>) {
    const toastId = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newToast: GameToast = { ...toast, id: toastId };
    set((s: TreasureGameState) => ({ toasts: [...s.toasts, newToast] }));
    setTimeout(() => {
        set((s: TreasureGameState) => ({ toasts: s.toasts.filter(t => t.id !== toastId) }));
    }, 3000);
}

export function pushLog(set: any, _get: any, entry: Omit<import('./treasureTypes').GameLogEntry, 'id' | 'timestamp'>) {
    const newLog: import('./treasureTypes').GameLogEntry = {
        ...entry,
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now()
    };
    set((s: TreasureGameState) => {
        const next = [...s.gameLogs, newLog];
        return { gameLogs: next.slice(-50) };
    });
}

// ==========================================
// Mining Logic
// ==========================================

export const BASE_MINING_CHANCE = 0.25;

/**
 * Calculates the success rate of mining a specific node.
 * 25% base + (25% * number of adjacent mined nodes).
 * gameMap: 現在プレイ中のマップ情報（省略時は後方互換のためデフォルトマップを使用）
 */
export function calcMiningChance(
    nodeId: number,
    minedNodes: Record<number, MiningRecord>,
    gameMap: GameMap = GAME_MAP
): number {
    const node = gameMap.nodes[nodeId];
    if (!node) return 0;

    let adjacentMinedCount = 0;
    for (const nextId of node.next) {
        if (minedNodes[nextId]) {
            adjacentMinedCount++;
        }
    }

    const bonus = adjacentMinedCount * 0.25;
    return Math.min(BASE_MINING_CHANCE + bonus, 1.0); // Max 100%
}

export function performMining(
    nodeId: number,
    minedNodes: Record<number, MiningRecord>,
    gameMap: GameMap = GAME_MAP
): { success: boolean, type: 'normal' | 'rare' | 'trap' | 'empty' | 'fail' } {
    if (minedNodes[nodeId]) {
        return { success: false, type: 'empty' }; // Already mined
    }

    const chance = calcMiningChance(nodeId, minedNodes, gameMap);
    const roll = Math.random();

    if (roll <= chance) {
        // Sub-roll to determine rare or trap
        const subRoll = Math.random();
        if (subRoll < 0.10) {
            return { success: true, type: 'rare' }; // 10% chance it's rare (2 pts)
        } else if (subRoll < 0.20) {
            return { success: true, type: 'trap' }; // 10% chance it's a trap (lose 1 pt)
        } else {
            return { success: true, type: 'normal' }; // 80% chance it's normal (1 pt)
        }
    }

    return { success: false, type: 'fail' };
}

// ==========================================
// Stealing Logic
// ==========================================

export const STEAL_PASS_BY_CHANCE = 0.30;
export const STEAL_SAME_NODE_CHANCE = 0.60;
export const COUNTER_PASS_BY_CHANCE = 0.15;
export const COUNTER_SAME_NODE_CHANCE = 0.30;

export function performSteal(
    type: 'pass_by' | 'same_node',
    attacker: TreasurePlayer,
    target: TreasurePlayer
): { success: boolean, isCounter: boolean, substituteUsed: boolean } {
    // substituteカードによる略奪無効化判定
    const hasSubstitute = target.cards.some(c => c.type === 'substitute');
    if (hasSubstitute) {
        return { success: false, isCounter: false, substituteUsed: true };
    }

    // power_upカードによる略奪ボーナス
    const powerUpCount = attacker.cards.filter(c => c.type === 'power_up').length;
    const attackerCardBonus = powerUpCount * 0.15;

    const baseChance = type === 'pass_by' ? STEAL_PASS_BY_CHANCE : STEAL_SAME_NODE_CHANCE;
    const attackChance = Math.min(baseChance + attackerCardBonus, 1.0);

    const roll = Math.random();
    if (roll <= attackChance) {
        return { success: true, isCounter: false, substituteUsed: false };
    }

    // If attack fails, roll for counter
    const counterBase = type === 'pass_by' ? COUNTER_PASS_BY_CHANCE : COUNTER_SAME_NODE_CHANCE;
    const counterRoll = Math.random();
    if (counterRoll <= counterBase) {
        return { success: false, isCounter: true, substituteUsed: false };
    }

    return { success: false, isCounter: false, substituteUsed: false };
}

// ==========================================
// Turn Progression
// ==========================================

export function checkTreasureGameOver(state: TreasureGameState): TreasurePlayer | null {
    const targetTreasures = state.settings.targetTreasures ?? 10;
    const winnerByPoints = state.players.find(p => p.treasures >= targetTreasures);
    if (winnerByPoints) return winnerByPoints;

    const propertyNodes = Object.values(state.map.nodes).filter(n => n.type === 'property');
    const totalMinable = propertyNodes.length;
    const minedCount = Object.keys(state.minedNodes).length;

    if (totalMinable > 0 && minedCount >= totalMinable) {
        const sorted = [...state.players].sort((a, b) => b.treasures - a.treasures);
        return sorted[0];
    }

    return null;
}

export function advanceTreasureTurn(set: any, get: any) {
    const s = get();

    const winner = checkTreasureGameOver(s);
    if (winner) {
        set({ phase: 'game_over', winner });
        return;
    }

    let nextIndex = s.currentPlayerIndex + 1;
    let nextRound = s.round;

    if (nextIndex >= s.players.length) {
        nextIndex = 0;
        nextRound++;
    }

    // Effect durations tick down here
    const players = s.players.map((p: TreasurePlayer) => {
        if (p.id !== s.players[nextIndex].id) return p;
        // Tick down effects for the NEXT player who is about to start their turn
        const activeEffects = p.activeEffects
            .map(e => ({ ...e, durationTurns: e.durationTurns - 1 }))
            .filter(e => e.durationTurns > 0);
        return { ...p, activeEffects };
    });

    set({
        currentPlayerIndex: nextIndex,
        round: nextRound,
        phase: 'playing',
        players,
        routeInfos: [],
        hoveredRouteId: null,
        diceValue: null,
        rollingDiceDisplay: null,
    });

    // まひ状態のプレーヤーはターンスキップ
    const nextPlayer = players[nextIndex];
    const isParalyzed = nextPlayer.activeEffects.some((e: any) => e.type === 'paralyzed');
    if (isParalyzed) {
        // ターンスキップ（次の人へ）
        setTimeout(() => advanceTreasureTurn(set, get), 800);
        return;
    }

    // Automatically start CPU turn if next player is CPU
    if (!nextPlayer.isHuman) {
        setTimeout(() => _cpuTreasureTurn(set, get), 1000);
    }
}

// ==========================================
// Main Turn Action Logic
// ==========================================

export function _handleTreasureRouteSelection(set: any, get: any, routeId: string) {
    const s = get();
    if (s.phase !== 'route_selection') return;

    const route = s.routeInfos.find((r: any) => r.id === routeId);
    if (!route) return;

    _executeMovementChunk(set, get, route.path, route.landingNodeId);
}

function _executeMovementChunk(set: any, get: any, fullPath: number[], landingNodeId: number) {
    const s = get();
    const player = s.players[s.currentPlayerIndex];
    let stealTargets: TreasurePlayer[] = [];
    let stealNodeIndex = -1;

    for (let i = 0; i < fullPath.length - 1; i++) {
        const nodeId = fullPath[i];
        const opponentsHere = s.players.filter((p: TreasurePlayer) => p.id !== player.id && p.position === nodeId && p.treasures > 0);
        if (opponentsHere.length > 0) {
            opponentsHere.sort((a: TreasurePlayer, b: TreasurePlayer) => b.treasures - a.treasures);
            stealTargets = opponentsHere;
            stealNodeIndex = i;
            break;
        }
    }

    if (stealTargets.length > 0) {
        const chunkPath = fullPath.slice(0, stealNodeIndex + 1);
        const remainingPath = fullPath.slice(stealNodeIndex + 1);

        set({
            phase: 'playing',
            movingPath: chunkPath,
            isAnimating: true,
            routeInfos: [],
            hoveredRouteId: null,
            pendingMovement: { path: remainingPath, landingNodeId: landingNodeId },
            pendingStealTargetIds: stealTargets.map(p => p.id)
        });

        const animDuration = chunkPath.length * 380 + 300;
        setTimeout(() => {
            _handleIntermediateStop(set, get);
        }, animDuration);
    } else {
        set({
            phase: 'playing',
            movingPath: fullPath,
            isAnimating: true,
            routeInfos: [],
            hoveredRouteId: null,
            pendingMovement: null,
            pendingStealTargetIds: []
        });

        const animDuration = fullPath.length * 380 + 300;
        setTimeout(() => {
            _finishTreasureMovement(set, get, { path: fullPath, landingNodeId });
        }, animDuration);
    }
}

function _handleIntermediateStop(set: any, get: any) {
    const s = get();
    const player = s.players[s.currentPlayerIndex];
    const chunkPath = s.movingPath;
    const targetNodeId = chunkPath[chunkPath.length - 1];

    // Update Player Position
    const players = s.players.map((p: TreasurePlayer) =>
        p.id === player.id ? { ...p, position: targetNodeId } : p
    );
    set({ players, movingPath: [], isAnimating: false });

    // Perform pass-by steals
    if (s.pendingStealTargetIds && s.pendingStealTargetIds.length > 0) {
        for (const targetId of s.pendingStealTargetIds) {
            const stealTarget = get().players.find((p: TreasurePlayer) => p.id === targetId);
            if (stealTarget) {
                const updatedPlayer = get().players.find((p: TreasurePlayer) => p.id === player.id)!;
                const stealResult = performSteal('pass_by', updatedPlayer, stealTarget);
                const battle = {
                    attackerId: player.id,
                    targetId: stealTarget.id,
                    success: stealResult.success,
                    isCounter: stealResult.isCounter,
                    substituteUsed: stealResult.substituteUsed,
                    type: 'pass_by' as const
                };
                const applyOut = _applyStealOutcome(set, get, battle);
                pushStealToast(set, get, battle, applyOut);
            }
        }
    }

    // 再開
    const s2 = get();
    if (s2.pendingMovement) {
        _executeMovementChunk(set, get, s2.pendingMovement.path, s2.pendingMovement.landingNodeId);
    }
}

function _finishTreasureMovement(set: any, get: any, route: any) {
    const s = get();
    const player = s.players[s.currentPlayerIndex];

    // 1. Update Player Position
    const players = s.players.map((p: TreasurePlayer) =>
        p.id === player.id ? { ...p, position: route.landingNodeId } : p
    );
    set({ players, movingPath: [], isAnimating: false });

    // 2. Resolve Stealing first!
    const landingNodeId = route.landingNodeId;

    let stealTargets: TreasurePlayer[] = [];
    let stealType: 'same_node' | 'pass_by' | null = null;
    let stealResult = null;

    const opponentsHere = players.filter((p: TreasurePlayer) => p.id !== player.id && p.position === landingNodeId && p.treasures > 0);
    if (opponentsHere.length > 0) {
        opponentsHere.sort((a: TreasurePlayer, b: TreasurePlayer) => b.treasures - a.treasures);
        stealTargets = opponentsHere;
        stealType = 'same_node';
    }

    if (stealTargets.length > 0 && stealType) {
        for (const target of stealTargets) {
            const stealTarget = get().players.find((p: TreasurePlayer) => p.id === target.id);
            if (!stealTarget) continue;

            const updatedPlayer = get().players.find((p: TreasurePlayer) => p.id === player.id)!;
            stealResult = performSteal(stealType, updatedPlayer, stealTarget);

            const battle = {
                attackerId: player.id,
                targetId: stealTarget.id,
                success: stealResult.success,
                isCounter: stealResult.isCounter,
                substituteUsed: stealResult.substituteUsed,
                type: stealType
            };
            const applyOut = _applyStealOutcome(set, get, battle);
            pushStealToast(set, get, battle, applyOut);
        }

        // 略奪が終わったので採掘へ
        const s2 = get();
        const currentPlayer = s2.players[s2.currentPlayerIndex];
        const node = s2.map.nodes[currentPlayer.position];
        if (node && node.type === 'bonus') {
            _resolveCardResult(set, get);
            return;
        }

        const mineResult = performMining(currentPlayer.position, s2.minedNodes, s2.map);
        if (mineResult.type !== 'empty') {
            _resolveMiningResult(set, get, currentPlayer.position, mineResult.type);
            return;
        }

        advanceTreasureTurn(set, get);
        return;
    }

    // 3. 略奕なしの場合、採掘/カードを解決
    const node = s.map.nodes[landingNodeId];
    if (node && node.type === 'bonus') {
        // カードノード: エンジン内で即座に解決
        _resolveCardResult(set, get);
        return;
    }

    // 封印状態の場合採掘スキップ
    const currentP = players.find((p: TreasurePlayer) => p.id === player.id)!;
    const isSealed = currentP.activeEffects.some((e: any) => e.type === 'sealed');

    const mineResult = performMining(landingNodeId, s.minedNodes, s.map);
    if (mineResult.type !== 'empty' && !isSealed) {
        // 採掘結果をエンジン内で即座に解決する
        _resolveMiningResult(set, get, landingNodeId, mineResult.type);
        return;
    }

    // End turn if nothing happened
    advanceTreasureTurn(set, get);
}

// ==========================================
// CPU Logic
// ==========================================

export function _cpuTreasureTurn(set: any, get: any) {
    const s = get();
    if (s.phase !== 'playing') return;

    // CPUのカード使用判断（ターン開始時）
    const cpuPlayer = s.players[s.currentPlayerIndex];
    const pCard = cpuPlayer.cpuPersonality?.cardLover ?? 0.33;
    const cardChance = 0.1 + pCard * 0.7; // cardLoverが高いほどカードをバンバン使う

    const activeCards = cpuPlayer.cards.filter((c: import('./treasureTypes').Card) => !c.isPassive);
    if (activeCards.length > 0 && Math.random() < cardChance) {
        const card = activeCards[Math.floor(Math.random() * activeCards.length)];

        let opponents = s.players.filter((p: TreasurePlayer) => p.id !== cpuPlayer.id);
        // 共通：トップをお宝数で特定し、最優先で妨害する
        opponents = opponents.sort((a: TreasurePlayer, b: TreasurePlayer) => b.treasures - a.treasures);

        if (card.type === 'dice_1' || card.type === 'dice_10') {
            _useCard(set, get, card.id);
        } else if (opponents.length > 0) {
            _useCard(set, get, card.id, opponents[0].id);
        }
    }

    set({ isRollingDice: true, diceValue: null });

    let ticks = 0;
    const timer = setInterval(() => {
        ticks++;
        if (ticks >= 10) {
            clearInterval(timer);
            let diceValue = rollDice();
            const s2 = get();
            const hasDice1 = s2.players[s2.currentPlayerIndex].activeEffects.some((e: any) => e.type === 'dice_1');
            const hasDice10 = s2.players[s2.currentPlayerIndex].activeEffects.some((e: any) => e.type === 'dice_10');
            if (hasDice1) diceValue = 1;
            if (hasDice10) diceValue = 10;

            const currentPlayer = s2.players[s2.currentPlayerIndex];
            const routeInfos = calcAllRoutes(currentPlayer.position, diceValue, s2.map, -1);

            set({
                isRollingDice: false,
                rollingDiceDisplay: diceValue,
                diceValue,
                routeInfos,
                phase: 'route_selection'
            });

            // CPU makes a choice
            setTimeout(() => {
                let bestRoute = routeInfos[0];
                let bestScore = -9999;

                const pMiner = currentPlayer.cpuPersonality?.miner ?? 0.33;
                const pStalker = currentPlayer.cpuPersonality?.stalker ?? 0.33;
                const pCard = currentPlayer.cpuPersonality?.cardLover ?? 0.33;

                // 共通：トップをお宝数で特定
                const sortedOpponents = s2.players
                    .filter((p: TreasurePlayer) => p.id !== currentPlayer.id)
                    .sort((a: TreasurePlayer, b: TreasurePlayer) => b.treasures - a.treasures);
                const topPlayer = sortedOpponents[0];

                for (const r of routeInfos) {
                    let score = 0;
                    const node = s2.map.nodes[r.landingNodeId];

                    // 1. 採掘への執着 (Miner)
                    let miningScore = 0;
                    if (!s2.minedNodes[r.landingNodeId] && node?.type === 'property') {
                        miningScore += 10;
                    }
                    if (node && node.type === 'property') {
                        let adjMined = 0;
                        for (const nextId of node.next) {
                            if (s2.minedNodes[nextId]) adjMined++;
                        }
                        miningScore += adjMined * 3;
                    }
                    score += miningScore * pMiner * 2.5;

                    // 2. カード・アイテムへの執着 (CardLover)
                    if (node?.type === 'bonus') {
                        score += 20 * pCard * 2.0;
                    }

                    // 3. 略奪・他者への執着 (Stalker + 共通トップ狙い)
                    const pathSet = new Set(r.path);
                    let stealScore = 0;
                    for (const p of s2.players) {
                        if (p.id === currentPlayer.id) continue;
                        if (p.treasures > 0) {
                            // 共通：トップからの強奪は特に優先度が高い
                            const isTargetTop = p.id === topPlayer?.id;
                            const priorityMult = isTargetTop ? 2.5 : 1.0;

                            if (p.position === r.landingNodeId) {
                                stealScore += 15 * priorityMult;
                            } else if (pathSet.has(p.position)) {
                                stealScore += 5 * priorityMult;
                            }
                        }
                    }
                    score += stealScore * pStalker * 2.5;

                    // ランダムな揺らぎ（同じスコアでスタックしないため）
                    score += Math.random() * 2;

                    if (score > bestScore) {
                        bestScore = score;
                        bestRoute = r;
                    }
                }

                _handleTreasureRouteSelection(set, get, bestRoute.id);
            }, 1000);

        } else {
            set({ rollingDiceDisplay: rollDice() });
        }
    }, 50);
}

// ==========================================
// Internal Result Resolvers（トースト應用 + 即座蓋様）
// ==========================================

/**
 * 採掘結果を解決しトーストを発行する。
 * 旧: phase='mining_result' に置きユーザー待機 → 新: 即座に遷移＋トースト表示。
 */
function _resolveMiningResult(
    set: any, get: any,
    nodeId: number,
    type: 'normal' | 'rare' | 'trap' | 'empty' | 'fail'
) {
    const s = get();
    const player = s.players[s.currentPlayerIndex];

    let newScore = player.treasures;
    if (type === 'normal') newScore += 1;
    else if (type === 'rare') newScore += 2;
    else if (type === 'trap') newScore = Math.max(0, newScore - 1);

    const minedNodes = { ...s.minedNodes };
    minedNodes[nodeId] = { playerId: type === 'fail' ? null : player.id, type };

    const players = s.players.map((p: TreasurePlayer) =>
        p.id === player.id ? { ...p, treasures: newScore } : p
    );

    const emoji = type === 'normal' ? '💎' : type === 'rare' ? '🌟' : type === 'trap' ? '💣' : '🪨';
    const title = type === 'normal' ? 'お宝発見！' : type === 'rare' ? 'レアなお宝！' : type === 'trap' ? '罠にかかった！' : '何も感じられず…';
    const message = type === 'normal' ? `所持数 ${newScore}（1アップ）`
        : type === 'rare' ? `所持数 ${newScore}（2アップ）`
            : type === 'trap' ? (newScore < player.treasures ? `所持数 ${newScore}（1減）` : '元々お宝なし…')
                : 'ハズレ！何も見つからなかった';
    const playerColor = COLOR_HEX[player.color as import('./types').PlayerColor] ?? '#fff';

    set({
        players,
        minedNodes,
        currentMiningResult: null,
        phase: 'playing',
    });
    pushToast(set, get, { category: 'mining', emoji, title: `${player.name} — ${title}`, message, playerColor });
    advanceTreasureTurn(set, get);
}

/**
 * カード取得結果を解決しトーストを発行する。
 */
function _resolveCardResult(set: any, get: any) {
    const s = get();
    const player = s.players[s.currentPlayerIndex];
    const card = getRandomCard();

    const players = s.players.map((p: TreasurePlayer) =>
        p.id === player.id ? { ...p, cards: [...p.cards, card] } : p
    );

    set({
        players,
        currentCardResult: null,
        phase: 'playing',
    });
    pushToast(set, get, {
        category: 'card',
        emoji: '🃏',
        title: `${player.name} — カードゲット！`,
        message: `${card.name}`,
        playerColor: COLOR_HEX[player.color as import('./types').PlayerColor] ?? '#fff',
    });
    advanceTreasureTurn(set, get);
}



/** 結果をステートに反映し、更新後のplayersを返す。 */
function _applyStealOutcome(
    set: any, get: any,
    battle: NonNullable<TreasureGameState['currentStealBattle']>
): { success: boolean; isCounter: boolean; substituteUsed: boolean } {
    const s = get();
    const players = [...s.players] as TreasurePlayer[];
    const attackerIdx = players.findIndex(p => p.id === battle.attackerId);
    const targetIdx = players.findIndex(p => p.id === battle.targetId);

    if (battle.substituteUsed) {
        const newCards = [...players[targetIdx].cards];
        const subIdx = newCards.findIndex(c => c.type === 'substitute');
        if (subIdx >= 0) newCards.splice(subIdx, 1);
        players[targetIdx] = { ...players[targetIdx], cards: newCards };
    } else if (battle.success && players[targetIdx].treasures > 0) {
        players[targetIdx] = { ...players[targetIdx], treasures: players[targetIdx].treasures - 1 };
        players[attackerIdx] = { ...players[attackerIdx], treasures: players[attackerIdx].treasures + 1 };
    } else if (battle.isCounter && players[attackerIdx].treasures > 0) {
        players[attackerIdx] = { ...players[attackerIdx], treasures: players[attackerIdx].treasures - 1 };
        players[targetIdx] = { ...players[targetIdx], treasures: players[targetIdx].treasures + 1 };
    }

    set({ players, currentStealBattle: null, phase: 'playing' });
    return { success: battle.success, isCounter: battle.isCounter, substituteUsed: battle.substituteUsed };
}

/** 略奕結果に応じたトーストを発行する。 */
function pushStealToast(
    set: any, get: any,
    battle: NonNullable<TreasureGameState['currentStealBattle']>,
    result: { success: boolean; isCounter: boolean; substituteUsed: boolean }
) {
    const s = get();
    const attacker = s.players.find((p: TreasurePlayer) => p.id === battle.attackerId);
    const target = s.players.find((p: TreasurePlayer) => p.id === battle.targetId);
    if (!attacker || !target) return;

    let emoji: string;
    let title: string;
    let message: string;

    if (result.substituteUsed) {
        emoji = '🧸'; title = '身代わり人形為活！';
        message = `${target.name}の身代わり人形が略奕を防いだ！`;
    } else if (result.success) {
        emoji = '⚔️'; title = `${attacker.name} — 略奕成功！`;
        message = `${target.name}からお宝を１つ屢った！`;
    } else if (result.isCounter) {
        emoji = '🛡️'; title = `${attacker.name} — 返り讨ち！`;
        message = `${target.name}に反撃された！`;
    } else {
        emoji = '💨'; title = `${attacker.name} — 略奕失敗`;
        message = '繰を保った...';
    }

    pushToast(set, get, { category: 'steal', emoji, title, message, playerColor: COLOR_HEX[attacker.color as import('./types').PlayerColor] ?? '#fff' });
    pushLog(set, get, {
        text: `${title} ${message}`,
        emoji,
        color: COLOR_HEX[attacker.color as import('./types').PlayerColor] ?? '#ccc',
    });
}

// 以下はストアから呼ばれるスタブ。
// ユーザーの確認クリックを待たずエンジン内部で即座に解決するようにしたため、
// これらの関数は現在未使用だが将来の履歴表示など向けに外部履歴として履歴をそのまま公開する。

export function _acknowledgeMining(_set: any, _get: any) { /* no-op: engine resolves immediately */ }
export function _acknowledgeSteal(_set: any, _get: any) { /* no-op: engine resolves immediately */ }
export function _acknowledgeCard(_set: any, _get: any) { /* no-op: engine resolves immediately */ }

function getRandomCard(): import('./treasureTypes').Card {
    const types: import('./treasureTypes').CardType[] = ['power_up', 'substitute', 'seal', 'blow_away', 'paralysis', 'phone_fraud', 'dice_1', 'dice_10'];
    const type = types[Math.floor(Math.random() * types.length)];
    const cardData: Record<import('./treasureTypes').CardType, { name: string; description: string; isPassive: boolean }> = {
        'power_up': { name: '略奪のお守り', description: '所持中は略奪成功率+15%', isPassive: true },
        'substitute': { name: '身代わり人形', description: '略奪された時に1回だけ無効化（消費）', isPassive: true },
        'seal': { name: '封印のツボ', description: '対象を3ターン採掘不可にする', isPassive: false },
        'blow_away': { name: 'ぶっ飛ばしハンマー', description: '対象をランダムワープさせる', isPassive: false },
        'paralysis': { name: 'ビリビリ罠', description: '対象を1回休みにする', isPassive: false },
        'phone_fraud': { name: '電話詐欺カード', description: '指定した一人からお宝を奪う（同じマス判定）', isPassive: false },
        'dice_1': { name: '1マスカード', description: '次のサイコロが必ず1になる', isPassive: false },
        'dice_10': { name: '10マスカード', description: '次のサイコロが必ず10になる', isPassive: false },
    };
    const data = cardData[type];
    return {
        id: `card_${Math.random().toString(36).substr(2, 9)}`,
        type,
        name: data.name,
        description: data.description,
        isPassive: data.isPassive,
    };
}

// ==========================================
// Card Usage Logic
// ==========================================

export function _useCard(set: any, get: any, cardId: string, targetPlayerId?: string) {
    const s = get();
    const player = s.players[s.currentPlayerIndex];
    const card = player.cards.find((c: import('./treasureTypes').Card) => c.id === cardId);
    if (!card) return;

    // パッシブカードは手動で使えない
    if (card.isPassive) return;

    let players = [...s.players] as TreasurePlayer[];
    const playerIdx = players.findIndex(p => p.id === player.id);

    switch (card.type) {
        case 'seal': {
            if (!targetPlayerId) return;
            const targetIdx = players.findIndex(p => p.id === targetPlayerId);
            if (targetIdx < 0) return;
            const target = players[targetIdx];
            players[targetIdx] = {
                ...target,
                activeEffects: [...target.activeEffects, { type: 'sealed', durationTurns: 3 }]
            };
            break;
        }
        case 'blow_away': {
            if (!targetPlayerId) return;
            const targetIdx = players.findIndex(p => p.id === targetPlayerId);
            if (targetIdx < 0) return;
            // Node selection deferred
            break;
        }
        case 'paralysis': {
            if (!targetPlayerId) return;
            const targetIdx = players.findIndex(p => p.id === targetPlayerId);
            if (targetIdx < 0) return;
            const target = players[targetIdx];
            players[targetIdx] = {
                ...target,
                activeEffects: [...target.activeEffects, { type: 'paralyzed', durationTurns: 1 }]
            };
            break;
        }
        case 'phone_fraud': {
            if (!targetPlayerId) return;
            const targetIdx = players.findIndex(p => p.id === targetPlayerId);
            if (targetIdx < 0) return;
            // 処理はカード削除後に実行
            break;
        }
        case 'dice_1': {
            players[playerIdx] = {
                ...players[playerIdx],
                activeEffects: [...players[playerIdx].activeEffects, { type: 'dice_1', durationTurns: 1 }]
            };
            break;
        }
        case 'dice_10': {
            players[playerIdx] = {
                ...players[playerIdx],
                activeEffects: [...players[playerIdx].activeEffects, { type: 'dice_10', durationTurns: 1 }]
            };
            break;
        }
        default:
            return;
    }

    // カードを手札から削除
    const newCards = player.cards.filter((c: import('./treasureTypes').Card) => c.id !== cardId);
    players[playerIdx] = { ...players[playerIdx], cards: newCards };

    set({ players, phase: 'playing' });

    if (card.type === 'phone_fraud' && targetPlayerId) {
        const tIdx = players.findIndex(p => p.id === targetPlayerId);
        if (tIdx >= 0) {
            const stealTarget = players[tIdx];
            const stealResult = performSteal('same_node', players[playerIdx], stealTarget);
            const battle = {
                attackerId: player.id,
                targetId: stealTarget.id,
                success: stealResult.success,
                isCounter: stealResult.isCounter,
                substituteUsed: stealResult.substituteUsed,
                type: 'same_node' as const
            };
            const out = _applyStealOutcome(set, get, battle);
            pushStealToast(set, get, battle, out);
        }
    }
}

export function _setupCardNodeSelection(set: any, _get: any, cardId: string, actionType: 'blow_away', targetPlayerId?: string) {
    set({
        phase: 'card_target_selection',
        pendingCardAction: { cardId, actionType, targetPlayerId }
    });
}

export function _confirmCardNodeSelection(set: any, get: any, nodeId: number) {
    const s = get();
    if (s.phase !== 'card_target_selection' || !s.pendingCardAction) return;

    const { cardId, actionType, targetPlayerId } = s.pendingCardAction;
    const player = s.players[s.currentPlayerIndex];
    let players = [...s.players] as TreasurePlayer[];
    const playerIdx = players.findIndex(p => p.id === player.id);

    if (actionType === 'blow_away' && targetPlayerId) {
        const targetIdx = players.findIndex(p => p.id === targetPlayerId);
        if (targetIdx >= 0) {
            players[targetIdx] = { ...players[targetIdx], position: nodeId };
        }
    }

    const newCards = player.cards.filter((c: import('./treasureTypes').Card) => c.id !== cardId);
    players[playerIdx] = { ...players[playerIdx], cards: newCards };

    set({ players, phase: 'playing', pendingCardAction: null });
}
