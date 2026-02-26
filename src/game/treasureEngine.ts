import type { GameSettings, LobbyPlayer } from './types';
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
    };
}

// ==========================================
// Mining Logic
// ==========================================

export const BASE_MINING_CHANCE = 0.25;

/**
 * Calculates the success rate of mining a specific node.
 * 25% base + (25% * number of adjacent mined nodes).
 */
export function calcMiningChance(nodeId: number, minedNodes: Record<number, MiningRecord>): number {
    const node = GAME_MAP.nodes[nodeId];
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

export function performMining(nodeId: number, minedNodes: Record<number, MiningRecord>): { success: boolean, type: 'normal' | 'rare' | 'trap' | 'empty' | 'fail' } {
    if (minedNodes[nodeId]) {
        return { success: false, type: 'empty' }; // Already mined
    }

    const chance = calcMiningChance(nodeId, minedNodes);
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

    set({
        phase: 'playing',
        movingPath: route.path,
        isAnimating: true,
        routeInfos: [],
        hoveredRouteId: null
    });

    const animDuration = route.path.length * 380 + 300;

    setTimeout(() => {
        _finishTreasureMovement(set, get, route);
    }, animDuration);
}

function _finishTreasureMovement(set: any, get: any, route: any) {
    const s = get();
    const player = s.players[s.currentPlayerIndex];

    // 1. Update Player Position
    const players = s.players.map((p: TreasurePlayer) =>
        p.id === player.id ? { ...p, position: route.landingNodeId } : p
    );
    set({ players, movingPath: [], isAnimating: false });

    // 2. Resolve Stealing first! (If landing on same node)
    const landingNodeId = route.landingNodeId;
    const opponentsHere = players.filter((p: TreasurePlayer) => p.id !== player.id && p.position === landingNodeId && p.treasures > 0);

    if (opponentsHere.length > 0) {
        // Attempt steal
        const target = opponentsHere[0];
        const updatedPlayer = players.find((p: TreasurePlayer) => p.id === player.id)!;
        const stealResult = performSteal('same_node', updatedPlayer, target);

        set({
            currentStealBattle: {
                attackerId: player.id,
                targetId: target.id,
                success: stealResult.success,
                isCounter: stealResult.isCounter,
                substituteUsed: stealResult.substituteUsed,
                type: 'same_node'
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

    const mineResult = performMining(landingNodeId, s.minedNodes);
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

    // After stealing, we STILL need to resolve mining if we landed on an unmined node.
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

    const mineResult = performMining(player.position, s.minedNodes);
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
            const allNodeIds = Object.keys(s.map.nodes).map(Number);
            const randomNodeId = allNodeIds[Math.floor(Math.random() * allNodeIds.length)];
            players[targetIdx] = { ...players[targetIdx], position: randomNodeId };
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
            // 自分の採掘済マス1つを未採掘に戻す
            const myMinedNodeIds = Object.entries(s.minedNodes)
                .filter(([, record]: [string, any]) => record.playerId === player.id)
                .map(([id]) => Number(id));
            if (myMinedNodeIds.length === 0) return;
            const targetNodeId = myMinedNodeIds[Math.floor(Math.random() * myMinedNodeIds.length)];
            const newMinedNodes = { ...s.minedNodes };
            delete newMinedNodes[targetNodeId];
            set({ minedNodes: newMinedNodes });
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
