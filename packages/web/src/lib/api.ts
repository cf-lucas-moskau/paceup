const API_BASE = '/api';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Redirect to login if unauthorized
      window.location.href = '/';
      throw new Error('Unauthorized');
    }
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}

export interface User {
  id: string;
  name: string;
  avatarUrl: string | null;
  timezone: string;
  unitPreference: string;
  isConnected: boolean;
  createdAt: string;
}

export function fetchCurrentUser(): Promise<{ user: User }> {
  return apiFetch('/auth/me');
}

export function logout(): Promise<{ ok: boolean }> {
  return apiFetch('/auth/logout', { method: 'POST' });
}

export { apiFetch };
