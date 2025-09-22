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

    const rootA = document.createElement('div');
    const rootB = document.createElement('div');
    document.body.appendChild(rootA);
    document.body.appendChild(rootB);

    const { container: a } = render(ClientStateProvider as any, { props: { instance: stateA } , container: rootA});
    const { container: b } = render(ClientStateProvider as any, { props: { instance: stateB } , container: rootB});

    // Render a consumer under each provider to verify context wiring
    const consumerA = render(TestContextConsumer as any, { container: a, props: { instance: stateA } });
    const consumerB = render(TestContextConsumer as any, { container: b, props: { instance: stateB } });

    const elA = consumerA.container.querySelector('[data-equal]') as HTMLElement;
    const elB = consumerB.container.querySelector('[data-equal]') as HTMLElement;
    expect(elA?.getAttribute('data-equal')).toBe('true');
    expect(elB?.getAttribute('data-equal')).toBe('true');
    expect(stateA).not.toBe(stateB);
  });
});

