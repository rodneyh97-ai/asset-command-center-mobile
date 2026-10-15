import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';

import type { AnalyticsEvent, AnalyticsName } from '../analytics/events';
import type { FeedbackKind } from '../engine';
import { initialState, parseStored, reducer, type Action, type AppState } from './state';

const STORAGE_KEY = 'eatos.state.v1';

interface Store {
  state: AppState;
  ready: boolean;
  dispatch: (a: Action) => void;
  track: (name: AnalyticsName, props?: AnalyticsEvent['props']) => void;
  feedback: (mealId: string, kind: FeedbackKind) => void;
  deleteAllData: () => Promise<void>;
}

const StoreContext = createContext<Store | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => dispatch({ type: 'hydrate', state: parseStored(raw) }))
      .catch(() => dispatch({ type: 'hydrate', state: initialState }))
      .finally(() => {
        hydrated.current = true;
        setReady(true);
        dispatch({ type: 'track', event: { name: 'app_open', at: new Date().toISOString() } });
      });
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {
      // Storage full or unavailable: the app keeps working for this session.
    });
  }, [state]);

  const track = useCallback((name: AnalyticsName, props?: AnalyticsEvent['props']) => {
    dispatch({ type: 'track', event: { name, at: new Date().toISOString(), props } });
  }, []);

  const feedback = useCallback((mealId: string, kind: FeedbackKind) => {
    dispatch({ type: 'feedback', mealId, kind, at: new Date().toISOString() });
  }, []);

  const deleteAllData = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
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
