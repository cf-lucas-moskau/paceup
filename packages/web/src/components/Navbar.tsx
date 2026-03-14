import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { NotificationBell } from './NotificationBell';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { useSyncInvalidation } from '../lib/useSyncInvalidation';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: HomeIcon },
  { to: '/planner', label: 'Planner', icon: CalendarIcon },
  { to: '/activities', label: 'Activities', icon: RunIcon },
  { to: '/groups', label: 'Groups', icon: UsersIcon },
  { to: '/feed', label: 'Feed', icon: FeedIcon },
] as const;

export function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  useSyncInvalidation();

  if (!user) return null;

  return (
    <>
      {/* Desktop / Tablet top navbar */}
      <nav className="border-b-3 border-neo-black bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border-3 border-neo-black bg-brand-500 shadow-neo-sm">
                <span className="text-lg font-bold text-white">P</span>
              </div>
              <span className="text-xl font-bold text-neo-black">
                Pace<span className="text-brand-500">Up</span>
              </span>
            </Link>
            <div className="hidden gap-1 md:flex">
              {NAV_ITEMS.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                    location.pathname === to
                      ? 'bg-brand-500 text-white'
                      : 'text-neo-black hover:bg-gray-100'
                  }`}
                >
                  {label}
                </Link>
              ))}
              <Link
                to="/settings"
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  location.pathname === '/settings'
                    ? 'bg-brand-500 text-white'
                    : 'text-neo-black hover:bg-gray-100'
                }`}
              >
                Settings
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SyncStatusIndicator />
            <NotificationBell />
            {user.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="h-8 w-8 rounded-full border-2 border-neo-black"
              />
            )}
            <span className="hidden text-sm font-semibold text-neo-black lg:block">
              {user.name}
            </span>
            <button
              onClick={logout}
              className="hidden rounded-lg border-2 border-neo-black px-3 py-1 text-sm font-medium text-neo-black hover:bg-gray-100 sm:block"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile bottom tabs */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t-3 border-neo-black bg-white md:hidden">
        <div className="flex items-center justify-around py-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
            const isActive = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center gap-0.5 px-2 py-1.5 ${
                  isActive ? 'text-brand-500' : 'text-gray-400'
                }`}
              >
                <Icon active={isActive} />
                <span className="text-[10px] font-semibold">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}

// --- Inline SVG icons for bottom tabs ---

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function RunIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function UsersIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function FeedIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
    </svg>
  );
}
