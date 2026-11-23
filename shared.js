/**
 * obs-dock-starter — shared state sync helper
 * Zero-dependency localStorage sync between OBS Custom Browser Dock and Browser Source.
 * License: MIT (KitWorks Lab)
 */
(function (global) {
  'use strict';

  const SCHEMA_VERSION = 1;
  const STORAGE_KEY = 'obs_dock_starter_state_v1';
  const CHANNEL_NAME = 'obs_dock_starter_ch_v1';
  const POLL_INTERVAL_MS = 350;

  const PRESETS = [
    {
      id: 'working',
      label: 'Working',
      badge: 'LIVE · FOCUS',
      mood: 'active',
      subtitle: 'Building & shipping on stream'
    },
    {
      id: 'break',
      label: 'Break',
      badge: 'ON BREAK',
      mood: 'warn',
      subtitle: 'Be right back in 5 minutes'
    },
    {
      id: 'chatting',
      label: 'Chatting',
      badge: 'JUST CHATTING',
      mood: 'info',
      subtitle: 'Q&A and topic catch-up'
    },
    {
      id: 'ending',
      label: 'Ending',
      badge: 'WRAPPING UP',
      mood: 'ended',
      subtitle: 'Thanks for watching today'
    }
  ];

  function createDefaultState() {
    return {
      v: SCHEMA_VERSION,
      seq: 0,
      updatedAt: Date.now(),
      visible: true,
      title: 'Today: OBS Dock Starter',
      subtitle: PRESETS[0].subtitle,
      status: PRESETS[0].badge,
      mood: PRESETS[0].mood,
      presetId: PRESETS[0].id,
      countLabel: 'Tasks',
      count: 0,
      goal: 10
    };
  }

  function safeParse(raw) {
    if (typeof raw !== 'string' || !raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function sanitizeState(candidate) {
    const base = createDefaultState();
    if (!candidate || typeof candidate !== 'object') return base;
    if (candidate.v !== SCHEMA_VERSION) {
      // Future schema migrations can transform older payloads here.
      return base;
    }
    const allowedMoods = new Set(['active', 'warn', 'info', 'ended']);
    const count = Number.isFinite(Number(candidate.count)) ? Math.max(0, Math.floor(Number(candidate.count))) : base.count;
    const goal = Number.isFinite(Number(candidate.goal)) ? Math.max(0, Math.floor(Number(candidate.goal))) : base.goal;

    return {
      v: SCHEMA_VERSION,
      seq: Number.isFinite(Number(candidate.seq)) ? Math.max(0, Math.floor(Number(candidate.seq))) : 0,
      updatedAt: Number.isFinite(Number(candidate.updatedAt)) ? Number(candidate.updatedAt) : base.updatedAt,
      visible: typeof candidate.visible === 'boolean' ? candidate.visible : base.visible,
      title: typeof candidate.title === 'string' ? candidate.title.slice(0, 120) : base.title,
      subtitle: typeof candidate.subtitle === 'string' ? candidate.subtitle.slice(0, 160) : base.subtitle,
      status: typeof candidate.status === 'string' ? candidate.status.slice(0, 48) : base.status,
      mood: allowedMoods.has(candidate.mood) ? candidate.mood : base.mood,
      presetId: typeof candidate.presetId === 'string' ? candidate.presetId : '',
      countLabel: typeof candidate.countLabel === 'string' ? candidate.countLabel.slice(0, 32) : base.countLabel,
      count,
      goal
    };
  }

  function createChannel() {
    if (typeof global.BroadcastChannel !== 'function') return null;
    try {
      return new global.BroadcastChannel(CHANNEL_NAME);
    } catch (_) {
      return null;
    }
  }

  const channel = createChannel();
  const localListeners = new Set();

  function notifyLocal(state, source) {
    localListeners.forEach(function (fn) {
      try {
        fn(state, source);
      } catch (err) {
        console.error('[obs-dock-starter] listener error:', err);
      }
    });
  }

  function loadState() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      return sanitizeState(safeParse(raw));
    } catch (_) {
      return createDefaultState();
    }
  }

  function saveState(patchOrState) {
    const current = loadState();
    const merged = sanitizeState({
      ...current,
      ...patchOrState,
      v: SCHEMA_VERSION,
      seq: current.seq + 1,
      updatedAt: Date.now()
    });

    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch (err) {
      console.error('[obs-dock-starter] localStorage write failed:', err);
    }

    notifyLocal(merged, 'local');

    if (channel) {
      try {
        channel.postMessage({ type: 'state', state: merged });
      } catch (_) {
        // Ignore cross-context channel errors; localStorage handles sync.
      }
    }
    return merged;
  }

  function resetState() {
    const fresh = createDefaultState();
    fresh.seq = loadState().seq + 1;
    fresh.updatedAt = Date.now();
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch (err) {
      console.error('[obs-dock-starter] localStorage reset failed:', err);
    }
    notifyLocal(fresh, 'reset');
    if (channel) {
      try {
        channel.postMessage({ type: 'state', state: fresh });
      } catch (_) {}
    }
    return fresh;
  }

  function stampOf(state) {
    return state.seq + ':' + state.updatedAt;
  }

  /**
   * Subscribe to state updates across OBS Dock and Browser Source.
   * Combines local dispatch + storage event + BroadcastChannel + deduplicated polling fallback.
   * Returns an unsubscribe function.
   */
  function subscribe(onChange) {
    let lastStamp = '';

    function emitIfChanged(rawCandidate, source) {
      const next = sanitizeState(rawCandidate);
      const stamp = stampOf(next);
      if (stamp === lastStamp) return;
      lastStamp = stamp;
      onChange(next, source);
    }

    localListeners.add(emitIfChanged);

    // Initial render
    emitIfChanged(loadState(), 'init');

    function handleStorage(event) {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      const parsed = safeParse(event.newValue);
      if (parsed) emitIfChanged(parsed, 'storage');
    }

    function handleMessage(event) {
      if (event.data && event.data.type === 'state' && event.data.state) {
        emitIfChanged(event.data.state, 'broadcast');
      }
    }

    global.addEventListener('storage', handleStorage);
    if (channel) {
      channel.addEventListener('message', handleMessage);
    }

    // Fallback polling covers OBS CEF builds where file:/// storage events do not fire reliably.
    const pollId = global.setInterval(function () {
      try {
        const raw = global.localStorage.getItem(STORAGE_KEY);
        const parsed = safeParse(raw);
        if (parsed) emitIfChanged(parsed, 'poll');
      } catch (_) {}
    }, POLL_INTERVAL_MS);

    return function unsubscribe() {
      localListeners.delete(emitIfChanged);
      global.removeEventListener('storage', handleStorage);
      if (channel) {
        channel.removeEventListener('message', handleMessage);
      }
      global.clearInterval(pollId);
    };
  }

  function formatClock(timestamp) {
    const d = new Date(timestamp || Date.now());
    const pad = (n) => String(n).padStart(2, '0');
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  global.ObsDockStarter = {
    SCHEMA_VERSION,
    STORAGE_KEY,
    PRESETS,
    createDefaultState,
    loadState,
    saveState,
    resetState,
    subscribe,
    formatClock
  };
})(window);
