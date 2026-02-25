import type { GameMap, MapNode, MapEdge } from './types';

// ========== グループ定義（地方ごと） ==========
// グループ内の物件をすべて所有するとボーナス
export const PROPERTY_GROUPS: Record<string, { label: string; color: string; nodes: number[] }> = {
  hokkaido: { label: '北海道', color: '#60A5FA', nodes: [1, 2] },
  tohoku: { label: '東北', color: '#34D399', nodes: [3, 4, 5, 6] },
  kanto: { label: '関東', color: '#F87171', nodes: [7, 8, 9, 10, 11, 12] },
  chubu: { label: '中部', color: '#FBBF24', nodes: [13, 14, 15, 16, 17] },
  kinki: { label: '近畿', color: '#A78BFA', nodes: [18, 19, 20, 21, 22] },
  chugoku_shikoku: { label: '中国・四国', color: '#F472B6', nodes: [23, 24, 25, 26] },
  kyushu: { label: '九州・沖縄', color: '#FB923C', nodes: [27, 28, 29, 30] },
};

// グループボーナス倍率（全物件所有時）
export const GROUP_BONUS_MULTIPLIER = 1.5;

// ========== マップノード定義 ==========
// 座標は SVG viewport (0-1000 x 0-700) に対応
// 日本地図を模した配置（北＝上、南＝下）

const rawNodes: Array<Omit<MapNode, 'properties'> & { price?: number; baseIncome?: number }> = [
  // ----- スタート -----
  { id: 0, name: 'スタート', type: 'start', x: 720, y: 480, next: [7, 8] },

  // ----- 北海道 -----
  { id: 1, name: '札幌', type: 'property', x: 820, y: 80, next: [2], price: 400, baseIncome: 40, groupId: 'hokkaido', color: '#60A5FA' },
  { id: 2, name: '函館', type: 'property', x: 760, y: 160, next: [3], price: 300, baseIncome: 30, groupId: 'hokkaido', color: '#60A5FA' },

  // ----- 東北 -----
  { id: 3, name: '青森', type: 'property', x: 740, y: 220, next: [4, 5], price: 250, baseIncome: 25, groupId: 'tohoku', color: '#34D399' },
  { id: 4, name: '仙台', type: 'property', x: 720, y: 280, next: [5, 6], price: 350, baseIncome: 35, groupId: 'tohoku', color: '#34D399' },
  { id: 5, name: '山形', type: 'bonus', x: 660, y: 270, next: [6, 17], amount: 150 },
  { id: 6, name: '福島', type: 'property', x: 700, y: 340, next: [11, 17], price: 280, baseIncome: 28, groupId: 'tohoku', color: '#34D399' },

  // ----- 関東 -----
  { id: 7, name: '東京', type: 'property', x: 720, y: 400, next: [8], price: 600, baseIncome: 60, groupId: 'kanto', color: '#F87171' },
  { id: 8, name: '横浜', type: 'property', x: 700, y: 460, next: [14], price: 550, baseIncome: 55, groupId: 'kanto', color: '#F87171' },
  { id: 9, name: '千葉', type: 'penalty', x: 770, y: 430, next: [7, 10], amount: -150 },
  { id: 10, name: '埼玉', type: 'property', x: 760, y: 370, next: [7, 11, 12], price: 400, baseIncome: 40, groupId: 'kanto', color: '#F87171' },
  { id: 11, name: '宇都宮', type: 'property', x: 720, y: 330, next: [], price: 320, baseIncome: 32, groupId: 'kanto', color: '#F87171' },
  { id: 12, name: '前橋', type: 'bonus', x: 660, y: 350, next: [16], amount: 200 },

  // ----- 中部 -----
  { id: 13, name: '名古屋', type: 'property', x: 620, y: 420, next: [19, 21], price: 500, baseIncome: 50, groupId: 'chubu', color: '#FBBF24' },
  { id: 14, name: '静岡', type: 'property', x: 680, y: 480, next: [13], price: 380, baseIncome: 38, groupId: 'chubu', color: '#FBBF24' },
  { id: 15, name: '金沢', type: 'property', x: 580, y: 330, next: [19], price: 360, baseIncome: 36, groupId: 'chubu', color: '#FBBF24' },
  { id: 16, name: '長野', type: 'penalty', x: 640, y: 360, next: [13, 15, 17], amount: -200 },
  { id: 17, name: '新潟', type: 'property', x: 640, y: 290, next: [15], price: 300, baseIncome: 30, groupId: 'chubu', color: '#FBBF24' },

  // ----- 近畿 -----
  { id: 18, name: '大阪', type: 'property', x: 540, y: 450, next: [20, 21, 22], price: 580, baseIncome: 58, groupId: 'kinki', color: '#A78BFA' },
  { id: 19, name: '京都', type: 'property', x: 560, y: 410, next: [18, 20, 32], price: 520, baseIncome: 52, groupId: 'kinki', color: '#A78BFA' },
  { id: 20, name: '神戸', type: 'property', x: 510, y: 460, next: [23, 24], price: 460, baseIncome: 46, groupId: 'kinki', color: '#A78BFA' },
  { id: 21, name: '奈良', type: 'bonus', x: 570, y: 470, next: [22], amount: 100 },
  { id: 22, name: '和歌山', type: 'property', x: 550, y: 510, next: [], price: 280, baseIncome: 28, groupId: 'kinki', color: '#A78BFA' },

  // ----- 中国・四国 -----
  { id: 23, name: '広島', type: 'property', x: 460, y: 470, next: [25, 33], price: 420, baseIncome: 42, groupId: 'chugoku_shikoku', color: '#F472B6' },
  { id: 24, name: '高松', type: 'property', x: 480, y: 530, next: [25, 26], price: 320, baseIncome: 32, groupId: 'chugoku_shikoku', color: '#F472B6' },
  { id: 25, name: '松山', type: 'penalty', x: 430, y: 540, next: [], amount: -100 },
  { id: 26, name: '高知', type: 'property', x: 460, y: 590, next: [25], price: 280, baseIncome: 28, groupId: 'chugoku_shikoku', color: '#F472B6' },

  // ----- 九州・沖縄 -----
  { id: 27, name: '福岡', type: 'property', x: 340, y: 520, next: [28], price: 480, baseIncome: 48, groupId: 'kyushu', color: '#FB923C' },
  { id: 28, name: '熊本', type: 'property', x: 330, y: 570, next: [29], price: 350, baseIncome: 35, groupId: 'kyushu', color: '#FB923C' },
  { id: 29, name: '鹿児島', type: 'bonus', x: 340, y: 630, next: [30], amount: 200 },
  { id: 30, name: '那覇', type: 'property', x: 200, y: 660, next: [], price: 380, baseIncome: 38, groupId: 'kyushu', color: '#FB923C' },

  // ----- 追加分岐ノード -----
  { id: 31, name: '松江', type: 'property', x: 420, y: 420, next: [33], price: 260, baseIncome: 26, groupId: 'chugoku_shikoku', color: '#F472B6' },
  { id: 32, name: '鳥取', type: 'bonus', x: 450, y: 380, next: [31], amount: 150 },
  { id: 33, name: '山口', type: 'property', x: 390, y: 470, next: [27], price: 300, baseIncome: 30, groupId: 'chugoku_shikoku', color: '#F472B6' },
];

const nodes: MapNode[] = rawNodes.map(raw => {
  const node: MapNode = {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    x: raw.x,
    y: raw.y,
    next: raw.next,
    groupId: raw.groupId,
    color: raw.color,
    amount: raw.amount,
    properties: []
  };

  if (raw.type === 'property' && raw.price != null && raw.baseIncome != null) {
    node.properties = [
      { id: `${raw.id}-1`, name: `${raw.name}屋台`, price: Math.floor(raw.price * 0.2), baseIncome: Math.floor(raw.baseIncome * 0.2) },
      { id: `${raw.id}-2`, name: `${raw.name}商店`, price: Math.floor(raw.price * 0.3), baseIncome: Math.floor(raw.baseIncome * 0.3) },
      { id: `${raw.id}-3`, name: `${raw.name}ビル`, price: Math.floor(raw.price * 0.5), baseIncome: Math.floor(raw.baseIncome * 0.5) },
    ];
  }
  return node;
});

// グループIDのノードリストを更新（追加分岐ノードを含む）
PROPERTY_GROUPS.chugoku_shikoku.nodes.push(31, 33);

// ========== エッジと接続の双方向化 ==========
// 片方向の定義から双方向に自動補完する
nodes.forEach(node => {
  node.next.forEach(nextId => {
    const target = nodes.find(n => n.id === nextId);
    if (target && !target.next.includes(node.id)) {
      target.next.push(node.id);
    }
  });
});

const edges: MapEdge[] = [];
nodes.forEach(node => {
  node.next.forEach(toId => {
    // 重複を避けるため、idが小さい方から大きい方へのみedgeを作成
    if (node.id < toId) {
      edges.push({ from: node.id, to: toId });
    }
  });
});

export const GAME_MAP: GameMap = {
  nodes: Object.fromEntries(nodes.map(n => [n.id, n])),
  edges,
  startNodeId: 0,
};

// 目的地候補（物件マスのみ）
export const DESTINATION_CANDIDATES = nodes
  .filter(n => n.type === 'property')
  .map(n => n.id);

// グループIDからグループ情報を取得
export function getGroupInfo(groupId: string) {
  return PROPERTY_GROUPS[groupId] ?? null;
}

// プレイヤーがグループを完全所有しているか
export function isGroupOwned(ownedProperties: string[], groupId: string): boolean {
  const group = PROPERTY_GROUPS[groupId];
  if (!group) return false;
  // グループ内の全ノードの全物件が所有リストに含まれているか
  return group.nodes.every(nodeId => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !node.properties) return true;
    return node.properties.every(prop => ownedProperties.includes(prop.id));
  });
}
