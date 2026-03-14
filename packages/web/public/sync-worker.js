// SharedWorker for SSE sync events
// Plain JS — SharedWorker cannot be a module in all browsers

const channel = new BroadcastChannel('paceup-sync');
let eventSource = null;
let ports = [];
let reconnectDelay = 1000;
let connecting = false;
let lastKnownStatus = null;

const EVENT_TYPES = ['sync-progress', 'sync-complete', 'sync-error', 'init', 'auth-expired', 'deauthorized'];

function connect() {
  if (eventSource || connecting) return;
  connecting = true;

  eventSource = new EventSource('/api/sync/events', { withCredentials: true });

  eventSource.onopen = () => {
    connecting = false;
    reconnectDelay = 1000;
  };

  for (const type of EVENT_TYPES) {
    eventSource.addEventListener(type, (e) => {
      try {
        const data = JSON.parse(e.data);
        lastKnownStatus = { type, data };
        channel.postMessage(lastKnownStatus);
      } catch (err) {
        console.warn('Failed to parse SSE event:', type, err);
      }
    });
  }

  eventSource.onerror = () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    connecting = false;

    if (ports.length > 0) {
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    }
  };
}

onconnect = (e) => {
  const port = e.ports[0];
  ports.push(port);

  // Reset backoff if user opens a new tab while reconnecting
  if (reconnectDelay > 2000) reconnectDelay = 1000;

  connect();

  // Send last known status to prevent init race
  if (lastKnownStatus) {
    port.postMessage(lastKnownStatus);
  }

  port.onmessage = (msg) => {
    if (msg.data === 'disconnect') {
      ports = ports.filter((p) => p !== port);
      if (ports.length === 0 && eventSource) {
        eventSource.close();
        eventSource = null;
      }
    }
  };
};
