import { useGameStore } from '../../store/gameStore';
import type { LobbyPlayer } from '../../game/types';
import { PLAYER_COLORS, COLOR_LABELS, COLOR_HEX } from '../../game/types';
import { TREASURE_MAPS } from '../../game/treasureMaps';

const DICE_EMOJI = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export function Lobby() {
  const state = useGameStore();
  if (state.phase !== 'lobby') return null;

  const { settings, lobbyPlayers, updateSettings, updateLobbyPlayers, startGame } = state;

  function updatePlayer(index: number, patch: Partial<LobbyPlayer>) {
    const updated = lobbyPlayers.map((p, i) => (i === index ? { ...p, ...patch } : p));
    updateLobbyPlayers(updated);
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
            </div>
          </div>
        ))}
      </div>

      {/* Game Settings */}
      <div className="lobby-card">
        <h2>ゲーム設定</h2>
        <div className="lobby-settings-grid">
          <div className="lobby-settings-item" style={{ gridColumn: '1 / -1' }}>
            <label>ゲームモード</label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button
                className={`btn ${settings.gameMode === 'classic' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => updateSettings({ gameMode: 'classic' })}
                style={{ flex: 1 }}
              >
                🏢 物件・資産（クラシック）
              </button>
              <button
                className={`btn ${settings.gameMode === 'treasure' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => updateSettings({ gameMode: 'treasure' })}
                style={{ flex: 1 }}
              >
                🏴‍☠️ お宝争奪戦（新モード）
              </button>
            </div>
          </div>
          {settings.gameMode === 'classic' && (
            <>
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
            </>
          )}

          {settings.gameMode === 'treasure' && (
            <>
              <div className="lobby-settings-item">
                <label>マップ選択</label>
                <select
                  className="lobby-select"
                  value={settings.treasureMapId}
                  onChange={e => updateSettings({ treasureMapId: e.target.value })}
                >
                  {TREASURE_MAPS.map(m => (
                    <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>
                  ))}
                </select>
                <div style={{ fontSize: '0.85rem', color: '#aaa', marginTop: 4 }}>
                  {TREASURE_MAPS.find(m => m.id === settings.treasureMapId)?.description}
                </div>
              </div>
              <div className="lobby-settings-item">
                <label>目標お宝個数</label>
                <select
                  className="lobby-select"
                  value={settings.targetTreasures}
                  onChange={e => updateSettings({ targetTreasures: Number(e.target.value) })}
                >
                  <option value={5}>5個（短い）</option>
                  <option value={10}>10個（標準）</option>
                  <option value={15}>15個（長い）</option>
                  <option value={20}>20個（激闘）</option>
                  <option value={999}>上限なし（全マス掘り尽くすまで）</option>
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      <button className="btn btn-primary" onClick={startGame} disabled={!canStart}>
        ゲームスタート
      </button>
    </div>
  );
}
