import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentUser, logout as apiLogout, type User } from './api';

export function useAuth() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const user: User | null = data?.user ?? null;
  const isAuthenticated = !!user;

  async function logout() {
    await apiLogout();
    queryClient.clear();
    window.location.href = '/';
  }

  return { user, isAuthenticated, isLoading, error, logout };
}
