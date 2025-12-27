import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import UpgradeModal from '../components/upgrade-modal';
import type { AppSettings, BathroomEvent, EventType, ProState } from '../src/types';
import { loadEvents, loadProState, loadSettings } from '../src/lib/storage';
import { getEffectivePro, setDevProOverride } from '../src/lib/pro';
import { getTheme, resolveThemeMode } from '../src/lib/theme';
import { buildCSV, buildPdfHtml, buildPlainText } from '../src/lib/export';

type RangeFilter = 'today' | 'week' | 'month' | 'year' | 'all';
type TypeFilter = 'all' | EventType;

const RANGE_OPTIONS: Array<{ id: RangeFilter; label: string; summary: string }> = [
  { id: 'today', label: 'Today', summary: 'Today' },
  { id: 'week', label: 'Week', summary: 'This week' },
  { id: 'month', label: 'Month', summary: 'This month' },
  { id: 'year', label: 'Year', summary: 'This year' },
  { id: 'all', label: 'All', summary: 'All time' },
];

const TYPE_OPTIONS: Array<{ id: TypeFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'pee', label: 'Pee' },
  { id: 'poop', label: 'Poop' },
];

function startOfDay(ts: number): number {
  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function startOfWeek(ts: number): number {
  const date = new Date(ts);
  const day = date.getDay();
  const diff = (day + 6) % 7;
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function startOfMonth(ts: number): number {
  const date = new Date(ts);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function startOfYear(ts: number): number {
  const date = new Date(ts);
  date.setMonth(0, 1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function rangeStart(range: RangeFilter, now: number): number {
  switch (range) {
    case 'today':
      return startOfDay(now);
    case 'week':
      return startOfWeek(now);
    case 'month':
      return startOfMonth(now);
    case 'year':
      return startOfYear(now);
    case 'all':
    default:
      return 0;
  }
}

export default function ExportScreen() {
  const [events, setEvents] = useState<BathroomEvent[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [proState, setProState] = useState<ProState | null>(null);
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('today');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [busy, setBusy] = useState(false);
  const systemMode = useColorScheme();

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const load = async () => {
        const [loadedSettings, loadedEvents, loadedPro] = await Promise.all([
          loadSettings(),
          loadEvents(),
          loadProState(),
        ]);
        if (!isActive) {
          return;
        }
        setSettings(loadedSettings);
        setEvents(loadedEvents);
        setProState(loadedPro);
      };
      load();
      return () => {
        isActive = false;
      };
    }, [])
  );

  const resolvedMode = resolveThemeMode(settings?.themeMode, systemMode);
  const theme = getTheme({ presetId: settings?.themeId ?? 't1', mode: resolvedMode });
  const isPro = proState ? getEffectivePro(proState) : false;

  const filteredEvents = useMemo(() => {
    const now = Date.now();
    const start = rangeStart(rangeFilter, now);
    return events.filter((event) => {
      if (event.ts < start) {
        return false;
      }
      if (typeFilter === 'all') {
        return true;
      }
      return event.type === typeFilter;
    });
  }, [events, rangeFilter, typeFilter]);

  const summary = useMemo(() => {
    let pee = 0;
    let poop = 0;
    filteredEvents.forEach((event) => {
      if (event.type === 'pee') {
        pee += 1;
      } else if (event.type === 'poop') {
        poop += 1;
      }
    });
    const rangeLabel =
      RANGE_OPTIONS.find((option) => option.id === rangeFilter)?.summary ?? 'All time';
    return {
      rangeLabel,
      total: filteredEvents.length,
      pee,
      poop,
    };
  }, [filteredEvents, rangeFilter]);

  const ensureShareAvailable = async () => {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert('Sharing unavailable', 'Sharing is not available on this device.');
      return false;
    }
    return true;
  };

  const handleSharePdf = async () => {
    if (!settings) {
      return;
    }
    if (!(await ensureShareAvailable())) {
      return;
    }
    setBusy(true);
    try {
      const html = buildPdfHtml(filteredEvents, settings, summary);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
    } catch (error) {
      Alert.alert('Export failed', 'Unable to generate the PDF export.');
    } finally {
      setBusy(false);
    }
  };

  const handleShareText = async () => {
    if (!settings) {
      return;
    }
    if (!(await ensureShareAvailable())) {
      return;
    }
    const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!baseDir) {
      Alert.alert('Export failed', 'No writable directory is available.');
      return;
    }
    setBusy(true);
    try {
      const content = buildPlainText(filteredEvents, settings);
      const uri = `${baseDir}BathroomCounter-export-${Date.now()}.txt`;
      await FileSystem.writeAsStringAsync(uri, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(uri, { mimeType: 'text/plain' });
    } catch (error) {
      Alert.alert('Export failed', 'Unable to generate the text export.');
    } finally {
      setBusy(false);
    }
  };

  const handleShareCsv = async () => {
    if (!settings) {
      return;
    }
    if (!(await ensureShareAvailable())) {
      return;
    }
    const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!baseDir) {
      Alert.alert('Export failed', 'No writable directory is available.');
      return;
    }
    setBusy(true);
    try {
      const content = buildCSV(filteredEvents, settings);
      const uri = `${baseDir}BathroomCounter-export-${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(uri, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(uri, { mimeType: 'text/csv' });
    } catch (error) {
      Alert.alert('Export failed', 'Unable to generate the CSV export.');
    } finally {
      setBusy(false);
    }
  };

  const shareButton = (label: string, onPress: () => void, locked: boolean) => (
    <Pressable
      style={[
        styles.primaryButton,
        {
          backgroundColor: locked ? theme.colors.border : theme.colors.primary,
          opacity: busy ? 0.6 : 1,
        },
      ]}
      onPress={locked ? () => setShowUpgrade(true) : onPress}
      disabled={busy}
    >
      <Text style={{ color: locked ? theme.colors.muted : theme.colors.primaryText, fontWeight: '600' }}>
        {label} {locked ? '(Pro)' : ''}
      </Text>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Filters</Text>
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Date range</Text>
          <View style={styles.filterRow}>
            {RANGE_OPTIONS.map((option) => {
              const active = rangeFilter === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setRangeFilter(option.id)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? theme.colors.primary : theme.colors.card,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: active ? theme.colors.primaryText : theme.colors.text }}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.label, { color: theme.colors.text }]}>Type</Text>
          <View style={styles.filterRow}>
            {TYPE_OPTIONS.map((option) => {
              const active = typeFilter === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setTypeFilter(option.id)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? theme.colors.primary : theme.colors.card,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: active ? theme.colors.primaryText : theme.colors.text }}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Summary</Text>
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Text style={{ color: theme.colors.text }}>Range: {summary.rangeLabel}</Text>
          <Text style={{ color: theme.colors.text }}>
            Total: {summary.total} (Pee {summary.pee} / Poop {summary.poop})
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Export</Text>
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          {shareButton('Share PDF', handleSharePdf, !isPro)}
          {shareButton('Share Text', handleShareText, !isPro)}
          {shareButton('Share CSV', handleShareCsv, !isPro)}
        </View>
      </ScrollView>

      <UpgradeModal
        visible={showUpgrade}
        isPro={isPro}
        showDevToggle={__DEV__}
        theme={theme}
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  primaryButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
});
