import { useTreasureStore } from '../../store/treasureStore';
import { COLOR_HEX } from '../../game/types';
import { TreasureBoard } from '../TreasureBoard/TreasureBoard';
import { TreasureModals } from '../TreasureModals/TreasureModals';
import { TreasureGameLog } from '../TreasureGameLog/TreasureGameLog';

export function TreasureMobileUI() {
    const state = useTreasureStore();
    const { players, currentPlayerIndex, round, phase, rollDiceAction, isRollingDice, rollingDiceDisplay, diceValue, settings, openCardPopup, closeCardPopup, cardPopupPlayerId, resetGame } = state;

    const canRoll = phase === 'playing' && !isRollingDice;
    const displayDiceVal = isRollingDice ? rollingDiceDisplay : diceValue;

    const propertyNodes = Object.values(state.map.nodes).filter(n => n.type === 'property');
    const totalMinable = propertyNodes.length;
    const minedCount = Object.keys(state.minedNodes).length;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', position: 'fixed', inset: 0, overflow: 'hidden', background: '#0d1b2a', color: '#fff' }}>

            {/* ヘッダー (画面上部) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', zIndex: 10 }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                        ラウンド {round}
                    </div>
                    {settings.targetTreasures < 999 && (
                        <div style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: 4 }}>
                            🎯 <span style={{ fontWeight: 'bold' }}>{settings.targetTreasures}</span>
                        </div>
                    )}
                    <div style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        💎 <span style={{ fontWeight: 'bold', color: 'var(--accent)' }}>{minedCount}/{totalMinable}</span>
                    </div>
                </div>
                <button
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '4px 8px', fontSize: '12px', background: 'transparent', border: '1px solid #555' }}
                    onClick={() => {
                        if (window.confirm('ゲームを中断してロビーに戻りますか？')) {
                            resetGame();
                        }
                    }}
                >
                    終了
                </button>
            </div>

            {/* マップ (中央エリア) */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <TreasureBoard isMobile={true} />
                <TreasureModals />
                <TreasureGameLog isMobile={true} />
            </div>

            {/* 各プレイヤーステータス (サイコロの上) */}
            <div style={{ display: 'flex', overflowX: 'auto', padding: '8px', gap: '8px', background: 'rgba(22, 33, 62, 0.8)', borderTop: '1px solid var(--border)', zIndex: 10 }}>
                {players.map((player) => {
                    const isCurrent = player.id === players[currentPlayerIndex]?.id;
                    const hasCards = player.cards.filter(c => !c.isPassive).length > 0;
                    const isClickable = isCurrent && hasCards && phase === 'playing';

                    return (
                        <div
                            key={player.id}
                            onClick={() => {
                                if (!isClickable) return;
                                if (cardPopupPlayerId === player.id) {
                                    closeCardPopup();
                                } else {
                                    openCardPopup(player.id);
                                }
                            }}
                            style={{
                                flex: '0 0 auto',
                                width: '120px',
                                padding: '6px 8px',
                                borderRadius: '8px',
                                background: isCurrent ? 'var(--surface2)' : 'rgba(0,0,0,0.3)',
                                border: isCurrent ? `2px solid ${COLOR_HEX[player.color]}` : '1px solid var(--border)',
                                cursor: isClickable ? 'pointer' : 'default',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: COLOR_HEX[player.color] }} />
                                {player.name}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                                <span>💎 {player.treasures}</span>
                                {player.cards.length > 0 && (
                                    <span style={{ display: 'flex', gap: 2 }}>
                                        {player.cards.slice(0, 3).map((_, i) => <span key={i} style={{ fontSize: '10px' }}>🃏</span>)}
                                        {player.cards.length > 3 && '+'}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* サイコロ (一番下真ん中) */}
            {(() => {
                const currentPlayer = players[currentPlayerIndex];
                const isHumanTurn = currentPlayer?.isHuman;
                return (
                    <div style={{ padding: '12px 16px', background: 'var(--surface)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', zIndex: 10 }}>
                        <div style={{
                            fontSize: '32px',
                            fontWeight: 'bold',
                            width: '56px',
                            height: '56px',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            background: 'var(--surface2)',
                            borderRadius: '12px',
                            border: '2px solid var(--border)',
                            color: displayDiceVal ? 'white' : '#555',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                        }}>
                            {displayDiceVal || '?'}
                        </div>
                        {isHumanTurn ? (
                            <button
                                className="btn btn-primary"
                                style={{ padding: '12px 24px', fontSize: '1.2rem', flex: 1, maxWidth: '240px' }}
                                disabled={!canRoll}
                                onClick={rollDiceAction}
                            >
                                {isRollingDice ? '回転中...' : 'サイコロ'}
                            </button>
                        ) : (
                            <div style={{
                                padding: '12px 24px',
                                fontSize: '1rem',
                                flex: 1,
                                maxWidth: '240px',
                                background: 'var(--surface2)',
                                border: '1px solid var(--border)',
                                borderRadius: '8px',
                                color: 'var(--text-muted)',
                                textAlign: 'center',
                                opacity: 0.5,
                            }}>
                                CPU思考中...
                            </div>
                        )}
                    </div>
                );
            })()}
        </div>
    );
}
