import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import type { LobbyPlayer } from '../../game/types';
import { PLAYER_COLORS, COLOR_LABELS, COLOR_HEX } from '../../game/types';
import { TREASURE_MAPS } from '../../game/treasureMaps';
import { ManualModal } from '../ManualModal/ManualModal';
import './Lobby.css';

// ========== デフォルトプレイヤー名候補（どうぶつ・のりもの・たべもの）==========
const DEFAULT_NAMES = [
  'ライオン', 'パンダ', 'ペンギン', 'キリン', 'ゾウ',
  'うさぎ', 'ねこ', 'いぬ', 'たぬき', 'きつね',
  'こあら', 'かば', 'かめ', 'とら', 'おさる',
  'しんかんせん', 'バス', 'ロケット', 'ひこうき', 'ヘリコプター',
  'バイク', 'トラック', 'ボート', 'せんすいかん', 'UFO',
  'カレー', 'ラーメン', 'すし', 'ピザ', 'たこやき',
];

function randomDefaultName(used: string[]): string {
  const remaining = DEFAULT_NAMES.filter(n => !used.includes(n));
  if (remaining.length === 0) return 'プレイヤー';
  return remaining[Math.floor(Math.random() * remaining.length)];
}

// ========== Segment Control コンポーネント ==========
interface SegmentOption<T> {
  label: string;
  value: T;
}

function SegmentControl<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segment-control">
      {options.map(opt => (
        <button
          key={String(opt.value)}
          className={`segment-btn ${value === opt.value ? 'segment-btn--active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ========== ロビー本体 ==========
export function Lobby() {
  const state = useGameStore();
  const [isManualOpen, setIsManualOpen] = useState(false);

  if (state.phase !== 'lobby') return null;

  const { settings, lobbyPlayers, updateSettings, updateLobbyPlayers, startGame } = state;

  function updatePlayer(index: number, patch: Partial<LobbyPlayer>) {
    const updated = lobbyPlayers.map((p, i) => (i === index ? { ...p, ...patch } : p));
    updateLobbyPlayers(updated);
  }

  function randomizeName(index: number) {
    const usedNames = lobbyPlayers.map((p, i) => i !== index ? p.name : '').filter(Boolean);
    updatePlayer(index, { name: randomDefaultName(usedNames) });
  }

  const canStart = lobbyPlayers.length >= 2 && lobbyPlayers.length <= 4;
  const isTreasure = settings.gameMode === 'treasure';

  return (
    <div className="lobby-screen">
      {/* 背景画像 */}
      <div className="lobby-bg" />

      {/* タイトルロゴ */}
      <header className="lobby-header">
        <div className="lobby-logo-wrap">
          <span className="lobby-logo-dice">🎲</span>
          <h1 className="lobby-logo-title">ペペテツ</h1>
          <span className="lobby-logo-dice">🎲</span>
        </div>
        <button className="lobby-manual-btn desktop-only" onClick={() => setIsManualOpen(true)}>
          📖 あそびかた
        </button>
      </header>

      {/* メインコンテンツ */}
      <div className="lobby-main">

        {/* 左ペイン：モード選択 */}
        <div className="lobby-modes">
          <button
            className={`mode-card ${settings.gameMode === 'classic' ? 'mode-card--active' : ''}`}
            onClick={() => updateSettings({ gameMode: 'classic' })}
          >
            <img src="/mode_classic.png" alt="マップすごろく" className="mode-card-img" />
            {settings.gameMode === 'classic' && <div className="mode-card-check">✔</div>}
          </button>

          <button
            className={`mode-card ${isTreasure ? 'mode-card--active' : ''}`}
            onClick={() => updateSettings({ gameMode: 'treasure' })}
          >
            <img src="/mode_treasure.png" alt="トレジャーハント" className="mode-card-img" />
            {isTreasure && <div className="mode-card-check">✔</div>}
          </button>
        </div>

        {/* 右ペイン：設定 */}
        <div className="lobby-settings-pane">

          {/* スタートボタン */}
          <button
            className="start-btn"
            onClick={startGame}
            disabled={!canStart}
          >
            ⚡ ゲームスタート！
          </button>

          {/* ゲーム設定 */}
          <div className="lobby-panel">
            <p className="lobby-pane-label">⚙ ゲーム設定</p>

            {/* クラシック設定 */}
            {settings.gameMode === 'classic' && (
              <>
                <div className="setting-row">
                  <span className="setting-label">🗓 総ラウンド数</span>
                  <SegmentControl
                    options={[
                      { label: '12（短）', value: 12 },
                      { label: '20（標準）', value: 20 },
                      { label: '30（長）', value: 30 },
                    ]}
                    value={settings.totalRounds}
                    onChange={v => updateSettings({ totalRounds: v })}
                  />
                </div>
                <div className="setting-row">
                  <span className="setting-label">💰 初期所持金</span>
                  <SegmentControl
                    options={[
                      { label: '800（厳）', value: 800 },
                      { label: '1000（標）', value: 1000 },
                      { label: '1500（楽）', value: 1500 },
                    ]}
                    value={settings.startingMoney}
                    onChange={v => updateSettings({ startingMoney: v })}
                  />
                </div>
                <div className="setting-row">
                  <span className="setting-label">🔄 決算サイクル</span>
                  <SegmentControl
                    options={[
                      { label: '3R', value: 3 },
                      { label: '4R', value: 4 },
                      { label: '5R', value: 5 },
                    ]}
                    value={settings.cycleLength}
                    onChange={v => updateSettings({ cycleLength: v })}
                  />
                </div>
                <div className="setting-row">
                  <span className="setting-label">🎯 目的地ボーナス</span>
                  <SegmentControl
                    options={[
                      { label: '300', value: 300 },
                      { label: '500', value: 500 },
                      { label: '800', value: 800 },
                    ]}
                    value={settings.destinationBonusAmount}
                    onChange={v => updateSettings({ destinationBonusAmount: v })}
                  />
                </div>
              </>
            )}

            {/* トレジャー設定 */}
            {isTreasure && (
              <>
                <div className="setting-row">
                  <span className="setting-label">🗺 マップ</span>
                  <div className="map-selector">
                    {TREASURE_MAPS.map(m => (
                      <button
                        key={m.id}
                        className={`map-btn ${settings.treasureMapId === m.id ? 'map-btn--active' : ''}`}
                        onClick={() => updateSettings({ treasureMapId: m.id })}
                        title={m.description}
                      >
                        <span>{m.emoji}</span>
                        <span>{m.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="setting-row">
                  <span className="setting-label">💎 目標お宝数</span>
                  <SegmentControl
                    options={[
                      { label: '5個', value: 5 },
                      { label: '10個', value: 10 },
                      { label: '15個', value: 15 },
                      { label: '20個', value: 20 },
                    ]}
                    value={settings.targetTreasures ?? 10}
                    onChange={v => updateSettings({ targetTreasures: v })}
                  />
                </div>
              </>
            )}
          </div>

          {/* プレイヤー設定 */}
          <div className="lobby-panel">
            <p className="lobby-pane-label">👥 プレイヤー設定</p>
            <div className="player-list">
              {lobbyPlayers.map((player, index) => (
                <div className="player-row" key={index}>
                  {/* 色選択 */}
                  <div className="color-dots">
                    {PLAYER_COLORS.map(color => {
                      const usedByOther = lobbyPlayers.some((p, i) => i !== index && p.color === color);
                      return (
                        <button
                          key={color}
                          className={`color-dot ${player.color === color ? 'color-dot--active' : ''}`}
                          style={{ background: COLOR_HEX[color], opacity: usedByOther ? 0.2 : 1 }}
                          disabled={usedByOther}
                          onClick={() => updatePlayer(index, { color })}
                          title={COLOR_LABELS[color]}
                        />
                      );
                    })}
                  </div>

                  {/* 名前入力 */}
                  <div className="player-name-wrap">
                    <input
                      className="player-input"
                      value={player.name}
                      onChange={e => updatePlayer(index, { name: e.target.value })}
                      maxLength={12}
                    />
                    <button
                      className="name-random-btn"
                      onClick={() => randomizeName(index)}
                      title="ランダムな名前にする"
                    >🎲</button>
                  </div>

                  {/* 人間/CPU */}
                  <SegmentControl
                    options={[
                      { label: '👤', value: 'human' },
                      { label: '🤖', value: 'cpu' },
                    ]}
                    value={player.isHuman ? 'human' : 'cpu'}
                    onChange={v => updatePlayer(index, { isHuman: v === 'human' })}
                  />
                </div>
              ))}
            </div>
          </div>
          <button className="lobby-manual-btn mobile-only" onClick={() => setIsManualOpen(true)}>
            📖 あそびかた
          </button>
        </div>
      </div>

      <ManualModal isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} />
    </div>
  );
}
