import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import type { AppSettings } from '../src/types';
import { loadSettings } from '../src/lib/storage';
import { getTheme, resolveThemeMode } from '../src/lib/theme';

export default function ProUnlockedScreen() {
  const router = useRouter();
  const systemMode = useColorScheme();
  const [settings, setSettings] = useState<AppSettings | null>(null);

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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.title, { color: theme.colors.text }]}>Pro Unlocked</Text>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
            You have lifetime Pro access.
          </Text>
          <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>Included:</Text>
          <View style={styles.list}>
            <Text style={[styles.listItem, { color: theme.colors.text }]}>
              - Widget customization (opacity)
            </Text>
            <Text style={[styles.listItem, { color: theme.colors.text }]}>- Custom icons</Text>
            <Text style={[styles.listItem, { color: theme.colors.text }]}>- Theme presets</Text>
            <Text style={[styles.listItem, { color: theme.colors.text }]}>- Export to PDF</Text>
          </View>

          <Pressable
            style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={{ color: theme.colors.primaryText, fontWeight: '600' }}>Close</Text>
          </Pressable>
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
  sectionLabel: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    marginTop: 8,
    gap: 6,
  },
  listItem: {
    fontSize: 14,
  },
  primaryButton: {
    marginTop: 18,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
});
