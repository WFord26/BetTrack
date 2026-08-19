import React from 'react';
import { Link } from 'react-router-dom';

const TICKER_ITEMS = [
  'LIVE ODDS · 7 SPORTS',
  'DAL -2.5 vs HOU',
  'MAVS +142 · Q3',
  'AUTO BET SETTLEMENT',
  'CLV TRACKED ON EVERY TICKET',
];

const WHAT_WE_ARE = [
  {
    icon: '/icons/target.png',
    title: 'YOUR BETTING HQ',
    body: 'One ledger for every wager across all your sportsbooks. Organized like a pro outfit.',
  },
  {
    icon: '/icons/chart.png',
    title: 'REAL-TIME DATA',
    body: 'Live odds, scores and line movement from ESPN and The Odds API, synced every 30 seconds.',
  },
  {
    icon: '/icons/ai.png',
    title: 'AI-POWERED',
    body: 'CLV grades, sharp-money signals and trend analysis on every ticket you track.',
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-dusk">
      {/* Hero Section */}
      <section
        className="relative flex flex-col items-center justify-center overflow-hidden px-6 py-14"
        style={{
          backgroundImage: 'url(/hero-background.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 65%',
          imageRendering: 'pixelated',
          minHeight: '520px',
        }}
      >
        {/* Dusk gradient overlay */}
        <div className="ds-hero-scrim absolute inset-0" />

        <div className="relative z-10 flex flex-col items-center">
          {/* Cowboy Dollar Logo */}
          <img
            src="/cowboy-dollar.svg"
            alt="BetTrack - Yeehaw!"
            style={{
              width: '190px',
              imageRendering: 'pixelated',
              filter: 'drop-shadow(0 10px 25px rgba(0,0,0,0.8))',
            }}
          />

          {/* Wordmark */}
          <div
            className="font-display text-cream mt-[18px] text-[15px] text-shadow-ds-ember"
          >
            BETTRACK
          </div>

          {/* Headline */}
          <h1
            className="font-display text-cream mt-[22px] text-center text-[34px] leading-[1.5] tracking-[.06em] text-shadow-ds-hero"
          >
            BET LIKE<br />A COWBOY
          </h1>

          {/* Tagline */}
          <p
            className="font-body mt-5 text-center text-[19px] text-cream-warm"
            style={{ textShadow: '0 2px 0 rgba(18,10,34,.6)' }}
          >
            Where the Wild West meets smart betting
          </p>

          {/* CTA Buttons */}
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
            <Link
              to="/v2"
              className="ds-btn-press-hero font-display px-[26px] py-[18px] text-[11px]"
            >
              START TRACKING
            </Link>
            <Link
              to="#what-we-do"
              className="ds-btn-ghost-plum px-[26px] py-[18px] text-[11px]"
            >
              LEARN MORE
            </Link>
          </div>
        </div>
      </section>

      {/* Sunset stripe divider */}
      <div className="flex h-2.5">
        <div className="flex-1 bg-gold" />
        <div className="flex-1 bg-ember" />
        <div className="flex-1 bg-coral" />
        <div className="flex-1 bg-plum" />
        <div className="flex-1 bg-dusk-panel2" />
      </div>

      {/* Ticker marquee */}
      <div className="bg-dusk-chrome overflow-hidden py-[10px]">
        <div className="animate-ds-marquee flex w-max gap-11">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span
              key={i}
              className="font-display text-cream-muted whitespace-nowrap text-[8px] tracking-[.08em]"
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* What We Are Section */}
      <section id="what-we-are" className="px-10 pt-12 pb-14">
        <h2
          className="font-display text-ember mb-[34px] text-center text-[15px] text-shadow-ds-dusk"
        >
          WHAT WE ARE
        </h2>

        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {WHAT_WE_ARE.map((card) => (
            <div key={card.title} className="ds-panel px-[22px] py-[26px]">
              <img
                src={card.icon}
                alt=""
                className="mx-auto mb-[18px]"
                style={{ width: '56px', height: '56px', imageRendering: 'pixelated' }}
              />
              <h3 className="font-display text-gold text-center text-[10px] leading-[1.7]">
                {card.title}
              </h3>
              <p className="font-body text-cream-secondary mt-3 text-center text-[14.5px] leading-[1.65]">
                {card.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Page-local footer strip */}
      <div className="bg-dusk-chrome mb-16 flex items-center gap-3.5 px-7 py-3">
        <img
          src="/animations/tumbleweed.gif"
          alt=""
          style={{ width: '22px', height: '22px', imageRendering: 'pixelated' }}
        />
        <span className="font-display text-cream-faint text-[7px] tracking-[.1em]">
          © 2026 BETTRACK · TRACKING ONLY — WE DO NOT FACILITATE BETTING
        </span>
        <span className="font-display text-cream-muted ml-auto text-[7px] tracking-[.1em]">
          1-800-GAMBLER
        </span>
      </div>
    </div>
  );
}
