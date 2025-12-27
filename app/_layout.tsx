import { useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import type { AppSettings } from '../src/types';
import { loadSettings, subscribeSettings } from '../src/lib/storage';
import { getTheme, resolveThemeMode } from '../src/lib/theme';

export default function RootLayout() {
  const systemMode = useColorScheme();
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      const loaded = await loadSettings();
      if (isActive) {
        setSettings(loaded);
      }
    };
    void load();
    const unsubscribe = subscribeSettings((next) => {
      setSettings(next);
    });
    return () => {
      isActive = false;
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
      </Stack>
      <StatusBar style={statusBarStyle} backgroundColor={theme.colors.bg} />
    </>
  );
}
