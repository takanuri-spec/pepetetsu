import { useState } from 'react';
import { useTreasureStore } from '../../store/treasureStore';
import { COLOR_HEX } from '../../game/types';
import type { Card } from '../../game/treasureTypes';

export function TreasureSidebar() {
  const state = useTreasureStore();

  const { players, currentPlayerIndex, round, totalRounds, phase, rollDiceAction, isRollingDice, rollingDiceDisplay, diceValue, useCard } = state;

  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  const canRoll = phase === 'playing' && !isRollingDice;
  const sortedByTreasures = [...players].sort((a, b) => b.treasures - a.treasures);
  const displayDiceVal = isRollingDice ? rollingDiceDisplay : diceValue;

  return (
    <div className="game-sidebar">
      {/* 1. 現在のステータス情報 */}
      <div className="sidebar-section">
        <h2 className="section-title">ゲーム情報</h2>
        <div style={{ marginBottom: '12px', fontSize: '1.2rem', fontWeight: 700 }}>
          ラウンド {round} <span style={{ fontSize: '0.9rem', color: '#aaa', fontWeight: 'normal' }}>/ {totalRounds}</span>
        </div>

        {/* サイコロの表示 / ロールボタン */}
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
          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: '1.1rem' }}
            disabled={!canRoll}
            onClick={rollDiceAction}
          >
            {isRollingDice ? 'サイコロ回転中...' : 'サイコロを振る'}
          </button>
        </div>
      </div>

      {/* 2. ランキング表示 */}
      <div className="sidebar-section" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h2 className="section-title">お宝ハンター・ランキング</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', paddingRight: '4px' }}>
          {sortedByTreasures.map((player, idx) => {
            const isCurrent = player.id === players[currentPlayerIndex]?.id;
            return (
              <div
                key={player.id}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  background: isCurrent ? 'var(--surface2)' : 'transparent',
                  border: isCurrent ? `2px solid ${COLOR_HEX[player.color]}` : '1px solid var(--border)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'background 0.2s',
                  position: 'relative'
                }}
              >
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: COLOR_HEX[player.color],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  color: 'white',
                  flexShrink: 0
                }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '15px' }} className="truncate">
                    {player.name}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent)' }}>
                    {player.treasures}
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 4 }}>個</span>
                  </div>
                  {player.cards.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#888' }}>🃏{player.cards.length}</div>
                  )}
                  {player.activeEffects.map((e, i) => (
                    <span key={i} style={{ fontSize: '10px', color: e.type === 'sealed' ? '#ef4444' : '#eab308', marginLeft: 4 }}>
                      {e.type === 'sealed' ? '🔒' : '⚡'}{e.durationTurns}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. 手札表示（現在のプレーヤーが人間の時のみ） */}
      {(() => {
        const currentPlayer = players[currentPlayerIndex];
        if (!currentPlayer?.isHuman || currentPlayer.cards.length === 0) return null;

        const cardEmoji: Record<string, string> = {
          'power_up': '⚔️', 'substitute': '🧸', 'seal': '🏺',
          'blow_away': '🔨', 'paralysis': '⚡', 'time_machine': '⌚',
        };

        return (
          <div className="sidebar-section">
            <h2 className="section-title">手札 ({currentPlayer.cards.length})</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {currentPlayer.cards.map((card: Card) => (
                <div key={card.id} style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: card.isPassive ? 'rgba(59,130,246,0.15)' : 'var(--surface2)',
                  border: selectedCard?.id === card.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                  cursor: card.isPassive ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
                  onClick={() => {
                    if (card.isPassive || phase !== 'playing') return;
                    setSelectedCard(selectedCard?.id === card.id ? null : card);
                  }}
                >
                  <span style={{ fontSize: 20 }}>{cardEmoji[card.type] || '🃏'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{card.name}</div>
                    <div style={{ fontSize: 11, color: '#aaa' }}>{card.description}</div>
                  </div>
                  {card.isPassive && <span style={{ fontSize: 10, color: '#3b82f6' }}>自動</span>}
                </div>
              ))}
            </div>

            {/* ターゲット選択 UI */}
            {selectedCard && !selectedCard.isPassive && phase === 'playing' && (
              <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--accent)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  {selectedCard.type === 'time_machine' ? '「タイムマシン」を使う？' : '誰に使う？'}
                </div>
                {selectedCard.type === 'time_machine' ? (
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%' }}
                    onClick={() => {
                      useCard(selectedCard.id);
                      setSelectedCard(null);
                    }}
                  >使う！</button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {players.filter(p => p.id !== currentPlayer.id).map(p => (
                      <button
                        key={p.id}
                        className="btn btn-secondary btn-sm"
                        style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
                        onClick={() => {
                          useCard(selectedCard.id, p.id);
                          setSelectedCard(null);
                        }}
                      >
                        <span style={{ width: 14, height: 14, borderRadius: '50%', background: COLOR_HEX[p.color], display: 'inline-block' }} />
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', marginTop: 6 }}
                  onClick={() => setSelectedCard(null)}
                >キャンセル</button>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
