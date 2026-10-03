import { AsyncLocalStorage } from 'node:async_hooks';

/** Carries how deep we are inside automation-triggered changes, to stop rule loops. */
export const automationContext = new AsyncLocalStorage<{ depth: number; automationId: string }>();

export const automationDepth = () => automationContext.getStore()?.depth ?? 0;
