import { useState, useEffect, useRef } from 'react';
import { useTreasureStore } from '../../store/treasureStore';
import { COLOR_HEX } from '../../game/types';

export interface GameLogEntry {
    id: number;
    text: string;
    color?: string;
    emoji?: string;
    timestamp: number;
}

let logIdCounter = 0;

/**
 * ゲームの進行状況をチャット風に表示するワイプUI。
 * 右下に常駐し、表示・非表示を切り替えられる。
 * 右下に常駐し、表示・非表示を切り替えられる。
 */
export function TreasureGameLog({ isMobile }: { isMobile?: boolean }) {
    const { players, currentPlayerIndex, phase, currentMiningResult, currentStealBattle, currentCardResult } = useTreasureStore();
    const [logs, setLogs] = useState<GameLogEntry[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const prevPhaseRef = useRef(phase);

    const addLog = (text: string, color?: string, emoji?: string) => {
        setLogs(prev => {
            const next = [...prev, { id: logIdCounter++, text, color, emoji, timestamp: Date.now() }];
            // 最大50件に制限
            return next.slice(-50);
        });
    };

    // フェーズ変化を監視してログを追加
    useEffect(() => {
        const prev = prevPhaseRef.current;
        prevPhaseRef.current = phase;

        const player = players[currentPlayerIndex];
        if (!player) return;
        const pColor = COLOR_HEX[player.color];

        // ターン開始
        if (prev !== 'playing' && phase === 'playing') {
            addLog(`${player.name} のターン`, pColor, '🎯');
        }

        // 採掘結果
        if (phase === 'mining_result' && currentMiningResult) {
            const typeMap: Record<string, { text: string; emoji: string }> = {
                'normal': { text: 'お宝を発見！(+1)', emoji: '💎' },
                'rare': { text: 'レアなお宝！(+2)', emoji: '🌟' },
                'trap': {
                    text: player.treasures === 0 ? '罠にかかったが元々お宝を持っていなかった' : '罠にかかった...(-1)',
                    emoji: '💣'
                },
                'fail': { text: '何も見つからなかった', emoji: '💦' },
                'empty': { text: 'すでに掘り尽くされている', emoji: '🕳️' },
            };
            const info = typeMap[currentMiningResult.type] || { text: '採掘', emoji: '⛏️' };
            addLog(`${player.name}: ${info.text}`, pColor, info.emoji);
        }

        // 略奪結果
        if (phase === 'steal_result' && currentStealBattle) {
            const attacker = players.find(p => p.id === currentStealBattle.attackerId);
            const target = players.find(p => p.id === currentStealBattle.targetId);
            if (attacker && target) {
                if (currentStealBattle.substituteUsed) {
                    addLog(`${target.name} の身代わり人形が略奪を防いだ！`, COLOR_HEX[target.color], '🧸');
                } else if (currentStealBattle.success) {
                    addLog(`${attacker.name} が ${target.name} からお宝を略奪！`, COLOR_HEX[attacker.color], '⚔️');
                } else if (currentStealBattle.isCounter) {
                    addLog(`${target.name} が返り討ち！`, COLOR_HEX[target.color], '🛡️');
                } else {
                    addLog(`${attacker.name} の略奪失敗`, '#888', '💨');
                }
            }
        }

        // カード取得
        if (phase === 'card_result' && currentCardResult) {
            addLog(`${player.name}: 🃏${currentCardResult.card.name} をゲット！`, pColor, '🃏');
        }

        // ゲームオーバー
        if (phase === 'game_over') {
            addLog('🏆 ゲーム終了！', 'gold', '👑');
        }
    }, [phase, currentMiningResult, currentStealBattle, currentCardResult]);

    // 自動スクロール
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div style={{
            position: 'fixed',
            bottom: isMobile ? undefined : 16,
            top: isMobile ? 56 : undefined,
            right: 16,
            zIndex: 500,
            width: isOpen ? 300 : 'auto',
            maxHeight: isOpen ? 280 : 'auto',
            display: 'flex',
            flexDirection: 'column',
            pointerEvents: 'auto',
        }}>
            {/* トグルボタン */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    alignSelf: 'flex-end',
                    background: 'rgba(30,30,40,0.9)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: isOpen ? '8px 8px 0 0' : '8px',
                    color: '#fff',
                    padding: '6px 14px',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    backdropFilter: 'blur(8px)',
                    width: isOpen ? '100%' : 'auto',
                    textAlign: isOpen ? 'right' : 'center',
                }}
            >
                {isOpen ? '▼ ログを閉じる' : '📜 ログ'}
                {!isOpen && logs.length > 0 && (
                    <span style={{
                        background: 'var(--accent)',
                        borderRadius: 10,
                        padding: '1px 7px',
                        fontSize: 11,
                        marginLeft: 6
                    }}>
                        {logs.length}
                    </span>
                )}
            </button>

            {/* ログ本体 */}
            {isOpen && (
                <div
                    ref={scrollRef}
                    style={{
                        background: 'rgba(15,15,25,0.92)',
                        borderRadius: '0 0 8px 8px',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderTop: 'none',
                        padding: '8px',
                        overflowY: 'auto',
                        maxHeight: 220,
                        backdropFilter: 'blur(12px)',
                    }}
                >
                    {logs.length === 0 ? (
                        <div style={{ color: '#666', fontSize: 12, textAlign: 'center', padding: 12 }}>
                            ゲームのログがここに流れます...
                        </div>
                    ) : (
                        logs.map(entry => (
                            <div
                                key={entry.id}
                                style={{
                                    padding: '4px 6px',
                                    fontSize: 12,
                                    lineHeight: 1.5,
                                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                                    animation: 'fadeInLog 0.3s ease-out',
                                }}
                            >
                                {entry.emoji && <span style={{ marginRight: 4 }}>{entry.emoji}</span>}
                                <span style={{ color: entry.color || '#ccc' }}>{entry.text}</span>
                            </div>
                        ))
                    )}
                </div>
            )}

            <style>{`
                @keyframes fadeInLog {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
