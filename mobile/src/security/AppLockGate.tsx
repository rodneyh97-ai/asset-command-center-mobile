import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { useStore } from '../store/AppProvider';
import { Body, Button, Icon, Logo, Title } from '../ui/components';
import { space, useColors } from '../ui/theme';
import { authenticate, lockSupported, RELOCK_AFTER_MS } from './appLock';

/** Covers the app with a lock screen when App Lock is on and the app was away long enough. */
export function AppLockGate({ children }: { children: ReactNode }) {
  const { state, ready, dispatch } = useStore();
  const c = useColors();
  const [awaySince, setAwaySince] = useState<number | null>(null);
  const [returnedAt, setReturnedAt] = useState<number | null>(null);
  const prompting = useRef(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') setAwaySince(Date.now());
      if (s === 'active') setReturnedAt(Date.now());
    });
    return () => sub.remove();
  }, []);

  const unlockedAt = state.sessionUnlockedAt;
  const relock =
    unlockedAt !== null && awaySince !== null && returnedAt !== null && awaySince > unlockedAt && returnedAt - awaySince >= RELOCK_AFTER_MS;
  const locked = ready && lockSupported && state.appLock && (unlockedAt === null || relock);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    const ok = await authenticate();
    prompting.current = false;
    if (ok) dispatch({ type: 'unlocked', at: Date.now() });
  }, [dispatch]);

  useEffect(() => {
    if (locked) void unlock();
  }, [locked, unlock]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {locked ? (
        <View style={[StyleSheet.absoluteFill, styles.lock, { backgroundColor: c.hero }]} accessibilityViewIsModal>
          <Logo size={44} inverse />
          <Icon name="lock-closed" size={40} color={c.accent} />
          <Title style={{ color: c.heroText, textAlign: 'center' }}>EatOS is locked</Title>
          <Body style={{ color: c.heroMuted, textAlign: 'center' }}>Use Face ID, your fingerprint, or your passcode to open it.</Body>
          <View style={{ alignSelf: 'stretch' }}>
            <Button label="Unlock" variant="accent" big icon="finger-print" onPress={unlock} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lock: { alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl },
});
