import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useDarkMode } from '../contexts/DarkModeContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SiteConfig {
  siteName: string;
  logoUrl: string | null;
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

// ─── SVG Icon components ──────────────────────────────────────────────────────
// Heroicons (outline, 18px) — consistent stroke weight and style throughout.
// Sized at w-[18px] h-[18px] so they sit flush with the 14px nav label text.

const IconDashboard = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const IconHistory = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 15" />
  </svg>
);

const IconFutures = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const IconStats = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const IconCLV = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const IconSun = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const IconMoon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const IconSettings = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const IconPreferences = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
    <circle cx="8" cy="6" r="2" fill="currentColor" stroke="none" />
    <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" />
    <circle cx="10" cy="18" r="2" fill="currentColor" stroke="none" />
  </svg>
);

const IconKey = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

const IconBell = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const IconShield = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

const IconUser = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconLogOut = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const IconChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const IconTrendUp = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

// ─── Shared dropdown item styling ────────────────────────────────────────────

const dropdownItemClass =
  'flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 ' +
  'hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors w-full text-left';

const dropdownPanelClass =
  'absolute right-0 mt-2 bg-white dark:bg-surface-800 rounded-lg shadow-lg ' +
  'border border-gray-200 dark:border-surface-700 py-1 z-50';

// ─── Component ────────────────────────────────────────────────────────────────

export default function Header() {
  const location = useLocation();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const { user, authEnabled, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>({
    siteName: 'BetTrack',
    logoUrl: '/logo.svg',
  });
  const userMenuRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  // Fetch optional site config override from admin
  useEffect(() => {
    api.get('/admin/site-config')
      .then(res => {
        const config = res.data.data;
        setSiteConfig({
          siteName: config.siteName || 'BetTrack',
          logoUrl: config.logoUrl || '/logo.svg',
        });
      })
      .catch(() => {
        // Silently fall back to defaults — not a user-facing error
      });
  }, []);

  // Close both dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setShowSettingsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Exact path match — sub-routes (e.g. /game/:id) don't light up a nav item
  const isActive = (path: string) => location.pathname === path;

  // ── Nav items ──────────────────────────────────────────────────────────────
  // '/' is the marketing landing page — not a nav destination for logged-in users.
  // '/v2' is the canonical dashboard (EnhancedDashboard). The "V2" label and
  // "NEW" badge were internal migration artifacts — removed here.
  const navItems: NavItem[] = [
    { path: '/v2',           label: 'Dashboard',  icon: <IconDashboard /> },
    { path: '/history',      label: 'Bet History', icon: <IconHistory />  },
    { path: '/futures',      label: 'Futures',     icon: <IconFutures />  },
    { path: '/stats',        label: 'Statistics',  icon: <IconStats />    },
    { path: '/analytics/clv', label: 'CLV',        icon: <IconCLV />      },
  ];

  // User initials for avatar fallback
  const userInitial = user
    ? (user.name?.[0] ?? user.email[0])?.toUpperCase()
    : '';

  return (
    <header className="bg-white dark:bg-surface-900 border-b border-gray-200 dark:border-surface-700 sticky top-0 z-40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* ── Logo ────────────────────────────────────────────────────── */}
          <Link
            to="/"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity flex-shrink-0"
            aria-label={`${siteConfig.siteName} — home`}
          >
            {siteConfig.logoUrl ? (
              <img
                src={siteConfig.logoUrl}
                alt=""
                aria-hidden="true"
                className="h-8 w-auto object-contain"
                onError={e => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            {/* Fallback icon — brand-red, no blue gradient */}
            <div className={
              siteConfig.logoUrl
                ? 'hidden'
                : 'w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0'
            }>
              <IconTrendUp />
            </div>
            {/* Site name — display (monospace) font, brand identity in the app shell */}
            <span className="font-display font-bold text-sm text-gray-900 dark:text-white hidden md:block tracking-wide">
              {siteConfig.siteName}
            </span>
          </Link>

          {/* ── Primary navigation ──────────────────────────────────────── */}
          <nav className="flex items-center gap-1" aria-label="Main navigation">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                aria-current={isActive(item.path) ? 'page' : undefined}
                className={[
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  isActive(item.path)
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-800 hover:text-gray-900 dark:hover:text-white',
                ].join(' ')}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* ── Right controls ───────────────────────────────────────────── */}
          <div className="flex items-center gap-1 flex-shrink-0">

            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? <IconSun /> : <IconMoon />}
            </button>

            {/* Settings dropdown */}
            <div className="relative" ref={settingsMenuRef}>
              <button
                onClick={() => setShowSettingsMenu(v => !v)}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
                title="Settings"
                aria-label="Settings"
                aria-expanded={showSettingsMenu}
                aria-haspopup="menu"
              >
                <IconSettings />
              </button>

              {showSettingsMenu && (
                <div className={`${dropdownPanelClass} w-52`} role="menu">
                  <Link
                    to="/settings/preferences"
                    className={dropdownItemClass}
                    onClick={() => setShowSettingsMenu(false)}
                    role="menuitem"
                  >
                    <IconPreferences />
                    Preferences
                  </Link>
                  <Link
                    to="/settings/api-keys"
                    className={dropdownItemClass}
                    onClick={() => setShowSettingsMenu(false)}
                    role="menuitem"
                  >
                    <IconKey />
                    API keys
                  </Link>
                  <Link
                    to="/settings/notifications"
                    className={dropdownItemClass}
                    onClick={() => setShowSettingsMenu(false)}
                    role="menuitem"
                  >
                    <IconBell />
                    Notifications
                  </Link>

                  {/* Admin — single-user mode or admin role */}
                  {(!authEnabled || (user && (user as any).isAdmin)) && (
                    <>
                      <div className="border-t border-gray-200 dark:border-surface-700 my-1" />
                      <Link
                        to="/settings/admin"
                        className={dropdownItemClass}
                        onClick={() => setShowSettingsMenu(false)}
                        role="menuitem"
                      >
                        <IconShield />
                        Admin
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* User menu — only when auth is enabled and user is logged in */}
            {authEnabled && user && (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(v => !v)}
                  className="flex items-center gap-2 p-1.5 pl-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
                  aria-expanded={showUserMenu}
                  aria-haspopup="menu"
                  aria-label="User menu"
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name || user.email}
                      className="w-7 h-7 rounded-full"
                    />
                  ) : (
                    // Avatar fallback — brand-red, not blue
                    <div className="w-7 h-7 bg-brand-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-display font-bold text-xs leading-none">
                        {userInitial}
                      </span>
                    </div>
                  )}
                  <IconChevronDown />
                </button>

                {showUserMenu && (
                  <div className={`${dropdownPanelClass} w-60`} role="menu">
                    {/* User info header */}
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-surface-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {user.name || 'User'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {user.email}
                      </p>
                      {/* Provider badge — info color (not brand) since it's informational */}
                      <span className="inline-block mt-1.5 px-2 py-0.5 text-xs rounded-full bg-info-100 dark:bg-info-900 text-info-800 dark:text-info-200">
                        {user.provider}
                      </span>
                    </div>

                    <Link
                      to="/profile"
                      className={dropdownItemClass}
                      onClick={() => setShowUserMenu(false)}
                      role="menuitem"
                    >
                      <IconUser />
                      Profile
                    </Link>

                    <button
                      onClick={async () => {
                        setShowUserMenu(false);
                        await logout();
                      }}
                      className={`${dropdownItemClass} text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300`}
                      role="menuitem"
                    >
                      <IconLogOut />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
