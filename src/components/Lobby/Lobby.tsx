import { useGameStore } from '../../store/gameStore';
import type { LobbyPlayer } from '../../game/types';
import { PLAYER_COLORS, COLOR_LABELS, COLOR_HEX } from '../../game/types';

const DICE_EMOJI = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export function Lobby() {
  const state = useGameStore();
  if (state.phase !== 'lobby') return null;

  const { settings, lobbyPlayers, updateSettings, updateLobbyPlayers, startGame } = state;

  function updatePlayer(index: number, patch: Partial<LobbyPlayer>) {
    const updated = lobbyPlayers.map((p, i) => (i === index ? { ...p, ...patch } : p));
    updateLobbyPlayers(updated);
  }

  function addPlayer() {
    if (lobbyPlayers.length >= 4) return;
    const usedColors = lobbyPlayers.map(p => p.color);
    const nextColor = PLAYER_COLORS.find(c => !usedColors.includes(c)) ?? 'red';
    updateLobbyPlayers([
      ...lobbyPlayers,
      { name: `プレイヤー${lobbyPlayers.length + 1}`, color: nextColor, isHuman: true },
    ]);
  }

  function removePlayer(index: number) {
    if (lobbyPlayers.length <= 2) return;
    updateLobbyPlayers(lobbyPlayers.filter((_, i) => i !== index));
  }

  const canStart = lobbyPlayers.length >= 2 && lobbyPlayers.length <= 4;

  return (
    <div className="lobby">
      <div>
        <h1 className="lobby-title">{DICE_EMOJI[1]}{DICE_EMOJI[3]}{DICE_EMOJI[5]} ペペ鉄</h1>
        <p className="lobby-subtitle">テーマ生成型ボードゲームエンジン — Phase 1</p>
      </div>

      {/* Players */}
      <div className="lobby-card">
        <h2>プレイヤー設定</h2>
        {lobbyPlayers.map((player, index) => (
          <div className="lobby-player-row" key={index}>
            <input
              className="lobby-input"
              value={player.name}
              onChange={e => updatePlayer(index, { name: e.target.value })}
              placeholder={`プレイヤー${index + 1}`}
              maxLength={12}
            />
            <select
              className="lobby-select"
              value={player.isHuman ? 'human' : 'cpu'}
              onChange={e => updatePlayer(index, { isHuman: e.target.value === 'human' })}
            >
              <option value="human">人間</option>
              <option value="cpu">CPU</option>
            </select>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {PLAYER_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => updatePlayer(index, { color })}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: COLOR_HEX[color],
                    border: player.color === color ? '2px solid white' : '2px solid transparent',
                    padding: 0,
                    cursor: lobbyPlayers.some((p, i) => i !== index && p.color === color)
                      ? 'not-allowed' : 'pointer',
                    opacity: lobbyPlayers.some((p, i) => i !== index && p.color === color) ? 0.3 : 1,
                  }}
                  disabled={lobbyPlayers.some((p, i) => i !== index && p.color === color)}
                  title={COLOR_LABELS[color]}
                />
              ))}
              {lobbyPlayers.length > 2 && (
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => removePlayer(index)}
                  style={{ marginLeft: 4 }}
                >✕</button>
              )}
            </div>
          </div>
        ))}
        {lobbyPlayers.length < 4 && (
          <button className="btn btn-secondary btn-sm" onClick={addPlayer} style={{ marginTop: 8 }}>
            + プレイヤーを追加
          </button>
        )}
      </div>

      {/* Game Settings */}
      <div className="lobby-card">
        <h2>ゲーム設定</h2>
        <div className="lobby-settings-grid">
          <div className="lobby-settings-item">
            <label>総ラウンド数</label>
            <select
              className="lobby-select"
              value={settings.totalRounds}
              onChange={e => updateSettings({ totalRounds: Number(e.target.value) })}
            >
              <option value={12}>12（短い）</option>
              <option value={20}>20（標準）</option>
              <option value={30}>30（長い）</option>
            </select>
          </div>
          <div className="lobby-settings-item">
            <label>決算サイクル</label>
            <select
              className="lobby-select"
              value={settings.cycleLength}
              onChange={e => updateSettings({ cycleLength: Number(e.target.value) })}
            >
              <option value={4}>4ラウンドごと</option>
              <option value={3}>3ラウンドごと</option>
              <option value={5}>5ラウンドごと</option>
            </select>
          </div>
          <div className="lobby-settings-item">
            <label>初期所持金</label>
            <select
              className="lobby-select"
              value={settings.startingMoney}
              onChange={e => updateSettings({ startingMoney: Number(e.target.value) })}
            >
              <option value={800}>800（厳しめ）</option>
              <option value={1000}>1000（標準）</option>
              <option value={1500}>1500（ゆとり）</option>
            </select>
          </div>
          <div className="lobby-settings-item">
            <label>目的地ボーナス</label>
            <select
              className="lobby-select"
              value={settings.destinationBonusAmount}
              onChange={e => updateSettings({ destinationBonusAmount: Number(e.target.value) })}
            >
              <option value={300}>300（少なめ）</option>
              <option value={500}>500（標準）</option>
              <option value={800}>800（大きめ）</option>
            </select>
          </div>
        </div>
      </div>

      <button className="btn btn-primary" onClick={startGame} disabled={!canStart}>
        ゲームスタート
      </button>
    </div>
  );
}
