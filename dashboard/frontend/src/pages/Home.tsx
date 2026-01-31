import React from 'react';
import { Link } from 'react-router-dom';
import { useDarkMode } from '../contexts/DarkModeContext';

export default function Home() {
  const { isDarkMode } = useDarkMode();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950"
         style={{ imageRendering: 'pixelated' }}>
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-4"
               style={{
                 backgroundImage: 'url(/hero-background.png)',
                 backgroundSize: 'cover',
                 backgroundPosition: 'center',
                 backgroundRepeat: 'no-repeat',
                 imageRendering: 'pixelated'
               }}>
        {/* Dark overlay for better text contrast */}
        <div className="absolute inset-0 bg-black opacity-40" />
        
        {/* Pixel art background pattern with scanlines */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `repeating-linear-gradient(
              0deg,
              ${isDarkMode ? '#dc2626' : '#b91c1c'} 0px,
              transparent 2px,
              transparent 4px,
              ${isDarkMode ? '#dc2626' : '#b91c1c'} 4px
            ),
            repeating-linear-gradient(
              90deg,
              ${isDarkMode ? '#dc2626' : '#b91c1c'} 0px,
              transparent 2px,
              transparent 4px,
              ${isDarkMode ? '#dc2626' : '#b91c1c'} 4px
            )`,
            backgroundSize: '4px 4px',
            imageRendering: 'pixelated'
          }}
        />
        
        {/* CRT Scanlines Effect */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-5"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
            backgroundSize: '100% 4px'
          }}
        />

        <div className="max-w-6xl mx-auto relative z-10">
          {/* Cowboy Dollar Logo */}
          <div className="flex justify-center mb-8">
            <img 
              src="/cowboy-dollar.png" 
              alt="BetTrack - Yeehaw!" 
              className="w-80 h-auto"
              style={{ 
                imageRendering: 'pixelated', 
                filter: 'drop-shadow(0 10px 25px rgba(0,0,0,0.8))'
              }}
            />
          </div>

          {/* Tagline */}
          <h1 className="text-5xl md:text-7xl font-bold text-center mb-6 text-white"
              style={{ 
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                textShadow: '6px 6px 0px rgba(0,0,0,0.8), 0 0 20px rgba(220,38,38,0.5)',
                letterSpacing: '0.05em',
                imageRendering: 'pixelated'
              }}>
            🤠 BET LIKE A COWBOY 🎰
          </h1>
          
          <p className="text-2xl md:text-3xl text-center mb-12 text-white"
             style={{ 
               fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
               textShadow: '3px 3px 0px rgba(0,0,0,0.8)'
             }}>
            Where the Wild West Meets Smart Betting
          </p>

          {/* CTA Buttons with enhanced 8-bit style */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to="/v2"
              className="relative pixel-button bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-8 text-xl transition-all transform hover:scale-105 hover:-translate-y-1"
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                border: '4px solid #991b1b',
                boxShadow: '0 6px 0 #7f1d1d, 0 10px 20px rgba(0,0,0,0.4)',
                imageRendering: 'pixelated'
              }}
            >
              🎲 START TRACKING →
            </Link>
            <Link
              to="#what-we-do"
              className="relative pixel-button bg-gray-700 hover:bg-gray-800 text-white font-bold py-4 px-8 text-xl transition-all transform hover:scale-105 hover:-translate-y-1"
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                border: '4px solid #374151',
                boxShadow: '0 6px 0 #1f2937, 0 10px 20px rgba(0,0,0,0.4)',
                imageRendering: 'pixelated'
              }}
            >
              📖 LEARN MORE
            </Link>
          </div>
        </div>
      </section>

      {/* What We Are Section */}
      <section id="what-we-are" className="py-20 px-4 bg-white dark:bg-gray-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-12 text-red-600 dark:text-red-500"
              style={{ 
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                textShadow: '3px 3px 0px rgba(0,0,0,0.2)'
              }}>
            💰 WHAT WE ARE
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="pixel-card p-6 transition-all transform hover:scale-105 hover:-translate-y-2"
                 style={{
                   fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                   backgroundColor: isDarkMode ? '#1f2937' : '#f9fafb',
                   border: `4px solid ${isDarkMode ? '#374151' : '#d1d5db'}`,
                   boxShadow: `0 6px 0 ${isDarkMode ? '#111827' : '#9ca3af'}, 0 10px 20px rgba(0,0,0,0.3)`,
                   imageRendering: 'pixelated'
                 }}>
              <div className="flex justify-center mb-4">
                <img src="/icons/target.png" alt="Target" className="w-16 h-16" style={{ imageRendering: 'pixelated' }} />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-center text-gray-900 dark:text-white"
                  style={{ textShadow: '2px 2px 0px rgba(0,0,0,0.2)' }}>
                Your Betting HQ
              </h3>
              <p className="text-gray-700 dark:text-gray-300 text-center leading-relaxed">
                A centralized hub for tracking all your sports bets across multiple games and sportsbooks. 
                Keep your betting organized like a pro.
              </p>
            </div>

            {/* Card 2 */}
            <div className="pixel-card p-6 transition-all transform hover:scale-105 hover:-translate-y-2"
                 style={{
                   fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                   backgroundColor: isDarkMode ? '#1f2937' : '#f9fafb',
                   border: `4px solid ${isDarkMode ? '#374151' : '#d1d5db'}`,
                   boxShadow: `0 6px 0 ${isDarkMode ? '#111827' : '#9ca3af'}, 0 10px 20px rgba(0,0,0,0.3)`,
                   imageRendering: 'pixelated'
                 }}>
              <div className="flex justify-center mb-4">
                <img src="/icons/chart.png" alt="Chart" className="w-16 h-16" style={{ imageRendering: 'pixelated' }} />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-center text-gray-900 dark:text-white"
                  style={{ textShadow: '2px 2px 0px rgba(0,0,0,0.2)' }}>
                Real-Time Data
              </h3>
              <p className="text-gray-700 dark:text-gray-300 text-center leading-relaxed">
                Live odds, scores, and statistics from ESPN and The Odds API. 
                Stay updated with real-time game information and line movements.
              </p>
            </div>

            {/* Card 3 */}
            <div className="pixel-card p-6 transition-all transform hover:scale-105 hover:-translate-y-2"
                 style={{
                   fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                   backgroundColor: isDarkMode ? '#1f2937' : '#f9fafb',
                   border: `4px solid ${isDarkMode ? '#374151' : '#d1d5db'}`,
                   boxShadow: `0 6px 0 ${isDarkMode ? '#111827' : '#9ca3af'}, 0 10px 20px rgba(0,0,0,0.3)`,
                   imageRendering: 'pixelated'
                 }}>
              <div className="flex justify-center mb-4">
                <img src="/icons/ai.png" alt="AI" className="w-16 h-16" style={{ imageRendering: 'pixelated' }} />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-center text-gray-900 dark:text-white"
                  style={{ textShadow: '2px 2px 0px rgba(0,0,0,0.2)' }}>
                AI-Powered
              </h3>
              <p className="text-gray-700 dark:text-gray-300 text-center leading-relaxed">
                Advanced analytics and insights powered by AI. 
                Get smarter betting recommendations and trend analysis.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What We Do Section */}
      <section id="what-we-do" className="py-20 px-4 bg-gradient-to-r from-red-600 to-red-700 text-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-12"
              style={{ 
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                textShadow: '3px 3px 0px rgba(0,0,0,0.3)'
              }}>
            🎰 WHAT WE DO
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Feature 1 */}
            <div className="flex items-start gap-4">
              <img src="/icons/dice.png" alt="Dice" className="w-12 h-12" style={{ imageRendering: 'pixelated' }} />
              <div>
                <h3 className="text-2xl font-bold mb-2">Track Your Bets</h3>
                <p className="text-red-100">
                  Build parlays, track straights, and manage your entire betting portfolio in one place. 
                  Our 8-bit retro interface makes betting management fun and intuitive.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex items-start gap-4">
              <img src="/icons/graph.png" alt="Graph" className="w-12 h-12" style={{ imageRendering: 'pixelated' }} />
              <div>
                <h3 className="text-2xl font-bold mb-2">Compare Odds</h3>
                <p className="text-red-100">
                  See lines from multiple sportsbooks side-by-side. 
                  Find the best value for your bets across DraftKings, FanDuel, BetMGM, and more.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex items-start gap-4">
              <img src="/icons/lightning.png" alt="Lightning" className="w-12 h-12" style={{ imageRendering: 'pixelated' }} />
              <div>
                <h3 className="text-2xl font-bold mb-2">Live Updates</h3>
                <p className="text-red-100">
                  Real-time scores, period tracking, and automatic bet settlement. 
                  Know immediately when your bets hit or miss.
                </p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="flex items-start gap-4">
              <img src="/icons/book.png" alt="Stats" className="w-12 h-12" style={{ imageRendering: 'pixelated' }} />
              <div>
                <h3 className="text-2xl font-bold mb-2">Stats & History</h3>
                <p className="text-red-100">
                  Access comprehensive game statistics, team data, and your complete betting history. 
                  Learn from your wins and losses.
                </p>
              </div>
            </div>

            {/* Feature 5 */}
            <div className="flex items-start gap-4">
              <img src="/icons/api.png" alt="API" className="w-12 h-12" style={{ imageRendering: 'pixelated' }} />
              <div>
                <h3 className="text-2xl font-bold mb-2">API Access</h3>
                <p className="text-red-100">
                  Developers can integrate BetTrack data into their own applications. 
                  Build custom tools with our powerful API.
                </p>
              </div>
            </div>

            {/* Feature 6 */}
            <div className="flex items-start gap-4">
              <img src="/icons/moon.png" alt="Dark Mode" className="w-12 h-12" style={{ imageRendering: 'pixelated' }} />
              <div>
                <h3 className="text-2xl font-bold mb-2">Dark Mode Ready</h3>
                <p className="text-red-100">
                  Bet comfortably day or night with our fully-featured dark mode. 
                  Easy on the eyes, sharp on the stats.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who We Are Section */}
      <section id="who-we-are" className="py-20 px-4 bg-white dark:bg-gray-800">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-12 text-red-600 dark:text-red-500"
              style={{ 
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                textShadow: '3px 3px 0px rgba(0,0,0,0.2)'
              }}>
            🤠 WHO WE ARE
          </h2>
          
          <div className="text-lg text-gray-700 dark:text-gray-300 space-y-6"
               style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
            <p className="text-2xl font-bold">
              We're a team of sports enthusiasts, developers, and data nerds who love betting 
              as much as we love retro gaming. 🎮
            </p>
            
            <p>
              Built with the heart of Texas and the precision of modern technology, 
              BetTrack combines cowboy spirit with cutting-edge sports analytics. 
              We believe betting should be strategic, transparent, and most importantly—fun.
            </p>

            <p>
              Our mission is simple: Give bettors the tools they need to make informed decisions, 
              track their action, and hopefully ride off into the sunset with more wins than losses. 🌅
            </p>

            <div className="mt-12 pt-12 border-t-4 border-red-600 dark:border-red-500">
              <p className="text-xl italic text-gray-600 dark:text-gray-400">
                "In the Wild West of sports betting, we're your trusty sidekick." 🐴
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-gray-900 to-gray-800 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6"
              style={{ 
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                textShadow: '3px 3px 0px rgba(0,0,0,0.4)'
              }}>
            Ready to Saddle Up? 🐎
          </h2>
          
          <p className="text-xl mb-12 text-gray-300"
             style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
            Start tracking your bets like a pro. It's free to get started.
          </p>

          <Link
            to="/v2"
            className="inline-block pixel-button bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-12 text-2xl transition-all transform hover:scale-105 hover:-translate-y-1"
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              border: '4px solid #991b1b',
              boxShadow: '0 6px 0 #7f1d1d, 0 10px 20px rgba(0,0,0,0.4)',
              imageRendering: 'pixelated'
            }}
          >
            🎲 LAUNCH DASHBOARD →
          </Link>

          <div className="mt-12 flex justify-center gap-8 text-sm text-gray-400">
            <span>✓ No Credit Card Required</span>
            <span>✓ Free Forever</span>
            <span>✓ Full Access</span>
          </div>
        </div>
      </section>
    </div>
  );
}
