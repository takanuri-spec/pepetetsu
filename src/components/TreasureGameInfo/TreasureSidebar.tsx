import { useTreasureStore } from '../../store/treasureStore';
import { COLOR_HEX } from '../../game/types';
import { TREASURE_MAPS } from '../../game/treasureMaps';

export function TreasureSidebar() {
  const state = useTreasureStore();

  const { players, currentPlayerIndex, round, phase, rollDiceAction, isRollingDice, rollingDiceDisplay, diceValue, resetGame, settings, openCardPopup, closeCardPopup, cardPopupPlayerId } = state;

  const canRoll = phase === 'playing' && !isRollingDice;
  const displayDiceVal = isRollingDice ? rollingDiceDisplay : diceValue;

  const propertyNodes = Object.values(state.map.nodes).filter(n => n.type === 'property');
  const totalMinable = propertyNodes.length;
  // property以外のマスがminedCountに含まれることは仕様上ないが、一応合わせた方が無難
  const minedCount = Object.keys(state.minedNodes).length;
  const remainingCount = totalMinable - minedCount;

  const cardEmoji: Record<string, string> = {
    'power_up': '⚔️',
    'substitute': '🧸',
    'seal': '🏺',
    'blow_away': '🔨',
    'phone_fraud': '📱',
    'dice_1': '1️⃣',
    'dice_10': '🔟',
  };

  function renderTreasures(count: number) {
    if (count === 0) return <span style={{ color: '#555', fontSize: 13 }}>—</span>;
    if (count >= 10) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: 22 }}>💎</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'gold' }}>x{count}</span>
        </span>
      );
    }
    return (
      <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 1 }}>
        {Array.from({ length: count }).map((_, i) => (
          <span key={i} style={{ fontSize: 14 }}>💎</span>
        ))}
      </span>
    );
  }

  return (
    <div className="game-sidebar">
      {/* 1. 現在のステータス情報 */}
      <div className="sidebar-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            {TREASURE_MAPS.find(m => m.id === settings.treasureMapId)?.name || 'ゲーム情報'}
          </h2>
          <button
            className="btn btn-secondary btn-sm"
            style={{ opacity: 0.8, fontSize: '0.75rem', padding: '4px 8px' }}
            onClick={() => {
              if (window.confirm('ゲームを中断してロビーに戻りますか？')) {
                resetGame();
              }
            }}
          >
            🚪 ロビーへ
          </button>
        </div>
        <div style={{ marginBottom: '8px', fontSize: '1.2rem', fontWeight: 700 }}>
          ラウンド {round}
          {settings.targetTreasures < 999 && (
            <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: 'var(--text-muted)', marginLeft: 8 }}>
              目標お宝個数：{settings.targetTreasures}個
            </span>
          )}
        </div>
        <div style={{ marginBottom: '12px', fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--accent)' }}>
          残りお宝候補: {remainingCount} / {totalMinable}
        </div>

        {/* サイコロの表示 / ロールボタン */}
        {(() => {
          const currentPlayer = players[currentPlayerIndex];
          const isHumanTurn = currentPlayer?.isHuman;
          return (
            <div style={{ textAlign: 'center', margin: '20px 0' }}>
              <div style={{
                fontSize: '48px',
                width: '80px',
                height: '80px',
                lineHeight: '80px',
                margin: '0 auto 12px',
                background: 'var(--surface2)',
                borderRadius: '16px',
                border: '2px solid var(--border)',
                boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                color: displayDiceVal ? 'white' : '#555'
              }}>
                {displayDiceVal || '?'}
              </div>
              {isHumanTurn ? (
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '12px', fontSize: '1.1rem' }}
                  disabled={!canRoll}
                  onClick={rollDiceAction}
                >
                  {isRollingDice ? 'サイコロ回転中...' : 'サイコロを振る'}
                </button>
              ) : (
                <div style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '1rem',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  cursor: 'not-allowed',
                  opacity: 0.5,
                  userSelect: 'none'
                }}>
                  CPU思考中...
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* 2. プレーヤー一覧表示 */}
      <div className="sidebar-section" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h2 className="section-title">プレーヤー状況</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', paddingRight: '4px' }}>
          {players.map((player, idx) => {
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
                  padding: '10px 12px',
                  borderRadius: '12px',
                  background: isCurrent ? 'var(--surface2)' : 'transparent',
                  border: isCurrent ? `2px solid ${COLOR_HEX[player.color]}` : '1px solid var(--border)',
                  transition: 'background 0.2s',
                  cursor: isClickable ? 'pointer' : 'default',
                }}
              >
                {/* 名前行 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: COLOR_HEX[player.color],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 'bold', fontSize: 12, color: 'white', flexShrink: 0
                  }}>{idx + 1}</div>
                  <span style={{ fontWeight: 600, fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {player.name}
                  </span>
                  {player.activeEffects.map((e, i) => {
                    const emoji = e.type === 'sealed' ? '🔒' : e.type === 'paralyzed' ? '⚡' : e.type === 'dice_1' ? '1️⃣' : '🔟';
                    const color = e.type === 'sealed' ? '#ef4444' : e.type === 'paralyzed' ? '#eab308' : '#3b82f6';
                    return (
                      <span key={i} style={{ fontSize: 11, color }}>
                        {emoji}{e.durationTurns > 0 ? e.durationTurns : ''}
                      </span>
                    );
                  })}
                </div>

                {/* お宝行 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: player.cards.length > 0 ? 4 : 0 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>お宝:</span>
                  {renderTreasures(player.treasures)}
                </div>

                {/* カード行（アイコン表示のみ、操作はマップのコマクリックで） */}
                {player.cards.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>手札:</span>
                    {player.cards.map((card) => (
                      <span
                        key={card.id}
                        title={card.name}
                        style={{
                          fontSize: 16,
                          filter: card.isPassive ? 'brightness(0.7)' : 'none',
                          opacity: card.isPassive ? 0.65 : 1
                        }}
                      >
                        {cardEmoji[card.type] ?? '🃏'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
