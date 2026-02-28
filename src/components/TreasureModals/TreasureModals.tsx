import { motion, AnimatePresence } from 'framer-motion';
import { useTreasureStore } from '../../store/treasureStore';
import { COLOR_HEX } from '../../game/types';
import type { GameToast } from '../../game/treasureTypes';

// ========================================
// Toast通知コンポーネント（採掘・略奪・カード取得）
// ========================================

function ToastItem({ toast }: { toast: GameToast }) {
    const borderAccent =
        toast.category === 'mining' ? '#22c55e'
            : toast.category === 'steal' ? '#ef4444'
                : '#3b82f6';

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: -24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                background: 'rgba(18, 18, 28, 0.94)',
                backdropFilter: 'blur(12px)',
                border: `1.5px solid ${borderAccent}44`,
                borderLeft: `4px solid ${borderAccent}`,
                borderRadius: 14,
                padding: '10px 16px 10px 12px',
                boxShadow: `0 6px 28px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)`,
                minWidth: 240,
                maxWidth: 320,
                pointerEvents: 'none',
            }}
        >
            {/* 絵文字アイコン */}
            <span style={{ fontSize: '1.5rem', lineHeight: 1.2, flexShrink: 0 }}>
                {toast.emoji}
            </span>

            <div style={{ flex: 1, overflow: 'hidden' }}>
                {/* タイトル（プレイヤー名 + 結果種別） */}
                <div style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: toast.playerColor,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: 1.3,
                }}>
                    {toast.title}
                </div>

                {/* 詳細メッセージ */}
                <div style={{
                    fontSize: '0.75rem',
                    color: 'rgba(255,255,255,0.65)',
                    marginTop: 2,
                    lineHeight: 1.4,
                }}>
                    {toast.message}
                </div>
            </div>

            {/* 進行バー（3秒で自動消去を視覚化） */}
            <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 3, ease: 'linear' }}
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    background: borderAccent,
                    borderRadius: '0 0 14px 14px',
                    transformOrigin: 'left',
                    opacity: 0.5,
                }}
            />
        </motion.div>
    );
}

// ========================================
// メインコンポーネント
// ========================================

export function TreasureModals() {
    const { phase, players, winner, resetGame, toasts } = useTreasureStore();

    const overlayVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
    };
    const modalVariants = {
        hidden: { opacity: 0, scale: 0.85, y: 20 },
        visible: { opacity: 1, scale: 1, y: 0 },
    };

    return (
        <>
            {/* ===== トーストスタック（画面上部） ===== */}
            <div
                style={{
                    position: 'absolute',
                    top: 16,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1100,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    alignItems: 'center',
                    pointerEvents: 'none',
                }}
            >
                <AnimatePresence mode="sync">
                    {toasts.map(t => (
                        <ToastItem key={t.id} toast={t} />
                    ))}
                </AnimatePresence>
            </div>

            {/* ===== カード対象マス選択ヘルプバナー ===== */}
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
                            pointerEvents: 'none',
                        }}
                    >
                        マップ上のマスをタップして指定してください
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ===== ゲーム終了モーダル ===== */}
            <AnimatePresence>
                {phase === 'game_over' && winner && (
                    <motion.div
                        className="modal-overlay"
                        variants={overlayVariants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        style={{ zIndex: 1000 }}
                    >
                        <motion.div
                            className="modal"
                            variants={modalVariants}
                            initial="hidden"
                            animate="visible"
                            exit="hidden"
                            style={{ textAlign: 'center', maxWidth: 450 }}
                        >
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
