import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import UpgradeModal from '../components/upgrade-modal';
import type { AppSettings, ProState } from '../src/types';
import { loadProState, loadSettings, saveSettings, clearAllEvents } from '../src/lib/storage';
import { getEffectivePro, setDevProOverride } from '../src/lib/pro';
import { getTheme, THEME_PRESETS } from '../src/lib/theme';

const DEFAULT_SETTINGS: AppSettings = {
  timeFormat: '24h',
  themeId: 't1',
  iconPee: 'dYs«',
  iconPoop: "dY'c",
};

export default function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [proState, setProState] = useState<ProState | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const load = async () => {
        const [loadedSettings, loadedPro] = await Promise.all([loadSettings(), loadProState()]);
        if (!isActive) {
          return;
        }
        setSettings(loadedSettings);
        setProState(loadedPro);
      };
      load();
      return () => {
        isActive = false;
      };
    }, [])
  );

  const theme = getTheme(settings?.themeId ?? 't1');
  const isPro = proState ? getEffectivePro(proState) : false;

  const updateSettings = async (next: AppSettings) => {
    setSettings(next);
    await saveSettings(next);
  };

  const handleClearEvents = () => {
    Alert.alert('Clear all events?', 'This will remove all logged events.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearAllEvents();
        },
      },
    ]);
  };

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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Appearance</Text>
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Theme preset</Text>
          {THEME_PRESETS.map((preset) => {
            const active = settings?.themeId === preset.id;
            return (
              <Pressable
                key={preset.id}
                onPress={() =>
                  settings ? updateSettings({ ...settings, themeId: preset.id }) : null
                }
                style={[
                  styles.rowButton,
                  {
                    borderColor: active ? theme.colors.primary : theme.colors.border,
                    backgroundColor: theme.colors.card,
                  },
                ]}
              >
                <Text style={{ color: theme.colors.text, fontWeight: active ? '700' : '500' }}>
                  {preset.name}
                </Text>
              </Pressable>
            );
          })}
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
          <Text style={[styles.label, { color: theme.colors.text }]}>Pee icon</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
            value={settings?.iconPee ?? ''}
            maxLength={2}
            onChangeText={(value) =>
              settings ? updateSettings({ ...settings, iconPee: value.slice(0, 2) }) : null
            }
            placeholder="P"
            placeholderTextColor={theme.colors.muted}
          />
          <Text style={[styles.label, { color: theme.colors.text }]}>Poop icon</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
            value={settings?.iconPoop ?? ''}
            maxLength={2}
            onChangeText={(value) =>
              settings ? updateSettings({ ...settings, iconPoop: value.slice(0, 2) }) : null
            }
            placeholder="C"
            placeholderTextColor={theme.colors.muted}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Pro</Text>
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Status: {isPro ? 'Pro unlocked' : 'Pro locked'}
          </Text>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => setShowUpgrade(true)}
          >
            <Text style={{ color: theme.colors.primaryText, fontWeight: '600' }}>Unlock Pro</Text>
          </Pressable>
        </View>

        {__DEV__ ? (
          <>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Developer</Text>
            <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Enable Pro (dev)</Text>
                <Switch
                  value={Boolean(proState?.devProOverride)}
                  onValueChange={async (value) => {
                    await setDevProOverride(value);
                    setProState((prev) => ({
                      isPro: prev?.isPro ?? false,
                      devProOverride: value,
                    }));
                  }}
                />
              </View>
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
      </ScrollView>

      <UpgradeModal
        visible={showUpgrade}
        isPro={isPro}
        showDevToggle={__DEV__}
        onClose={() => setShowUpgrade(false)}
        onEnableDevPro={async () => {
          await setDevProOverride(true);
          setProState((prev) => ({
            isPro: prev?.isPro ?? false,
            devProOverride: true,
          }));
          setShowUpgrade(false);
        }}
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
  segmentedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
});
