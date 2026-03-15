import { create } from 'zustand';

// --- SSE Event Types (discriminated union) ---

export interface SyncProgress {
  type: 'sync-progress';
  data: {
    userId: string;
    status: 'syncing';
    activitiesCompleted: number;
    totalEnqueued: number;
    pagesCompleted: number;
    listingDone?: boolean;
    phase?: 'listing' | 'queuing';
    page?: number;
  };
}

export interface SyncComplete {
  type: 'sync-complete';
  data: {
    userId: string;
    activitiesCompleted?: number;
  };
}

export interface SyncError {
  type: 'sync-error';
  data: {
    userId: string;
    error: string;
  };
}

export interface AuthExpired {
  type: 'auth-expired';
  data: { message: string };
}

export interface Deauthorized {
  type: 'deauthorized';
  data: { message: string };
}

export type SyncEvent = SyncProgress | SyncComplete | SyncError | AuthExpired | Deauthorized;

export interface SyncStatus {
  status: 'idle' | 'syncing' | 'error';
  activitiesCompleted?: number;
  totalEnqueued?: number;
  pagesCompleted?: number;
  listingDone?: boolean;
  phase?: 'listing' | 'queuing' | 'fetching';
  error?: string;
}

interface SyncStore {
  statuses: Record<string, SyncStatus>;
  isConnected: boolean;
  setStatus: (userId: string, status: SyncStatus) => void;
  clearStatus: (userId: string) => void;
  setConnected: (connected: boolean) => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  statuses: {},
  isConnected: false,
  setStatus: (userId, status) =>
    set((state) => ({
      statuses: { ...state.statuses, [userId]: status },
    })),
  clearStatus: (userId) =>
    set((state) => {
      const { [userId]: _, ...rest } = state.statuses;
      return { statuses: rest };
    }),
  setConnected: (connected) => set({ isConnected: connected }),
}));

// --- Reference-counted connection management ---

let refCount = 0;
let eventSource: EventSource | null = null;
let rafId: number | null = null;
let pendingMessages: SyncEvent[] = [];

function processMessage(event: SyncEvent): void {
  const store = useSyncStore.getState();

  switch (event.type) {
    case 'sync-progress': {
      const d = event.data;
      const phase = d.listingDone
        ? 'fetching'
        : d.phase === 'listing'
          ? 'listing'
          : 'queuing';
      store.setStatus(d.userId, {
        status: 'syncing',
        activitiesCompleted: d.activitiesCompleted,
        totalEnqueued: d.totalEnqueued,
        pagesCompleted: d.pagesCompleted,
        listingDone: d.listingDone,
        phase,
      });
      break;
    }
    case 'sync-complete':
      store.setStatus(event.data.userId, { status: 'idle' });
      break;
    case 'sync-error':
      store.setStatus(event.data.userId, {
        status: 'error',
        error: event.data.error,
      });
      break;
    case 'auth-expired':
    case 'deauthorized':
      disconnectSync();
      window.location.href = '/?error=session_expired';
      break;
  }
}

function batchProcess(): void {
  const messages = pendingMessages;
  pendingMessages = [];
  rafId = null;
  for (const msg of messages) {
    processMessage(msg);
  }
}

function handleMessage(event: SyncEvent): void {
  pendingMessages.push(event);
  if (rafId === null) {
    rafId = requestAnimationFrame(batchProcess);
  }
}

export function connectSync(): void {
  refCount++;
  if (refCount > 1) return; // Already connected

  // Direct EventSource connection
  eventSource = new EventSource('/api/sync/events', { withCredentials: true });

  const eventTypes = ['sync-progress', 'sync-complete', 'sync-error', 'auth-expired', 'deauthorized', 'init'];
  for (const type of eventTypes) {
    eventSource.addEventListener(type, (e: Event) => {
      const data = JSON.parse((e as MessageEvent).data);
      handleMessage({ type, data } as SyncEvent);
    });
  }

  eventSource.onopen = () => {
    useSyncStore.getState().setConnected(true);
  };

  eventSource.onerror = () => {
    useSyncStore.getState().setConnected(false);
  };
}

export function disconnectSync(): void {
  refCount--;
  if (refCount > 0) return;

  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }

  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  pendingMessages = [];

  useSyncStore.getState().setConnected(false);
}
