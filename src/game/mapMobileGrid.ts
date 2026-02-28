import type { GameMap, MapNode, MapEdge } from './types';

export function buildMobileGridMap(): GameMap {
    const cols = 6;
    const rows = 10;
    const spacing = 60;

    // We want the board to roughly center around 0,0 or just start from 100,100
    // If it starts at 40,40, the max width is 40 + 5*60 = 340 (fits iPhone 390 width)
    // Max height is 40 + 9*60 = 580.
    const startX = 40;
    const startY = 40;

    const nodes: MapNode[] = [];
    const edges: MapEdge[] = [];

    // Define some indices to be card nodes (bonus) instead of property
    const cardIndices = new Set([
        0, // top-left
        cols - 1, // top-right
        (rows - 1) * cols, // bottom-left
        rows * cols - 1, // bottom-right
        Math.floor(rows / 2) * cols + Math.floor(cols / 2), // center somewhere
        Math.floor(rows / 2) * cols + 1, // center left
    ]);

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
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

    // Connect them in a grid
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const index = y * cols + x;

            // Connect right
            if (x < cols - 1) {
                const rightIndex = index + 1;
                nodes[index].next.push(rightIndex);
                nodes[rightIndex].next.push(index);
                edges.push({ from: index, to: rightIndex });
            }

            // Connect down
            if (y < rows - 1) {
                const downIndex = index + cols;
                nodes[index].next.push(downIndex);
                nodes[downIndex].next.push(index);
                edges.push({ from: index, to: downIndex });
            }
        }
    }

    // Node 0 is start? In treasure map, start is not used (players spawn randomly),
    // but schema requires a startNodeId.
    return {
        nodes: Object.fromEntries(nodes.map(n => [n.id, n])),
        edges,
        startNodeId: 0,
    };
}
