import './index.css';
import { useState } from 'react';
import { useGameStore } from './store/gameStore';
import { Lobby } from './components/Lobby/Lobby';
import { Board } from './components/Board/Board';
import { Sidebar } from './components/GameInfo/Sidebar';
import { Modals } from './components/Modals/Modals';

function App() {
  const state = useGameStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (state.phase === 'lobby') {
    return <Lobby />;
  }

  return (
    <div className="game-layout">
      {/* Mobile Toggle Button */}
      <button
        className="mobile-sidebar-toggle"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        {isSidebarOpen ? '✖' : '☰ ランキング・情報'}
      </button>

      <div className="game-board-area">
        <Board />
        <Modals />
      </div>

      {/* Overlay for mobile to close sidebar when tapping outside */}
      {isSidebarOpen && (
        <div className="mobile-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      <div className={`sidebar-container ${isSidebarOpen ? 'open' : ''}`}>
        <Sidebar />
      </div>
    </div>
  );
}

export default App;
