import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ClientStateProvider from '@sila/client/state/ClientStateProvider.svelte';
import { ClientState } from '@sila/client/state/clientState.svelte';
import TestContextConsumer from './TestContextConsumer.svelte';

describe('ClientState context and isolation (Svelte)', () => {
  it('renders two isolated app trees with separate states', async () => {
    const stateA = new ClientState();
    const stateB = new ClientState();
    await stateA.init({});
    await stateB.init({});

    // Render consumer inside provider via default slot to inherit context
    const { container: a } = render(ClientStateProvider as any, {
      props: { instance: stateA },
      slots: { default: TestContextConsumer as any },
    });
    const { container: b } = render(ClientStateProvider as any, {
      props: { instance: stateB },
      slots: { default: TestContextConsumer as any },
    });

    const elA = a.querySelector('[data-equal]') as HTMLElement;
    const elB = b.querySelector('[data-equal]') as HTMLElement;
    expect(elA?.getAttribute('data-equal')).toBe('true');
    expect(elB?.getAttribute('data-equal')).toBe('true');
    expect(stateA).not.toBe(stateB);
  });
});

