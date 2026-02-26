import './index.css';
import { useGameStore } from './store/gameStore';
import { Lobby } from './components/Lobby/Lobby';
import { ClassicGame } from './components/ClassicGame/ClassicGame';
import { TreasureGame } from './components/TreasureGame/TreasureGame';

function App() {
  const state = useGameStore();

  if (state.phase === 'lobby') {
    return <Lobby />;
  }

  if (state.settings.gameMode === 'treasure') {
    return <TreasureGame />;
  }

  return <ClassicGame />;
}

export default App;
