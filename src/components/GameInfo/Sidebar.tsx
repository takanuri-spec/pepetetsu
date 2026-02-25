import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { calcDistancesFromTarget } from '../../game/engine';
import { COLOR_HEX } from '../../game/types';
import type { MapNode, StationProperty } from '../../game/types';

const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export function Sidebar() {
  const state = useGameStore();
  const {
    players,
    currentPlayerIndex,
    round,
    totalRounds,
    cycleLength,
    destinationNodeId,
    diceValue,
    phase,
    map,
    rollDiceAction,
    resetGame,
    isRollingDice,
    rollingDiceDisplay,
  } = state;

  const [viewingPlayerId, setViewingPlayerId] = useState<string | null>(null);

  const distancesFromGoal = useMemo(() => {
    if (destinationNodeId == null) return {};
    return calcDistancesFromTarget(destinationNodeId, map);
  }, [destinationNodeId, map]);

  if (phase === 'lobby') return null;

  const currentPlayer = players[currentPlayerIndex];
  const destinationNode = destinationNodeId != null ? map.nodes[destinationNodeId] : null;
  const cycleNum = Math.floor((round - 1) / cycleLength) + 1;
  const nextSettlementRound = Math.ceil(round / cycleLength) * cycleLength;
  const canRoll = phase === 'playing' && currentPlayer.isHuman && !isRollingDice;

  const sortedByAssets = [...players].sort((a, b) => b.totalAssets - a.totalAssets);
  const displayDiceVal = isRollingDice ? rollingDiceDisplay : diceValue;

  return (
    <div className="game-sidebar">
      {/* Round info */}
      <div className="sidebar-section">
        <div className="sidebar-title">ラウンド</div>
        <div className="round-number">Round {round} / {totalRounds}</div>
        <div className="round-sub">
          第{cycleNum}サイクル ─ 次の決算: Round {Math.min(nextSettlementRound, totalRounds)}
        </div>
      </div>

      {/* Destination */}
      {destinationNode && (
        <div className="sidebar-section">
          <div className="sidebar-title">現在の目的地</div>
          <div className="destination-badge">
            <span className="destination-star">⭐</span>
            <div>
              <div style={{ fontWeight: 700 }}>{destinationNode.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                到達ボーナス ¥{state.settings.destinationBonusAmount}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rankings */}
      <div className="sidebar-section" style={{ flex: 1 }}>
        <div className="sidebar-title">ランキング</div>
        {sortedByAssets.map((player, rank) => {
          const isActive = player.id === currentPlayer.id;
          const isCurrentTurn = player.id === players[currentPlayerIndex].id;
          return (
            <div
              key={player.id}
              className={`player-card ${isActive ? 'active' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setViewingPlayerId(player.id)}
            >
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', width: 16 }}>
                {rank + 1}
              </span>
              <div
                className="player-avatar"
                style={{ background: COLOR_HEX[player.color] }}
              >
                {player.name[0]}
              </div>
              <div className="player-info">
                <div className="player-name">{player.name}</div>
                <div className="player-money">¥{player.money.toLocaleString()}</div>
                <div className="player-assets">
                  総資産 ¥{player.totalAssets.toLocaleString()}
                  {player.ownedProperties.length > 0 && (
                    <span style={{ marginLeft: 4 }}>
                      ({player.ownedProperties.length}件)
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--accent)', marginTop: 2, fontWeight: 'bold' }}>
                  🎯 目的地まで {distancesFromGoal[player.position] ?? '-'} マス
                </div>
              </div>
              {isCurrentTurn && (
                <span className="turn-badge">
                  {currentPlayer.isHuman ? '▶ あなた' : '🤖 CPU'}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Action panel */}
      <div className="action-panel">
        <div className="current-player-tag">現在のターン</div>
        <div className="current-player-name" style={{ color: COLOR_HEX[currentPlayer.color] }}>
          {currentPlayer.name}
        </div>

        {displayDiceVal != null && (
          <div className="dice-display">
            <div
              className={`dice-face ${isRollingDice ? 'dice-rolling' : ''}`}
              style={{ color: displayDiceVal === 1 ? '#ef4444' : '#000' }}
            >
              {DICE_FACES[displayDiceVal]}
            </div>
            <div className="dice-label">
              {isRollingDice ? '判定中...' : `サイコロ: ${displayDiceVal}`}
            </div>
          </div>
        )}

        {canRoll && (
          <button
            className="btn-roll"
            onClick={rollDiceAction}
            disabled={!canRoll}
          >
            🎲 サイコロを振る
          </button>
        )}

        {!currentPlayer.isHuman && phase === 'playing' && !isRollingDice && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '8px 0' }}>
            🤖 CPU が考え中...
          </div>
        )}

        {phase !== 'playing' && phase !== 'branch_selection' && !isRollingDice && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '8px 0' }}>
            イベント処理中...
          </div>
        )}

        <button
          className="btn btn-secondary btn-sm"
          onClick={resetGame}
          style={{ width: '100%', marginTop: 8 }}
        >
          タイトルへ戻る
        </button>
      </div>

      {/* Owned Properties Modal */}
      <AnimatePresence>
        {viewingPlayerId && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setViewingPlayerId(null)}
          >
            <motion.div
              className="modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: 500, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
            >
              {(() => {
                const p = players.find(p => p.id === viewingPlayerId);
                if (!p) return null;
                const ownedProps = p.ownedProperties.map(propId => {
                  for (const node of Object.values(map.nodes)) {
                    const matchedProp = (node.properties ?? []).find(pr => pr.id === propId);
                    if (matchedProp) return { node, prop: matchedProp };
                  }
                  return null;
                }).filter(Boolean) as { node: MapNode; prop: StationProperty }[];

                const totalIncome = ownedProps.reduce((sum, item) => sum + item.prop.baseIncome, 0);
                const totalValue = ownedProps.reduce((sum, item) => sum + item.prop.price, 0);

                return (
                  <>
                    <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: COLOR_HEX[p.color], display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12 }}>
                        {p.name[0]}
                      </div>
                      {p.name} の所有物件
                    </div>

                    <div style={{ marginBottom: 12, fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>所有数: {ownedProps.length}件 (¥{totalValue.toLocaleString()})</span>
                      <span style={{ color: '#22c55e' }}>決算収益: ¥{totalIncome.toLocaleString()}</span>
                    </div>

                    <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {ownedProps.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                          所有している物件はありません
                        </div>
                      ) : (
                        ownedProps.map((item, i) => (
                          <div key={i} style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontSize: '0.8rem', color: item.node.color ?? 'var(--text-muted)' }}>{item.node.name}駅</div>
                              <div style={{ fontWeight: 'bold' }}>{item.prop.name}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.85rem' }}>価格: ¥{item.prop.price.toLocaleString()}</div>
                              <div style={{ fontSize: '0.85rem', color: '#22c55e' }}>収益: ¥{item.prop.baseIncome.toLocaleString()}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="modal-actions" style={{ marginTop: 16 }}>
                      <button className="btn btn-secondary" onClick={() => setViewingPlayerId(null)} style={{ width: '100%' }}>
                        閉じる
                      </button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
