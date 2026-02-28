import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { useTreasureStore } from '../../store/treasureStore';
import type { MapNode, MapEdge } from '../../game/types';
import { COLOR_HEX } from '../../game/types';
import { calcMiningChance } from '../../game/treasureEngine';
import type { Card } from '../../game/treasureTypes';

// 描画設定のトグル
export const USE_ORTHOGONAL_LINES = true;

function createOrthogonalPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  if (dx > dy) {
    return `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2}`;
  } else {
    return `M ${x1} ${y1} L ${x1} ${y2} L ${x2} ${y2}`;
  }
}

const NODE_RADIUS: Record<string, number> = {
  start: 16,
  property: 14,
  bonus: 12,
  penalty: 12,
};

function getNodeDisplay(node: MapNode) {
  if (node.type === 'start') return { emoji: '🏠', label: '' };
  if (node.type === 'bonus' || node.type === 'penalty') return { emoji: '🃏', label: '' };
  return { emoji: '🪨', label: '' };
}

function getPlayerOffset(playerIndex: number, totalAtNode: number): { dx: number; dy: number } {
  if (totalAtNode <= 1) return { dx: 0, dy: 0 };
  const baseOffset = 10;
  const angle = (playerIndex / totalAtNode) * Math.PI * 2;
  return { dx: Math.cos(angle) * baseOffset, dy: Math.sin(angle) * baseOffset };
}

// カードアイコン定義
const CARD_EMOJI: Record<string, string> = {
  'power_up': '⚔️',
  'substitute': '🧸',
  'seal': '🏺',
  'blow_away': '🔨',
  'paralysis': '⚡',
  'phone_fraud': '📱',
  'dice_1': '1️⃣',
  'dice_10': '🔟',
};

// マウス座標の角度をもとに、直前ノードから対象ノードへ向かうルートの中で最も近いものを選択する
const getRouteByMouseAngle = (e: React.MouseEvent<SVGGElement>, routes: any[], currentMap: any, targetNode: any) => {
  if (routes.length <= 1) return routes[0];

  let centerX = 0;
  let centerY = 0;

  // テキスト等に引っ張られる getBoundingClientRect() のズレを回避し、
  // ノードの真の中心座標(targetNode.x, targetNode.y)の画面上での位置を逆算する
  const svgGroup = e.currentTarget;
  const svgElement = svgGroup.ownerSVGElement;

  if (svgElement) {
    const pt = svgElement.createSVGPoint();
    pt.x = targetNode.x;
    pt.y = targetNode.y;
    const ctm = svgGroup.getScreenCTM();
    if (ctm) {
      const screenPt = pt.matrixTransform(ctm);
      centerX = screenPt.x;
      centerY = screenPt.y;
    }
  }

  // 万が一取得失敗した場合はgetBoundingClientRect（下方向にズレる）をフォールバックに
  if (centerX === 0 && centerY === 0) {
    const rect = e.currentTarget.getBoundingClientRect();
    centerX = rect.left + rect.width / 2;
    centerY = rect.top + rect.height / 2;
  }

  const dx = e.clientX - centerX;
  const dy = e.clientY - centerY;
  const mouseAngle = Math.atan2(dy, dx);

  let bestRoute = routes[0];
  let minDiff = Infinity;

  for (const r of routes) {
    const pNodeId = r.path.length >= 2 ? r.path[r.path.length - 2] : r.path[0];
    const pNode = currentMap.nodes[pNodeId] || targetNode;
    // 対象ノードから直前ノードへの角度を求めて、マウスの角度と比較
    const rAngle = Math.atan2(pNode.y - targetNode.y, pNode.x - targetNode.x);

    let diff = Math.abs(rAngle - mouseAngle);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;

    if (diff < minDiff) {
      minDiff = diff;
      bestRoute = r;
    }
  }
  return bestRoute;
};

export function TreasureBoard({ isMobile }: { isMobile?: boolean }) {
  const state = useTreasureStore();
  const { players, currentPlayerIndex, map, movingPath, isAnimating, routeInfos, hoveredRouteId, minedNodes, phase, cardPopupPlayerId, selectedCardId, openCardPopup, closeCardPopup, setSelectedCardId } = state;
  const svgRef = useRef<SVGSVGElement>(null);
  const [currentMoveHighlight, setCurrentMoveHighlight] = useState<number | null>(null);

  const cardPopupPlayer = players.find(p => p.id === cardPopupPlayerId) ?? null;
  const selectedCard = cardPopupPlayer?.cards.find(c => c.id === selectedCardId) ?? null;

  // 複数ルート選択時の確認ポップアップ用
  const [routePopupNodeId, setRoutePopupNodeId] = useState<number | null>(null);

  useEffect(() => {
    // フェーズが変わったらルート選択ポップアップは閉じる
    if (phase !== 'route_selection') {
      setRoutePopupNodeId(null);
    }
  }, [phase]);

  useEffect(() => {
    if (isAnimating && movingPath.length > 0) {
      movingPath.forEach((nodeId: number, i: number) => {
        setTimeout(() => setCurrentMoveHighlight(nodeId), i * 380);
      });
      setTimeout(() => setCurrentMoveHighlight(null), movingPath.length * 380 + 100);
    }
  }, [movingPath, isAnimating]);

  // ホバー中の分岐経路をハイライト用セットに変換
  const hoveredPathSet = new Set<number>();
  const hoveredEdgeSet = new Set<string>();
  let hoveredLandingNodeId: number | null = null;
  if (hoveredRouteId != null) {
    const info = routeInfos.find(b => b.id === hoveredRouteId);
    if (info) {
      info.path.forEach(id => hoveredPathSet.add(id));
      hoveredLandingNodeId = info.landingNodeId;
      const currentPlayerPos = players[currentPlayerIndex]?.position;
      if (currentPlayerPos !== undefined) {
        const fullPath = [currentPlayerPos, ...info.path];
        for (let i = 0; i < fullPath.length - 1; i++) {
          const u = fullPath[i];
          const v = fullPath[i + 1];
          hoveredEdgeSet.add(`${u}-${v}`);
          hoveredEdgeSet.add(`${v}-${u}`);
        }
      }
    }
  }

  const nodes = Object.values(map.nodes) as MapNode[];
  const edges = map.edges as MapEdge[];

  // Dynamic ViewBox
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(n => {
    if (n.x < minX) minX = n.x;
    if (n.x > maxX) maxX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.y > maxY) maxY = n.y;
  });
  const padding = 50;
  const vbX = Math.round(minX - padding);
  const vbY = Math.round(minY - padding);
  const vbW = Math.round(maxX - minX + padding * 2);
  const vbH = Math.round(maxY - minY + padding * 2);
  const dynamicViewBox = `${vbX} ${vbY} ${vbW} ${vbH}`;

  const currentPlayer = players[currentPlayerIndex];

  return (
    <>
      <TransformWrapper
        initialScale={1}
        minScale={isMobile ? 1 : 0.2}
        maxScale={isMobile ? 1 : 4}
        wheel={{ step: 0.1 }}
        doubleClick={{ disabled: true }}
        panning={{ disabled: isMobile, velocityDisabled: true }}
        pinch={{ disabled: isMobile }}
        centerOnInit={true}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <div style={isMobile ? { width: '100%', height: '100%', overflow: 'auto', WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' } : {}}>
            {!isMobile && (
              <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => zoomIn()}>🔍+</button>
                <button className="btn btn-secondary btn-sm" onClick={() => zoomOut()}>🔍-</button>
                <button className="btn btn-secondary btn-sm" onClick={() => resetTransform()}>リセット</button>
              </div>
            )}
            <TransformComponent wrapperStyle={isMobile ? { width: '100%', height: 'auto', minHeight: '100%' } : { width: '100%', height: '100%' }} contentStyle={isMobile ? { width: '100%', height: 'auto', minHeight: '100%' } : { width: '100%', height: '100%' }}>
              <svg
                ref={svgRef}
                viewBox={dynamicViewBox}
                width={isMobile ? "100%" : undefined}
                height={isMobile ? "auto" : undefined}
                className="board-svg"
                style={isMobile ? { display: 'block' } : { display: 'block', width: '100%', height: '100%' }}
              >
                {/* Nodes */}
                {nodes.map((node: MapNode) => {
                  if (node.type === 'start') return null; // スタート地点のマス自体を表示しない

                  const r = NODE_RADIUS[node.type] ?? 18;
                  const isHighlighted = node.id === currentMoveHighlight;
                  const isOnHoveredPath = hoveredPathSet.has(node.id);
                  const isHoveredLanding = node.id === hoveredLandingNodeId;
                  let fillColor = '#d4d4d8';
                  let nodeStroke = 'rgba(255,255,255,0.4)';

                  // カードマス（bonus/penalty）はピンク系で差別化
                  if (node.type === 'bonus' || node.type === 'penalty') {
                    fillColor = '#ec4899'; // 強めのピンク
                    nodeStroke = '#fbcfe8'; // 薄いピンクの縁
                  }

                  const currentPlayerColorStr = players[currentPlayerIndex] ? COLOR_HEX[players[currentPlayerIndex].color] : 'yellow';
                  const { emoji } = getNodeDisplay(node);
                  let nodeStrokeWidth = 1.5;

                  const miningRecord = minedNodes[node.id];

                  if (miningRecord) {
                    fillColor = '#333';
                  }

                  const selectableRoutes = phase === 'route_selection' ? routeInfos.filter((r: any) => r.landingNodeId === node.id) : [];
                  const isSelectableLanding = phase === 'route_selection' && selectableRoutes.length > 0;

                  // 選択可能な行き先マスの枠線を白にして、中の色(ピンク等)との境界をくっきりさせる
                  if (isSelectableLanding) {
                    nodeStroke = 'white';
                    nodeStrokeWidth = isHoveredLanding ? 4 : 2;
                  }

                  const cursorStyle = phase === 'card_target_selection'
                    ? 'crosshair'
                    : (isSelectableLanding || node.type === 'property' ? 'pointer' : 'default');

                  return (
                    <g
                      key={node.id}
                      onMouseEnter={(e) => {
                        if (isMobile) return;
                        if (isSelectableLanding && selectableRoutes.length > 0) {
                          const route = getRouteByMouseAngle(e, selectableRoutes, map, node);
                          useTreasureStore.getState().setHoveredRoute(route.id);
                        }
                      }}
                      onMouseMove={(e) => {
                        if (isMobile) return;
                        if (isSelectableLanding && selectableRoutes.length > 1) {
                          const route = getRouteByMouseAngle(e, selectableRoutes, map, node);
                          if (route.id !== useTreasureStore.getState().hoveredRouteId) {
                            useTreasureStore.getState().setHoveredRoute(route.id);
                          }
                        }
                      }}
                      onMouseLeave={() => {
                        if (isMobile) return;
                        if (isSelectableLanding) {
                          useTreasureStore.getState().setHoveredRoute(null);
                        }
                      }}
                      onClick={() => {
                        if (phase === 'card_target_selection') {
                          useTreasureStore.getState().confirmCardNodeSelection(node.id);
                        } else if (isSelectableLanding && selectableRoutes.length > 0) {
                          if (selectableRoutes.length === 1) {
                            // 1ルートのみなら即決定
                            useTreasureStore.getState().selectRoute(selectableRoutes[0].id);
                            setRoutePopupNodeId(null);
                          } else {
                            // 複数ルートある場合
                            if (!isMobile) {
                              // PCの場合：現在のカーソル位置でハイライトされているルートを即座に決定
                              const storeHoveredId = useTreasureStore.getState().hoveredRouteId;
                              if (storeHoveredId) {
                                useTreasureStore.getState().selectRoute(storeHoveredId);
                              }
                            } else {
                              // モバイルの場合：トグル操作とポップアップ
                              const storeHoveredId = useTreasureStore.getState().hoveredRouteId;
                              if (routePopupNodeId === node.id) {
                                // 既にポップアップが開いている状態ならタップで次のルートに切り替える(トグル)
                                const currentIdx = selectableRoutes.findIndex((r: any) => r.id === storeHoveredId);
                                const nextIdx = (currentIdx + 1) % selectableRoutes.length;
                                useTreasureStore.getState().setHoveredRoute(selectableRoutes[nextIdx].id);
                              } else {
                                // 初回タップ時：ポップアップを開き、最初のルートをハイライトする
                                setRoutePopupNodeId(node.id);
                                useTreasureStore.getState().setHoveredRoute(selectableRoutes[0].id);
                              }
                            }
                          }
                        }
                      }}
                      style={{ cursor: cursorStyle }}
                    >
                      {/* 拡張当たり判定ゾーン (複数ルート時にカーソルをずらしやすくする) */}
                      {isSelectableLanding && selectableRoutes.length > 1 && (
                        <circle cx={node.x} cy={node.y} r={r + 26} fill="transparent" />
                      )}
                      {isHighlighted && (
                        <circle cx={node.x} cy={node.y} r={r + 8} fill="white" opacity={0.3} />
                      )}

                      {isOnHoveredPath && !isHoveredLanding && (
                        <circle cx={node.x} cy={node.y} r={r + 5} fill={currentPlayerColorStr} opacity={0.25} />
                      )}

                      {/* Dowsing Glow */}
                      {!miningRecord && node.type === 'property' && (() => {
                        const chance = calcMiningChance(node.id, minedNodes, map);
                        if (chance <= 0.25) return null;
                        const intensity = (chance - 0.25) / 0.75;
                        const maxOpacity = 0.4 + (0.5 * intensity);
                        const minOpacity = 0.1 + (0.2 * intensity);
                        const animationDuration = 2.0 - (1.2 * intensity);
                        const glowRadius = r + 4 + (4 * intensity);
                        const strokeWidth = 1 + (3 * Math.max(0.5, intensity));
                        return (
                          <motion.circle
                            cx={node.x} cy={node.y} r={glowRadius} fill="none" stroke="#c084fc" strokeWidth={strokeWidth}
                            initial={{ opacity: minOpacity, scale: 0.95 }}
                            animate={{ opacity: maxOpacity, scale: 1.1 + (0.1 * intensity) }}
                            transition={{ repeat: Infinity, repeatType: "reverse", duration: animationDuration }}
                          />
                        );
                      })()}

                      {/* 行き先マスのブリンク強調（視認性向上） */}
                      {isSelectableLanding && (
                        <motion.circle
                          cx={node.x} cy={node.y} r={r + (isHoveredLanding ? 8 : 4)}
                          fill="none" stroke={currentPlayerColorStr} strokeWidth={isHoveredLanding ? 5 : 3}
                          initial={{ opacity: 0.3 }}
                          animate={{ opacity: 1 }}
                          transition={{ repeat: Infinity, repeatType: 'reverse', duration: 0.6 }}
                        />
                      )}

                      {nodeStrokeWidth > 3 && !isHoveredLanding && !isSelectableLanding && (
                        <circle cx={node.x} cy={node.y} r={r + 4} fill="none" stroke={nodeStroke} strokeWidth={2} opacity={0.4} />
                      )}

                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={r}
                        fill={fillColor}
                        stroke={nodeStroke}
                        strokeWidth={nodeStrokeWidth}
                      />

                      <text
                        x={node.x}
                        y={node.y + r + 13}
                        textAnchor="middle"
                        fontSize={9}
                        fill="rgba(255,255,255,0.85)"
                        fontWeight="400"
                      >
                        {node.name}
                      </text>

                      {(emoji || miningRecord) && (
                        <text x={node.x} y={node.y + 5} textAnchor="middle" fontSize={12}>
                          {miningRecord ? '🕳️' : emoji}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Player Tokens */}
                {[...players].sort((a, b) => {
                  const aIsTurn = a.id === players[currentPlayerIndex]?.id;
                  const bIsTurn = b.id === players[currentPlayerIndex]?.id;
                  if (aIsTurn && !bIsTurn) return 1;
                  if (!aIsTurn && bIsTurn) return -1;
                  return 0;
                }).map((player) => {
                  const node = map.nodes[player.position] as MapNode | undefined;
                  if (!node) return null;

                  const playersAtNode = players.filter(p => p.position === player.position);
                  const indexAtNode = playersAtNode.findIndex(p => p.id === player.id);
                  const { dx, dy } = getPlayerOffset(indexAtNode, playersAtNode.length);

                  const isTurnPlayer = player.id === players[currentPlayerIndex]?.id;
                  const tokenScale = isTurnPlayer ? 1.4 : 1.0;

                  // 現在のプレイヤー（人間ターン）のコマはクリック可能
                  const isCurrentHuman = isTurnPlayer && currentPlayer?.isHuman;
                  const hasCards = player.cards.filter(c => !c.isPassive).length > 0;
                  const isClickable = isCurrentHuman && hasCards && phase === 'playing';

                  return (
                    <motion.g
                      key={player.id}
                      animate={{ x: node.x + dx, y: node.y + dy, scale: tokenScale }}
                      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                      style={{
                        cursor: isClickable ? 'pointer' : 'default',
                        pointerEvents: isClickable ? 'auto' : 'none'
                      }}
                    >
                      {/* クリック可能リング */}
                      {isClickable && (
                        <motion.circle
                          cx={0} cy={0} r={17} fill="none" stroke="white" strokeWidth={2}
                          initial={{ opacity: 0.4 }} animate={{ opacity: 0.9 }}
                          transition={{ repeat: Infinity, repeatType: 'reverse', duration: 0.9 }}
                        />
                      )}
                      {/* Token shadow */}
                      <circle cx={0} cy={2} r={15} fill="rgba(0,0,0,0.4)" style={{ pointerEvents: 'none' }} />
                      {/* Token body */}
                      <circle
                        cx={0}
                        cy={0}
                        r={14}
                        fill={COLOR_HEX[player.color]}
                        stroke="white"
                        strokeWidth={2}
                        style={{ pointerEvents: 'none' }}
                      />
                      {/* Player initial */}
                      <text x={0} y={5} textAnchor="middle" fontSize={14} fill="white" fontWeight="700" style={{ pointerEvents: 'none' }}>
                        {player.name[0]}
                      </text>

                      {/* Hit Area (Top most layer to block clicks cleanly) */}
                      {isClickable && (
                        <circle
                          cx={0} cy={0} r={24} fill="transparent"
                          cursor="pointer"
                          style={{ pointerEvents: 'auto' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (cardPopupPlayerId === player.id) {
                              closeCardPopup();
                            } else {
                              openCardPopup(player.id);
                            }
                          }}
                          onTouchEnd={(e) => {
                            // On mobile, sometimes onClick is swallowed by panning containers, onTouchEnd helps capture it.
                            e.stopPropagation();
                            // Optional: e.preventDefault() prevents double firing of click, but let's just let it fire as normal.
                            if (cardPopupPlayerId === player.id) {
                              closeCardPopup();
                            } else {
                              openCardPopup(player.id);
                            }
                          }}
                        />
                      )}
                    </motion.g>
                  );
                })}

                {/* Edges */}
                {edges.map((edge: MapEdge, i: number) => {
                  const from = map.nodes[edge.from] as MapNode | undefined;
                  const to = map.nodes[edge.to] as MapNode | undefined;
                  if (!from || !to) return null;
                  if (from.type === 'start' || to.type === 'start') return null; // スタートノードに繋がるエッジを描画しない
                  const isHoveredEdge = hoveredEdgeSet.has(`${edge.from}-${edge.to}`);
                  const currentPlayerColorStr = players[currentPlayerIndex] ? COLOR_HEX[players[currentPlayerIndex].color] : 'rgba(0,255,255,0.8)';
                  const strokeColor = isHoveredEdge ? currentPlayerColorStr : 'rgba(255,255,255,0.4)';
                  const strokeWidth = isHoveredEdge ? 3 : 2;
                  const strokeDasharray = isHoveredEdge ? 'none' : '6 4';

                  if (USE_ORTHOGONAL_LINES) {
                    return (
                      <path
                        key={i}
                        d={createOrthogonalPath(from.x, from.y, to.x, to.y)}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={strokeDasharray}
                        style={{ pointerEvents: 'none' }}
                      />
                    );
                  }

                  return (
                    <line
                      key={i}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDasharray}
                      style={{ pointerEvents: 'none' }}
                    />
                  );
                })}


              </svg>
            </TransformComponent>
          </div>
        )}
      </TransformWrapper>

      {/* 手札ポップアップ（コマクリック時に表示） */}
      <AnimatePresence>
        {cardPopupPlayer && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            style={{
              position: 'absolute',
              bottom: 80,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 200,
              background: 'var(--surface)',
              border: `2px solid ${COLOR_HEX[cardPopupPlayer.color]}`,
              borderRadius: 16,
              padding: '16px 20px',
              minWidth: 260,
              maxWidth: 340,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>
                <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: COLOR_HEX[cardPopupPlayer.color], marginRight: 6, verticalAlign: 'middle' }} />
                {cardPopupPlayer.name} の手札
              </div>
              <button className="btn btn-secondary btn-sm" style={{ padding: '2px 8px', fontSize: 12 }} onClick={closeCardPopup}>✕</button>
            </div>

            {/* カード一覧 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {cardPopupPlayer.cards.filter(c => !c.isPassive).map((card: Card) => (
                <div
                  key={card.id}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: selectedCard?.id === card.id ? 'rgba(255,255,255,0.1)' : 'var(--surface2)',
                    border: selectedCard?.id === card.id ? `2px solid ${COLOR_HEX[cardPopupPlayer.color]}` : '1px solid var(--border)',
                    cursor: phase === 'playing' ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                  onClick={() => {
                    if (phase !== 'playing') return;
                    setSelectedCardId(selectedCard?.id === card.id ? null : card.id);
                  }}
                >
                  <span style={{ fontSize: 22 }}>{CARD_EMOJI[card.type] || '🃏'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{card.name}</div>
                    <div style={{ fontSize: 11, color: '#aaa' }}>{card.description}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* ターゲット選択 */}
            {selectedCard && phase === 'playing' && (
              <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  {selectedCard.type === 'dice_1' || selectedCard.type === 'dice_10' ? '自身に使います' : '誰に使う？'}
                </div>
                {selectedCard.type === 'dice_1' || selectedCard.type === 'dice_10' ? (
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%' }}
                    onClick={() => {
                      state.useCard(selectedCard.id);
                      closeCardPopup();
                    }}
                  >使う！</button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {players.filter(p => p.id !== cardPopupPlayer.id).map(p => (
                      <button
                        key={p.id}
                        className="btn btn-secondary btn-sm"
                        style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
                        onClick={() => {
                          if (selectedCard.type === 'blow_away') {
                            state.setupCardNodeSelection(selectedCard.id, 'blow_away', p.id);
                          } else {
                            state.useCard(selectedCard.id, p.id);
                          }
                          closeCardPopup();
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
                  onClick={() => setSelectedCardId(null)}
                >キャンセル</button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 複数ルート選択時の確認ポップアップ（モバイル用対応） */}
      <AnimatePresence>
        {routePopupNodeId && phase === 'route_selection' && (
          <motion.div
            drag
            dragConstraints={svgRef}
            dragElastic={0.2}
            dragMomentum={false}
            initial={{ opacity: 0, scale: 0.8, y: 20, x: '-50%' }}
            animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, scale: 0.8, y: 20, x: '-50%' }}
            style={{
              position: 'absolute',
              bottom: 120,
              left: '50%',
              zIndex: 200,
              background: 'rgba(22, 33, 62, 0.95)',
              border: `2px solid var(--accent)`,
              borderRadius: 32, // Pill shape
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              backdropFilter: 'blur(8px)',
              cursor: 'grab',
              touchAction: 'none' // Prevent scrolling while dragging popup
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span>ルート</span>
              <span>選択</span>
            </div>

            {/* ルート切替ボタン */}
            <button
              onClick={() => {
                const routes = routeInfos.filter(r => r.landingNodeId === routePopupNodeId);
                const currentIdx = routes.findIndex(r => r.id === hoveredRouteId);
                const nextIdx = (currentIdx + 1) % routes.length;
                useTreasureStore.getState().setHoveredRoute(routes[nextIdx].id);
              }}
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: '50%',
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18
              }}
            >
              🔄
            </button>

            {/* 決定ボタン */}
            <button
              onClick={() => {
                const latestHovered = useTreasureStore.getState().hoveredRouteId;
                if (latestHovered) {
                  useTreasureStore.getState().selectRoute(latestHovered);
                } else {
                  // フォールバック: もしホバー状態が消えてもデフォルトで最初のルートを選ぶ
                  const routes = routeInfos.filter(r => r.landingNodeId === routePopupNodeId);
                  if (routes.length > 0) {
                    useTreasureStore.getState().selectRoute(routes[0].id);
                  }
                }
                setRoutePopupNodeId(null);
              }}
              style={{
                background: 'var(--accent)',
                border: 'none',
                borderRadius: '50%',
                width: 48,
                height: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                color: 'white',
                boxShadow: '0 2px 12px rgba(233, 69, 96, 0.6)'
              }}
            >
              ✨
            </button>

            {/* キャンセルボタン */}
            <button
              onClick={() => setRoutePopupNodeId(null)}
              style={{
                background: 'transparent',
                border: 'none',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                opacity: 0.6
              }}
            >
              ❌
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
