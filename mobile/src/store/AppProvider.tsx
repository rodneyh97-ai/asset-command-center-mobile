import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';

import { clock } from '../clock';
import { CRASH_KEY } from '../analytics/crash';
import type { AnalyticsEvent, AnalyticsName } from '../analytics/events';
import type { FeedbackKind, MealTime, Setting } from '../engine';
import { syncReminders } from '../notifications/reminders';
import { initialState, parseStored, reducer, type Action, type AppState } from './state';

const STORAGE_KEY = 'eatos.state.v1';
const BACKUP_KEY = 'eatos.state.unreadable-backup';

interface Store {
  state: AppState;
  ready: boolean;
  dispatch: (a: Action) => void;
  track: (name: AnalyticsName, props?: AnalyticsEvent['props']) => void;
  feedback: (mealId: string, kind: FeedbackKind, where?: { setting: Setting; mealTime: MealTime }) => void;
  deleteAllData: () => Promise<void>;
}

const StoreContext = createContext<Store | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [ready, setReady] = useState(false);
  // Only write after a successful read; otherwise a transient read error would
  // overwrite the user's real data with an empty profile.
  const canPersist = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = parseStored(raw);
        if (parsed.unreadable) {
          // Keep a copy of anything we couldn't read (e.g. from a newer app version) before replacing it.
          await AsyncStorage.setItem(BACKUP_KEY, parsed.unreadable);
        }
        if (cancelled) return;
        const { unreadable: _drop, ...clean } = parsed;
        dispatch({ type: 'hydrate', state: clean });
        canPersist.current = true;
        // Re-apply reminder choices (e.g. after an OS update cleared scheduled notifications).
        void syncReminders(clean.reminders).catch(() => {});
      } catch {
        // Read failed: run this session in memory only and leave stored data untouched.
        if (!cancelled) dispatch({ type: 'hydrate', state: initialState });
      } finally {
        if (!cancelled) {
          setReady(true);
          dispatch({ type: 'track', event: { name: 'app_open', at: clock.now().toISOString() } });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canPersist.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {
      // Storage full or unavailable: the app keeps working for this session.
    });
  }, [state]);

  const track = useCallback((name: AnalyticsName, props?: AnalyticsEvent['props']) => {
    dispatch({ type: 'track', event: { name, at: clock.now().toISOString(), props } });
  }, []);

  const feedback = useCallback(
    (mealId: string, kind: FeedbackKind, where?: { setting: Setting; mealTime: MealTime }) => {
      dispatch({ type: 'feedback', mealId, kind, at: clock.now().toISOString(), ...where });
    },
    [],
  );

  const deleteAllData = useCallback(async () => {
    await AsyncStorage.multiRemove([STORAGE_KEY, BACKUP_KEY, CRASH_KEY]);
    await syncReminders([]).catch(() => {});
    canPersist.current = true;
    dispatch({ type: 'deleteAll' });
  }, []);

  const value = useMemo(
    () => ({ state, ready, dispatch, track, feedback, deleteAllData }),
    [state, ready, track, feedback, deleteAllData],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore must be used inside <AppProvider>');
  return s;
}
