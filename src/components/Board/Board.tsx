import { useRef, useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { useGameStore } from '../../store/gameStore';
import { calcDistancesFromTarget } from '../../game/engine';
import type { MapNode, Player, MapEdge } from '../../game/types';
import { COLOR_HEX } from '../../game/types';

// SVG座標のスケール（ビューポート900x650に正規化）
const VIEWBOX = '0 0 900 700';

const NODE_RADIUS: Record<string, number> = {
  start: 16,
  property: 14,
  bonus: 12,
  penalty: 12,
};

const NODE_COLOR: Record<string, string> = {
  start: '#ffd700',
  bonus: '#22c55e',
  penalty: '#ef4444',
};

function getNodeDisplay(node: MapNode) {
  if (node.type === 'start') return { emoji: '🏠', label: 'START' };
  if (node.type === 'bonus') return { emoji: '⭐', label: `+${node.amount}` };
  if (node.type === 'penalty') return { emoji: '💀', label: `${node.amount}` };
  return { emoji: '', label: node.name };
}


function getPlayerOffset(playerIndex: number, totalAtNode: number): { dx: number; dy: number } {
  if (totalAtNode <= 1) return { dx: 0, dy: 0 };
  const angle = (playerIndex / totalAtNode) * Math.PI * 2;
  return { dx: Math.cos(angle) * 8, dy: Math.sin(angle) * 8 };
}

export function Board() {
  const state = useGameStore();
  const { players, currentPlayerIndex, map, destinationNodeId, movingPath, isAnimating, routeInfos, hoveredRouteId } = state;
  const [tooltip, setTooltip] = useState<MapNode | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [currentMoveHighlight, setCurrentMoveHighlight] = useState<number | null>(null);

  const distancesFromGoal = useMemo(() => {
    if (destinationNodeId == null) return {};
    return calcDistancesFromTarget(destinationNodeId, map);
  }, [destinationNodeId, map]);

  useEffect(() => {
    if (isAnimating && movingPath.length > 0) {
      movingPath.forEach((nodeId: number, i: number) => {
        setTimeout(() => setCurrentMoveHighlight(nodeId), i * 380);
      });
      setTimeout(() => setCurrentMoveHighlight(null), movingPath.length * 380 + 100);
    }
  }, [movingPath, isAnimating]);

  if (state.phase === 'lobby') return null;

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

  return (
    <TransformWrapper
      initialScale={1}
      minScale={0.5}
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
              viewBox={VIEWBOX}
              className="board-svg"
              style={{ display: 'block', width: '100%', height: '100%' }}
            >
              {/* Nodes */}
              {nodes.map((node: MapNode) => {
                const r = NODE_RADIUS[node.type] ?? 18;
                const isDestination = node.id === destinationNodeId;
                const isHighlighted = node.id === currentMoveHighlight;
                const isOnHoveredPath = hoveredPathSet.has(node.id);
                const isHoveredLanding = node.id === hoveredLandingNodeId;
                const distance = distancesFromGoal[node.id];
                const fillColor = node.color ?? NODE_COLOR[node.type] ?? '#334155';
                const { emoji } = getNodeDisplay(node);

                return (
                  <g
                    key={node.id}
                    onMouseEnter={() => {
                      if (node.type === 'property') {
                        setTooltip(node);
                      }
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    {/* Glow for destination */}
                    {isDestination && (
                      <circle cx={node.x} cy={node.y} r={r + 6} fill="gold" opacity={0.25}>
                        <animate attributeName="r" values={`${r + 4};${r + 10};${r + 4}`} dur="1.5s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.2;0.5;0.2" dur="1.5s" repeatCount="indefinite" />
                      </circle>
                    )}

                    {/* Move highlight (animation) */}
                    {isHighlighted && (
                      <circle cx={node.x} cy={node.y} r={r + 8} fill="white" opacity={0.3} />
                    )}

                    {/* Branch hover: 経路上ノード */}
                    {isOnHoveredPath && !isHoveredLanding && (
                      <circle cx={node.x} cy={node.y} r={r + 5} fill="cyan" opacity={0.2} />
                    )}

                    {/* Branch hover: 着地ノード */}
                    {isHoveredLanding && (
                      <circle cx={node.x} cy={node.y} r={r + 8} fill="cyan" opacity={0.5}>
                        <animate attributeName="opacity" values="0.3;0.7;0.3" dur="0.8s" repeatCount="indefinite" />
                      </circle>
                    )}

                    {/* Main circle */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={r}
                      fill={fillColor}
                      stroke={isHoveredLanding ? 'cyan' : isDestination ? 'gold' : 'rgba(255,255,255,0.2)'}
                      strokeWidth={isHoveredLanding ? 3 : isDestination ? 2.5 : 1}
                    />

                    {/* Label */}
                    <text
                      x={node.x}
                      y={node.y + r + 13}
                      textAnchor="middle"
                      fontSize={node.type === 'start' ? 10 : 9}
                      fill="rgba(255,255,255,0.85)"
                      fontWeight={isDestination ? '700' : '400'}
                    >
                      {node.type === 'start' ? 'START' : node.name}
                    </text>

                    {/* Emoji for special tiles */}
                    {emoji && (
                      <text x={node.x} y={node.y + 5} textAnchor="middle" fontSize={12}>
                        {emoji}
                      </text>
                    )}

                    {/* Destination star */}
                    {isDestination && (
                      <text x={node.x} y={node.y - r - 4} textAnchor="middle" fontSize={14}>
                        ⭐
                      </text>
                    )}

                    {/* Distance badge */}
                    {distance !== undefined && !isDestination && (
                      <g transform={`translate(${node.x + r + 2}, ${node.y - r - 2})`}>
                        <rect x={0} y={-14} width={24} height={14} rx={4} fill="rgba(0,0,0,0.65)" stroke="white" strokeWidth={0.5} />
                        <text x={12} y={-4} fontSize={9} fill="white" textAnchor="middle" fontWeight="bold">
                          {distance}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Player Tokens */}
              {(players as Player[]).map((player: Player) => {
                const node = map.nodes[player.position] as MapNode | undefined;
                if (!node) return null;

                const playersAtNode = (players as Player[]).filter((p: Player) => p.position === player.position);
                const indexAtNode = playersAtNode.findIndex((p: Player) => p.id === player.id);
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
                return (
                  <line
                    key={i}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={isHoveredEdge ? 'rgba(0,255,255,0.8)' : 'rgba(255,255,255,0.4)'}
                    strokeWidth={isHoveredEdge ? 3 : 2}
                    strokeDasharray={isHoveredEdge ? 'none' : '6 4'}
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
                      価格: <span style={{ color: '#ffd700' }}>¥{tooltip.properties?.reduce((sum, p) => sum + p.price, 0).toLocaleString()}</span>
                    </div>
                    <div style={{ color: '#888', fontSize: 11 }}>
                      収益: <span style={{ color: '#22c55e' }}>¥{tooltip.properties?.reduce((sum, p) => sum + p.baseIncome, 0).toLocaleString()}/決算</span>
                    </div>
                    {tooltip.groupId && (
                      <div style={{ color: '#888', fontSize: 11 }}>
                        グループ: <span style={{ color: tooltip.color }}>{tooltip.groupId}</span>
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
  );
}
