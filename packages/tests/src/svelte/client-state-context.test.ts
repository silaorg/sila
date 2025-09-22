import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ClientStateProvider from '@sila/client/state/ClientStateProvider.svelte';
import { ClientState } from '@sila/client';
import SilaApp from '@sila/client/comps/SilaApp.svelte';

describe('ClientState context and isolation', () => {
  it('provides isolated ClientState instances per subtree', async () => {
    const stateA = new ClientState();
    const stateB = new ClientState();

    // Initialize both states with no-op config
    await stateA.init({});
    await stateB.init({});

    // Render two isolated apps side by side
    const { container: containerA } = render(ClientStateProvider as any, {
      props: {
        instance: stateA,
        children: () => SilaApp,
      },
    });

    const { container: containerB } = render(ClientStateProvider as any, {
      props: {
        instance: stateB,
        children: () => SilaApp,
      },
    });

    expect(containerA).toBeTruthy();
    expect(containerB).toBeTruthy();

    // The two states should not be the same reference
    expect(stateA).not.toBe(stateB);
  });
});

