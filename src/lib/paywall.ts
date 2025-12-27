import { useCallback, useMemo } from 'react';
import { useRouter, useSegments } from 'expo-router';

export function usePaywall() {
  const router = useRouter();
  const segments = useSegments();
  const isPaywallOpen = useMemo(() => segments[0] === 'paywall', [segments]);

  const openPaywall = useCallback(() => {
    if (isPaywallOpen) {
      return;
    }
    router.push('/paywall');
  }, [isPaywallOpen, router]);

  return { openPaywall, isPaywallOpen };
}
