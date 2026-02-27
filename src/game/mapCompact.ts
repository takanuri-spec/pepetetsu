import type { GameMap, MapNode, MapEdge } from './types';

const rawNodes: Array<MapNode> = [
  {
    "id": 1,
    "name": "L-0-0",
    "type": "property",
    "x": 0,
    "y": 100,
    "next": [
      2,
      4
    ]
  },
  {
    "id": 2,
    "name": "L-0-1",
    "type": "property",
    "x": 100,
    "y": 100,
    "next": [
      3,
      1,
      5
    ]
  },
  {
    "id": 3,
    "name": "L-0-2",
    "type": "bonus",
    "x": 200,
    "y": 100,
    "next": [
      2,
      6,
      15
    ]
  },
  {
    "id": 4,
    "name": "L-1-0",
    "type": "property",
    "x": 0,
    "y": 200,
    "next": [
      5,
      7,
      1
    ]
  },
  {
    "id": 5,
    "name": "L-1-1",
    "type": "property",
    "x": 100,
    "y": 200,
    "next": [
      6,
      4,
      8,
      2
    ]
  },
  {
    "id": 6,
    "name": "L-1-2",
    "type": "property",
    "x": 200,
    "y": 200,
    "next": [
      5,
      9,
      3
    ]
  },
  {
    "id": 7,
    "name": "L-2-0",
    "type": "property",
    "x": 0,
    "y": 300,
    "next": [
      8,
      4
    ]
  },
  {
    "id": 8,
    "name": "L-2-1",
    "type": "property",
    "x": 100,
    "y": 300,
    "next": [
      9,
      7,
      5
    ]
  },
  {
    "id": 9,
    "name": "L-2-2",
    "type": "bonus",
    "x": 200,
    "y": 300,
    "next": [
      8,
      6,
      25
    ]
  },
  {
    "id": 10,
    "name": "M-0-0",
    "type": "property",
    "x": 400,
    "y": 0,
    "next": [
      11,
      15
    ]
  },
  {
    "id": 11,
    "name": "M-0-1",
    "type": "bonus",
    "x": 500,
    "y": 0,
    "next": [
      12,
      10,
      16
    ]
  },
  {
    "id": 12,
    "name": "M-0-2",
    "type": "penalty",
    "x": 600,
    "y": 0,
    "next": [
      13,
      11,
      17
    ]
  },
  {
    "id": 13,
    "name": "M-0-3",
    "type": "property",
    "x": 700,
    "y": 0,
    "next": [
      14,
      12,
      18
    ]
  },
  {
    "id": 14,
    "name": "M-0-4",
    "type": "property",
    "x": 800,
    "y": 0,
    "next": [
      13,
      19
    ]
  },
  {
    "id": 15,
    "name": "M-1-0",
    "type": "property",
    "x": 400,
    "y": 100,
    "next": [
      16,
      20,
      10,
      3
    ]
  },
  {
    "id": 16,
    "name": "M-1-1",
    "type": "property",
    "x": 500,
    "y": 100,
    "next": [
      17,
      15,
      21,
      11
    ]
  },
  {
    "id": 17,
    "name": "M-1-2",
    "type": "property",
    "x": 600,
    "y": 100,
    "next": [
      18,
      16,
      22,
      12
    ]
  },
  {
    "id": 18,
    "name": "M-1-3",
    "type": "property",
    "x": 700,
    "y": 100,
    "next": [
      19,
      17,
      23,
      13
    ]
  },
  {
    "id": 19,
    "name": "M-1-4",
    "type": "property",
    "x": 800,
    "y": 100,
    "next": [
      18,
      24,
      14,
      35
    ]
  },
  {
    "id": 20,
    "name": "M-2-0",
    "type": "property",
    "x": 400,
    "y": 200,
    "next": [
      21,
      25,
      15
    ]
  },
  {
    "id": 21,
    "name": "M-2-1",
    "type": "property",
    "x": 500,
    "y": 200,
    "next": [
      22,
      20,
      26,
      16
    ]
  },
  {
    "id": 22,
    "name": "M-2-2",
    "type": "property",
    "x": 600,
    "y": 200,
    "next": [
      23,
      21,
      27,
      17
    ]
  },
  {
    "id": 23,
    "name": "M-2-3",
    "type": "property",
    "x": 700,
    "y": 200,
    "next": [
      24,
      22,
      28,
      18
    ]
  },
  {
    "id": 24,
    "name": "M-2-4",
    "type": "property",
    "x": 800,
    "y": 200,
    "next": [
      23,
      29,
      19
    ]
  },
  {
    "id": 25,
    "name": "M-3-0",
    "type": "property",
    "x": 400,
    "y": 300,
    "next": [
      26,
      30,
      20,
      9
    ]
  },
  {
    "id": 26,
    "name": "M-3-1",
    "type": "property",
    "x": 500,
    "y": 300,
    "next": [
      27,
      25,
      31,
      21
    ]
  },
  {
    "id": 27,
    "name": "M-3-2",
    "type": "property",
    "x": 600,
    "y": 300,
    "next": [
      28,
      26,
      32,
      22
    ]
  },
  {
    "id": 28,
    "name": "M-3-3",
    "type": "property",
    "x": 700,
    "y": 300,
    "next": [
      29,
      27,
      33,
      23
    ]
  },
  {
    "id": 29,
    "name": "M-3-4",
    "type": "property",
    "x": 800,
    "y": 300,
    "next": [
      28,
      34,
      24,
      43
    ]
  },
  {
    "id": 30,
    "name": "M-4-0",
    "type": "property",
    "x": 400,
    "y": 400,
    "next": [
      31,
      25
    ]
  },
  {
    "id": 31,
    "name": "M-4-1",
    "type": "property",
    "x": 500,
    "y": 400,
    "next": [
      32,
      30,
      26
    ]
  },
  {
    "id": 32,
    "name": "M-4-2",
    "type": "bonus",
    "x": 600,
    "y": 400,
    "next": [
      33,
      31,
      27
    ]
  },
  {
    "id": 33,
    "name": "M-4-3",
    "type": "bonus",
    "x": 700,
    "y": 400,
    "next": [
      34,
      32,
      28
    ]
  },
  {
    "id": 34,
    "name": "M-4-4",
    "type": "property",
    "x": 800,
    "y": 400,
    "next": [
      33,
      29
    ]
  },
  {
    "id": 35,
    "name": "R-0-0",
    "type": "property",
    "x": 1000,
    "y": 50,
    "next": [
      36,
      39,
      19
    ]
  },
  {
    "id": 36,
    "name": "R-0-1",
    "type": "property",
    "x": 1100,
    "y": 50,
    "next": [
      37,
      35,
      40
    ]
  },
  {
    "id": 37,
    "name": "R-0-2",
    "type": "property",
    "x": 1200,
    "y": 50,
    "next": [
      38,
      36,
      41
    ]
  },
  {
    "id": 38,
    "name": "R-0-3",
    "type": "property",
    "x": 1300,
    "y": 50,
    "next": [
      37,
      42
    ]
  },
  {
    "id": 39,
    "name": "R-1-0",
    "type": "property",
    "x": 1000,
    "y": 150,
    "next": [
      40,
      43,
      35
    ]
  },
  {
    "id": 40,
    "name": "R-1-1",
    "type": "property",
    "x": 1100,
    "y": 150,
    "next": [
      41,
      39,
      44,
      36
    ]
  },
  {
    "id": 41,
    "name": "R-1-2",
    "type": "bonus",
    "x": 1200,
    "y": 150,
    "next": [
      42,
      40,
      45,
      37
    ]
  },
  {
    "id": 42,
    "name": "R-1-3",
    "type": "property",
    "x": 1300,
    "y": 150,
    "next": [
      41,
      46,
      38
    ]
  },
  {
    "id": 43,
    "name": "R-2-0",
    "type": "property",
    "x": 1000,
    "y": 250,
    "next": [
      44,
      47,
      39,
      29
    ]
  },
  {
    "id": 44,
    "name": "R-2-1",
    "type": "property",
    "x": 1100,
    "y": 250,
    "next": [
      45,
      43,
      48,
      40
    ]
  },
  {
    "id": 45,
    "name": "R-2-2",
    "type": "property",
    "x": 1200,
    "y": 250,
    "next": [
      46,
      44,
      49,
      41
    ]
  },
  {
    "id": 46,
    "name": "R-2-3",
    "type": "property",
    "x": 1300,
    "y": 250,
    "next": [
      45,
      50,
      42
    ]
  },
  {
    "id": 47,
    "name": "R-3-0",
    "type": "property",
    "x": 1000,
    "y": 350,
    "next": [
      48,
      43
    ]
  },
  {
    "id": 48,
    "name": "R-3-1",
    "type": "bonus",
    "x": 1100,
    "y": 350,
    "next": [
      49,
      47,
      44
    ]
  },
  {
    "id": 49,
    "name": "R-3-2",
    "type": "bonus",
    "x": 1200,
    "y": 350,
    "next": [
      50,
      48,
      45
    ]
  },
  {
    "id": 50,
    "name": "R-3-3",
    "type": "property",
    "x": 1300,
    "y": 350,
    "next": [
      49,
      46
    ]
  }
];

export const COMPACT_GAME_MAP: GameMap = {
  nodes: Object.fromEntries(rawNodes.map(n => [n.id, n])),
  edges: [],
  startNodeId: 2,
};

const edges: MapEdge[] = [];
const seenEdges = new Set<string>();

rawNodes.forEach((node) => {
  node.next.forEach((nextId) => {
    const smaller = Math.min(node.id, nextId);
    const larger = Math.max(node.id, nextId);
    const edgeKey = `${smaller}-${larger}`;
    if (!seenEdges.has(edgeKey)) {
      seenEdges.add(edgeKey);
      edges.push({ from: smaller, to: larger });
    }
  });
});

COMPACT_GAME_MAP.edges = edges;
