export function Landing() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neo-white">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border-3 border-neo-black bg-brand-500 shadow-neo-lg">
          <span className="text-4xl font-bold text-white">P</span>
        </div>
        <h1 className="text-5xl font-bold text-neo-black">
          Pace<span className="text-brand-500">Up</span>
        </h1>
        <p className="mt-3 text-lg text-gray-500">
          Training plans. Activity analysis. Group accountability.
        </p>
        <a
          href="/api/auth/strava"
          className="neo-btn mt-8 inline-flex items-center gap-2 bg-[#fc4c02] text-lg text-white hover:bg-[#e34402]"
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
