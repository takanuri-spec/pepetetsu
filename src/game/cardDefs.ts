import type { CardType, Card } from './treasureTypes';

// ==========================================
// カード絵文字マッピング（UI 表示用）
// 新しいカードを追加する際はここだけ変更すればよい
// ==========================================

export const CARD_EMOJI: Record<CardType, string> = {
    power_up: '⚔️',
    substitute: '🧸',
    seal: '🏺',
    blow_away: '🔨',
    paralysis: '⚡',
    phone_fraud: '📞',
    dice_1: '1️⃣',
    dice_10: '🔟',
};

// ==========================================
// カード静的データ（名称・説明・パッシブ判定）
// getRandomCard() や UI の両方から参照する
// ==========================================

export const CARD_STATIC_DATA: Record<CardType, { name: string; description: string; isPassive: boolean }> = {
    power_up: { name: '略奪のお守り', description: '所持中は略奪成功率+15%', isPassive: true },
    substitute: { name: '身代わり人形', description: '略奪された時に1回だけ無効化（消費）', isPassive: true },
    seal: { name: '封印のツボ', description: '対象を3ターン採掘不可にする', isPassive: false },
    blow_away: { name: 'ぶっ飛ばしハンマー', description: '対象をランダムワープさせる', isPassive: false },
    paralysis: { name: 'ビリビリ罠', description: '対象を1回休みにする', isPassive: false },
    phone_fraud: { name: '電話詐欺カード', description: '指定した一人からお宝を奪う（同じマス判定）', isPassive: false },
    dice_1: { name: '1マスカード', description: '次のサイコロが必ず1になる', isPassive: false },
    dice_10: { name: '10マスカード', description: '次のサイコロが必ず10になる', isPassive: false },
};

// ==========================================
// カードファクトリ
// ==========================================

/** ランダムなカードを1枚生成する */
export function getRandomCard(): Card {
    const types = Object.keys(CARD_STATIC_DATA) as CardType[];
    const type = types[Math.floor(Math.random() * types.length)];
    const data = CARD_STATIC_DATA[type];
    return {
        id: `card_${Math.random().toString(36).substring(2, 11)}`,
        type,
        name: data.name,
        description: data.description,
        isPassive: data.isPassive,
    };
}
