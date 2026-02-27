import type { GameSettings, LobbyPlayer, GameMap } from './types';
import type { TreasureGameState, TreasurePlayer, MiningRecord } from './treasureTypes';
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
): Omit<TreasureGameState, 'phase' | 'isAnimating' | 'pendingMoves' | 'routeInfos' | 'hoveredRouteId' | 'isRollingDice' | 'rollingDiceDisplay' | 'currentMiningResult' | 'currentStealBattle' | 'currentCardResult'> {

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

    const players: TreasurePlayer[] = finalPlayers.map((lp, index) => ({
        id: `player_${index}`,
        name: lp.name,
        color: lp.color,
        position: shuffledIds[index] ?? treasureMap.startNodeId,
        isHuman: lp.isHuman,
        lapsCompleted: 0,
        treasures: 0,
        cards: [],
        activeEffects: [],
    }));

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
        pendingStealTargetId: null,
    };
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

    const totalNodes = Object.keys(state.map.nodes).length;
    const minedCount = Object.keys(state.minedNodes).length;

    if (minedCount >= totalNodes - 1) { // Minus 1 for start node
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
    let stealTarget = null;
    let stealNodeIndex = -1;

    for (let i = 0; i < fullPath.length - 1; i++) {
        const nodeId = fullPath[i];
        const opponentsHere = s.players.filter((p: TreasurePlayer) => p.id !== player.id && p.position === nodeId && p.treasures > 0);
        if (opponentsHere.length > 0) {
            opponentsHere.sort((a: TreasurePlayer, b: TreasurePlayer) => b.treasures - a.treasures);
            stealTarget = opponentsHere[0];
            stealNodeIndex = i;
            break;
        }
    }

    if (stealTarget) {
        const chunkPath = fullPath.slice(0, stealNodeIndex + 1);
        const remainingPath = fullPath.slice(stealNodeIndex + 1);

        set({
            phase: 'playing',
            movingPath: chunkPath,
            isAnimating: true,
            routeInfos: [],
            hoveredRouteId: null,
            pendingMovement: { path: remainingPath, landingNodeId: landingNodeId },
            pendingStealTargetId: stealTarget.id
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
            pendingStealTargetId: null
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

    // Perform pass-by steal
    const stealTarget = players.find((p: TreasurePlayer) => p.id === s.pendingStealTargetId);
    if (stealTarget) {
        const updatedPlayer = players.find((p: TreasurePlayer) => p.id === player.id)!;
        const stealResult = performSteal('pass_by', updatedPlayer, stealTarget);
        set({
            currentStealBattle: {
                attackerId: player.id,
                targetId: stealTarget.id,
                success: stealResult.success,
                isCounter: stealResult.isCounter,
                substituteUsed: stealResult.substituteUsed,
                type: 'pass_by'
            },
            phase: 'steal_result'
        });
    } else {
        // Fallback
        if (s.pendingMovement) {
            _executeMovementChunk(set, get, s.pendingMovement.path, s.pendingMovement.landingNodeId);
        }
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

    let stealTarget = null;
    let stealType: 'same_node' | 'pass_by' | null = null;
    let stealResult = null;

    const opponentsHere = players.filter((p: TreasurePlayer) => p.id !== player.id && p.position === landingNodeId && p.treasures > 0);
    if (opponentsHere.length > 0) {
        opponentsHere.sort((a: TreasurePlayer, b: TreasurePlayer) => b.treasures - a.treasures);
        stealTarget = opponentsHere[0];
        stealType = 'same_node';
    }

    if (stealTarget && stealType) {
        const updatedPlayer = players.find((p: TreasurePlayer) => p.id === player.id)!;
        stealResult = performSteal(stealType, updatedPlayer, stealTarget);

        set({
            currentStealBattle: {
                attackerId: player.id,
                targetId: stealTarget.id,
                success: stealResult.success,
                isCounter: stealResult.isCounter,
                substituteUsed: stealResult.substituteUsed,
                type: stealType
            },
            phase: 'steal_result'
        });
        return; // Wait for user to acknowledge steal result
    }

    // 3. If no steal, resolve Mining/Card
    const node = s.map.nodes[landingNodeId];
    if (node && node.type === 'bonus') {
        // Card node
        const newCard = getRandomCard();
        set({
            currentCardResult: { card: newCard },
            phase: 'card_result'
        });
        return;
    }

    // 封印状態の場合採掘スキップ
    const currentP = players.find((p: TreasurePlayer) => p.id === player.id)!;
    const isSealed = currentP.activeEffects.some((e: any) => e.type === 'sealed');

    const mineResult = performMining(landingNodeId, s.minedNodes, s.map);
    if (mineResult.type !== 'empty' && !isSealed) {
        set({
            currentMiningResult: { nodeId: landingNodeId, type: mineResult.type },
            phase: 'mining_result'
        });
        return; // Wait for user to acknowledge mining result
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
    const activeCards = cpuPlayer.cards.filter((c: import('./treasureTypes').Card) => !c.isPassive);
    if (activeCards.length > 0 && Math.random() < 0.4) {
        const card = activeCards[Math.floor(Math.random() * activeCards.length)];
        const opponents = s.players.filter((p: TreasurePlayer) => p.id !== cpuPlayer.id);
        if (card.type === 'time_machine') {
            _useCard(set, get, card.id);
        } else if (opponents.length > 0) {
            // お宝が一番多い相手を狙う
            const bestTarget = [...opponents].sort((a: TreasurePlayer, b: TreasurePlayer) => b.treasures - a.treasures)[0];
            _useCard(set, get, card.id, bestTarget.id);
        }
    }

    set({ isRollingDice: true, diceValue: null });

    let ticks = 0;
    const timer = setInterval(() => {
        ticks++;
        if (ticks >= 10) {
            clearInterval(timer);
            const diceValue = rollDice();

            const s2 = get();
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

                for (const r of routeInfos) {
                    let score = 0;

                    // 1. landing on unmined node
                    if (!s2.minedNodes[r.landingNodeId]) score += 10;

                    // 2. adjacent to mined node (better mining chance)
                    const node = s2.map.nodes[r.landingNodeId];
                    if (node) {
                        let adjMined = 0;
                        for (const nextId of node.next) {
                            if (s2.minedNodes[nextId]) adjMined++;
                        }
                        score += adjMined * 2;
                    }

                    // 3. evaluate stealing
                    const pathSet = new Set(r.path);
                    for (const p of s2.players) {
                        if (p.id === currentPlayer.id) continue;
                        if (p.treasures > 0) {
                            if (p.position === r.landingNodeId) {
                                score += 15; // 60% chance to steal
                            } else if (pathSet.has(p.position)) {
                                score += 5; // 30% chance to steal (simplified logic)
                            }
                        }
                    }

                    // small random noise to prevent getting stuck
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
// Acknowledgements from Modals
// ==========================================

export function _acknowledgeMining(set: any, get: any) {
    const s = get();
    if (s.phase !== 'mining_result' || !s.currentMiningResult) return;

    const player = s.players[s.currentPlayerIndex];
    const res = s.currentMiningResult;

    let newScore = player.treasures;

    if (res.type === 'normal') newScore += 1;
    else if (res.type === 'rare') newScore += 2;
    else if (res.type === 'trap') newScore = Math.max(0, newScore - 1);

    const minedNodes = { ...s.minedNodes };
    minedNodes[res.nodeId] = { playerId: res.type === 'fail' ? null : player.id, type: res.type };

    const players = s.players.map((p: TreasurePlayer) =>
        p.id === player.id ? { ...p, treasures: newScore } : p
    );

    set({
        players,
        minedNodes,
        currentMiningResult: null,
        phase: 'playing'
    });

    advanceTreasureTurn(set, get);
}

export function _acknowledgeSteal(set: any, get: any) {
    const s = get();
    if (s.phase !== 'steal_result' || !s.currentStealBattle) return;

    const battle = s.currentStealBattle;
    const players = [...s.players] as TreasurePlayer[];

    const attackerIdx = players.findIndex(p => p.id === battle.attackerId);
    const targetIdx = players.findIndex(p => p.id === battle.targetId);

    if (battle.substituteUsed) {
        // 身代わり人形を消費（最初の1枚だけ）
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

    if (s.pendingMovement) {
        // Resume movement!
        _executeMovementChunk(set, get, s.pendingMovement.path, s.pendingMovement.landingNodeId);
        return;
    }

    // After stealing (same_node), we STILL need to resolve mining if we landed on an unmined node.
    const player = s.players[s.currentPlayerIndex];
    const node = s.map.nodes[player.position];
    if (node && node.type === 'bonus') {
        // Card node
        const newCard = getRandomCard();
        set({
            currentCardResult: { card: newCard },
            phase: 'card_result'
        });
        return;
    }

    const mineResult = performMining(player.position, s.minedNodes, s.map);
    if (mineResult.type !== 'empty') {
        set({
            currentMiningResult: { nodeId: player.position, type: mineResult.type },
            phase: 'mining_result'
        });
        return;
    }

    advanceTreasureTurn(set, get);
}

export function _acknowledgeCard(set: any, get: any) {
    const s = get();
    if (s.phase !== 'card_result' || !s.currentCardResult) return;

    const player = s.players[s.currentPlayerIndex];
    const card = s.currentCardResult.card;

    const players = s.players.map((p: import('./treasureTypes').TreasurePlayer) =>
        p.id === player.id ? { ...p, cards: [...p.cards, card] } : p
    );

    set({
        players,
        currentCardResult: null,
        phase: 'playing'
    });

    advanceTreasureTurn(set, get);
}

function getRandomCard(): import('./treasureTypes').Card {
    const types: import('./treasureTypes').CardType[] = ['power_up', 'substitute', 'seal', 'blow_away', 'paralysis', 'time_machine'];
    const type = types[Math.floor(Math.random() * types.length)];
    const cardData: Record<import('./treasureTypes').CardType, { name: string; description: string; isPassive: boolean }> = {
        'power_up': { name: '略奪のお守り', description: '所持中は略奪成功率+15%', isPassive: true },
        'substitute': { name: '身代わり人形', description: '略奪された時に1回だけ無効化（消費）', isPassive: true },
        'seal': { name: '封印のツボ', description: '対象を3ターン採掘不可にする', isPassive: false },
        'blow_away': { name: 'ぶっ飛ばしハンマー', description: '対象をランダムワープさせる', isPassive: false },
        'paralysis': { name: 'ビリビリ罠', description: '対象を1回休みにする', isPassive: false },
        'time_machine': { name: 'タイムマシン', description: '自分の採掘済マス1つを未採掘に戻す', isPassive: false },
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
        case 'time_machine': {
            // Node selection deferred
            break;
        }
        default:
            return;
    }

    // カードを手札から削除
    const newCards = player.cards.filter((c: import('./treasureTypes').Card) => c.id !== cardId);
    players[playerIdx] = { ...players[playerIdx], cards: newCards };

    set({ players, phase: 'playing' });
}

export function _setupCardNodeSelection(set: any, _get: any, cardId: string, actionType: 'blow_away' | 'time_machine', targetPlayerId?: string) {
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
    } else if (actionType === 'time_machine') {
        const newMinedNodes = { ...s.minedNodes };
        delete newMinedNodes[nodeId];
        set({ minedNodes: newMinedNodes });
    }

    const newCards = player.cards.filter((c: import('./treasureTypes').Card) => c.id !== cardId);
    players[playerIdx] = { ...players[playerIdx], cards: newCards };

    set({ players, phase: 'playing', pendingCardAction: null });
}
