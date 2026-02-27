import { useEffect } from 'react';
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
        currentMiningResult,
        currentStealBattle,
        currentCardResult,
        acknowledgeMining,
        acknowledgeSteal,
        acknowledgeCard,
        winner,
        resetGame,
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

    return (
        <>


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
                                    <span style={{ fontSize: '1.4rem', color: '#ef4444', fontWeight: 'bold' }}>
                                        {currentPlayer?.treasures === 0
                                            ? "罠にかかったが、元々お宝を持っていなかった..."
                                            : "罠にかかった... (所持数 -1)"}
                                    </span>
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
                                                    返り討ち！<br />
                                                    <span style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 'normal' }}>
                                                        {attacker.treasures > 0
                                                            ? `${target.name}に反撃され、お宝を1つ奪われた！`
                                                            : `${target.name}に反撃されたが、お宝を持っていなかったので何も奪われなかった！`}
                                                    </span>
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

            {/* Card Target Selection Help Overlay */}
            <AnimatePresence>
                {phase === 'card_target_selection' && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        style={{
                            position: 'absolute',
                            top: 20,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: 'var(--accent)',
                            color: 'white',
                            padding: '12px 24px',
                            borderRadius: '30px',
                            fontSize: '1.2rem',
                            fontWeight: 'bold',
                            zIndex: 1000,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            pointerEvents: 'none'
                        }}
                    >
                        マップ上のマスをタップして指定してください
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
                            <div className="modal-body" style={{ fontSize: '1.2rem', padding: '0 16px' }}>
                                <div style={{ marginBottom: 20 }}>
                                    お宝ハントの勝者は...<br /><br />
                                    <strong style={{ fontSize: '1.8rem', color: COLOR_HEX[winner.color] }}>{winner.name}</strong>
                                    <br /><br />
                                    お宝を <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'gold' }}>{winner.treasures}</span> 個 集めました！
                                </div>
                                <div style={{ borderTop: '1px solid #444', paddingTop: 16 }}>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: 12 }}>最終結果（ランキング）</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
                                        {[...players].sort((a, b) => b.treasures - a.treasures).map((p, i) => (
                                            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: 8 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ fontWeight: 'bold', width: 20 }}>{i + 1}位</span>
                                                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: COLOR_HEX[p.color], display: 'inline-block' }} />
                                                    {p.name}
                                                </div>
                                                <div style={{ fontWeight: 'bold', color: 'gold' }}>{p.treasures} 個</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
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
