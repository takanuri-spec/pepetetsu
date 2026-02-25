import type { Player, GameMap, StationProperty } from './types';
import type { RouteInfo } from './engine';

// CPU の購入判断
// 戦略: 所持金の 60% 以内 かつ グループ完成が近い物件を優先
export function decideBuy(
  player: Player,
  prop: StationProperty,
  map: GameMap
): boolean {
  // node自体はgroup確認のために逆引きが必要
  const node = Object.values(map.nodes).find(n => n.properties?.some(p => p.id === prop.id));
  if (!node) return false;

  // 所持金の 60% より高ければ買わない
  if (prop.price > player.money * 0.6) return false;

  // グループを確認して残り1個ならば積極的に購入
  if (node.groupId) {
    const group = node.groupId;
    const groupNodes = Object.values(map.nodes).filter(n => n.groupId === group);
    const ownedInGroup = groupNodes.filter(n => n.properties?.every(p => player.ownedProperties.includes(p.id)));
    const remaining = groupNodes.length - ownedInGroup.length;

    if (remaining === 1) return prop.price <= player.money * 0.9;
    if (remaining === 2) return prop.price <= player.money * 0.7;
  }

  // 収益率チェック: 10サイクルで回収できるか（概算）
  const incomePerCycle = prop.baseIncome ?? 0;
  const paybackCycles = incomePerCycle > 0 ? prop.price / incomePerCycle : Infinity;
  return paybackCycles <= 10;
}

// CPU のルート選択
// 戦略: 目的地への距離が最も近いルートを選ぶ。到達できれば優先。
export function decideRoute(
  routeInfos: RouteInfo[]
): RouteInfo {
  // 目的地にピッタリ止まれるルートを最優先
  const reachDest = routeInfos.filter(r => r.distToDestination === 0);
  if (reachDest.length > 0) return reachDest[Math.floor(Math.random() * reachDest.length)];

  // 次に目的地に近いルートを選ぶ
  const withDist = routeInfos.filter(r => r.distToDestination !== null);
  if (withDist.length > 0) {
    const minDist = Math.min(...withDist.map(r => r.distToDestination as number));
    const closest = withDist.filter(r => r.distToDestination === minDist);
    if (closest.length > 0) {
      return closest[Math.floor(Math.random() * closest.length)];
    }
  }

  // それ以外はランダム
  return routeInfos[Math.floor(Math.random() * routeInfos.length)];
}
