import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { COLOR_HEX } from '../../game/types';
import type { NodeActionInfo, Player, GameMap } from '../../game/types';

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.85, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0 },
};

export function Modals() {
  const state = useGameStore();
  if (state.phase === 'lobby') return null;

  const {
    phase,
    players,
    currentPlayerIndex,
    map,
    currentNodeAction,
    lastSettlement,
    winner,
    destinationNodeId,
    diceValue,
    routeInfos,
    buyProperty,
    skipBuy,
    acknowledgeAction,
    selectRoute,
    setHoveredRoute,
    resetGame,
    settings,
  } = state;

  const currentPlayer = players[currentPlayerIndex];
  const sortedByAssets = [...players].sort((a, b) => b.totalAssets - a.totalAssets);

  return (
    <>
      {/* Branch Selection */}
      <AnimatePresence>
        {phase === 'branch_selection' && (
          <motion.div
            className="branch-panel"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <div className="branch-header">
              <div className="branch-title">🗺️ ルート決定 — どこへ進む？</div>
              {diceValue != null && (
                <div className="branch-dice">🎲 {diceValue} マス進む</div>
              )}
            </div>
            <div className="branch-buttons">
              {routeInfos.map(info => {
                const landingNode = map.nodes[info.landingNodeId];
                const midNodes = info.path.slice(1, -1)
                  .map(id => map.nodes[id])
                  .filter(Boolean);
                const isNear = info.distToDestination != null && info.distToDestination <= 4;
                const isDestination = info.landingNodeId === destinationNodeId;

                return (
                  <button
                    key={info.id}
                    className="btn-branch"
                    onClick={() => selectRoute(info.id)}
                    onMouseEnter={() => setHoveredRoute(info.id)}
                    onMouseLeave={() => setHoveredRoute(null)}
                  >
                    <div className="branch-card-name">
                      {isDestination && <span style={{ marginRight: 4 }}>⭐</span>}
                      {landingNode?.name ?? `ノード${info.landingNodeId}`}
                    </div>

                    <div className="branch-card-type">
                      {landingNode?.type === 'property' && (
                        <>🏘️ ¥{landingNode.properties?.reduce((sum, p) => sum + p.price, 0).toLocaleString()} <span style={{ color: '#22c55e' }}>収益¥{landingNode.properties?.reduce((sum, p) => sum + p.baseIncome, 0).toLocaleString()}</span></>
                      )}
                      {landingNode?.type === 'bonus' && (
                        <span style={{ color: '#22c55e' }}>⭐ +¥{landingNode.amount?.toLocaleString()}</span>
                      )}
                      {landingNode?.type === 'penalty' && (
                        <span style={{ color: '#ef4444' }}>💀 -¥{landingNode.amount?.toLocaleString()}</span>
                      )}
                      {landingNode?.type === 'start' && (
                        <span style={{ color: '#ffd700' }}>🏠 スタート</span>
                      )}
                    </div>

                    <div className={`branch-card-dist${isNear ? ' near' : ''}`}>
                      🎯 {isDestination
                        ? '目的地！'
                        : info.distToDestination != null
                          ? `目的地まで ${info.distToDestination} マス`
                          : '目的地: 遠回り'}
                    </div>

                    {midNodes.length > 0 && (
                      <div className="branch-card-via">
                        経由: {midNodes.slice(0, 3).map(n => n?.name).join(' → ')}
                        {midNodes.length > 3 && ' …'}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Property Action Modal */}
      <AnimatePresence>
        {phase === 'property_action' && currentNodeAction && (
          <motion.div
            className="modal-overlay"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            <motion.div
              className={`modal ${map.nodes[currentNodeAction.nodeId]?.type === 'property' ? 'modal-wide' : ''}`}
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              style={{ padding: map.nodes[currentNodeAction.nodeId]?.type === 'property' ? '24px 20px' : '' }}
            >
              <PropertyActionContent
                action={currentNodeAction}
                currentPlayer={currentPlayer}
                players={players}
                map={map}
                buyProperty={buyProperty}
                skipBuy={skipBuy}
                acknowledgeAction={acknowledgeAction}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Destination Reached */}
      <AnimatePresence>
        {phase === 'destination_reached' && (
          <motion.div
            className="modal-overlay"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            <motion.div
              className="modal"
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              style={{ textAlign: 'center' }}
            >
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎉</div>
              <div className="modal-title">目的地に到達！</div>
              <div className="modal-body">
                <strong style={{ color: COLOR_HEX[currentPlayer.color] }}>
                  {currentPlayer.name}
                </strong>{' '}
                が{' '}
                <strong style={{ color: 'var(--accent2)' }}>
                  {destinationNodeId != null ? map.nodes[destinationNodeId]?.name : ''}
                </strong>{' '}
                に到達しました！
                <span className="modal-price">+¥{settings.destinationBonusAmount.toLocaleString()}</span>
              </div>
              <button className="btn btn-primary" onClick={acknowledgeAction} style={{ width: '100%' }}>
                続ける
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settlement */}
      <AnimatePresence>
        {phase === 'settlement' && lastSettlement && (
          <motion.div
            className="modal-overlay"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            <motion.div
              className="modal"
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              style={{ maxWidth: 520 }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>💰 決算</div>
              <div className="modal-title">第{lastSettlement.cycleNumber}サイクル 決算</div>
              <div className="modal-body">物件収益を受け取りました</div>

              <table className="settlement-table">
                <thead>
                  <tr>
                    <th>プレイヤー</th>
                    <th>物件数</th>
                    <th>収益</th>
                  </tr>
                </thead>
                <tbody>
                  {lastSettlement.incomes.map(income => {
                    const player = players.find(p => p.id === income.playerId);
                    if (!player) return null;
                    return (
                      <tr key={income.playerId}>
                        <td>
                          <span style={{
                            display: 'inline-block',
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: COLOR_HEX[player.color],
                            marginRight: 6,
                          }} />
                          {player.name}
                        </td>
                        <td>{income.breakdown.length}件</td>
                        <td className="settlement-total">
                          {income.amount > 0 ? `+¥${income.amount.toLocaleString()}` : '¥0'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <button className="btn btn-primary" onClick={acknowledgeAction} style={{ width: '100%' }}>
                続ける
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over */}
      <AnimatePresence>
        {phase === 'game_over' && winner && (
          <motion.div
            className="game-over-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="game-over-card"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <div className="game-over-trophy">🏆</div>
              <div className="game-over-winner" style={{ color: COLOR_HEX[winner.color] }}>
                {winner.name} の勝利！
              </div>
              <div className="game-over-sub">
                総資産 ¥{winner.totalAssets.toLocaleString()}
              </div>

              <ul className="ranking-list">
                {sortedByAssets.map((player, rank) => (
                  <li key={player.id} className={`ranking-item ${rank === 0 ? 'rank-1' : ''}`}>
                    <span className="ranking-rank">{rank + 1}位</span>
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: COLOR_HEX[player.color],
                        display: 'inline-block',
                      }}
                    />
                    <span className="ranking-name">{player.name}</span>
                    <span className="ranking-assets">¥{player.totalAssets.toLocaleString()}</span>
                  </li>
                ))}
              </ul>

              <button className="btn btn-primary" onClick={resetGame} style={{ width: '100%' }}>
                タイトルへ戻る
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ========== Property Action Content ==========

interface PropertyActionContentProps {
  action: NodeActionInfo | null;
  currentPlayer: Player;
  players: Player[];
  map: GameMap;
  buyProperty: (propId?: string) => void;
  skipBuy: () => void;
  acknowledgeAction: () => void;
}

function PropertyActionContent({
  action,
  currentPlayer,
  players,
  map,
  buyProperty,
  skipBuy,
  acknowledgeAction,
}: PropertyActionContentProps) {
  if (!action) return null;
  const node = map.nodes[action.nodeId];
  if (!node) return null;

  // Bonus tile
  if (node.type === 'bonus') {
    return (
      <>
        <div style={{ fontSize: '2rem', marginBottom: 8 }}>⭐</div>
        <div className="modal-title">ボーナス！</div>
        <div className="modal-body">
          <strong style={{ color: COLOR_HEX[currentPlayer.color] }}>{currentPlayer.name}</strong>{' '}
          が {node.name} に止まりました。
          <span className="modal-price">+¥{node.amount?.toLocaleString()}</span>
        </div>
        <button className="btn btn-primary" onClick={acknowledgeAction} style={{ width: '100%' }}>
          受け取る
        </button>
      </>
    );
  }

  // Penalty tile
  if (node.type === 'penalty') {
    return (
      <>
        <div style={{ fontSize: '2rem', marginBottom: 8 }}>💀</div>
        <div className="modal-title">ペナルティ！</div>
        <div className="modal-body">
          <strong style={{ color: COLOR_HEX[currentPlayer.color] }}>{currentPlayer.name}</strong>{' '}
          が {node.name} に止まりました。
          <span className="modal-price" style={{ color: '#ef4444' }}>¥{node.amount?.toLocaleString()}</span>
        </div>
        <button className="btn btn-primary" onClick={acknowledgeAction} style={{ width: '100%' }}>
          OK
        </button>
      </>
    );
  }

  // Property list and Rent Payment
  if (node.type === 'property') {
    const totalRent = action.rentPayments.reduce((sum, rp) => sum + rp.amount, 0);

    if (!action.canBuy && action.rentPayments.length > 0) {
      // Just paid rent
      return (
        <>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>💸</div>
          <div className="modal-title">通行料を支払いました！</div>
          <div className="modal-body">
            <strong style={{ color: COLOR_HEX[currentPlayer.color] }}>{currentPlayer.name}</strong> が {node.name} に止まり、<br />
            合計 <span className="modal-price" style={{ color: '#ef4444' }}>-¥{totalRent.toLocaleString()}</span> を支払いました。
          </div>
          <button className="btn btn-primary" onClick={acknowledgeAction} style={{ width: '100%' }}>
            OK
          </button>
        </>
      );
    }

    // Property List
    return (
      <>
        <div style={{ fontSize: '2rem', marginBottom: 8 }}>🏘️</div>
        <div className="modal-title">{node.name} — 物件リスト</div>
        <div className="modal-body">
          <div style={{ marginBottom: 16 }}>
            {action.rentPayments.length > 0 && (
              <div style={{ color: '#ef4444', marginBottom: 8, fontSize: '0.85rem' }}>
                ⚠️ 他プレイヤーの物件があったため、通行料 ¥{totalRent.toLocaleString()} を支払いました
              </div>
            )}
            所持金: <span className="modal-price">¥{currentPlayer.money.toLocaleString()}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto', padding: '0 4px' }}>
            {node.properties?.map(prop => {
              const owner = players.find(p => p.ownedProperties.includes(prop.id));
              const canAfford = currentPlayer.money >= prop.price;
              const isOwned = !!owner;

              return (
                <div key={prop.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '4px' }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 'bold' }}>{prop.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      収益: ¥{prop.baseIncome.toLocaleString()}
                    </div>
                  </div>
                  {isOwned ? (
                    <div style={{ fontSize: '0.85rem', color: COLOR_HEX[owner.color] }}>
                      {owner.name} 所有
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.85rem', color: canAfford ? 'white' : '#ef4444' }}>
                        ¥{prop.price.toLocaleString()}
                      </span>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                        disabled={!canAfford}
                        onClick={() => buyProperty(prop.id)}
                      >
                        購入
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={skipBuy} style={{ width: '100%' }}>
            終了して進む
          </button>
        </div>
      </>
    );
  }

  return null;
}
