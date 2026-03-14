import { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Card, Button, Badge } from '../components/ui';
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
    <div className="min-h-screen bg-neo-white pb-20 md:pb-0">
      <Navbar />
      <main className="mx-auto max-w-xl px-4 py-8">
        <h1 className="text-2xl font-bold text-neo-black">Settings</h1>

        <div className="mt-6 space-y-4">
          {/* Unit preference */}
          <Card>
            <h3 className="font-bold text-neo-black">Unit Preference</h3>
            <div className="mt-3 flex gap-3">
              <button
                onClick={() => setUnit('metric')}
                className={`flex-1 rounded-lg border-3 px-4 py-2 text-sm font-semibold transition ${
                  unit === 'metric'
                    ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-neo-sm'
                    : 'border-neo-black text-gray-600 hover:bg-gray-50'
                }`}
              >
                Metric (km)
              </button>
              <button
                onClick={() => setUnit('imperial')}
                className={`flex-1 rounded-lg border-3 px-4 py-2 text-sm font-semibold transition ${
                  unit === 'imperial'
                    ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-neo-sm'
                    : 'border-neo-black text-gray-600 hover:bg-gray-50'
                }`}
              >
                Imperial (mi)
              </button>
            </div>
          </Card>

          {/* Timezone */}
          <Card>
            <h3 className="font-bold text-neo-black">Timezone</h3>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="neo-input mt-3"
            >
              {Intl.supportedValuesOf('timeZone').map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </Card>

          {/* Strava connection */}
          <Card>
            <h3 className="font-bold text-neo-black">Strava Connection</h3>
            <div className="mt-3 flex items-center gap-3">
              {user?.isConnected ? (
                <>
                  <Badge color="green">Connected</Badge>
                  <span className="text-sm text-gray-500">{user.name}</span>
                </>
              ) : (
                <>
                  <Badge color="red">Disconnected</Badge>
                  <a
                    href="/api/auth/strava"
                    className="text-sm font-semibold text-brand-500 hover:text-brand-600"
                  >
                    Reconnect
                  </a>
                </>
              )}
            </div>
          </Card>

          {/* Save button */}
          <Button
            onClick={handleSave}
            disabled={updateSettings.isPending}
            className="w-full"
          >
            {updateSettings.isPending ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </Button>
        </div>

        <p className="mt-8 text-center text-xs text-gray-400">Powered by Strava</p>
      </main>
    </div>
  );
}
