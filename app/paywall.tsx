import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import type { AppSettings } from '../src/types';
import { loadSettings } from '../src/lib/storage';
import { getTheme, resolveThemeMode } from '../src/lib/theme';
import { usePro } from '../src/lib/pro';

export default function PaywallScreen() {
  const router = useRouter();
  const systemMode = useColorScheme();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const { isPro, purchase, restore, error, price } = usePro();
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const load = async () => {
        const loadedSettings = await loadSettings();
        if (!isActive) {
          return;
        }
        setSettings(loadedSettings);
      };
      load();
      return () => {
        isActive = false;
      };
    }, [])
  );

  const resolvedMode = resolveThemeMode(settings?.themeMode, systemMode);
  const theme = getTheme({ presetId: settings?.themeId ?? 't1', mode: resolvedMode });

  const handleBuy = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    const ok = await purchase();
    setBusy(false);
    if (ok) {
      router.back();
    }
  };

  const handleRestore = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    const ok = await restore();
    setBusy(false);
    if (ok) {
      router.back();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.title, { color: theme.colors.text }]}>Unlock Pro</Text>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
            Lifetime unlock. Customize icons, themes, widget opacity, and export.
          </Text>
          <View style={styles.list}>
            <Text style={[styles.listItem, { color: theme.colors.text }]}>
              • Widget customization (opacity)
            </Text>
            <Text style={[styles.listItem, { color: theme.colors.text }]}>• Custom icons</Text>
            <Text style={[styles.listItem, { color: theme.colors.text }]}>• Theme presets</Text>
            <Text style={[styles.listItem, { color: theme.colors.text }]}>
              • Export to PDF
            </Text>
          </View>

          {error ? <Text style={[styles.error, { color: theme.colors.accent }]}>{error}</Text> : null}

          {isPro ? (
            <Pressable
              style={[styles.secondaryButton, { borderColor: theme.colors.border }]}
              onPress={() => router.back()}
            >
              <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Close</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleBuy}
                disabled={busy}
              >
                <Text style={{ color: theme.colors.primaryText, fontWeight: '600' }}>
                  Buy Lifetime{price ? ` • ${price}` : ''}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryButton, { borderColor: theme.colors.border }]}
                onPress={handleRestore}
                disabled={busy}
              >
                <Text style={{ color: theme.colors.text, fontWeight: '600' }}>
                  Restore Purchases
                </Text>
              </Pressable>
              <Pressable style={styles.cancelButton} onPress={() => router.back()}>
                <Text style={{ color: theme.colors.muted }}>Cancel</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  card: {
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  list: {
    marginTop: 16,
    gap: 6,
  },
  listItem: {
    fontSize: 14,
  },
  error: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: 18,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButton: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButton: {
    marginTop: 12,
    alignItems: 'center',
  },
});
