import { Navbar } from '../components/Navbar';
import { useAuth } from '../lib/auth';

export function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.name?.split(' ')[0]}
        </h1>
        <p className="mt-2 text-gray-600">
          Your activities and training plan will appear here.
        </p>

        {/* Placeholder cards */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">This Week</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">0 km</p>
            <p className="mt-1 text-sm text-gray-400">0 activities</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Plan Compliance</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">—</p>
            <p className="mt-1 text-sm text-gray-400">No plan set</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Sync Status</h3>
            <p className="mt-2 text-3xl font-bold text-green-600">Connected</p>
            <p className="mt-1 text-sm text-gray-400">Strava webhook active</p>
          </div>
        </div>
      </main>
    </div>
  );
}
