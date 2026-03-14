export function Landing() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-gray-900">
          Pace<span className="text-brand-500">Up</span>
        </h1>
        <p className="mt-3 text-lg text-gray-600">
          Training plans. Activity analysis. Group accountability.
        </p>
        <a
          href="/api/auth/strava"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#fc4c02] px-6 py-3 text-lg font-semibold text-white shadow-sm transition hover:bg-[#e34402]"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
          </svg>
          Login with Strava
        </a>
        <p className="mt-4 text-xs text-gray-400">Powered by Strava</p>
      </div>
    </div>
  );
}
