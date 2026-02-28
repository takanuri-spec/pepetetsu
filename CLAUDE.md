# ぺぺテツ (pepetetsu) — AI コーディングガイド

## プロジェクト概要

家族・知人向けのボードゲームWebアプリ。2モード構成：
- **マップすごろく（クラシック）**: 物件購入・家賃収入方式
- **お宝争奪（トレジャーハント）**: 採掘・略奪・カードバトル方式

**URL:** https://pepetetsu-de422.web.app  
**デプロイ:** `npm run build && firebase deploy --only hosting`

---

## 技術スタック

| 項目 | 内容 |
|---|---|
| フレームワーク | React 19 + TypeScript（strict） |
| 状態管理 | Zustand v5 |
| アニメーション | Framer Motion |
| マップ操作 | react-zoom-pan-pinch |
| ビルド | Vite 7 |
| ホスティング | Firebase Hosting |

---

## コード規約（厳守）

### 言語
- コメント・変数・関数名はすべて**意味が一目で分かる名前**で記述
- ドキュメントコメントは**「なぜそうしたのか」**を書く（何をしているかではない）
- 回答・コメントは**日本語**で

### 型安全
- `any` は使用禁止。エンジン関数は `EngineSet` / `EngineGet` 型エイリアスを使う
- `type: ActiveEffect` など既存の型を活用。新しい型は `treasureTypes.ts` か `types.ts` に定義

### 設計パターン
- **Early Return**: 異常系は冒頭で処理してネストを深くしない
- **DRY**: カード定義は `cardDefs.ts` 一か所のみ。コピペ禁止
- **副作用なしの純粋計算**: `calcMiningChance()`・`performSteal()` などはエンジン関数の外に存在し、副作用を持たない

---

## 重要な実装パターン

### ゲームエンジン関数のシグネチャ（必須）

```typescript
// src/game/treasureEngine.ts 冒頭の型を使う
type EngineSet = (partial: Partial<EngineState> | ((s: EngineState) => Partial<EngineState>)) => void;
type EngineGet = () => EngineState;

function myEngineFunction(set: EngineSet, get: EngineGet) { ... }
```

**理由:** `treasureStore` → `treasureEngine` の import 方向のため逆参照は循環になる。

### カードの追加

```typescript
// src/game/cardDefs.ts のみ変更する。他ファイルは不要
export const CARD_EMOJI: Record<CardType, string> = { ... };
export const CARD_STATIC_DATA: Record<CardType, { name, description, isPassive }> = { ... };
// treasureTypes.ts の CardType と ActiveEffectType も更新が必要
```

### トースト通知（結果表示のパターン）

```typescript
// ダイアログは使わない。エンジン内で即解決 → トーストで通知
pushToast(set, get, { category: 'mining', emoji, title, message, playerColor });
pushLog(set, get, { text, emoji, color });  // ログウィンドウにも記録
```

### useMemo の活用（TreasureBoard パターン）

```typescript
// 毎レンダーで重い計算はしない
const dynamicViewBox = useMemo(() => { /* O(nodes) */ }, [nodes]);
const miningChanceCache = useMemo(() => { /* O(nodes) */ }, [nodes, minedNodes, map]);
```

---

## モバイル対応ルール

- ブレークポイント: **768px**（`useIsMobile(768)`）
- スマホ用: `TreasureMobileUI.tsx`（縦レイアウト）/ デスクトップ用: `TreasureGame.tsx`
- マップは `TreasureBoard(isMobile=true)` でスクロール方式に切り替わる
- `isMobile` props でロジック分岐する場合は `if(isMobile) return;` パターンを使う

---

## やってはいけないこと

- `gameStore.ts` と `treasureStore.ts` を混ぜる（片方の state を他方から直接参照しない）
- `mining_result` / `steal_result` / `card_result` フェーズを set する（廃止済み）
- `CARD_EMOJI` を手書きで新たに定義する（`cardDefs.ts` から import）
- `calcMiningChance()` / `performMining()` を引数なしで呼ぶ（3引数目 `gameMap` は必須）

---

## ファイルの役割早見表

| ファイル | 役割 |
|---|---|
| `game/types.ts` | 共通型（MapNode, GameMap, Player, GameSettings...） |
| `game/treasureTypes.ts` | トレジャー専用型（TreasurePlayer, Card, ActiveEffect...） |
| `game/cardDefs.ts` | **カード定義の唯一の場所**（CARD_EMOJI, CARD_STATIC_DATA, getRandomCard） |
| `game/treasureEngine.ts` | トレジャーの全ゲームロジック（914行） |
| `game/engine.ts` | クラシックのゲームロジック（BFS経路計算など） |
| `store/treasureStore.ts` | トレジャーの Zustand ストア |
| `store/gameStore.ts` | ロビー状態 + クラシックゲーム Zustand ストア |
| `game/treasureMaps.ts` | マップ定義（五つの島・二大陸・環状列島） |
| `game/mapMobileGrid.ts` | 「ミニマム」マップ（6×9グリッド、スマホ専用） |
