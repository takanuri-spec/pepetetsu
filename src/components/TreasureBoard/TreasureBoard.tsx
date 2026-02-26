import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { useTreasureStore } from '../../store/treasureStore';
import type { MapNode, MapEdge } from '../../game/types';
import { COLOR_HEX } from '../../game/types';

// SVG座標のスケール（ビューポートに正規化するための設定は動的に計算されます）

// 描画設定のトグル（あとで直線を戻せるようにフラグ化）
export const USE_ORTHOGONAL_LINES = true;

function createOrthogonalPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);

  // Xの移動距離の方が長ければX軸を先に、そうでなければY軸を先に移動（L字型を書く）
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
  if (node.type === 'start') return { emoji: '🏠', label: 'START' };
  if (node.type === 'bonus' || node.type === 'penalty') return { emoji: '🃏', label: 'CARD' };
  return { emoji: '🪨', label: '' };
}


function getPlayerOffset(playerIndex: number, totalAtNode: number): { dx: number; dy: number } {
  if (totalAtNode <= 1) return { dx: 0, dy: 0 };
  const angle = (playerIndex / totalAtNode) * Math.PI * 2;
  return { dx: Math.cos(angle) * 8, dy: Math.sin(angle) * 8 };
}

export function TreasureBoard() {
  const state = useTreasureStore();
  const { players, currentPlayerIndex, map, movingPath, isAnimating, routeInfos, hoveredRouteId, minedNodes } = state;
  const [tooltip, setTooltip] = useState<MapNode | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [currentMoveHighlight, setCurrentMoveHighlight] = useState<number | null>(null);

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

      // エッジのハイライト用セット作成
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

  const minScale = typeof window !== 'undefined' && window.innerWidth < 768 ? 0.3 : 0.2;

  // Dynamic ViewBox
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(n => {
    if (n.x < minX) minX = n.x;
    if (n.x > maxX) maxX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.y > maxY) maxY = n.y;
  });
  const padding = 150;
  const vbX = Math.round(minX - padding);
  const vbY = Math.round(minY - padding);
  const vbW = Math.round(maxX - minX + padding * 2);
  const vbH = Math.round(maxY - minY + padding * 2);
  const dynamicViewBox = `${vbX} ${vbY} ${vbW} ${vbH}`;

  return (
    <>
      <TransformWrapper
        initialScale={typeof window !== 'undefined' && window.innerWidth < 768 ? 0.5 : 0.8}
        minScale={minScale}
        maxScale={4}
        wheel={{ step: 0.1 }}
        doubleClick={{ disabled: true }}
        panning={{ velocityDisabled: true }}
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
                  const r = NODE_RADIUS[node.type] ?? 18;
                  const isHighlighted = node.id === currentMoveHighlight;
                  const isOnHoveredPath = hoveredPathSet.has(node.id);
                  const isHoveredLanding = node.id === hoveredLandingNodeId;
                  let fillColor = '#d4d4d8'; // 未採掘マスは白っぽく目立つ
                  if (node.type === 'bonus' || node.type === 'penalty') {
                    fillColor = '#93c5fd'; // カードマスは明るい青
                  } else if (node.type === 'start') {
                    fillColor = '#ffd700';
                  }

                  const { emoji } = getNodeDisplay(node);

                  let nodeStroke = 'rgba(255,255,255,0.4)';
                  let nodeStrokeWidth = 1.5;

                  // Mining Status
                  const miningRecord = minedNodes[node.id];
                  const minerColor = miningRecord && miningRecord.playerId ? players.find(p => p.id === miningRecord.playerId)?.color : null;

                  if (miningRecord) {
                    if (minerColor) {
                      fillColor = COLOR_HEX[minerColor]; // 採掘ゲットで初めてプレーヤー色になる
                    } else {
                      fillColor = '#333'; // 採掘失敗した穴
                    }
                  }

                  if (isHoveredLanding) {
                    nodeStroke = 'cyan';
                    nodeStrokeWidth = 3;
                  }

                  return (
                    <g
                      key={node.id}
                      onMouseEnter={() => {
                        if (node.type === 'property') {
                          setTooltip(node);
                        }
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      style={{ cursor: node.type === 'property' ? 'pointer' : 'default' }}
                    >
                      {/* Move highlight (animation) */}
                      {isHighlighted && (
                        <circle cx={node.x} cy={node.y} r={r + 8} fill="white" opacity={0.3} />
                      )}

                      {/* Branch hover: 経路上ノード */}
                      {isOnHoveredPath && !isHoveredLanding && (
                        <circle cx={node.x} cy={node.y} r={r + 5} fill="cyan" opacity={0.2} />
                      )}

                      {/* Fully Owned Ring indicator (Outer Glow) */}
                      {nodeStrokeWidth > 3 && !isHoveredLanding && (
                        <circle cx={node.x} cy={node.y} r={r + 4} fill="none" stroke={nodeStroke} strokeWidth={2} opacity={0.4} />
                      )}

                      {/* Main circle */}
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={r}
                        fill={fillColor}
                        stroke={nodeStroke}
                        strokeWidth={nodeStrokeWidth}
                      />

                      {/* Label */}
                      <text
                        x={node.x}
                        y={node.y + r + 13}
                        textAnchor="middle"
                        fontSize={node.type === 'start' ? 10 : 9}
                        fill="rgba(255,255,255,0.85)"
                        fontWeight="400"
                      >
                        {node.type === 'start' ? 'START' : node.name}
                      </text>

                      {/* Emoji for special tiles */}
                      {(emoji || miningRecord) && (
                        <text x={node.x} y={node.y + 5} textAnchor="middle" fontSize={12}>
                          {miningRecord && minerColor ? '⛏️' : miningRecord && !minerColor ? '🕳️' : emoji}
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

                  return (
                    <motion.g
                      key={player.id}
                      animate={{ x: node.x + dx, y: node.y + dy }}
                      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                    >
                      {/* Token shadow */}
                      <circle cx={0} cy={1} r={8} fill="rgba(0,0,0,0.4)" />
                      {/* Token body */}
                      <circle
                        cx={0}
                        cy={0}
                        r={7}
                        fill={COLOR_HEX[player.color]}
                        stroke="white"
                        strokeWidth={1}
                      />
                      {/* Player initial */}
                      <text x={0} y={3} textAnchor="middle" fontSize={8} fill="white" fontWeight="700">
                        {player.name[0]}
                      </text>
                    </motion.g>
                  );
                })}

                {/* Edges (Lines drawn in front of nodes and tokens to be visible over them) */}
                {edges.map((edge: MapEdge, i: number) => {
                  const from = map.nodes[edge.from] as MapNode | undefined;
                  const to = map.nodes[edge.to] as MapNode | undefined;
                  if (!from || !to) return null;
                  // ホバー中経路のエッジをハイライト
                  const isHoveredEdge = hoveredEdgeSet.has(`${edge.from}-${edge.to}`);

                  const strokeColor = isHoveredEdge ? 'rgba(0,255,255,0.8)' : 'rgba(255,255,255,0.4)';
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

                {/* Tooltip */}
                {tooltip && (
                  <foreignObject
                    x={Math.min(tooltip.x + 20, 720)}
                    y={Math.min(tooltip.y - 20, 620)}
                    width={160}
                    height={100}
                    style={{ pointerEvents: 'none' }}
                  >
                    <div
                      style={{
                        background: 'rgba(15,52,96,0.95)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: 8,
                        padding: '8px 12px',
                        fontSize: 12,
                        color: '#eaeaea',
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{tooltip.name}</div>
                      <div style={{ color: '#888', fontSize: 11 }}>
                        ({tooltip.type})
                      </div>

                      {minedNodes[tooltip.id] && (
                        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.2)', fontSize: 11 }}>
                          採掘済み: <span style={{ color: COLOR_HEX[players.find(p => p.id === minedNodes[tooltip.id].playerId)?.color || 'red'] }}>
                            {players.find(p => p.id === minedNodes[tooltip.id].playerId)?.name}
                          </span>
                        </div>
                      )}
                    </div>
                  </foreignObject>
                )}
              </svg>
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </>
  );
}
