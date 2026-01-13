import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as IAP from 'react-native-iap';
import { ErrorCode } from 'react-native-iap';

import type { ProState } from '../types';
import { loadProState, saveProState, subscribeProState } from './storage';

const PRODUCT_ID = 'relieflog_pro_lifetime';

let cachedProState: ProState = { isPro: false, devProOverride: false };
let cachedLoaded = false;
let iapInitPromise: Promise<boolean> | null = null;

type ProHook = {
  isPro: boolean;
  isLoading: boolean;
  errorKey: ProErrorKey | null;
  price: string | null;
  devProOverride: boolean;
  purchase: () => Promise<boolean>;
  restore: () => Promise<boolean>;
};

type ProErrorKey =
  | 'proErrors.billingUnavailable'
  | 'proErrors.purchaseFailed'
  | 'proErrors.restoreFailed'
  | 'proErrors.noPurchasesFound';

type ProductLike = {
  id?: string | null;
  productId?: string | null;
  localizedPrice?: string | null;
  oneTimePurchaseOfferDetailsAndroid?: Array<{ formattedPrice: string }> | null;
  price?: string | number | null;
};

function updateCache(state: ProState) {
  cachedProState = state;
  cachedLoaded = true;
}

export function getEffectivePro(state: ProState): boolean {
  return state.isPro || (__DEV__ && state.devProOverride);
}

export async function setDevProOverride(on: boolean): Promise<void> {
  if (!__DEV__) {
    return;
  }
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
  console.log('[pro] IAP init start');
  iapInitPromise = IAP.initConnection()
    .then(async () => {
      const flushFn = (IAP as any).flushFailedPurchasesCachedAsPendingAndroid as
        | (() => Promise<void>)
        | undefined;
      if (typeof flushFn === 'function') {
        try {
          await flushFn();
        } catch {
          // Ignore init cleanup errors.
        }
      }
      console.log('[pro] IAP init done');
      return true;
    })
    .catch(() => {
      console.log('[pro] IAP init failed');
      return false;
    });
  return iapInitPromise;
}

function getErrorCode(err: unknown): ErrorCode | null {
  if (!err || typeof err !== 'object' || !('code' in err)) {
    return null;
  }
  const code = (err as { code?: unknown }).code;
  if (typeof code === 'string') {
    return code as ErrorCode;
  }
  return null;
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

function getProductId(product: ProductLike): string | null {
  return product.productId ?? product.id ?? null;
}

function getProductPrice(product: ProductLike): string | null {
  const localizedPrice = product.localizedPrice ?? null;
  const offerPrice = product.oneTimePurchaseOfferDetailsAndroid?.[0]?.formattedPrice ?? null;
  const rawPrice = product.price ?? null;
  const priceValue = typeof rawPrice === 'number' ? rawPrice.toString() : rawPrice;
  return localizedPrice ?? offerPrice ?? priceValue ?? null;
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
  const [errorKey, setErrorKey] = useState<ProErrorKey | null>(null);
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
      console.info('[pro] iap init start (price)');
      const ready = await ensureIapConnection();
      console.info('[pro] iap init end (price)', { ready });
      if (!ready) {
        return;
      }
      try {
        const products =
          (await IAP.fetchProducts({
            skus: [PRODUCT_ID],
            type: 'in-app',
          })) ?? [];
        const productIds = products
          .map((item) => getProductId(item as ProductLike))
          .filter((id): id is string => Boolean(id));
        console.info('[pro] fetchProducts result', {
          count: products.length,
          productIds,
        });
        const product = products.find(
          (item) => getProductId(item as ProductLike) === PRODUCT_ID
        );
        const nextPrice = product ? getProductPrice(product as ProductLike) : null;
        if (isActive) {
          setPrice(nextPrice);
        }
      } catch (err) {
        const error = err as { code?: string; message?: string };
        console.error('[pro] fetchProducts failed', {
          err,
          code: error?.code,
          message: error?.message,
        });
      }
    };
    void loadPrice();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    const purchaseSubscription = IAP.purchaseUpdatedListener(async (purchase) => {
      if (!isActive) {
        return;
      }
      if (purchase.productId !== PRODUCT_ID) {
        return;
      }
      try {
        await IAP.finishTransaction({ purchase, isConsumable: false });
      } catch (err) {
        const error = err as { code?: string; message?: string };
        console.error('[pro] finishTransaction failed', {
          err,
          code: error?.code,
          message: error?.message,
        });
      }
      await setProPurchased(true);
    });
    const errorSubscription = IAP.purchaseErrorListener((err) => {
      if (!isActive) {
        return;
      }
      const code = getErrorCode(err);
      console.log('[pro] purchase error', code ?? 'unknown', err?.message ?? '');
      if (code !== ErrorCode.UserCancelled) {
        setErrorKey('proErrors.purchaseFailed');
      }
    });
    return () => {
      isActive = false;
      purchaseSubscription?.remove();
      errorSubscription?.remove();
    };
  }, []);

  const isPro = useMemo(() => getEffectivePro(proState), [proState]);

  const purchase = useCallback(async () => {
    setErrorKey(null);
    const ready = await ensureIapConnection();
    if (!ready) {
      setErrorKey('proErrors.billingUnavailable');
      return false;
    }
    try {
      console.log(`[pro] purchase start id=${PRODUCT_ID}`);
      const result = await IAP.requestPurchase({
        request: { google: { skus: [PRODUCT_ID] } },
        type: 'in-app',
      });
      const purchaseResult = normalizedPurchase(result);
      if (!purchaseResult) {
        return false;
      }
      try {
        await IAP.finishTransaction({ purchase: purchaseResult, isConsumable: false });
      } catch {
        // Ignore finish errors; entitlement is stored locally below.
      }
      await setProPurchased(true);
      return true;
    } catch (err) {
      const code = getErrorCode(err);
      console.log('[pro] purchase request error', code ?? 'unknown', err?.message ?? '');
      if (code !== ErrorCode.UserCancelled) {
        setErrorKey('proErrors.purchaseFailed');
      }
      return false;
    }
  }, []);

  const restore = useCallback(async () => {
    setErrorKey(null);
    const ready = await ensureIapConnection();
    if (!ready) {
      setErrorKey('proErrors.billingUnavailable');
      return false;
    }
    try {
      const purchases = await IAP.getAvailablePurchases();
      const purchaseIds = purchases.map((purchase) => purchase.productId);
      console.log(`[pro] restore purchases=${purchases.length} ids=${purchaseIds.join(',')}`);
      const hasPro = purchases.some((purchase) => purchase.productId === PRODUCT_ID);
      if (hasPro) {
        await setProPurchased(true);
        return true;
      }
      setErrorKey('proErrors.noPurchasesFound');
      return false;
    } catch {
      setErrorKey('proErrors.restoreFailed');
      return false;
    }
  }, []);

  return {
    isPro,
    isLoading,
    errorKey,
    price,
    devProOverride: proState.devProOverride,
    purchase,
    restore,
  };
}
