import { useAuth } from '../lib/auth';

export function Navbar() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <a href="/dashboard" className="text-xl font-bold text-brand-500">
            PaceUp
          </a>
          <div className="hidden gap-4 sm:flex">
            <a href="/dashboard" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              Dashboard
            </a>
            <a href="/planner" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              Planner
            </a>
            <a href="/activities" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              Activities
            </a>
            <a href="/settings" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              Settings
            </a>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user.avatarUrl && (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="h-8 w-8 rounded-full"
            />
          )}
          <span className="hidden text-sm font-medium text-gray-700 sm:block">{user.name}</span>
          <button
            onClick={logout}
            className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
