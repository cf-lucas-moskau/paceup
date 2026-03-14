import { useSearchParams } from 'react-router-dom';

export function ScopeRequired() {
  const [searchParams] = useSearchParams();
  const rawUrl = searchParams.get('reauth');
  // Only allow Strava OAuth URLs to prevent open redirect
  const reauthUrl = rawUrl?.startsWith('https://www.strava.com/oauth/') ? rawUrl : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-gray-900">Permission Required</h1>
        <p className="mt-3 text-gray-600">
          PaceUp needs access to your activities to sync your training data.
          Please make sure the <strong>"View data about your activities"</strong> checkbox
          is checked on the Strava authorization page.
        </p>
        {reauthUrl && (
          <a
            href={reauthUrl}
            className="mt-6 inline-block rounded-lg bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600"
          >
            Try Again
          </a>
        )}
        <a href="/" className="mt-4 block text-sm text-gray-400 hover:text-gray-600">
          Back to home
        </a>
      </div>
    </div>
  );
}
