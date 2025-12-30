import { useEffect, useMemo, useRef, useState } from 'react';
import { useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';

import type { AppSettings } from '../src/types';
import { loadSettings, subscribeSettings } from '../src/lib/storage';
import { getTheme, resolveThemeMode } from '../src/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const systemMode = useColorScheme();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const hasHiddenSplashRef = useRef(false);
  const splashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isActive = true;
    const hideSplashIfNeeded = async () => {
      if (hasHiddenSplashRef.current) {
        return;
      }
      hasHiddenSplashRef.current = true;
      if (splashTimerRef.current) {
        clearTimeout(splashTimerRef.current);
        splashTimerRef.current = null;
      }
      await SplashScreen.hideAsync();
    };

    splashTimerRef.current = setTimeout(() => {
      void hideSplashIfNeeded();
    }, 4000);

    const load = async () => {
      try {
        const loaded = await loadSettings();
        if (isActive) {
          setSettings(loaded);
        }
      } finally {
        void hideSplashIfNeeded();
      }
    };
    void load();
    const unsubscribe = subscribeSettings((next) => {
      setSettings(next);
    });
    return () => {
      isActive = false;
      if (splashTimerRef.current) {
        clearTimeout(splashTimerRef.current);
        splashTimerRef.current = null;
      }
      unsubscribe();
    };
  }, []);

  const resolvedMode = resolveThemeMode(settings?.themeMode, systemMode);
  const theme = useMemo(
    () => getTheme({ presetId: settings?.themeId ?? 't1', mode: resolvedMode }),
    [settings?.themeId, resolvedMode]
  );
  const statusBarStyle = resolvedMode === 'dark' ? 'light' : 'dark';

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { color: theme.colors.text, fontWeight: '600', fontSize: 16 },
          headerTitleAlign: 'center',
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Simple Bathroom Tracker' }} />
        <Stack.Screen name="export" options={{ title: 'Export' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="paywall" options={{ title: 'Unlock Pro' }} />
        <Stack.Screen name="pro-unlocked" options={{ title: 'Pro Unlocked' }} />
      </Stack>
      <StatusBar style={statusBarStyle} backgroundColor={theme.colors.bg} />
    </>
  );
}
