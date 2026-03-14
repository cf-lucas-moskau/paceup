import { create } from 'zustand';

// --- SSE Event Types (discriminated union) ---

export interface SyncProgress {
  type: 'sync-progress';
  data: {
    userId: string;
    status: 'syncing';
    completed: number;
    total: number;
    type: string;
  };
}

export interface SyncComplete {
  type: 'sync-complete';
  data: {
    userId: string;
    stravaActivityId?: number;
    type?: string;
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
  completed?: number;
  total?: number;
  syncType?: string;
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
let worker: SharedWorker | null = null;
let eventSource: EventSource | null = null;
let channel: BroadcastChannel | null = null;
let rafId: number | null = null;
let pendingMessages: SyncEvent[] = [];

function processMessage(event: SyncEvent): void {
  const store = useSyncStore.getState();

  switch (event.type) {
    case 'sync-progress':
      store.setStatus(event.data.userId, {
        status: 'syncing',
        completed: event.data.completed,
        total: event.data.total,
        syncType: event.data.type,
      });
      break;
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
      // Session ended server-side — disconnect and redirect to login
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

function handleChannelMessage(e: MessageEvent): void {
  handleMessage(e.data as SyncEvent);
}

export function connectSync(): void {
  refCount++;
  if (refCount > 1) return; // Already connected

  // Try SharedWorker first, fall back to direct EventSource
  if (typeof SharedWorker !== 'undefined') {
    try {
      worker = new SharedWorker('/sync-worker.js');
      channel = new BroadcastChannel('paceup-sync');
      channel.onmessage = handleChannelMessage;
      // Handle lastKnownStatus replay from SharedWorker
      worker.port.onmessage = handleChannelMessage;
      worker.port.start();
      useSyncStore.getState().setConnected(true);
      return;
    } catch {
      // SharedWorker failed, fall through to EventSource
      worker = null;
      channel = null;
    }
  }

  // Fallback: direct EventSource (Safari/iOS)
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
  if (refCount > 0) return; // Other components still connected

  if (worker) {
    worker.port.postMessage('disconnect');
    worker = null;
  }

  if (channel) {
    channel.onmessage = null;
    channel.close();
    channel = null;
  }

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
