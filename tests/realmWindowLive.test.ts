import { afterEach, describe, expect, it } from 'vitest';
import { spec } from '../src/ui/windows/RealmWindow';
import { state, campaignListeners } from '../src/app/state';
import { createRealmState } from '../src/engine/campaign/realm';

function fakeBody(): any {
  return {
    isConnected: true,
    innerHTML: '',
    querySelector: () => null,
    querySelectorAll: () => [],
  };
}

describe('realm window — live campaign state', () => {
  afterEach(() => {
    spec.unmount?.();
    state.realm = null;
  });

  it('re-renders an open window when campaign state syncs', () => {
    state.realm = createRealmState();
    const body = fakeBody();

    const before = campaignListeners.size;
    spec.mount(body);
    expect(body.innerHTML).toContain('Public Health');
    expect(campaignListeners.size).toBe(before + 1);

    state.realm = { ...state.realm!, health: 77 };
    for (const listener of campaignListeners) listener();

    expect(body.innerHTML).toContain('77%');
  });

  it('unregisters its listener on unmount', () => {
    state.realm = createRealmState();
    const body = fakeBody();
    const before = campaignListeners.size;

    spec.mount(body);
    spec.unmount?.();

    expect(campaignListeners.size).toBe(before);
  });
});
