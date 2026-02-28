import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useTreasureStore } from '../../store/treasureStore';
import { TreasureBoard } from '../TreasureBoard/TreasureBoard';
import { TreasureSidebar } from '../TreasureGameInfo/TreasureSidebar';
import { TreasureModals } from '../TreasureModals/TreasureModals';
import { TreasureGameLog } from '../TreasureGameLog/TreasureGameLog';
import { TreasureMobileUI } from './TreasureMobileUI';
import { useIsMobile } from '../../hooks/useIsMobile';

export function TreasureGame() {
    const isMobile = useIsMobile(768);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        // When this component mounts, we initialize the treasure store
        // using the settings and lobby players from the main gameStore.
        const { settings, lobbyPlayers } = useGameStore.getState();
        useTreasureStore.getState().startGame!(settings, lobbyPlayers);
    }, []);

    if (isMobile) {
        return <TreasureMobileUI />;
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
                <TreasureBoard />
                <TreasureModals />
                <TreasureGameLog />
            </div>

            {/* Overlay for mobile to close sidebar when tapping outside */}
            {isSidebarOpen && (
                <div className="mobile-overlay" onClick={() => setIsSidebarOpen(false)} />
            )}

            <div className={`sidebar-container ${isSidebarOpen ? 'open' : ''}`}>
                <TreasureSidebar />
            </div>
        </div>
    );
}
