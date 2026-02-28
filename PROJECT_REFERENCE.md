# ぺぺテツ 詳細仕様・コード構造ガイド

> 作成日: 2026-02-28  
> 対象コミット: `1267e2e`  
> 目的: 1〜2週間の中断後に**ゼロから読み直し不要**で再開するための参照ドキュメント

---

## 1. プロジェクト全体像

### アプリ概要

- **名称:** ぺぺテツ（pepetetsu）
- **URL:** https://pepetetsu-de422.web.app
- **リポジトリ:** https://github.com/takanuri-spec/pepetetsu
- **ターゲット:** 家族・知人との1台PC/スマホ共有プレイ（通信対戦ではない）
- **技術スタック:** React 19 + TypeScript + Zustand + Vite + Firebase Hosting

### 2つのゲームモード

| モード | 選択 | 勝利条件 | 特徴 |
|---|---|---|---|
| **クラシック（マップすごろく）** | ロビーで選択 | 規定ラウンド終了時・総資産最大 | 物件購入・家賃・地域独占 |
| **トレジャーハント（お宝争奪）** | ロビーで選択 | 規定数のお宝を最初に集めた人 | 採掘・略奪・カード |

---

## 2. ディレクトリ構造

```
src/
├── App.tsx                         // ルーティング: lobby → ClassicGame or TreasureGame
├── index.css                       // グローバルCSSデザインシステム
├── store/
│   ├── gameStore.ts                // クラシックモードの Zustand ストア（555行）
│   └── treasureStore.ts            // トレジャーモードの Zustand ストア（188行）
├── game/
│   ├── types.ts                    // 共通型定義（MapNode, GameMap, Player, GameSettings...）
│   ├── engine.ts                   // クラシックゲームのロジック（BFS, 経路計算, 決算）
│   ├── cpu.ts                      // クラシックの CPU 判断ロジック
│   ├── mapData.ts                  // クラシックマップデータ（日本全国）
│   ├── mapCompact.ts               // コンパクトマップ（トレジャー用）
│   ├── mapMobileGrid.ts            // 「ミニマム」マップ（6×9グリッド。スマホ最適化）
│   ├── treasureTypes.ts            // トレジャー専用型（TreasurePlayer, Card, ActiveEffect...）
│   ├── treasureEngine.ts           // トレジャーのコアゲームロジック（914行）
│   ├── treasureMaps.ts             // トレジャーマップ定義（五つの島・二大陸・環状列島）
│   └── cardDefs.ts                 // カード定義の一元管理（CARD_EMOJI / CARD_STATIC_DATA / getRandomCard）
├── components/
│   ├── Lobby/                      // ロビー画面（Lobby.tsx + Lobby.css）
│   ├── ClassicGame/                // クラシックゲーム全体コンポーネント
│   ├── Board/                      // クラシックマップ描画（SVG）
│   ├── GameInfo/                   // クラシックサイドバー
│   ├── Modals/                     // クラシックモーダル
│   ├── TreasureGame/
│   │   ├── TreasureGame.tsx        // デスクトップ版エントリ（ゲーム開始・ルーティング）
│   │   └── TreasureMobileUI.tsx    // モバイル版全画面レイアウト
│   ├── TreasureBoard/              // トレジャーマップ描画（SVG・739行）
│   ├── TreasureGameInfo/           // デスクトップ用サイドバー（プレイヤー状況・カード表示）
│   ├── TreasureGameLog/            // 右下のゲームログウィンドウ（デフォルト非表示）
│   ├── TreasureModals/             // トーストスタック + ゲーム終了モーダル
│   ├── ManualModal/                // 遊び方モーダル
│   └── Dice/                       // サイコロアニメーション
└── hooks/
    └── useIsMobile.ts              // 画面幅で mobile 判定（デフォルト: 768px）
```

---

## 3. 状態管理の設計

### ストアの分離原則

- `gameStore.ts` = ロビー状態 + クラシックゲーム状態
- `treasureStore.ts` = トレジャーゲーム状態（ロビーは gameStore から参照）
- ゲーム開始時: `App.tsx` → `TreasureGame.tsx` の `useEffect` → `gameStore` の settings/lobbyPlayers を読んで `treasureStore.startGame()` を呼ぶ

```typescript
// TreasureGame.tsx の useEffect（ゲーム初期化パターン）
const { settings, lobbyPlayers } = useGameStore.getState();
useTreasureStore.getState().startGame!(settings, lobbyPlayers);
```

### ゲームフェーズ遷移（トレジャー）

```
playing
  ↓ [サイコロ]
route_selection
  ↓ [ルート選択]
playing（移動アニメーション）
  ↓ [到着]
card_target_selection  ← カードのターゲット選択待ち（blow_away のみ）
  ↓ または即座に
playing
  ↓ [ゲーム終了条件]
game_over
```

> **重要:** `mining_result`・`steal_result`・`card_result` フェーズは**現在は使われていない**。  
> これらは旧来のモーダル確認フロー用だったが、toast通知方式に移行して廃止済み。  
> 型定義には残っているが、実際に set されることはない。

---

## 4. トレジャーエンジンの処理フロー

### 移動処理（`_executeMovementChunk`）

1. 移動経路中に**お宝持ちの相手がいるか**を先読み
2. いれば → その手前で止まり（`_handleIntermediateStop`）、**全員に対して順番に略奪発動**
3. いなければ → 着地点まで一気に移動（`_finishTreasureMovement`）

### 着地後の処理（`_finishTreasureMovement`）

1. 着地点に相手がいれば → 全員から略奪（`same_node` 判定・60%成功率）
2. カードマス（`bonus`）なら → `_resolveCardResult()`
3. それ以外 → 封印チェック → `performMining()` で採掘判定

### 採掘確率

```
BASE = 25%
+ 隣接採掘済みマス数 × 25%（最大 100%）
  内訳: 成功の80%が通常(+1)、10%がレア(+2)、10%が罠(-1)
```

### ターン進行（`advanceTreasureTurn`）

- 次のプレイヤーのアクティブエフェクトを1ターン減らす（0になったら削除）
- `paralyzed` 状態なら 800ms 後に再度 `advanceTreasureTurn`（ターンスキップ）
- CPU なら 1000ms 後に `_cpuTreasureTurn`

---

## 5. カードシステム

### 定義の一元管理（`src/game/cardDefs.ts`）

カードを追加・変更する場合は **必ず `cardDefs.ts` だけを変更する**。  
`CARD_EMOJI` と `CARD_STATIC_DATA` はここから各コンポーネントが import している。

### カード一覧

| 型（`CardType`） | 名称 | パッシブ | 効果 |
|---|---|---|---|
| `power_up` | 略奪のお守り | ✅ | 所持中は略奪成功率+15% |
| `substitute` | 身代わり人形 | ✅ | 奪われそうになった時1回だけ防いで消滅 |
| `seal` | 封印のツボ | ❌ | 対象を3ターン採掘不能（`sealed` エフェクト） |
| `blow_away` | ぶっ飛ばしハンマー | ❌ | 対象をマップ上の任意ノードにワープ（マス選択が必要 → `card_target_selection` フェーズ） |
| `paralysis` | ビリビリ罠 | ❌ | 対象を1回お休み（`paralyzed` エフェクト） |
| `phone_fraud` | 電話詐欺カード | ❌ | 対象1人から即時略奪（same_node 判定・60%成功率） |
| `dice_1` | 1マスカード | ❌ | 次サイコロが必ず1（`dice_1` エフェクト） |
| `dice_10` | 10マスカード | ❌ | 次サイコロが必ず10（`dice_10` エフェクト） |

### アクティブエフェクト（`ActiveEffectType`）

```typescript
type ActiveEffectType = 'sealed' | 'paralyzed' | 'dice_1' | 'dice_10';
```

- **エフェクト適用:** `_useCard()` が players 配列を更新して set
- **カウントダウン:** `advanceTreasureTurn()` で次プレイヤーの番になったとき -1
- **0になったら:** filter で削除

---

## 6. トレジャーマップ

### マップ一覧

| ID | 名称 | ファイル | 特徴 |
|---|---|---|---|
| `mobile_grid` | 📱 ミニマム | `mapMobileGrid.ts` | 6×9、中央（行3-5、列2-3）が空洞。スマホ専用 |
| `five_islands` | 🏝️ 五つの島 | `treasureMaps.ts` | 3×3クラスター×5、回廊でつないだ形 |
| `twin_continents` | 🌉 二大陸 | `treasureMaps.ts` | 2大陸を橋で連結、略奪多発 |
| `ring_of_fire` | 🔥 環状列島 | `treasureMaps.ts` | 6島がリング状 |
| `compact` | ⚡ コンパクト | `mapCompact.ts` | 3エリアの密集マップ |

### 新マップの追加手順

1. `treasureMaps.ts` に `TREASURE_MAPS` 配列のエントリを追加
2. `build` 関数を実装（または `buildMobileGridMap()` のような外部ファイルで定義して import）
3. `Lobby.tsx` のマップ選択UI は `TREASURE_MAPS` を自動で読むので変更不要

---

## 7. UI のプラットフォーム分岐

```typescript
// useIsMobile.ts (768px 未満がモバイル扱い)
export function useIsMobile(breakpoint = 768): boolean
```

- **デスクトップ:** `TreasureGame.tsx` → `TreasureBoard` + `TreasureSidebar` + `TreasureGameLog`
- **モバイル:** `TreasureMobileUI.tsx` → 縦レイアウト全画面、`TreasureBoard(isMobile=true)` でスクロール制御

### スマホ特有の仕様

- ロビーは縦スクロール・全幅タイル（`Lobby.css` の `@media (max-width: 768px)` セクション）
- マップ選択はロビー画面に **セレクトボックス形式ではなくボタン一覧**
- マップ表示は **SVG スクロール** 方式（react-zoom-pan-pinch の panning を無効、overflow: auto）
- ルート選択は **タップ→ポップアップ（上にルートボタン表示）** 方式
- 封印中のプレイヤー名が **赤色** で表示（`TreasureMobileUI.tsx` + `TreasureSidebar.tsx`）

---

## 8. 通知システム（Toast）

### 採掘・略奪・カード取得の結果通知

- 結果はエンジン内で即座に適用され、`phase` は `playing` のまま
- Toast: 画面上部に 3秒間表示（`pushToast()`）
- Log: `gameLogs` に追記（`pushLog()`）→ 右下の📜ログウィンドウに表示

```typescript
// エンジン内でのトースト発行パターン
pushToast(set, get, { category: 'mining', emoji, title, message, playerColor });
pushLog(set, get, { text: `${title} ${message}`, emoji, color });
```

### `TreasureGameLog` の設計

- `gameLogs`（Store）: エンジンが pushLog で書き込む（採掘・略奪）
- `displayLogs`（ローカル useState）: ターン開始・カード取得など UI 側で補完
- 両者をタイムスタンプでマージして表示

---

## 9. 略奪の確率定数

```typescript
// src/game/treasureEngine.ts
export const STEAL_PASS_BY_CHANCE     = 0.30;  // すれ違い成功率
export const STEAL_SAME_NODE_CHANCE   = 0.60;  // 着地時成功率（phone_fraud card も同じ）
export const COUNTER_PASS_BY_CHANCE   = 0.15;  // すれ違いカウンター率
export const COUNTER_SAME_NODE_CHANCE = 0.30;  // 着地カウンター率
export const BASE_MINING_CHANCE       = 0.25;  // 採掘基本確率
```

---

## 10. 勝利条件チェック（`checkTreasureGameOver`）

1. `settings.targetTreasures`（デフォルト10）以上のお宝を持つプレイヤーがいれば → 即勝利
2. マップ上の全 `property` ノードが掘り尽くされた → サドンデス（所持数トップが勝利）

---

## 11. 型安全の設計規則（2026-02 リファクタリング後）

### エンジン関数の型シグネチャ

```typescript
// src/game/treasureEngine.ts 冒頭に定義
interface EngineState extends TreasureGameState {
    routeInfos: RouteInfo[];
    hoveredRouteId: string | null;
    isRollingDice: boolean;
    rollingDiceDisplay: number | null;
}
type EngineSet = (partial: Partial<EngineState> | ((s: EngineState) => Partial<EngineState>)) => void;
type EngineGet = () => EngineState;
```

**理由:** `treasureStore.ts` → `treasureEngine.ts` の方向に import が走るため、  
逆方向（エンジン → ストア型）参照は循環 import になる。解決策として  
`TreasureGameState` を拡張した `EngineState` をエンジン内部に定義している。

### `any` の残存

現在 `any` は `TreasureBoard.tsx` の `getRouteByMouseAngle` 関数引数にのみ残っている（DOM操作上の都合）。  
他はすべて型付け済み（`ActiveEffect`, `TreasurePlayer`, `RouteInfo` など）。

---

## 12. 次のやりたいことリスト（idea.md より）

`/Users/matsuitakanori/Projects/pepetetsu/idea.md` に随時メモあり。  
再開時はまずここを確認する。

---

## 13. 既知の妥協・将来課題

| 項目 | 現状 | 将来案 |
|---|---|---|
| クライアントサイドゲームロジック | ブラウザコンソールで不正可能 | 知人同士なら許容。大会用途なら Firebase Functions で検証 |
| `Math.random()` | 予測可能な乱数 | 知人プレイなら許容 |
| タイマー（setInterval）のキャンセル | リセット時に残る可能性あり | `useRef` でタイマーIDを管理する |
| `gameStore.ts` の規模 | 555行（クラシックロジック内包） | `classicEngine.ts` に抽出 |
| CPU の card_blow_away 対応 | CPU は blow_away カードを使わない | `_cpuTreasureTurn` に blow_away の判断ロジックを追加 |
