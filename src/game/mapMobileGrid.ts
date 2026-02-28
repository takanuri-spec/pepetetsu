import type { GameMap, MapNode, MapEdge } from './types';

export function buildMobileGridMap(): GameMap {
    const cols = 6;
    const rows = 9;
    const spacing = 60;

    const startX = 40;
    const startY = 40;

    const isBlank = (x: number, y: number) => {
        // 4-6 rows (index 3, 4, 5), 3-4 columns (index 2, 3)
        return (x === 2 || x === 3) && (y >= 3 && y <= 5);
    };

    const nodes: MapNode[] = [];
    const edges: MapEdge[] = [];

    const cardIndices = new Set([
        0, // top-left
        cols - 1, // top-right
        (rows - 1) * cols, // bottom-left
        rows * cols - 1, // bottom-right
        4 * cols + 0, // middle-left
        4 * cols + 5, // middle-right
    ]);

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (isBlank(x, y)) continue;

            const index = y * cols + x;
            const isCard = cardIndices.has(index);

            nodes.push({
                id: index,
                name: `M${x}-${y}`,
                type: isCard ? 'bonus' : 'property',
                x: startX + x * spacing,
                y: startY + y * spacing,
                next: [],
                properties: [],
                amount: isCard ? 100 : undefined,
            });
        }
    }

    const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (isBlank(x, y)) continue;

            const index = y * cols + x;

            // Connect right
            if (x < cols - 1 && !isBlank(x + 1, y)) {
                const rightIndex = y * cols + (x + 1);
                if (nodeMap[rightIndex]) {
                    nodeMap[index].next.push(rightIndex);
                    nodeMap[rightIndex].next.push(index);
                    edges.push({ from: index, to: rightIndex });
                }
            }

            // Connect down
            if (y < rows - 1 && !isBlank(x, y + 1)) {
                const downIndex = (y + 1) * cols + x;
                if (nodeMap[downIndex]) {
                    nodeMap[index].next.push(downIndex);
                    nodeMap[downIndex].next.push(index);
                    edges.push({ from: index, to: downIndex });
                }
            }
        }
    }

    return {
        nodes: nodeMap,
        edges,
        startNodeId: 0,
    };
}
