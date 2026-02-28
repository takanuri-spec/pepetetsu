import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './ManualModal.css';

interface ManualModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultMode?: 'classic' | 'treasure';
}

export function ManualModal({ isOpen, onClose, defaultMode = 'treasure' }: ManualModalProps) {
    const [activeMode, setActiveMode] = useState<'classic' | 'treasure'>(defaultMode);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="manual-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <motion.div
                        className="manual-content"
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="manual-header">
                            <div className="manual-tabs">
                                <button
                                    className={`manual-tab ${activeMode === 'classic' ? 'manual-tab--active' : ''}`}
                                    onClick={() => setActiveMode('classic')}
                                >
                                    🗾 マップすごろく
                                </button>
                                <button
                                    className={`manual-tab ${activeMode === 'treasure' ? 'manual-tab--active' : ''}`}
                                    onClick={() => setActiveMode('treasure')}
                                >
                                    🏴‍☠️ トレジャーハント
                                </button>
                            </div>
                            <button className="manual-close-btn" onClick={onClose}>
                                とじる ✕
                            </button>
                        </div>

                        <div className="manual-body" style={{ padding: '0' }}>
                            <AnimatePresence mode="wait">
                                {activeMode === 'classic' ? (
                                    <motion.img
                                        key="classic"
                                        src="/manual_classic_guide.png"
                                        alt="マップすごろく攻略ガイド"
                                        className="manual-guide-img"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        transition={{ duration: 0.2 }}
                                        style={{ margin: '0', display: 'block', width: '100%', height: 'auto' }}
                                    />
                                ) : (
                                    <motion.img
                                        key="treasure"
                                        src="/manual_guide.jpg"
                                        alt="トレジャーハント攻略ガイド"
                                        className="manual-guide-img"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ duration: 0.2 }}
                                        style={{ margin: '0', display: 'block', width: '100%', height: 'auto' }}
                                    />
                                )}
                            </AnimatePresence>
                        </div>

                        <div className="manual-footer">
                            ぺぺテツ 攻略ガイド — 家族みんなであそぼう！
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
