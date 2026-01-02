// Component exports
export { default as SilaApp } from './comps/SilaApp.svelte';
export type { ClientStateConfig } from './state/clientState.svelte';
export type { AppDialogs, OpenDialogOptions, SaveDialogOptions } from './appDialogs';
export { ClientState } from './state/clientState.svelte';
export { provideClientState } from './state/clientStateContext';
export { default as ClientStateProvider } from './comps/ClientStateProvider.svelte';
export { i18n } from './state/i18n.svelte';