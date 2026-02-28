import { useEffect, useRef, useState } from 'react';
import { useTreasureStore } from '../../store/treasureStore';
import { COLOR_HEX } from '../../game/types';
import type { GameLogEntry } from '../../game/treasureTypes';

/**
 * ゲームの進行状況をチャット風に表示するワイプUI。
 * Store の gameLogs を直接参照することで、ローカルな重複管理を排除している。
 * ターン開始ログのみブラウザ側で補完する（エンジンは採掘・略奪ログを pushLog で書き込む）。
 */
export function TreasureGameLog({ isMobile }: { isMobile?: boolean }) {
    const { players, currentPlayerIndex, phase, gameLogs, currentCardResult } = useTreasureStore();
    const [displayLogs, setDisplayLogs] = useState<GameLogEntry[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const prevPhaseRef = useRef(phase);

    // ターン開始・カード取得など、エンジンが pushLog しないイベントをここで補完する
    useEffect(() => {
        const prev = prevPhaseRef.current;
        prevPhaseRef.current = phase;

        const player = players[currentPlayerIndex];
        if (!player) return;

        const pColor = COLOR_HEX[player.color];

        // ターン開始（playing への遷移でのみ）
        if (prev !== 'playing' && phase === 'playing') {
            setDisplayLogs(prev => {
                const entry: GameLogEntry = {
                    id: `local_${Date.now()}`,
                    text: `${player.name} のターン`,
                    color: pColor,
                    emoji: '🎯',
                    timestamp: Date.now(),
                };
                return [...prev, entry].slice(-50);
            });
        }

        // カード取得（エンジン側でログを書かないためここで補完）
        if (phase === 'card_result' && currentCardResult) {
            setDisplayLogs(prev => {
                const entry: GameLogEntry = {
                    id: `card_${Date.now()}`,
                    text: `${player.name}: 🃏${currentCardResult.card.name} をゲット！`,
                    color: pColor,
                    emoji: '🃏',
                    timestamp: Date.now(),
                };
                return [...prev, entry].slice(-50);
            });
        }

        // ゲーム終了
        if (phase === 'game_over') {
            setDisplayLogs(prev => {
                const entry: GameLogEntry = {
                    id: `gameover_${Date.now()}`,
                    text: '🏆 ゲーム終了！',
                    color: 'gold',
                    emoji: '👑',
                    timestamp: Date.now(),
                };
                return [...prev, entry].slice(-50);
            });
        }
    }, [phase, currentPlayerIndex, players, currentCardResult]);

    // Store の gameLogs（採掘・略奪など）とローカル補完ログを時刻順にマージ
    const combinedLogs = [...displayLogs, ...gameLogs]
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-50);

    // ログが更新されたら末尾にスクロール
    useEffect(() => {
        if (scrollRef.current && isOpen) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [combinedLogs, isOpen]);

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
                {!isOpen && combinedLogs.length > 0 && (
                    <span style={{
                        background: 'var(--accent)',
                        borderRadius: 10,
                        padding: '1px 7px',
                        fontSize: 11,
                        marginLeft: 6
                    }}>
                        {combinedLogs.length}
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
                    {combinedLogs.length === 0 ? (
                        <div style={{ color: '#666', fontSize: 12, textAlign: 'center', padding: 12 }}>
                            ゲームのログがここに流れます...
                        </div>
                    ) : (
                        combinedLogs.map(entry => (
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
