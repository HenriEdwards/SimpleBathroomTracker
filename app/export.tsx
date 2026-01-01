import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  NativeModules,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useTranslation } from 'react-i18next';

import type { AppSettings, BathroomEvent, EventType } from '../src/types';
import { loadEvents, loadSettings } from '../src/lib/storage';
import { usePro } from '../src/lib/pro';
import { getTheme, resolveThemeMode } from '../src/lib/theme';
import type { ExportChart } from '../src/lib/export';
import { buildPdfHtml } from '../src/lib/export';
import { usePaywall } from '../src/lib/paywall';
import { formatMonthLabel, formatMonthYearLabel, formatShortDate } from '../src/lib/time';

type RangeFilter = 'today' | 'week' | 'month' | 'year' | 'all';
type TypeFilter = 'all' | EventType;
type BucketKind = 'hour' | 'day' | 'month';
type BucketConfig = {
  kind: BucketKind;
  keys: string[];
  labels: string[];
  tickValues: number[];
};
type ExportChartSeries = {
  label: string;
  color: string;
  values: number[];
};
type MediaStoreBridgeModule = {
  savePdfToDownloads: (base64: string, fileName: string) => Promise<string>;
};

const RANGE_OPTIONS: RangeFilter[] = ['today', 'week', 'month', 'year', 'all'];

const TYPE_OPTIONS: TypeFilter[] = ['all', 'pee', 'poop'];

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

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

function bucketKey(ts: number, kind: BucketKind): string {
  const date = new Date(ts);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  if (kind === 'hour') {
    const hour = `${date.getHours()}`.padStart(2, '0');
    return `${year}-${month}-${day}-${hour}`;
  }
  if (kind === 'month') {
    return `${year}-${month}`;
  }
  return `${year}-${month}-${day}`;
}

function buildTickValues(length: number, step: number): number[] {
  if (length === 0) {
    return [];
  }
  const values: number[] = [];
  for (let i = 0; i < length; i += step) {
    values.push(i);
  }
  if (values[values.length - 1] !== length - 1) {
    values.push(length - 1);
  }
  return values;
}

function buildBucketConfig(
  range: RangeFilter,
  filteredEvents: BathroomEvent[],
  now: number
): BucketConfig {
  const keys: string[] = [];
  const labels: string[] = [];
  let kind: BucketKind = 'day';
  let tickStep = 1;

  if (range === 'today') {
    kind = 'hour';
    const start = startOfDay(now);
    for (let hour = 0; hour < 24; hour += 1) {
      const ts = start + hour * MS_PER_HOUR;
      keys.push(bucketKey(ts, kind));
      labels.push(String(hour));
    }
    tickStep = 4;
  } else if (range === 'week') {
    kind = 'day';
    const start = startOfWeek(now);
    for (let day = 0; day < 7; day += 1) {
      const ts = start + day * MS_PER_DAY;
      keys.push(bucketKey(ts, kind));
      labels.push(formatShortDate(ts));
    }
    tickStep = 1;
  } else if (range === 'month') {
    kind = 'day';
    const start = startOfMonth(now);
    const end = startOfDay(now);
    const totalDays = Math.floor((end - start) / MS_PER_DAY) + 1;
    for (let day = 0; day < totalDays; day += 1) {
      const ts = start + day * MS_PER_DAY;
      const date = new Date(ts);
      keys.push(bucketKey(ts, kind));
      labels.push(String(date.getDate()));
    }
    tickStep = Math.max(1, Math.ceil(totalDays / 6));
  } else if (range === 'year') {
    kind = 'month';
    const yearStart = startOfYear(now);
    const currentMonth = new Date(now).getMonth();
    for (let month = 0; month <= currentMonth; month += 1) {
      const date = new Date(yearStart);
      date.setMonth(month);
      keys.push(bucketKey(date.getTime(), kind));
      labels.push(formatMonthLabel(date.getTime()));
    }
    tickStep = 1;
  } else {
    kind = 'month';
    if (filteredEvents.length === 0) {
      return { kind, keys, labels, tickValues: [] };
    }
    const earliestTs = filteredEvents[filteredEvents.length - 1]?.ts ?? now;
    const startDate = new Date(earliestTs);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(now);
    endDate.setDate(1);
    endDate.setHours(0, 0, 0, 0);
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      keys.push(bucketKey(cursor.getTime(), kind));
      labels.push(formatMonthYearLabel(cursor.getTime()));
      cursor.setMonth(cursor.getMonth() + 1);
    }
    tickStep = Math.max(1, Math.ceil(keys.length / 6));
  }

  return { kind, keys, labels, tickValues: buildTickValues(keys.length, tickStep) };
}

function buildExportChart(
  filteredEvents: BathroomEvent[],
  range: RangeFilter,
  typeFilter: TypeFilter,
  theme: ReturnType<typeof getTheme>,
  labels: { pee: string; poop: string }
): ExportChart | null {
  if (filteredEvents.length === 0) {
    return null;
  }
  const now = Date.now();
  const bucketConfig = buildBucketConfig(range, filteredEvents, now);
  if (bucketConfig.keys.length === 0) {
    return null;
  }

  const indexByKey = new Map<string, number>();
  bucketConfig.keys.forEach((key, index) => {
    indexByKey.set(key, index);
  });
  const peeCounts = new Array(bucketConfig.keys.length).fill(0);
  const poopCounts = new Array(bucketConfig.keys.length).fill(0);

  filteredEvents.forEach((event) => {
    const key = bucketKey(event.ts, bucketConfig.kind);
    const index = indexByKey.get(key);
    if (index === undefined) {
      return;
    }
    if (event.type === 'pee') {
      peeCounts[index] += 1;
    } else if (event.type === 'poop') {
      poopCounts[index] += 1;
    }
  });

  const series: ExportChartSeries[] = [];
  if (typeFilter === 'all' || typeFilter === 'pee') {
    series.push({ label: labels.pee, color: theme.colors.primary, values: peeCounts });
  }
  if (typeFilter === 'all' || typeFilter === 'poop') {
    const color = typeFilter === 'all' ? theme.colors.text : theme.colors.primary;
    series.push({ label: labels.poop, color, values: poopCounts });
  }

  let maxValue = 0;
  const nonZeroBuckets = new Set<number>();
  series.forEach((line) => {
    line.values.forEach((value, index) => {
      if (value > maxValue) {
        maxValue = value;
      }
      if (value > 0) {
        nonZeroBuckets.add(index);
      }
    });
  });

  return {
    series,
    maxValue: Math.max(1, maxValue),
    canShow: nonZeroBuckets.size > 1,
    gridColor: theme.colors.border,
    textColor: theme.colors.text,
    mutedColor: theme.colors.muted,
    bgColor: theme.colors.card,
    borderColor: theme.colors.border,
    xLabels: bucketConfig.labels,
    xTickIndices: bucketConfig.tickValues,
  };
}

export default function ExportScreen() {
  const { t } = useTranslation();
  const [events, setEvents] = useState<BathroomEvent[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('today');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [busy, setBusy] = useState(false);
  const systemMode = useColorScheme();
  const { isPro } = usePro();
  const { openPaywall } = usePaywall();
  const rangeSummaryLabels = useMemo(
    () => ({
      today: t('range.today'),
      week: t('range.thisWeek'),
      month: t('range.thisMonth'),
      year: t('range.thisYear'),
      all: t('range.allTime'),
    }),
    [t]
  );
  const mediaStoreBridge: MediaStoreBridgeModule | null =
    Platform.OS === 'android' && NativeModules.MediaStoreBridge
      ? (NativeModules.MediaStoreBridge as MediaStoreBridgeModule)
      : null;

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const load = async () => {
        const [loadedSettings, loadedEvents] = await Promise.all([loadSettings(), loadEvents()]);
        if (!isActive) {
          return;
        }
        setSettings(loadedSettings);
        setEvents(loadedEvents);
      };
      load();
      return () => {
        isActive = false;
      };
    }, [])
  );

  const resolvedMode = resolveThemeMode(settings?.themeMode, systemMode);
  const theme = getTheme({ presetId: settings?.themeId ?? 't1', mode: resolvedMode });

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
    const rangeLabel = rangeSummaryLabels[rangeFilter] ?? t('range.allTime');
    return {
      rangeLabel,
      total: filteredEvents.length,
      pee,
      poop,
    };
  }, [filteredEvents, rangeFilter, rangeSummaryLabels, t]);

  const chart = useMemo(
    () =>
      buildExportChart(filteredEvents, rangeFilter, typeFilter, theme, {
        pee: t('eventTypes.pee'),
        poop: t('eventTypes.poop'),
      }),
    [filteredEvents, rangeFilter, t, typeFilter, theme]
  );

  const ensureShareAvailable = async () => {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert(t('export.sharingUnavailableTitle'), t('export.sharingUnavailableMessage'));
      return false;
    }
    return true;
  };

  const buildPdfFile = async (currentSettings: AppSettings) => {
    const html = buildPdfHtml(filteredEvents, currentSettings, summary, chart);
    return Print.printToFileAsync({ html });
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
      const { uri } = await buildPdfFile(settings);
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
    } catch (error) {
      Alert.alert(t('export.exportFailedTitle'), t('export.exportFailedMessage'));
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!settings) {
      return;
    }
    setBusy(true);
    try {
      const { uri } = await buildPdfFile(settings);
      const info = await FileSystemLegacy.getInfoAsync(uri);
      if (!info.exists || !info.size) {
        throw new Error(`PDF not generated at ${uri}`);
      }
      const base64 = await FileSystemLegacy.readAsStringAsync(uri, {
        encoding: FileSystemLegacy.EncodingType.Base64,
      });
      if (!base64) {
        throw new Error('PDF base64 content is empty');
      }
      if (Platform.OS === 'android') {
        const dateLabel = new Date().toISOString().slice(0, 10);
        const fileName = `SBT_export_${dateLabel}_${Date.now().toString().slice(-4)}.pdf`;
        if (mediaStoreBridge) {
          const needsPermission = typeof Platform.Version === 'number' && Platform.Version < 29;
          if (needsPermission) {
            const granted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
              {
                title: t('export.storagePermissionTitle'),
                message: t('export.storagePermissionMessage'),
                buttonPositive: t('export.allow'),
              }
            );
            if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
              Alert.alert(
                t('export.downloadCanceledTitle'),
                t('export.downloadPermissionMessage')
              );
              return;
            }
          }
          try {
            await mediaStoreBridge.savePdfToDownloads(base64, fileName);
            Alert.alert(t('export.savedTitle'), t('export.savedDownloadsMessage'));
            return;
          } catch (error) {
            console.error('MediaStore save failed', error);
          }
        }
        const storageAccessFramework =
          FileSystem.StorageAccessFramework ?? FileSystemLegacy.StorageAccessFramework;
        if (!storageAccessFramework) {
          throw new Error('StorageAccessFramework unavailable');
        }
        const permissions = await storageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permissions.granted) {
          Alert.alert(
            t('export.downloadCanceledTitle'),
            t('export.downloadChooseFolderMessage')
          );
          return;
        }
        const destUri = await storageAccessFramework.createFileAsync(
          permissions.directoryUri,
          fileName,
          'application/pdf'
        );
        await FileSystemLegacy.writeAsStringAsync(destUri, base64, {
          encoding: FileSystemLegacy.EncodingType.Base64,
        });
        const decoded = decodeURIComponent(permissions.directoryUri);
        const match = decoded.match(/primary:([^/]+)/);
        const folderLabel = match?.[1]?.replace('Download', 'Downloads');
        const savedMessage = folderLabel
          ? t('export.savedMessage', { destination: folderLabel })
          : t('export.savedMessage', { destination: fileName });
        Alert.alert(t('export.savedTitle'), savedMessage);
      } else {
        const baseDir = FileSystemLegacy.documentDirectory;
        if (!baseDir) {
          Alert.alert(t('export.exportFailedTitle'), t('export.noWritableDirectory'));
          return;
        }
        const dateLabel = new Date().toISOString().slice(0, 10);
        const destUri = `${baseDir}SBT_export_${dateLabel}_${Date.now().toString().slice(-4)}.pdf`;
        await FileSystemLegacy.copyAsync({ from: uri, to: destUri });
        Alert.alert(
          t('export.savedTitle'),
          t('export.savedMessage', { destination: destUri })
        );
      }
    } catch (error) {
      console.error('Download PDF failed', error);
      Alert.alert(t('export.exportFailedTitle'), t('export.exportSaveFailedMessage'));
    } finally {
      setBusy(false);
    }
  };

  const shareButton = (label: string, onPress: () => void, locked: boolean) => {
    const proSuffix = locked ? ` (${t('common.pro')})` : '';
    return (
      <Pressable
        style={[
          styles.primaryButton,
          {
            backgroundColor: locked ? theme.colors.border : theme.colors.primary,
            opacity: busy ? 0.6 : 1,
          },
        ]}
        onPress={locked ? openPaywall : onPress}
        disabled={busy}
      >
        <Text
          style={{ color: locked ? theme.colors.muted : theme.colors.primaryText, fontWeight: '600' }}
        >
          {label}
          {proSuffix}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          {t('export.filtersTitle')}
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.label, { color: theme.colors.text }]}>{t('labels.dateRange')}</Text>
          <View style={styles.filterRow}>
            {RANGE_OPTIONS.map((optionId) => {
              const active = rangeFilter === optionId;
              const label = t(`range.${optionId}`);
              return (
                <Pressable
                  key={optionId}
                  onPress={() => setRangeFilter(optionId)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? theme.colors.primary : theme.colors.card,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: active ? theme.colors.primaryText : theme.colors.text }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.label, { color: theme.colors.text }]}>{t('labels.type')}</Text>
          <View style={styles.filterRow}>
            {TYPE_OPTIONS.map((optionId) => {
              const active = typeFilter === optionId;
              const label =
                optionId === 'all' ? t('range.all') : t(`eventTypes.${optionId}`);
              return (
                <Pressable
                  key={optionId}
                  onPress={() => setTypeFilter(optionId)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? theme.colors.primary : theme.colors.card,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: active ? theme.colors.primaryText : theme.colors.text }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          {t('export.summaryTitle')}
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Text style={{ color: theme.colors.text }}>
            {t('export.rangeSummary', { range: summary.rangeLabel })}
          </Text>
          <Text style={{ color: theme.colors.text }}>
            {t('export.totalSummary', {
              total: summary.total,
              pee: summary.pee,
              poop: summary.poop,
              peeLabel: t('eventTypes.pee'),
              poopLabel: t('eventTypes.poop'),
            })}
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          {t('export.exportTitle')}
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          {shareButton(t('export.sharePdf'), handleSharePdf, !isPro)}
          {shareButton(t('export.downloadPdf'), handleDownloadPdf, !isPro)}
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
