import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { Dashboard } from './pages/Dashboard';
import { Planner } from './pages/Planner';
import { Activities } from './pages/Activities';
import { Settings } from './pages/Settings';
import { Groups } from './pages/Groups';
import { GroupDetail } from './pages/GroupDetail';
import { GroupTraining } from './pages/GroupTraining';
import { Feed } from './pages/Feed';
import { ScopeRequired } from './pages/ScopeRequired';
import { ProtectedRoute } from './components/ProtectedRoute';

// Lazy-load chart-heavy pages to reduce initial bundle
const ActivityDetail = lazy(() =>
  import('./pages/ActivityDetail').then((m) => ({ default: m.ActivityDetail }))
);

function LazyFallback() {
  return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" /></div>;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/planner"
          element={
            <ProtectedRoute>
              <Planner />
            </ProtectedRoute>
          }
        />
        <Route
          path="/activities"
          element={
            <ProtectedRoute>
              <Activities />
            </ProtectedRoute>
          }
        />
        <Route
          path="/activity/:id"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LazyFallback />}>
                <ActivityDetail />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups"
          element={
            <ProtectedRoute>
              <Groups />
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups/:groupId"
          element={
            <ProtectedRoute>
              <GroupDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups/:groupId/training"
          element={
            <ProtectedRoute>
              <GroupTraining />
            </ProtectedRoute>
          }
        />
        <Route
          path="/feed"
          element={
            <ProtectedRoute>
              <Feed />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route path="/auth/scope-required" element={<ScopeRequired />} />
      </Routes>
    </BrowserRouter>
  );
}
