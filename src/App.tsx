import './index.css';
import { useGameStore } from './store/gameStore';
import { Lobby } from './components/Lobby/Lobby';
import { Board } from './components/Board/Board';
import { Sidebar } from './components/GameInfo/Sidebar';
import { Modals } from './components/Modals/Modals';

function App() {
  const state = useGameStore();

  if (state.phase === 'lobby') {
    return <Lobby />;
  }

  return (
    <div className="game-layout">
      <div className="game-board-area">
        <Board />
        <Modals />
      </div>
      <Sidebar />
    </div>
  );
}

export default App;
