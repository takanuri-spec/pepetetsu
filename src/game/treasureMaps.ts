import type { GameMap, MapNode, MapEdge } from './types';

// ========== マップ定義型 ==========

export interface TreasureMapDef {
    id: string;
    name: string;
    description: string;
    emoji: string;
    build: () => GameMap;
}

// ========== クラスター生成ヘルパー ==========

/**
 * 3×3グリッドのノードクラスターを生成する。
 * 内部は格子状に接続され、採掘マス(property)とカードマス(bonus)が混在する。
 * カードマスは中央ノード(index=4)に配置される。
 */
function createCluster(
    centerX: number,
    centerY: number,
    spacing: number,
    startId: number,
    clusterName: string
): { nodes: MapNode[]; internalEdges: MapEdge[] } {
    const positions = [
        [-1, -1], [0, -1], [1, -1],
        [-1, 0], [0, 0], [1, 0],
        [-1, 1], [0, 1], [1, 1],
    ];

    const nodes: MapNode[] = positions.map(([dx, dy], i) => {
        const id = startId + i;
        const isCardNode = i === 4; // 中央をカードマスに
        return {
            id,
            name: `${clusterName}-${i + 1}`,
            type: isCardNode ? 'bonus' as const : 'property' as const,
            x: centerX + dx * spacing,
            y: centerY + dy * spacing,
            next: [],
            properties: [],
            amount: isCardNode ? 100 : undefined,
        };
    });

    // グリッド内の隣接関係（上下左右のみ）
    const gridConnections = [
        [0, 1], [1, 2],       // 上段
        [3, 4], [4, 5],       // 中段
        [6, 7], [7, 8],       // 下段
        [0, 3], [1, 4], [2, 5], // 左列
        [3, 6], [4, 7], [5, 8], // 中列
    ];

    const internalEdges: MapEdge[] = [];

    for (const [a, b] of gridConnections) {
        const idA = startId + a;
        const idB = startId + b;
        nodes[a].next.push(idB);
        nodes[b].next.push(idA);
        internalEdges.push({ from: idA, to: idB });
    }

    return { nodes, internalEdges };
}

/**
 * 2つのノード間を接続する回廊ノード（中間点）を生成する。
 * 回廊はカードマスになることがある。
 */
function createCorridor(
    nodeA: MapNode,
    nodeB: MapNode,
    corridorId: number,
    name: string,
    isCard: boolean = false
): { node: MapNode; edges: MapEdge[] } {
    const midX = Math.round((nodeA.x + nodeB.x) / 2);
    const midY = Math.round((nodeA.y + nodeB.y) / 2);

    const node: MapNode = {
        id: corridorId,
        name,
        type: isCard ? 'bonus' : 'property',
        x: midX,
        y: midY,
        next: [nodeA.id, nodeB.id],
        properties: [],
        amount: isCard ? 100 : undefined,
    };

    nodeA.next.push(corridorId);
    nodeB.next.push(corridorId);

    const edges: MapEdge[] = [
        { from: Math.min(nodeA.id, corridorId), to: Math.max(nodeA.id, corridorId) },
        { from: Math.min(nodeB.id, corridorId), to: Math.max(nodeB.id, corridorId) },
    ];

    return { node, edges };
}

/**
 * ノード配列とエッジ配列からGameMapを構築する
 */
function buildGameMap(allNodes: MapNode[], allEdges: MapEdge[]): GameMap {
    return {
        nodes: Object.fromEntries(allNodes.map(n => [n.id, n])),
        edges: allEdges,
        startNodeId: allNodes[0].id,
    };
}

// ========== マップ1: 五つの島 ==========
// 正方形の四隅＋中央に3×3クラスターを配置

function buildFiveIslands(): GameMap {
    const spacing = 60;
    const clusterGap = 400;

    // 5つのクラスター（四隅＋中央）
    const nw = createCluster(200, 200, spacing, 0, '北西');
    const ne = createCluster(200 + clusterGap, 200, spacing, 9, '北東');
    const center = createCluster(200 + clusterGap / 2, 200 + clusterGap / 2, spacing, 18, '中央');
    const sw = createCluster(200, 200 + clusterGap, spacing, 27, '南西');
    const se = createCluster(200 + clusterGap, 200 + clusterGap, spacing, 36, '南東');

    const allNodes = [...nw.nodes, ...ne.nodes, ...center.nodes, ...sw.nodes, ...se.nodes];
    const allEdges = [...nw.internalEdges, ...ne.internalEdges, ...center.internalEdges, ...sw.internalEdges, ...se.internalEdges];

    let nextId = 45;

    // NW → Center（NW右下 → Center左上）
    const c1 = createCorridor(nw.nodes[8], center.nodes[0], nextId++, '北西道', true);
    allNodes.push(c1.node); allEdges.push(...c1.edges);

    // NE → Center（NE左下 → Center右上）
    const c2 = createCorridor(ne.nodes[6], center.nodes[2], nextId++, '北東道', false);
    allNodes.push(c2.node); allEdges.push(...c2.edges);

    // SW → Center（SW右上 → Center左下）
    const c3 = createCorridor(sw.nodes[2], center.nodes[6], nextId++, '南西道', false);
    allNodes.push(c3.node); allEdges.push(...c3.edges);

    // SE → Center（SE左上 → Center右下）
    const c4 = createCorridor(se.nodes[0], center.nodes[8], nextId++, '南東道', true);
    allNodes.push(c4.node); allEdges.push(...c4.edges);

    // NW → NE（NW右上 → NE左上）
    const c5 = createCorridor(nw.nodes[2], ne.nodes[0], nextId++, '北方道', true);
    allNodes.push(c5.node); allEdges.push(...c5.edges);

    // SW → SE（SW右下 → SE左下）
    const c6 = createCorridor(sw.nodes[8], se.nodes[6], nextId++, '南方道', true);
    allNodes.push(c6.node); allEdges.push(...c6.edges);

    // NW → SW（NW左下 → SW左上）
    const c7 = createCorridor(nw.nodes[6], sw.nodes[0], nextId++, '西方道', false);
    allNodes.push(c7.node); allEdges.push(...c7.edges);

    // NE → SE（NE右下 → SE右上）
    const c8 = createCorridor(ne.nodes[8], se.nodes[2], nextId++, '東方道', false);
    allNodes.push(c8.node); allEdges.push(...c8.edges);

    return buildGameMap(allNodes, allEdges);
}

// ========== マップ2: 二大陸 ==========
// 左右2つの大きなクラスター＋中央の橋

function buildTwinContinents(): GameMap {
    const spacing = 60;

    // 左大陸（3×3 × 2クラスター分を上下に重ねる）
    const leftTop = createCluster(200, 200, spacing, 0, '左上');
    const leftBot = createCluster(200, 400, spacing, 9, '左下');

    // 右大陸
    const rightTop = createCluster(700, 200, spacing, 18, '右上');
    const rightBot = createCluster(700, 400, spacing, 27, '右下');

    const allNodes = [...leftTop.nodes, ...leftBot.nodes, ...rightTop.nodes, ...rightBot.nodes];
    const allEdges = [...leftTop.internalEdges, ...leftBot.internalEdges, ...rightTop.internalEdges, ...rightBot.internalEdges];

    let nextId = 36;

    // 左大陸 内部接続（上↔下）
    const lc = createCorridor(leftTop.nodes[7], leftBot.nodes[1], nextId++, '左内道', false);
    allNodes.push(lc.node); allEdges.push(...lc.edges);

    // 右大陸 内部接続（上↔下）
    const rc = createCorridor(rightTop.nodes[7], rightBot.nodes[1], nextId++, '右内道', false);
    allNodes.push(rc.node); allEdges.push(...rc.edges);

    // 橋（左大陸右端 → 右大陸左端）- 上段
    const bridge1 = createCorridor(leftTop.nodes[5], rightTop.nodes[3], nextId++, '北の橋', true);
    allNodes.push(bridge1.node); allEdges.push(...bridge1.edges);

    // 橋 - 下段
    const bridge2 = createCorridor(leftBot.nodes[5], rightBot.nodes[3], nextId++, '南の橋', true);
    allNodes.push(bridge2.node); allEdges.push(...bridge2.edges);

    return buildGameMap(allNodes, allEdges);
}

// ========== マップ3: 環状列島 ==========
// 6つのクラスターが六角形状に環状配置

function buildRingOfFire(): GameMap {
    const spacing = 60;
    const ringRadius = 350;
    const cx = 450;
    const cy = 400;

    const clusters: ReturnType<typeof createCluster>[] = [];
    const clusterNames = ['火山島', '珊瑚島', '密林島', '氷河島', '砂漠島', '鉱山島'];

    // 6つのクラスターを円形に配置
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 - Math.PI / 2; // 上から時計回り
        const clusterX = Math.round(cx + Math.cos(angle) * ringRadius);
        const clusterY = Math.round(cy + Math.sin(angle) * ringRadius);
        clusters.push(createCluster(clusterX, clusterY, spacing, i * 9, clusterNames[i]));
    }

    const allNodes = clusters.flatMap(c => c.nodes);
    const allEdges = clusters.flatMap(c => c.internalEdges);

    let nextId = 54;

    // 環状接続（隣接クラスター同士を繋ぐ）
    for (let i = 0; i < 6; i++) {
        const current = clusters[i];
        const next = clusters[(i + 1) % 6];

        // 各クラスターの最寄りのノード同士を接続
        // current の「次のクラスター方向寄り」のノード → next の「前のクラスター方向寄り」のノード
        const angle = ((i + 0.5) / 6) * Math.PI * 2 - Math.PI / 2;
        const currentEdgeIdx = getBestEdgeNode(current.nodes, angle);
        const nextEdgeIdx = getBestEdgeNode(next.nodes, angle + Math.PI);

        const corridor = createCorridor(
            current.nodes[currentEdgeIdx],
            next.nodes[nextEdgeIdx],
            nextId++,
            `${clusterNames[i]}→${clusterNames[(i + 1) % 6]}`,
            i % 2 === 0 // 交互にカードマスにする
        );
        allNodes.push(corridor.node);
        allEdges.push(...corridor.edges);
    }

    return buildGameMap(allNodes, allEdges);
}

/**
 * クラスター内で指定の角度方向に最も近いノードのインデックスを返す
 */
function getBestEdgeNode(nodes: MapNode[], targetAngle: number): number {
    const cx = nodes.reduce((sum, n) => sum + n.x, 0) / nodes.length;
    const cy = nodes.reduce((sum, n) => sum + n.y, 0) / nodes.length;

    let bestIdx = 0;
    let bestScore = -Infinity;

    nodes.forEach((n, i) => {
        // 目標角度方向へのスコア（内積ベース）
        const dx = n.x - cx;
        const dy = n.y - cy;
        const score = dx * Math.cos(targetAngle) + dy * Math.sin(targetAngle);
        if (score > bestScore) {
            bestScore = score;
            bestIdx = i;
        }
    });

    return bestIdx;
}

// ========== エクスポート ==========

export const TREASURE_MAPS: TreasureMapDef[] = [
    {
        id: 'five_islands',
        name: '五つの島',
        description: '四隅と中央に島が点在。中央制圧 vs 外周確保の戦略が問われる',
        emoji: '🏝️',
        build: buildFiveIslands,
    },
    {
        id: 'twin_continents',
        name: '二大陸',
        description: '左右の大陸を橋が繋ぐ。狭いので略奪バトルが多発！',
        emoji: '🌉',
        build: buildTwinContinents,
    },
    {
        id: 'ring_of_fire',
        name: '環状列島',
        description: '6つの島がリング状に連なる。周回しながら採掘を進めよう',
        emoji: '🔥',
        build: buildRingOfFire,
    },
];

export function getTreasureMap(mapId: string): GameMap {
    const def = TREASURE_MAPS.find(m => m.id === mapId);
    if (!def) {
        // フォールバック: 最初のマップを返す
        return TREASURE_MAPS[0].build();
    }
    return def.build();
}
