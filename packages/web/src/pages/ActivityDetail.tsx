import { useParams } from 'react-router-dom';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  AreaChart,
} from 'recharts';
import { Navbar } from '../components/Navbar';
import { useActivity, useActivityStreams } from '../lib/hooks';
import { formatDistance, formatDuration, formatPace } from '../lib/date-utils';
import { format } from 'date-fns';

const HR_ZONE_COLORS = ['#93c5fd', '#86efac', '#fde047', '#fb923c', '#ef4444'];
const HR_ZONE_LABELS = ['Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 5'];

function getHrZone(hr: number, maxHr: number): number {
  const pct = hr / maxHr;
  if (pct < 0.6) return 0;
  if (pct < 0.7) return 1;
  if (pct < 0.8) return 2;
  if (pct < 0.9) return 3;
  return 4;
}

export function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useActivity(id!);
  const { data: streamsData, isLoading: streamsLoading, isError: streamsError, refetch: refetchStreams } = useActivityStreams(id!);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neo-white pb-20 md:pb-0">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8">
          <div className="space-y-4">
            <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
            <div className="h-40 animate-pulse rounded-lg bg-gray-200" />
            <div className="h-[250px] animate-pulse rounded-lg bg-gray-200" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !data?.activity) {
    return (
      <div className="min-h-screen bg-neo-white pb-20 md:pb-0">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8">
          <p className="text-gray-500">Activity not found.</p>
        </main>
      </div>
    );
  }

  const activity = data.activity;

  // Build streams from the separate streams query
  const streams: Record<string, unknown[]> = {};
  if (streamsData?.streams) {
    for (const s of streamsData.streams) {
      streams[s.streamType] = s.data as unknown[];
    }
  }

  const paceData = buildPaceData(streams);
  const elevationData = buildElevationData(streams);
  const hrZoneData = buildHrZoneData(streams, activity.maxHeartrate || 190);
  const splitsData = buildSplitsData(streams);

  const isManual = activity.isManual;

  return (
    <div className="min-h-screen bg-neo-white pb-20 md:pb-0">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Summary card — renders immediately */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{activity.name}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {format(new Date(activity.startDateLocal), 'EEEE, MMMM d, yyyy · h:mm a')}
                {' · '}{activity.sportType}
              </p>
            </div>
            <a
              href={`https://www.strava.com/activities/${activity.stravaActivityId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-[#fc4c02]"
            >
              View on Strava →
            </a>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Distance" value={formatDistance(activity.distance)} />
            <Stat label="Duration" value={formatDuration(activity.movingTime)} />
            <Stat label="Pace" value={formatPace(activity.averageSpeed || 0)} />
            <Stat label="Elevation" value={`${Math.round(activity.totalElevationGain)}m`} />
            {activity.hasHeartrate && (
              <>
                <Stat label="Avg HR" value={`${Math.round(activity.averageHeartrate || 0)} bpm`} />
                <Stat label="Max HR" value={`${Math.round(activity.maxHeartrate || 0)} bpm`} />
              </>
            )}
            {activity.calories && (
              <Stat label="Calories" value={`${Math.round(activity.calories)}`} />
            )}
          </div>

          {activity.match && (
            <div className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
              Matched to: <strong>{activity.match.plannedWorkout.workoutType}</strong>
              {activity.match.plannedWorkout.targetDistance && (
                <> · Target: {formatDistance(activity.match.plannedWorkout.targetDistance)}</>
              )}
              {' · '}Confidence: {Math.round(activity.match.confidence * 100)}%
            </div>
          )}
        </div>

        {/* Charts — loaded separately with skeletons */}
        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-3">
            {streamsLoading ? (
              <>
                <ChartSkeleton height="h-[250px]" />
                <ChartSkeleton height="h-[180px]" />
              </>
            ) : streamsError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
                <p className="text-sm text-red-600">Unable to load chart data</p>
                <button
                  onClick={() => refetchStreams()}
                  className="mt-2 rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200"
                >
                  Retry
                </button>
              </div>
            ) : isManual && Object.keys(streams).length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
                <p className="text-sm text-gray-500">Manual activity — no GPS/stream data available</p>
              </div>
            ) : (
              <>
                {paceData.length > 0 && (
                  <ChartCard title="Pace">
                    <ResponsiveContainer width="100%" height={250}>
                      <ComposedChart data={paceData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="km" tick={{ fontSize: 11 }} />
                        <YAxis
                          yAxisId="pace"
                          reversed
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v: number) => {
                            const m = Math.floor(v / 60);
                            const s = Math.round(v % 60);
                            return `${m}:${s.toString().padStart(2, '0')}`;
                          }}
                        />
                        {streams.heartrate && (
                          <YAxis yAxisId="hr" orientation="right" tick={{ fontSize: 11 }} />
                        )}
                        <Tooltip />
                        <Line
                          yAxisId="pace"
                          type="monotone"
                          dataKey="paceSeconds"
                          stroke="#ff6b35"
                          dot={false}
                          strokeWidth={2}
                          name="Pace (s/km)"
                        />
                        {streams.heartrate && (
                          <Area
                            yAxisId="hr"
                            type="monotone"
                            dataKey="hr"
                            fill="#ef444433"
                            stroke="#ef4444"
                            strokeWidth={1}
                            name="Heart Rate"
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}

                {elevationData.length > 0 && (
                  <ChartCard title="Elevation">
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={elevationData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="km" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="altitude"
                          fill="#86efac44"
                          stroke="#22c55e"
                          strokeWidth={2}
                          name="Elevation (m)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}

                {hrZoneData.length > 0 && activity.hasHeartrate && (
                  <ChartCard title="Heart Rate Zones">
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={hrZoneData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis type="number" tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="zone" tick={{ fontSize: 11 }} width={60} />
                        <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                        <Bar dataKey="percentage" name="Time in Zone">
                          {hrZoneData.map((_, i) => (
                            <Cell key={i} fill={HR_ZONE_COLORS[i]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}
              </>
            )}
          </div>

          {/* Splits column */}
          <div className="lg:col-span-2">
            {streamsLoading ? (
              <ChartSkeleton height="h-[300px]" />
            ) : splitsData.length > 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">Splits</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-gray-500">
                      <th className="pb-2">KM</th>
                      <th className="pb-2">Pace</th>
                      <th className="pb-2">Elev</th>
                      {activity.hasHeartrate && <th className="pb-2">HR</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {splitsData.map((split, i) => (
                      <tr key={i} className="border-b border-gray-100 last:border-0">
                        <td className="py-1.5 font-medium text-gray-700">{split.km}</td>
                        <td className="py-1.5 text-gray-600">{split.pace}</td>
                        <td className="py-1.5 text-gray-600">{split.elevation}m</td>
                        {activity.hasHeartrate && (
                          <td className="py-1.5 text-gray-600">{split.hr || '—'}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <p className="mt-4 text-center text-xs text-gray-400">
              Powered by Strava
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function ChartSkeleton({ height }: { height: string }) {
  return (
    <div className={`${height} animate-pulse rounded-lg border border-gray-200 bg-gray-100`} />
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">{title}</h3>
      {children}
    </div>
  );
}

// --- Data builders ---

function buildPaceData(streams: Record<string, unknown[]>) {
  const distance = streams.distance as number[] | undefined;
  const velocity = streams.velocity_smooth as number[] | undefined;
  const heartrate = streams.heartrate as number[] | undefined;

  if (!distance || !velocity) return [];

  const data: { km: number; paceSeconds: number; hr?: number }[] = [];
  let lastKm = 0;

  for (let i = 0; i < distance.length; i++) {
    const currentKm = Math.floor(distance[i] / 1000);
    if (currentKm > lastKm || i === distance.length - 1) {
      const speed = velocity[i] || 0;
      const paceSeconds = speed > 0 ? 1000 / speed : 0;
      data.push({
        km: currentKm,
        paceSeconds,
        hr: heartrate?.[i],
      });
      lastKm = currentKm;
    }
  }

  return data;
}

function buildElevationData(streams: Record<string, unknown[]>) {
  const distance = streams.distance as number[] | undefined;
  const altitude = streams.altitude as number[] | undefined;

  if (!distance || !altitude) return [];

  const data: { km: number; altitude: number }[] = [];
  // Sample every ~100m for performance
  const step = Math.max(1, Math.floor(distance.length / 200));

  for (let i = 0; i < distance.length; i += step) {
    data.push({
      km: +(distance[i] / 1000).toFixed(2),
      altitude: Math.round(altitude[i] as number),
    });
  }

  return data;
}

function buildHrZoneData(streams: Record<string, unknown[]>, maxHr: number) {
  const heartrate = streams.heartrate as number[] | undefined;
  if (!heartrate || heartrate.length === 0) return [];

  const zones = [0, 0, 0, 0, 0];
  for (const hr of heartrate) {
    zones[getHrZone(hr as number, maxHr)]++;
  }

  const total = heartrate.length;
  return HR_ZONE_LABELS.map((label, i) => ({
    zone: label,
    percentage: (zones[i] / total) * 100,
  }));
}

function buildSplitsData(streams: Record<string, unknown[]>) {
  const distance = streams.distance as number[] | undefined;
  const time = streams.time as number[] | undefined;
  const altitude = streams.altitude as number[] | undefined;
  const heartrate = streams.heartrate as number[] | undefined;

  if (!distance || !time) return [];

  const splits: { km: number; pace: string; elevation: string; hr?: string }[] = [];
  let lastKmIdx = 0;

  for (let i = 1; i < distance.length; i++) {
    const currentKm = Math.floor(distance[i] / 1000);
    const prevKm = Math.floor(distance[i - 1] / 1000);

    if (currentKm > prevKm) {
      const timeDelta = (time[i] as number) - (time[lastKmIdx] as number);
      const paceMinutes = Math.floor(timeDelta / 60);
      const paceSeconds = Math.round(timeDelta % 60);

      const elevGain = altitude
        ? Math.max(0, Math.round((altitude[i] as number) - (altitude[lastKmIdx] as number)))
        : 0;

      const avgHr = heartrate
        ? Math.round(
            heartrate.slice(lastKmIdx, i).reduce((sum, v) => sum + (v as number), 0) /
              (i - lastKmIdx)
          )
        : undefined;

      splits.push({
        km: currentKm,
        pace: `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}`,
        elevation: `+${elevGain}`,
        hr: avgHr ? `${avgHr}` : undefined,
      });

      lastKmIdx = i;
    }
  }

  return splits;
}
