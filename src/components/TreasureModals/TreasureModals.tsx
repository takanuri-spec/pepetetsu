import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTreasureStore } from '../../store/treasureStore';
import { COLOR_HEX } from '../../game/types';

const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
};

const modalVariants = {
    hidden: { opacity: 0, scale: 0.85, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0 },
};

export function TreasureModals() {
    const state = useTreasureStore();

    const {
        phase,
        players,
        currentPlayerIndex,
        map,
        currentMiningResult,
        currentStealBattle,
        currentCardResult,
        acknowledgeMining,
        acknowledgeSteal,
        acknowledgeCard,
        winner,
        resetGame,
        diceValue,
        routeInfos,
        selectRoute,
        setHoveredRoute
    } = state;

    const currentPlayer = players[currentPlayerIndex];
    const isCpuTurn = currentPlayer && !currentPlayer.isHuman;

    // CPUプレーヤーのダイアログは2秒後に自動閉じる
    useEffect(() => {
        if (!isCpuTurn) return;
        if (phase === 'mining_result' && currentMiningResult) {
            const t = setTimeout(() => acknowledgeMining(), 2000);
            return () => clearTimeout(t);
        }
    }, [phase, isCpuTurn, currentMiningResult, acknowledgeMining]);

    useEffect(() => {
        if (!isCpuTurn) return;
        if (phase === 'steal_result' && currentStealBattle) {
            const t = setTimeout(() => acknowledgeSteal(), 2000);
            return () => clearTimeout(t);
        }
    }, [phase, isCpuTurn, currentStealBattle, acknowledgeSteal]);

    useEffect(() => {
        if (!isCpuTurn) return;
        if (phase === 'card_result' && currentCardResult) {
            const t = setTimeout(() => acknowledgeCard(), 2000);
            return () => clearTimeout(t);
        }
    }, [phase, isCpuTurn, currentCardResult, acknowledgeCard]);

    // Touch UI handling
    const [hasHover, setHasHover] = useState(() =>
        typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches
    );
    const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

    useEffect(() => {
        const mq = window.matchMedia('(hover: hover)');
        const handler = (e: MediaQueryListEvent) => setHasHover(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    return (
        <>
            {/* Route Selection */}
            <AnimatePresence>
                {phase === 'route_selection' && (
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
                            {[...routeInfos].map(info => {
                                const landingNode = map.nodes[info.landingNodeId];
                                const midNodes = info.path.slice(1, -1)
                                    .map(id => map.nodes[id])
                                    .filter(Boolean);

                                const isSelected = selectedRouteId === info.id;

                                return (
                                    <button
                                        key={info.id}
                                        className={`btn-branch ${isSelected ? 'selected' : ''}`}
                                        onClick={() => {
                                            if (hasHover) {
                                                selectRoute(info.id);
                                            } else {
                                                if (isSelected) {
                                                    selectRoute(info.id);
                                                } else {
                                                    setSelectedRouteId(info.id);
                                                    setHoveredRoute(info.id);
                                                }
                                            }
                                        }}
                                        onMouseEnter={() => {
                                            if (hasHover) setHoveredRoute(info.id);
                                        }}
                                        onMouseLeave={() => {
                                            if (hasHover) setHoveredRoute(null);
                                        }}
                                    >
                                        <div className="branch-card-name">
                                            {landingNode?.name ?? `ノード${info.landingNodeId}`}
                                        </div>

                                        <div className="branch-card-type">
                                            {landingNode?.type === 'bonus' && (
                                                <span style={{ color: '#3b82f6' }}>🃏 カードマス</span>
                                            )}
                                            {landingNode?.type === 'start' && (
                                                <span style={{ color: '#ffd700' }}>🏠 スタート</span>
                                            )}
                                            {(!landingNode || (landingNode.type !== 'bonus' && landingNode.type !== 'start')) && (
                                                <span style={{ color: '#aaa' }}>🪨 採掘マス</span>
                                            )}
                                        </div>

                                        {midNodes.length > 0 && (
                                            <div className="branch-card-via">
                                                経由: {midNodes.slice(0, 3).map(n => n?.name).join(' → ')}
                                                {midNodes.length > 3 && ' …'}
                                            </div>
                                        )}

                                        {!hasHover && isSelected && (
                                            <div style={{ marginTop: 8, padding: '4px 8px', background: 'var(--accent)', color: 'white', borderRadius: 4, fontSize: '0.85rem', fontWeight: 'bold' }}>
                                                決定
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Mining Result Modal */}
            <AnimatePresence>
                {phase === 'mining_result' && currentMiningResult && (
                    <motion.div className="modal-overlay" variants={overlayVariants} initial="hidden" animate="visible" exit="hidden" style={{ zIndex: 1000 }}>
                        <motion.div className="modal" variants={modalVariants} initial="hidden" animate="visible" exit="hidden" style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '3rem', marginBottom: 12 }}>
                                {currentMiningResult.type === 'normal' && '💎'}
                                {currentMiningResult.type === 'rare' && '🌟'}
                                {currentMiningResult.type === 'trap' && '💣'}
                                {currentMiningResult.type === 'empty' && '🪨'}
                                {currentMiningResult.type === 'fail' && '💦'}
                            </div>

                            <div className="modal-title" style={{ fontSize: '1.5rem', marginBottom: 16 }}>採掘結果！</div>

                            <div className="modal-body" style={{ marginBottom: 24 }}>
                                <strong style={{ color: COLOR_HEX[currentPlayer?.color ?? 'red'], fontSize: '1.2rem' }}>
                                    {currentPlayer?.name}
                                </strong>
                                の採掘：<br /><br />

                                {currentMiningResult.type === 'normal' && (
                                    <span style={{ fontSize: '1.4rem', color: '#22c55e', fontWeight: 'bold' }}>お宝を発見！ (所持数 +1)</span>
                                )}
                                {currentMiningResult.type === 'rare' && (
                                    <span style={{ fontSize: '1.4rem', color: 'gold', fontWeight: 'bold' }}>レアなお宝を発見！ (所持数 +2)</span>
                                )}
                                {currentMiningResult.type === 'trap' && (
                                    <span style={{ fontSize: '1.4rem', color: '#ef4444', fontWeight: 'bold' }}>罠にかかった... (所持数 -1)</span>
                                )}
                                {currentMiningResult.type === 'empty' && (
                                    <span style={{ fontSize: '1.2rem', color: '#888' }}>ここはすでに掘り尽くされている...</span>
                                )}
                                {currentMiningResult.type === 'fail' && (
                                    <span style={{ fontSize: '1.2rem', color: '#888', fontWeight: 'bold' }}>何も見つからなかった... (ハズレ)</span>
                                )}
                            </div>

                            <button className="btn btn-primary" onClick={acknowledgeMining} style={{ width: '100%', fontSize: '1.2rem', padding: '12px' }}>
                                確認
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Stealing Result Modal */}
            <AnimatePresence>
                {phase === 'steal_result' && currentStealBattle && (
                    <motion.div className="modal-overlay" variants={overlayVariants} initial="hidden" animate="visible" exit="hidden" style={{ zIndex: 1000 }}>
                        <motion.div className="modal" variants={modalVariants} initial="hidden" animate="visible" exit="hidden" style={{ textAlign: 'center', maxWidth: 450 }}>
                            <div style={{ fontSize: '3rem', marginBottom: 12 }}>
                                {currentStealBattle.substituteUsed ? '🧸' : currentStealBattle.success ? '⚔️' : currentStealBattle.isCounter ? '🛡️' : '💨'}
                            </div>

                            <div className="modal-title" style={{ fontSize: '1.5rem', marginBottom: 16 }}>略奪バトル！</div>

                            <div className="modal-body" style={{ marginBottom: 24 }}>
                                {(() => {
                                    const attacker = players.find(p => p.id === currentStealBattle.attackerId);
                                    const target = players.find(p => p.id === currentStealBattle.targetId);

                                    if (!attacker || !target) return null;

                                    return (
                                        <div>
                                            <strong style={{ color: COLOR_HEX[attacker.color], fontSize: '1.2rem' }}>{attacker.name}</strong>
                                            <span style={{ margin: '0 8px' }}>vs</span>
                                            <strong style={{ color: COLOR_HEX[target.color], fontSize: '1.2rem' }}>{target.name}</strong>
                                            <br /><br />

                                            {currentStealBattle.substituteUsed && (
                                                <span style={{ fontSize: '1.4rem', color: '#3b82f6', fontWeight: 'bold', display: 'inline-block', marginTop: 8 }}>
                                                    身代わり人形が身代わりに！<br /><span style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 'normal' }}>{target.name}の身代わり人形が略奪を防いだ！</span>
                                                </span>
                                            )}
                                            {!currentStealBattle.substituteUsed && currentStealBattle.success && (
                                                <span style={{ fontSize: '1.4rem', color: '#22c55e', fontWeight: 'bold', display: 'inline-block', marginTop: 8 }}>
                                                    略奪成功！<br /><span style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 'normal' }}>{target.name}からお宝を1つ奪った！</span>
                                                </span>
                                            )}
                                            {!currentStealBattle.substituteUsed && currentStealBattle.isCounter && (
                                                <span style={{ fontSize: '1.4rem', color: '#ef4444', fontWeight: 'bold', display: 'inline-block', marginTop: 8 }}>
                                                    返り討ち！<br /><span style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 'normal' }}>{target.name}に反撃され、お宝を1つ奪われた！</span>
                                                </span>
                                            )}
                                            {!currentStealBattle.substituteUsed && !currentStealBattle.success && !currentStealBattle.isCounter && (
                                                <span style={{ fontSize: '1.2rem', color: '#aaa', display: 'inline-block', marginTop: 8 }}>
                                                    略奪失敗... お互いの距離を保った。
                                                </span>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>

                            <button className="btn btn-primary" onClick={acknowledgeSteal} style={{ width: '100%', fontSize: '1.2rem', padding: '12px' }}>
                                確認
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Card Result Modal */}
            <AnimatePresence>
                {phase === 'card_result' && currentCardResult && (
                    <motion.div className="modal-overlay" variants={overlayVariants} initial="hidden" animate="visible" exit="hidden" style={{ zIndex: 1000 }}>
                        <motion.div className="modal" variants={modalVariants} initial="hidden" animate="visible" exit="hidden" style={{ textAlign: 'center', maxWidth: 450 }}>
                            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🃏</div>
                            <div className="modal-title" style={{ fontSize: '1.5rem', marginBottom: 16 }}>カードをゲット！</div>
                            <div className="modal-body" style={{ marginBottom: 24 }}>
                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#3b82f6', marginBottom: 8 }}>
                                    {currentCardResult.card.name}
                                </div>
                                <div style={{ fontSize: '1.1rem', color: '#ccc' }}>
                                    {currentCardResult.card.description}
                                </div>
                            </div>
                            <button className="btn btn-primary" onClick={acknowledgeCard} style={{ width: '100%', fontSize: '1.2rem', padding: '12px' }}>
                                手に入れる
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Game Over Modal */}
            <AnimatePresence>
                {phase === 'game_over' && winner && (
                    <motion.div className="modal-overlay" variants={overlayVariants} initial="hidden" animate="visible" exit="hidden" style={{ zIndex: 1000 }}>
                        <motion.div className="modal" variants={modalVariants} initial="hidden" animate="visible" exit="hidden" style={{ textAlign: 'center', maxWidth: 450 }}>
                            <div style={{ fontSize: '4rem', marginBottom: 16 }}>👑</div>
                            <div className="modal-title" style={{ fontSize: '2rem', marginBottom: 24 }}>ゲーム終了！</div>
                            <div className="modal-body" style={{ fontSize: '1.2rem' }}>
                                お宝ハントの勝者は...<br /><br />
                                <strong style={{ fontSize: '1.8rem', color: COLOR_HEX[winner.color] }}>{winner.name}</strong>
                                <br /><br />
                                お宝を <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'gold' }}>{winner.treasures}</span> 個 集めました！
                            </div>
                            <button className="btn btn-primary" onClick={resetGame} style={{ width: '100%', marginTop: 24, fontSize: '1.2rem', padding: '16px' }}>
                                ロビーに戻る
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
