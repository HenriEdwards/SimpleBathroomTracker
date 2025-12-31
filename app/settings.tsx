import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import Slider from '@react-native-community/slider';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import IconPickerModal from '../src/components/IconPickerModal';
import { DEFAULT_PEE_ICON, DEFAULT_POOP_ICON, ICON_PRESETS, isValidIcon } from '../src/lib/icons';
import { usePaywall } from '../src/lib/paywall';
import { setDevProOverride, usePro } from '../src/lib/pro';
import { clearAllEvents, loadEvents, loadSettings, saveEvents, saveSettings } from '../src/lib/storage';
import { getTheme, resolveThemeMode, THEME_PRESETS } from '../src/lib/theme';
import { mirrorWidgetSettings, mirrorWidgetSummary } from '../src/lib/widget-bridge';
import type { AppSettings, BathroomEvent } from '../src/types';

const DEFAULT_SETTINGS: AppSettings = {
  timeFormat: '24h',
  themeId: 't1',
  themeMode: 'system',
  widgetOpacity: 1,
  iconPee: DEFAULT_PEE_ICON,
  iconPoop: DEFAULT_POOP_ICON,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SEED_CONFIG = {
  days: 90,
  minTotal: 300,
  maxTotal: 600,
  minPerDay: 2,
  maxPerDay: 10,
  peeRatio: 0.85,
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildDailyCounts(days: number): number[] {
  const counts = Array.from({ length: days }, () =>
    randomInt(SEED_CONFIG.minPerDay, SEED_CONFIG.maxPerDay)
  );
  let total = counts.reduce((sum, value) => sum + value, 0);
  if (total > SEED_CONFIG.maxTotal) {
    let excess = total - SEED_CONFIG.maxTotal;
    while (excess > 0) {
      const index = randomInt(0, counts.length - 1);
      if (counts[index] > SEED_CONFIG.minPerDay) {
        counts[index] -= 1;
        excess -= 1;
      }
    }
  } else if (total < SEED_CONFIG.minTotal) {
    let deficit = SEED_CONFIG.minTotal - total;
    while (deficit > 0) {
      const index = randomInt(0, counts.length - 1);
      if (counts[index] < SEED_CONFIG.maxPerDay) {
        counts[index] += 1;
        deficit -= 1;
      }
    }
  }
  total = counts.reduce((sum, value) => sum + value, 0);
  if (total > SEED_CONFIG.maxTotal) {
    while (total > SEED_CONFIG.maxTotal) {
      const index = randomInt(0, counts.length - 1);
      if (counts[index] > SEED_CONFIG.minPerDay) {
        counts[index] -= 1;
        total -= 1;
      }
    }
  }
  return counts;
}

function buildSeedEvents(now: number): BathroomEvent[] {
  const counts = buildDailyCounts(SEED_CONFIG.days);
  const events: BathroomEvent[] = [];
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  for (let day = 0; day < counts.length; day += 1) {
    const baseTs = dayStart.getTime() - day * MS_PER_DAY;
    for (let i = 0; i < counts[day]; i += 1) {
      const earlySlot = Math.random() < 0.1;
      const minutesWindow = earlySlot ? 6 * 60 : 17 * 60 + 30;
      const offsetMinutes = earlySlot
        ? randomInt(0, minutesWindow - 1)
        : Math.floor(((Math.random() + Math.random()) / 2) * minutesWindow);
      const minutesFromStart = earlySlot ? offsetMinutes : 6 * 60 + offsetMinutes;
      const ts = baseTs + minutesFromStart * 60 * 1000 + randomInt(0, 59) * 1000;
      events.push({
        id: `seed-${ts}-${day}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        type: Math.random() < SEED_CONFIG.peeRatio ? 'pee' : 'poop',
        ts,
      });
    }
  }
  return events.sort((a, b) => b.ts - a.ts);
}

export default function SettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [activePicker, setActivePicker] = useState<'pee' | 'poop' | null>(null);
  const systemMode = useColorScheme();
  const { isPro, devProOverride } = usePro();
  const { openPaywall } = usePaywall();
  const [seedBusy, setSeedBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const load = async () => {
        const [loadedSettings] = await Promise.all([loadSettings()]);
        if (!isActive) {
          return;
        }
        setSettings(loadedSettings);
        const resolvedMode = resolveThemeMode(loadedSettings?.themeMode, systemMode);
        await mirrorWidgetSettings(loadedSettings, resolvedMode);
      };
      load();
      return () => {
        isActive = false;
      };
    }, [systemMode])
  );

  const resolvedMode = resolveThemeMode(settings?.themeMode, systemMode);
  const theme = getTheme({ presetId: settings?.themeId ?? 't1', mode: resolvedMode });
  const iconPee = settings?.iconPee ?? DEFAULT_PEE_ICON;
  const iconPoop = settings?.iconPoop ?? DEFAULT_POOP_ICON;
  const widgetOpacity = settings?.widgetOpacity ?? 1;
  const customizationLocked = !isPro;

  const updateSettings = async (next: AppSettings) => {
    setSettings(next);
    await saveSettings(next);
    const resolvedMode = resolveThemeMode(next.themeMode, systemMode);
    await mirrorWidgetSettings(next, resolvedMode);
  };

  const handleOpacityChange = (value: number) => {
    if (!settings) {
      return;
    }
    const clamped = Math.min(1, Math.max(0.5, value));
    const next = { ...settings, widgetOpacity: clamped };
    setSettings(next);
    const resolvedMode = resolveThemeMode(next.themeMode, systemMode);
    void mirrorWidgetSettings(next, resolvedMode);
  };

  const handleOpacityComplete = async (value: number) => {
    if (!settings) {
      return;
    }
    const clamped = Math.min(1, Math.max(0.5, value));
    await updateSettings({ ...settings, widgetOpacity: clamped });
  };

  const handleIconSelect = async (icon: string) => {
    if (!settings || !activePicker || !isValidIcon(icon) || customizationLocked) {
      return;
    }
    const next: AppSettings =
      activePicker === 'pee'
        ? { ...settings, iconPee: icon }
        : { ...settings, iconPoop: icon };
    await updateSettings(next);
    setActivePicker(null);
  };

  const handleClearEvents = () => {
    Alert.alert('Clear all events?', 'This will remove all logged events.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearAllEvents();
          await mirrorWidgetSummary([]);
        },
      },
    ]);
  };

  const applySeedEvents = useCallback(async (seeded: BathroomEvent[], mode: 'append' | 'replace') => {
    try {
      const existing = mode === 'append' ? await loadEvents() : [];
      const next = mode === 'append' ? [...seeded, ...existing] : seeded;
      next.sort((a, b) => b.ts - a.ts);
      await saveEvents(next);
      await mirrorWidgetSummary(next);
      Alert.alert(mode === 'append' ? 'Added events' : 'Seeded events', `Seeded ${seeded.length} events.`);
    } finally {
      setSeedBusy(false);
    }
  }, []);

  const handleSeedDemoData = useCallback(async () => {
    if (!__DEV__ || seedBusy) {
      return;
    }
    setSeedBusy(true);
    const seeded = buildSeedEvents(Date.now());
    try {
      const existing = await loadEvents();
      if (existing.length > 0) {
        Alert.alert('Seed demo data', 'Append to or replace existing events?', [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setSeedBusy(false),
          },
          {
            text: 'Replace',
            style: 'destructive',
            onPress: () => {
              void applySeedEvents(seeded, 'replace');
            },
          },
          {
            text: 'Append',
            onPress: () => {
              void applySeedEvents(seeded, 'append');
            },
          },
        ]);
        return;
      }
      await applySeedEvents(seeded, 'replace');
    } catch {
      setSeedBusy(false);
    }
  }, [applySeedEvents, seedBusy]);

  const handleClearAndSeed = useCallback(async () => {
    if (!__DEV__ || seedBusy) {
      return;
    }
    setSeedBusy(true);
    const seeded = buildSeedEvents(Date.now());
    void applySeedEvents(seeded, 'replace');
  }, [applySeedEvents, seedBusy]);

  const handleResetSettings = () => {
    Alert.alert('Reset settings?', 'This will restore defaults.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await updateSettings(DEFAULT_SETTINGS);
        },
      },
    ]);
  };

  const handleRateApp = useCallback(async () => {
    const packageId = 'com.anonymous.BathroomTracker';
    const marketUrl = `market://details?id=${packageId}`;
    const webUrl = `https://play.google.com/store/apps/details?id=${packageId}`;
    const target = Platform.OS === 'android' ? marketUrl : webUrl;
    try {
      const supported = await Linking.canOpenURL(target);
      await Linking.openURL(supported ? target : webUrl);
    } catch {
      Alert.alert('Unable to open the store right now.');
    }
  }, []);

  const handleRequestFeature = useCallback(async () => {
    const subject = 'Feature request - Bathroom Tracker';
    const body = 'Tell me about the feature you would like to see.';
    const mailto = `mailto:henriedwards.work@gmail.com?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    try {
      const supported = await Linking.canOpenURL(mailto);
      if (!supported) {
        Alert.alert('No email app available.');
        return;
      }
      await Linking.openURL(mailto);
    } catch {
      Alert.alert('Unable to open the email app.');
    }
  }, []);

  const handleOpenX = useCallback(async () => {
    const handle = 'henriedev';
    const appUrl = `twitter://user?screen_name=${handle}`;
    const webUrl = `https://x.com/${handle}`;
    try {
      const supported = await Linking.canOpenURL(appUrl);
      await Linking.openURL(supported ? appUrl : webUrl);
    } catch {
      Alert.alert('Unable to open the X profile.');
    }
  }, []);

  const handleProPress = () => {
    if (isPro) {
      router.push('/pro-unlocked');
      return;
    }
    openPaywall();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Appearance</Text>
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Mode</Text>
          <View style={styles.segmentedRow}>
            {(['light', 'dark'] as const).map((mode) => {
              const active = resolvedMode === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() =>
                    settings ? updateSettings({ ...settings, themeMode: mode }) : null
                  }
                  style={[
                    styles.segmentButton,
                    {
                      backgroundColor: active ? theme.colors.primary : theme.colors.card,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: active ? theme.colors.primaryText : theme.colors.text }}>
                    {mode === 'light' ? 'Light' : 'Dark'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.sectionRow}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Theme preset</Text>
            {customizationLocked ? (
              <View style={[styles.proBadge, { backgroundColor: theme.colors.primary }]}>
                <Text style={[styles.proBadgeText, { color: theme.colors.primaryText }]}>Pro</Text>
              </View>
            ) : null}
          </View>
          {THEME_PRESETS.map((preset) => {
            const active = settings?.themeId === preset.id;
            return (
              <Pressable
                key={preset.id}
                onPress={() => {
                  if (!settings) {
                    return;
                  }
                  if (customizationLocked) {
                    openPaywall();
                    return;
                  }
                  updateSettings({ ...settings, themeId: preset.id });
                }}
                style={[
                  styles.rowButton,
                  {
                    borderColor: active ? theme.colors.primary : theme.colors.border,
                    backgroundColor: theme.colors.card,
                    opacity: customizationLocked ? 0.5 : 1,
                  },
                ]}
              >
                <Text style={{ color: theme.colors.text, fontWeight: active ? '700' : '500' }}>
                  {preset.name}
                </Text>
              </Pressable>
            );
          })}
          <Text style={[styles.label, { color: theme.colors.text }]}>Widget opacity</Text>
          <Pressable
            onPress={() => {
              if (customizationLocked) {
                openPaywall();
              }
            }}
            disabled={!customizationLocked}
          >
            <View style={styles.opacityRow}>
              <Slider
                style={styles.opacitySlider}
                minimumValue={0.5}
                maximumValue={1}
                step={0.01}
                value={widgetOpacity}
                minimumTrackTintColor={theme.colors.primary}
                maximumTrackTintColor={theme.colors.border}
                thumbTintColor={theme.colors.primary}
                onValueChange={handleOpacityChange}
                onSlidingComplete={handleOpacityComplete}
                disabled={!settings || customizationLocked}
              />
              <Text style={[styles.opacityValue, { color: theme.colors.text }]}>
                Opacity: {Math.round(widgetOpacity * 100)}%
              </Text>
            </View>
          </Pressable>
          <Text style={[styles.label, { color: theme.colors.text }]}>Time format</Text>
          <View style={styles.segmentedRow}>
            {(['24h', '12h'] as const).map((value) => {
              const active = settings?.timeFormat === value;
              return (
                <Pressable
                  key={value}
                  onPress={() =>
                    settings ? updateSettings({ ...settings, timeFormat: value }) : null
                  }
                  style={[
                    styles.segmentButton,
                    {
                      backgroundColor: active ? theme.colors.primary : theme.colors.card,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: active ? theme.colors.primaryText : theme.colors.text }}>
                    {value}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Icons / Privacy</Text>
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Pressable
            style={[
              styles.iconRow,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.card,
                opacity: customizationLocked ? 0.5 : 1,
              },
            ]}
            onPress={() => (customizationLocked ? openPaywall() : setActivePicker('pee'))}
            disabled={!settings}
          >
            <View style={styles.iconCopy}>
              <View style={styles.sectionRow}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Pee icon</Text>
                {customizationLocked ? (
                  <View style={[styles.proBadge, { backgroundColor: theme.colors.primary }]}>
                    <Text style={[styles.proBadgeText, { color: theme.colors.primaryText }]}>
                      Pro
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.iconHint, { color: theme.colors.muted }]}>
                Choose an icon for privacy
              </Text>
            </View>
            <Text style={[styles.iconPreview, { color: theme.colors.text }]}>{iconPee}</Text>
          </Pressable>
          <Pressable
            style={[
              styles.iconRow,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.card,
                opacity: customizationLocked ? 0.5 : 1,
              },
            ]}
            onPress={() => (customizationLocked ? openPaywall() : setActivePicker('poop'))}
            disabled={!settings}
          >
            <View style={styles.iconCopy}>
              <View style={styles.sectionRow}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Poo icon</Text>
                {customizationLocked ? (
                  <View style={[styles.proBadge, { backgroundColor: theme.colors.primary }]}>
                    <Text style={[styles.proBadgeText, { color: theme.colors.primaryText }]}>
                      Pro
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.iconHint, { color: theme.colors.muted }]}>
                Choose an icon for privacy
              </Text>
            </View>
            <Text style={[styles.iconPreview, { color: theme.colors.text }]}>{iconPoop}</Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Pro</Text>
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Status: {isPro ? 'Pro unlocked' : 'Pro locked'}
          </Text>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleProPress}
          >
            <Text style={{ color: theme.colors.primaryText, fontWeight: '600' }}>
              {isPro ? 'Pro Unlocked' : 'Unlock Pro'}
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Feedback</Text>
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Pressable
            style={[
              styles.linkRow,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.card },
            ]}
            onPress={handleRateApp}
          >
            <Text style={[styles.label, { color: theme.colors.text }]}>Rate the app</Text>
          </Pressable>
          <Pressable
            style={[
              styles.linkRow,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.card },
            ]}
            onPress={handleRequestFeature}
          >
            <Text style={[styles.label, { color: theme.colors.text }]}>Request a feature</Text>
          </Pressable>
        </View>

        {__DEV__ ? (
          <>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Developer</Text>
            <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Enable Pro (dev)</Text>
                <Switch
                  value={Boolean(devProOverride)}
                  onValueChange={async (value) => {
                    await setDevProOverride(value);
                  }}
                />
              </View>
              <Pressable
                style={[
                  styles.secondaryButton,
                  { borderColor: theme.colors.border, opacity: seedBusy ? 0.6 : 1 },
                ]}
                onPress={handleSeedDemoData}
                disabled={seedBusy}
              >
                <Text style={{ color: theme.colors.text }}>Seed demo data</Text>
              </Pressable>
              <Text style={[styles.devCaption, { color: theme.colors.muted }]}>
                Generates realistic events across the past 90 days.
              </Text>
              <Pressable
                style={[
                  styles.secondaryButton,
                  { borderColor: theme.colors.border, opacity: seedBusy ? 0.6 : 1 },
                ]}
                onPress={handleClearAndSeed}
                disabled={seedBusy}
              >
                <Text style={{ color: theme.colors.text }}>Clear + Seed</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Data</Text>
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Pressable
            style={[styles.secondaryButton, { borderColor: theme.colors.border }]}
            onPress={handleClearEvents}
          >
            <Text style={{ color: theme.colors.text }}>Clear all events</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, { borderColor: theme.colors.border }]}
            onPress={handleResetSettings}
          >
            <Text style={{ color: theme.colors.text }}>Reset settings</Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Contact</Text>
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Pressable
            style={[
              styles.linkRow,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.card },
            ]}
            onPress={handleOpenX}
          >
            <View style={styles.linkRowLeft}>
              <FontAwesome6 name="x-twitter" size={18} color={theme.colors.muted} />
              <Text style={[styles.label, { color: theme.colors.text }]}>@henriedev</Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>

      <IconPickerModal
        visible={activePicker !== null}
        title={activePicker === 'poop' ? 'Poo icon' : 'Pee icon'}
        selected={activePicker === 'poop' ? iconPoop : iconPee}
        options={ICON_PRESETS}
        onSelect={handleIconSelect}
        onClose={() => setActivePicker(null)}
        theme={theme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  proBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  proBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  opacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  opacitySlider: {
    flex: 1,
    height: 36,
  },
  opacityValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  iconRow: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  iconCopy: {
    flex: 1,
    gap: 4,
  },
  iconHint: {
    fontSize: 12,
  },
  iconPreview: {
    fontSize: 28,
  },
  primaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  devCaption: {
    marginTop: -4,
    fontSize: 12,
  },
  linkRow: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
