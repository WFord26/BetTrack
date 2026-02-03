import React, { useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/ToastProvider';
import { DarkModeProvider } from './contexts/DarkModeContext';
import { AuthProvider } from './contexts/AuthContext';
import { PreferencesProvider } from './contexts/PreferencesContext';
import ProtectedRoute from './components/ProtectedRoute';
import Header from './components/Header';
import Footer from './components/Footer';
import OddsGrid from './components/odds/OddsGrid';
import BetSlip from './components/bets/BetSlip';
import BetHistory from './pages/BetHistory';
import Futures from './pages/Futures';
import Stats from './pages/Stats';
import GameDetail from './pages/GameDetail';
import TeamDetail from './pages/TeamDetail';
import EnhancedDashboard from './pages/EnhancedDashboard';
import Home from './pages/Home';
import Login from './pages/Login';
import ApiKeysSettings from './pages/ApiKeysSettings';
import Preferences from './pages/Preferences';
import Notifications from './pages/Notifications';
import AdminSettings from './pages/AdminSettings';
import { useBetSlip } from './hooks/useBetSlip';
import { usePreferences } from './contexts/PreferencesContext';
import './index.css';

function Dashboard() {
  const { addLeg, removeLeg, clearSlip, legs } = useBetSlip();
  const { useDecimalOdds, updatePreference, preferences } = usePreferences();
  const [selectedBets, setSelectedBets] = useState<Set<string>>(new Set());

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
      // Check for conflicting selections on same game
      let conflictingIndices: number[] = [];
      
      // For totals: Over/Under on same game/line should replace each other
      if (selection.selectionType === 'total') {
        conflictingIndices = legs.reduce((indices, leg, idx) => {
          if (leg.gameId === selection.gameId && 
              leg.selectionType === 'total' && 
              leg.line === selection.line &&
              leg.selection !== selection.selection) {
            indices.push(idx);
          }
          return indices;
        }, [] as number[]);
      }
      
      // For spread/moneyline: Can't bet on opposing teams (mutually exclusive outcomes)
      // Example: Can't have Team A spread AND Team B moneyline
      if (selection.selectionType === 'spread' || selection.selectionType === 'moneyline') {
        conflictingIndices = legs.reduce((indices, leg, idx) => {
          if (leg.gameId === selection.gameId) {
            // Check for conflicting spread/ML combinations
            const isConflict = 
              // New selection is spread, existing is ML on opposing team
              (selection.selectionType === 'spread' && 
               leg.selectionType === 'moneyline' && 
               leg.selection !== selection.selection) ||
              // New selection is ML, existing is spread on opposing team
              (selection.selectionType === 'moneyline' && 
               leg.selectionType === 'spread' && 
               leg.selection !== selection.selection);
            
            if (isConflict) {
              indices.push(idx);
            }
          }
          return indices;
        }, [] as number[]);
      }
      
      // Remove conflicting selections
      if (conflictingIndices.length > 0) {
        conflictingIndices.reverse().forEach(idx => {
          const conflictLeg = legs[idx];
          const conflictKey = conflictLeg.line !== undefined
            ? `${conflictLeg.gameId}-${conflictLeg.selectionType}-${conflictLeg.selection}-${conflictLeg.line}`
            : `${conflictLeg.gameId}-${conflictLeg.selectionType}-${conflictLeg.selection}`;
          
          removeLeg(idx);
          setSelectedBets((prev) => {
            const newSet = new Set(prev);
            newSet.delete(conflictKey);
            return newSet;
          });
        });
      }
      
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
          onToggleOddsFormat={() => updatePreference('oddsFormat', useDecimalOdds ? 'american' : 'decimal')}
        />
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <DarkModeProvider>
          <PreferencesProvider>
            <AuthProvider>
              <div className="app h-full flex flex-col">
                <Header />
              <main className="flex-1 overflow-hidden">
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/" element={<Home />} />
                  <Route path="/v2" element={<ProtectedRoute><EnhancedDashboard /></ProtectedRoute>} />
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/history" element={<ProtectedRoute><BetHistory /></ProtectedRoute>} />
                  <Route path="/futures" element={<ProtectedRoute><Futures /></ProtectedRoute>} />
                  <Route path="/stats" element={<ProtectedRoute><Stats /></ProtectedRoute>} />
                  <Route path="/game/:gameId" element={<ProtectedRoute><GameDetail /></ProtectedRoute>} />
                  <Route path="/team/:teamId" element={<ProtectedRoute><TeamDetail /></ProtectedRoute>} />
                  <Route path="/settings/preferences" element={<ProtectedRoute><Preferences /></ProtectedRoute>} />
                  <Route path="/settings/api-keys" element={<ProtectedRoute><ApiKeysSettings /></ProtectedRoute>} />
                  <Route path="/settings/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                  <Route path="/settings/admin" element={<ProtectedRoute><AdminSettings /></ProtectedRoute>} />
                </Routes>
              </main>
              <Footer />
              {/* Global Bet Slip - accessible from all pages */}
              <GlobalBetSlip />
            </div>
            </AuthProvider>
          </PreferencesProvider>
        </DarkModeProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

// Global BetSlip wrapper
function GlobalBetSlip() {
  const { useDecimalOdds } = usePreferences();
  return <BetSlip useDecimalOdds={useDecimalOdds} />;
}

export default App;
