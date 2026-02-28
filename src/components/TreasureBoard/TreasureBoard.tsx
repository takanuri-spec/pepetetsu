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
  'time_machine': '⌚',
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

export function TreasureBoard() {
  const state = useTreasureStore();
  const { players, currentPlayerIndex, map, movingPath, isAnimating, routeInfos, hoveredRouteId, minedNodes, phase, cardPopupPlayerId, selectedCardId, openCardPopup, closeCardPopup, setSelectedCardId } = state;
  const svgRef = useRef<SVGSVGElement>(null);
  const [currentMoveHighlight, setCurrentMoveHighlight] = useState<number | null>(null);

  const cardPopupPlayer = players.find(p => p.id === cardPopupPlayerId) ?? null;
  const selectedCard = cardPopupPlayer?.cards.find(c => c.id === selectedCardId) ?? null;

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
        minScale={0.2}
        maxScale={4}
        wheel={{ step: 0.1 }}
        doubleClick={{ disabled: true }}
        panning={{ velocityDisabled: true }}
        centerOnInit={true}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => zoomIn()}>🔍+</button>
              <button className="btn btn-secondary btn-sm" onClick={() => zoomOut()}>🔍-</button>
              <button className="btn btn-secondary btn-sm" onClick={() => resetTransform()}>リセット</button>
            </div>
            <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%' }}>
              <svg
                ref={svgRef}
                viewBox={dynamicViewBox}
                className="board-svg"
                style={{ display: 'block', width: '100%', height: '100%' }}
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

                  if (isHoveredLanding) {
                    nodeStroke = currentPlayerColorStr;
                    nodeStrokeWidth = 3;
                  }

                  const selectableRoutes = phase === 'route_selection' ? routeInfos.filter((r: any) => r.landingNodeId === node.id) : [];
                  const isSelectableLanding = phase === 'route_selection' && selectableRoutes.length > 0;

                  if (isSelectableLanding && !isHoveredLanding) {
                    nodeStroke = currentPlayerColorStr;
                    nodeStrokeWidth = 3;
                  }

                  const cursorStyle = phase === 'card_target_selection'
                    ? 'crosshair'
                    : (isSelectableLanding || node.type === 'property' ? 'pointer' : 'default');

                  return (
                    <g
                      key={node.id}
                      onMouseEnter={(e) => {
                        if (isSelectableLanding && selectableRoutes.length > 0) {
                          const route = getRouteByMouseAngle(e, selectableRoutes, map, node);
                          useTreasureStore.getState().setHoveredRoute(route.id);
                        }
                      }}
                      onMouseMove={(e) => {
                        if (isSelectableLanding && selectableRoutes.length > 1) {
                          const route = getRouteByMouseAngle(e, selectableRoutes, map, node);
                          if (route.id !== useTreasureStore.getState().hoveredRouteId) {
                            useTreasureStore.getState().setHoveredRoute(route.id);
                          }
                        }
                      }}
                      onMouseLeave={() => {
                        if (isSelectableLanding) {
                          useTreasureStore.getState().setHoveredRoute(null);
                        }
                      }}
                      onClick={() => {
                        if (phase === 'card_target_selection') {
                          useTreasureStore.getState().confirmCardNodeSelection(node.id);
                        } else if (isSelectableLanding && selectableRoutes.length > 0) {
                          const currentHoveredId = useTreasureStore.getState().hoveredRouteId;
                          const targetRoute = selectableRoutes.find((r: any) => r.id === currentHoveredId) || selectableRoutes[0];
                          useTreasureStore.getState().selectRoute(targetRoute.id);
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

                      {nodeStrokeWidth > 3 && !isHoveredLanding && (
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
                {players.map((player) => {
                  const node = map.nodes[player.position] as MapNode | undefined;
                  if (!node) return null;

                  const playersAtNode = players.filter(p => p.position === player.position);
                  const indexAtNode = playersAtNode.findIndex(p => p.id === player.id);
                  const { dx, dy } = getPlayerOffset(indexAtNode, playersAtNode.length);

                  // 現在のプレイヤー（人間ターン）のコマはクリック可能
                  const isCurrentHuman = player.id === currentPlayer?.id && currentPlayer?.isHuman;
                  const hasCards = player.cards.filter(c => !c.isPassive).length > 0;
                  const isClickable = isCurrentHuman && hasCards && phase === 'playing';

                  return (
                    <motion.g
                      key={player.id}
                      animate={{ x: node.x + dx, y: node.y + dy }}
                      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                      style={{
                        cursor: isClickable ? 'pointer' : 'default',
                        pointerEvents: isClickable ? 'all' : 'none'
                      }}
                      onPointerDown={(e) => {
                        if (!isClickable) return;
                        // Prevent map dragging if we touched the token
                        e.stopPropagation();
                      }}
                      onClickCapture={(e) => {
                        if (!isClickable) return;
                        e.stopPropagation();
                        if (cardPopupPlayerId === player.id) {
                          closeCardPopup();
                        } else {
                          openCardPopup(player.id);
                        }
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
                      <circle cx={0} cy={2} r={15} fill="rgba(0,0,0,0.4)" />
                      {/* Token body */}
                      <circle
                        cx={0}
                        cy={0}
                        r={14}
                        fill={COLOR_HEX[player.color]}
                        stroke="white"
                        strokeWidth={2}
                      />
                      {/* Player initial */}
                      <text x={0} y={5} textAnchor="middle" fontSize={14} fill="white" fontWeight="700">
                        {player.name[0]}
                      </text>
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
          </>
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
                  {selectedCard.type === 'time_machine' ? '「タイムマシン」を使う？' : '誰に使う？'}
                </div>
                {selectedCard.type === 'time_machine' ? (
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%' }}
                    onClick={() => {
                      state.setupCardNodeSelection(selectedCard.id, 'time_machine');
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
    </>
  );
}
