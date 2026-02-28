import type { PlayerColor, GameMap, GameSettings } from './types';

// ========== Treasure Components ==========

export type CardType =
    | 'power_up' // パワーアップ（略奪率+10%）
    | 'substitute' // 身代わり（奪われても宝箱は失わない）
    | 'seal' // 封印（指定プレイヤーは5ターン採掘不可）
    | 'blow_away' // ぶっ飛ばし（ランダムワープ）
    | 'paralysis' // まひ（1回休み）
    | 'time_machine'; // タイムマシン（現在の採掘済みマスを復活）

export interface Card {
    id: string; // ユニークID (ex: card_0)
    type: CardType;
    name: string;
    description: string;
    isPassive: boolean; // 持っているだけで効果があるかどうか
}

export type ActiveEffectType = 'sealed' | 'paralyzed';

export interface ActiveEffect {
    type: ActiveEffectType;
    durationTurns: number; // 残り効果ターン数
}

export interface MiningRecord {
    playerId: string | null;
    type: 'normal' | 'rare' | 'trap' | 'fail';
}

// ========== Toast Notification ==========

export type ToastCategory = 'mining' | 'steal' | 'card';

export interface GameToast {
    id: string;            // 重複防止用ユニークID
    category: ToastCategory;
    emoji: string;
    title: string;
    message: string;
    playerColor: string;   // CSS色文字列（強調表示用）
}

// ========== State Interfaces ==========

export interface TreasurePlayer {
    id: string;
    name: string;
    color: PlayerColor;
    position: number;
    isHuman: boolean;
    lapsCompleted: number;

    // Treasure Mode Specifics
    treasures: number;
    cards: Card[];
    activeEffects: ActiveEffect[];

    // CPU Behavior Weights (for AI)
    cpuPersonality?: {
        cardLover: number;  // アイテム集めて使うのが好き
        miner: number;      // 採掘好き
        stalker: number;    // 宝保持者を付け狙うのが好き
    };
}

export type TreasureGamePhase =
    | 'playing'
    | 'route_selection'
    | 'destination_reached'
    | 'mining_result' // 採掘結果ダイアログ
    | 'steal_result' // 略奪バトルの結果ダイアログ
    | 'card_action' // カード使用ダイアログ
    | 'card_result' // カード取得ダイアログ
    | 'card_target_selection' // カードの対象マス選択
    | 'game_over';

export interface TreasureGameState {
    phase: TreasureGamePhase;
    players: TreasurePlayer[];
    currentPlayerIndex: number;
    round: number;
    totalRounds: number;

    map: GameMap;
    minedNodes: Record<number, MiningRecord>; // key: nodeId

    // 進行中のアクション表示用情報
    currentMiningResult: { nodeId: number, type: 'normal' | 'rare' | 'trap' | 'empty' | 'fail' } | null;
    currentCardResult: { card: Card } | null;
    currentStealBattle: {
        attackerId: string;
        targetId: string;
        success: boolean;
        isCounter: boolean;
        substituteUsed: boolean;
        type: 'pass_by' | 'same_node';
    } | null;

    pendingCardAction: { cardId: string, actionType: 'blow_away' | 'time_machine', targetPlayerId?: string } | null;

    diceValue: number | null;
    movingPath: number[];
    winner: TreasurePlayer | null;
    settings: GameSettings;

    // UI state
    pendingMoves: number;
    isAnimating: boolean;
    pendingMovement: { path: number[], landingNodeId: number } | null;
    pendingStealTargetId: string | null;

    // スマホ通知スタイルのトーストキュー（確認クリック不要）
    toasts: GameToast[];
}
