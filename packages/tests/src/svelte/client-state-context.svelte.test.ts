import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte/svelte5';
import ClientStateProvider from '@sila/client/state/ClientStateProvider.svelte';
// Avoid importing ClientState to prevent pulling full library graph during test
import TestContextConsumer from './TestContextConsumer.svelte';

describe.skip('ClientState context and isolation (Svelte)', () => {
  it('renders two isolated app trees with separate states', async () => {
    const stateA: any = {};
    const stateB: any = {};

    // Render consumer inside provider via default slot to inherit context
    const { container: a } = render(ClientStateProvider as any, { props: { instance: stateA } });
    const { container: b } = render(ClientStateProvider as any, { props: { instance: stateB } });

    // Nest consumer inside provider containers
    const consumerA = render(TestContextConsumer as any, { container: a });
    const consumerB = render(TestContextConsumer as any, { container: b });

    const elA = consumerA.container.querySelector('[data-equal]') as HTMLElement;
    const elB = consumerB.container.querySelector('[data-equal]') as HTMLElement;
    expect(elA?.getAttribute('data-equal')).toBe('true');
    expect(elB?.getAttribute('data-equal')).toBe('true');
    expect(stateA).not.toBe(stateB);
  });
});

