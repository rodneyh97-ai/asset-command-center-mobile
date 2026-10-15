import { useMemo } from 'react';

import { activeProfile, type AppState } from './state';

/** Me + whoever I'm eating with, memoized so screens don't recompute on every render. */
export function useActiveProfile(state: AppState) {
  return useMemo(
    () => activeProfile(state),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only these fields affect the result
    [state.profile, state.members, state.eatingWith],
  );
}
