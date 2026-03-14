import { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../lib/auth';
import { useUpdateSettings } from '../lib/hooks';

export function Settings() {
  const { user } = useAuth();
  const updateSettings = useUpdateSettings();

  const [unit, setUnit] = useState(user?.unitPreference || 'metric');
  const [timezone, setTimezone] = useState(user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    updateSettings.mutate(
      { unitPreference: unit, timezone },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
      }
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-xl px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

        <div className="mt-6 space-y-6">
          {/* Unit preference */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="font-medium text-gray-900">Unit Preference</h3>
            <div className="mt-3 flex gap-3">
              <button
                onClick={() => setUnit('metric')}
                className={`flex-1 rounded-md border px-4 py-2 text-sm transition ${
                  unit === 'metric'
                    ? 'border-brand-500 bg-brand-50 font-medium text-brand-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                Metric (km)
              </button>
              <button
                onClick={() => setUnit('imperial')}
                className={`flex-1 rounded-md border px-4 py-2 text-sm transition ${
                  unit === 'imperial'
                    ? 'border-brand-500 bg-brand-50 font-medium text-brand-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                Imperial (mi)
              </button>
            </div>
          </div>

          {/* Timezone */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="font-medium text-gray-900">Timezone</h3>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {Intl.supportedValuesOf('timeZone').map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          {/* Strava connection */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="font-medium text-gray-900">Strava Connection</h3>
            <div className="mt-3 flex items-center gap-3">
              {user?.isConnected ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    Connected
                  </span>
                  <span className="text-sm text-gray-500">{user.name}</span>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    Disconnected
                  </span>
                  <a
                    href="/api/auth/strava"
                    className="text-sm text-brand-500 hover:text-brand-600"
                  >
                    Reconnect
                  </a>
                </>
              )}
            </div>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={updateSettings.isPending}
            className="w-full rounded-md bg-brand-500 px-4 py-2.5 font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {updateSettings.isPending ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>

        <p className="mt-8 text-center text-xs text-gray-400">Powered by Strava</p>
      </main>
    </div>
  );
}
