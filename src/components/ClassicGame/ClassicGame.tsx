import { useState } from 'react';
import { Board } from '../Board/Board';
import { Sidebar } from '../GameInfo/Sidebar';
import { Modals } from '../Modals/Modals';

export function ClassicGame() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
