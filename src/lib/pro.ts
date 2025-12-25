import type { ProState } from '../types';
import { loadProState, saveProState } from './storage';

export function getEffectivePro(state: ProState): boolean {
  return state.isPro || state.devProOverride;
}

export async function setDevProOverride(on: boolean): Promise<void> {
  const current = await loadProState();
  await saveProState({ ...current, devProOverride: on });
}

export async function setProPurchased(on: boolean): Promise<void> {
  const current = await loadProState();
  await saveProState({ ...current, isPro: on });
}
