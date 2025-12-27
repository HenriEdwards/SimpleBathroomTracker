import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as IAP from 'react-native-iap';

import type { ProState } from '../types';
import { loadProState, saveProState, subscribeProState } from './storage';

const PRODUCT_ID = 'pro_lifetime';

let cachedProState: ProState = { isPro: false, devProOverride: false };
let cachedLoaded = false;
let iapInitPromise: Promise<boolean> | null = null;

type ProHook = {
  isPro: boolean;
  isLoading: boolean;
  error: string | null;
  price: string | null;
  devProOverride: boolean;
  purchase: () => Promise<boolean>;
  restore: () => Promise<boolean>;
};

function updateCache(state: ProState) {
  cachedProState = state;
  cachedLoaded = true;
}

export function getEffectivePro(state: ProState): boolean {
  return state.isPro || (__DEV__ && state.devProOverride);
}

export async function setDevProOverride(on: boolean): Promise<void> {
  const current = await loadProState();
  const next = { ...current, devProOverride: on };
  updateCache(next);
  await saveProState(next);
}

export async function setProPurchased(on: boolean): Promise<void> {
  const current = await loadProState();
  const next = { ...current, isPro: on };
  updateCache(next);
  await saveProState(next);
}

async function ensureIapConnection(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }
  if (iapInitPromise) {
    return iapInitPromise;
  }
  iapInitPromise = IAP.initConnection()
    .then(async () => {
      try {
        await IAP.flushFailedPurchasesCachedAsPendingAndroid();
      } catch {
        // Ignore init cleanup errors.
      }
      return true;
    })
    .catch(() => false);
  return iapInitPromise;
}

function normalizedPurchase(input: unknown) {
  if (!input) {
    return null;
  }
  if (Array.isArray(input)) {
    return input[0] ?? null;
  }
  return input;
}

export function requirePro(isPro: boolean, openPaywall: () => void, action: () => void): boolean {
  if (isPro) {
    action();
    return true;
  }
  openPaywall();
  return false;
}

export function usePro(): ProHook {
  const [proState, setProState] = useState<ProState>(cachedProState);
  const [isLoading, setIsLoading] = useState(!cachedLoaded);
  const [error, setError] = useState<string | null>(null);
  const [price, setPrice] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    if (!cachedLoaded) {
      loadProState().then((state) => {
        updateCache(state);
        if (isActive) {
          setProState(state);
          setIsLoading(false);
        }
      });
    } else {
      setIsLoading(false);
    }
    const unsubscribe = subscribeProState((state) => {
      updateCache(state);
      if (isActive) {
        setProState(state);
      }
    });
    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    const loadPrice = async () => {
      const ready = await ensureIapConnection();
      if (!ready) {
        return;
      }
      try {
        const products = await (IAP.getProducts as unknown as (args: { skus: string[] }) => Promise<any[]>)({
          skus: [PRODUCT_ID],
        });
        const product = products.find((item) => item.productId === PRODUCT_ID);
        const nextPrice =
          (product as { localizedPrice?: string; price?: string } | undefined)?.localizedPrice ||
          (product as { price?: string } | undefined)?.price ||
          null;
        if (isActive) {
          setPrice(nextPrice);
        }
      } catch {
        // Ignore price lookup errors.
      }
    };
    void loadPrice();
    return () => {
      isActive = false;
    };
  }, []);

  const isPro = useMemo(() => getEffectivePro(proState), [proState]);

  const purchase = useCallback(async () => {
    setError(null);
    const ready = await ensureIapConnection();
    if (!ready) {
      setError('Billing unavailable.');
      return false;
    }
    try {
      const result = await (IAP.requestPurchase as unknown as (args: { sku: string }) => Promise<any>)({
        sku: PRODUCT_ID,
      });
      const purchaseResult = normalizedPurchase(result);
      if (!purchaseResult) {
        return false;
      }
      try {
        await IAP.finishTransaction({ purchase: purchaseResult, isConsumable: false });
      } catch {
        try {
          await IAP.finishTransaction(purchaseResult as unknown as any, false);
        } catch {
          // Ignore finish errors; entitlement is stored locally below.
        }
      }
      await setProPurchased(true);
      return true;
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code !== 'E_USER_CANCELLED') {
        setError('Purchase failed.');
      }
      return false;
    }
  }, []);

  const restore = useCallback(async () => {
    setError(null);
    const ready = await ensureIapConnection();
    if (!ready) {
      setError('Billing unavailable.');
      return false;
    }
    try {
      const purchases = await (IAP.getAvailablePurchases as unknown as () => Promise<any[]>)();
      const hasPro = purchases.some((purchase) => purchase.productId === PRODUCT_ID);
      if (hasPro) {
        await setProPurchased(true);
        return true;
      }
      setError('No purchases found.');
      return false;
    } catch {
      setError('Restore failed.');
      return false;
    }
  }, []);

  return {
    isPro,
    isLoading,
    error,
    price,
    devProOverride: proState.devProOverride,
    purchase,
    restore,
  };
}
