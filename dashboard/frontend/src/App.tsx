import React, { useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/ToastProvider';
import { DarkModeProvider } from './contexts/DarkModeContext';
import Header from './components/Header';
import Footer from './components/Footer';
import OddsGrid from './components/odds/OddsGrid';
import BetSlip from './components/bets/BetSlip';
import BetHistory from './pages/BetHistory';
import Stats from './pages/Stats';
import { useBetSlip } from './hooks/useBetSlip';
import './index.css';

function Dashboard() {
  const { addLeg, removeLeg, clearSlip, legs } = useBetSlip();
  const [selectedBets, setSelectedBets] = useState<Set<string>>(new Set());
  const [useDecimalOdds, setUseDecimalOdds] = useState(false);

  const handleAddToBetSlip = (selection: any) => {
    // Generate key for tracking
    const key = selection.line !== undefined 
      ? `${selection.gameId}-${selection.selectionType}-${selection.selection}-${selection.line}`
      : `${selection.gameId}-${selection.selectionType}-${selection.selection}`;
    
    // Check if this selection is already in the bet slip
    const existingIndex = legs.findIndex(leg => {
      const legKey = leg.line !== undefined
        ? `${leg.gameId}-${leg.selectionType}-${leg.selection}-${leg.line}`
        : `${leg.gameId}-${leg.selectionType}-${leg.selection}`;
      return legKey === key;
    });

    if (existingIndex >= 0) {
      // Remove from bet slip
      removeLeg(existingIndex);
      // Remove from selected set
      setSelectedBets((prev) => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    } else {
      // Add to bet slip
      addLeg(selection);
      // Add to selected set
      setSelectedBets((prev) => new Set(prev).add(key));
    }
  };

  const handleRemoveLeg = (index: number) => {
    // Get the leg being removed
    const leg = legs[index];
    
    // Remove from bet slip
    removeLeg(index);
    
    // Remove from selected set
    const key = leg.line !== undefined
      ? `${leg.gameId}-${leg.selectionType}-${leg.selection}-${leg.line}`
      : `${leg.gameId}-${leg.selectionType}-${leg.selection}`;
    setSelectedBets((prev) => {
      const newSet = new Set(prev);
      newSet.delete(key);
      return newSet;
    });
  };

  const handleClearBetSlip = () => {
    clearSlip();
    setSelectedBets(new Set()); // Clear the highlighting
  };

  return (
    <div className="dashboard-container bg-gray-50 dark:bg-gray-900 min-h-screen transition-colors">
      <div className="main-content">
        <OddsGrid 
          onAddToBetSlip={handleAddToBetSlip} 
          selectedBets={selectedBets}
          useDecimalOdds={useDecimalOdds}
          onToggleOddsFormat={() => setUseDecimalOdds(!useDecimalOdds)}
        />
      </div>
      {/* Bet slip as bottom popup */}
      <BetSlip 
        useDecimalOdds={useDecimalOdds} 
        onClear={handleClearBetSlip}
        onRemoveLeg={handleRemoveLeg}
      />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <DarkModeProvider>
          <div className="app">
            <Header />
          <main style={{ paddingBottom: '48px' }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/history" element={<BetHistory />} />
              <Route path="/stats" element={<Stats />} />
            </Routes>
          </main>
          <Footer />
          </div>
        </DarkModeProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
