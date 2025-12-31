import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  AppStateStatus,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  useColorScheme,
  useWindowDimensions,
  View,
  ViewToken,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';

import type { AppSettings, BathroomEvent, EventType } from '../src/types';
import { appendEvent, loadEvents, loadSettings, saveEvents } from '../src/lib/storage';
import { getTheme, resolveThemeMode } from '../src/lib/theme';
import { formatDate, formatTime } from '../src/lib/time';
import { DEFAULT_PEE_ICON, DEFAULT_POOP_ICON } from '../src/lib/icons';
import { usePaywall } from '../src/lib/paywall';
import { usePro } from '../src/lib/pro';
import {
  clearQueuedWidgetEvents,
  getQueuedWidgetEvents,
  mirrorWidgetSettings,
  mirrorWidgetSummary,
} from '../src/lib/widget-bridge';

type RangeFilter = 'today' | 'week' | 'month' | 'year' | 'all';
type TypeFilter = 'all' | EventType;
type ActiveTab = 'events' | 'stats';
type BucketKind = 'hour' | 'day' | 'month';
type BucketConfig = {
  kind: BucketKind;
  keys: string[];
  labels: string[];
  tickValues: number[];
};

const RANGE_OPTIONS: Array<{ id: RangeFilter; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'all', label: 'All' },
];

const TYPE_OPTIONS: Array<{ id: TypeFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'pee', label: 'Pee' },
  { id: 'poop', label: 'Poo' },
];

const TAB_OPTIONS: Array<{ id: ActiveTab; label: string }> = [
  { id: 'events', label: 'Events' },
  { id: 'stats', label: 'Stats' },
];
const RANGE_SUBLABELS: Record<RangeFilter, string> = {
  today: 'Today',
  week: 'This week',
  month: 'This month',
  year: 'This year',
  all: 'All time',
};

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

function bucketKey(ts: number, kind: BucketKind): string {
  const date = new Date(ts);
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  if (kind === 'hour') {
    const hour = pad2(date.getHours());
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
      const date = new Date(ts);
      keys.push(bucketKey(ts, kind));
      labels.push(`${date.getMonth() + 1}/${date.getDate()}`);
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
      labels.push(MONTH_LABELS[month] ?? String(month + 1));
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
      labels.push(`${MONTH_LABELS[cursor.getMonth()] ?? cursor.getMonth() + 1} ${cursor.getFullYear()}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    tickStep = Math.max(1, Math.ceil(keys.length / 6));
  }

  return {
    kind,
    keys,
    labels,
    tickValues: buildTickValues(keys.length, tickStep),
  };
}

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

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [events, setEvents] = useState<BathroomEvent[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<BathroomEvent | null>(null);
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('today');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [activeTab, setActiveTab] = useState<ActiveTab>('events');
  const [visibleCount, setVisibleCount] = useState(10);
  const systemMode = useColorScheme();
  const { isPro, isLoading: isProLoading } = usePro();
  const { openPaywall } = usePaywall();
  const isMountedRef = useRef(true);
  const isLoadingRef = useRef(false);
  const lastAutoLoadRef = useRef(0);
  const lastAutoLoadAtRef = useRef(0);

  const mergeWidgetQueue = useCallback(async (baseEvents: BathroomEvent[]) => {
    const queued = await getQueuedWidgetEvents();
    if (queued.length === 0) {
      return baseEvents;
    }
    const existingIds = new Set(baseEvents.map((event) => event.id));
    const uniqueQueued = queued.filter((event) => !existingIds.has(event.id));
    if (uniqueQueued.length === 0) {
      await clearQueuedWidgetEvents();
      return baseEvents;
    }
    const merged = [...uniqueQueued, ...baseEvents].sort((a, b) => b.ts - a.ts);
    await saveEvents(merged);
    await clearQueuedWidgetEvents();
    return merged;
  }, []);

  const loadFromStorage = useCallback(async () => {
    if (isLoadingRef.current) {
      return;
    }
    isLoadingRef.current = true;
    try {
      const [loadedSettings, loadedEvents] = await Promise.all([loadSettings(), loadEvents()]);
      if (!isMountedRef.current) {
        return;
      }
      const mergedEvents = await mergeWidgetQueue(loadedEvents);
      if (!isMountedRef.current) {
        return;
      }
      setSettings(loadedSettings);
      setEvents(mergedEvents);
    } finally {
      isLoadingRef.current = false;
    }
  }, [mergeWidgetQueue]);

  useFocusEffect(
    useCallback(() => {
      loadFromStorage();
    }, [loadFromStorage])
  );

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void loadFromStorage();
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [loadFromStorage]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const resolvedMode = resolveThemeMode(settings?.themeMode, systemMode);
  const theme = getTheme({ presetId: settings?.themeId ?? 't1', mode: resolvedMode });
  const timeMode = settings?.timeFormat ?? '24h';
  const iconPee = settings?.iconPee ?? DEFAULT_PEE_ICON;
  const iconPoop = settings?.iconPoop ?? DEFAULT_POOP_ICON;

  useEffect(() => {
    if (settings) {
      mirrorWidgetSettings(settings, resolvedMode);
    }
  }, [resolvedMode, settings]);

  useEffect(() => {
    mirrorWidgetSummary(events);
  }, [events]);

  const lastPee = useMemo(() => events.find((event) => event.type === 'pee'), [events]);
  const lastPoop = useMemo(() => events.find((event) => event.type === 'poop'), [events]);

  const rangeFilteredEvents = useMemo(() => {
    const now = Date.now();
    const start = rangeStart(rangeFilter, now);
    return events.filter((event) => event.ts >= start);
  }, [events, rangeFilter]);

  const filteredEvents = useMemo(() => {
    if (typeFilter === 'all') {
      return rangeFilteredEvents;
    }
    return rangeFilteredEvents.filter((event) => event.type === typeFilter);
  }, [rangeFilteredEvents, typeFilter]);

  const rangeCounts = useMemo(() => {
    let pee = 0;
    let poop = 0;
    rangeFilteredEvents.forEach((event) => {
      if (event.type === 'pee') {
        pee += 1;
      } else if (event.type === 'poop') {
        poop += 1;
      }
    });
    return { pee, poop };
  }, [rangeFilteredEvents]);

  useEffect(() => {
    setVisibleCount(10);
    lastAutoLoadRef.current = 0;
    lastAutoLoadAtRef.current = 0;
  }, [rangeFilter, typeFilter]);

  const paginatedEvents = useMemo(
    () => filteredEvents.slice(0, visibleCount),
    [filteredEvents, visibleCount]
  );

  const handleLog = async (type: EventType) => {
    const next = await appendEvent(type);
    setEvents((prev) => [next, ...prev]);
    setVisibleCount(10);
    lastAutoLoadRef.current = 0;
    lastAutoLoadAtRef.current = 0;
  };

  const handleDeleteEvent = useCallback((event: BathroomEvent) => {
    setDeleteCandidate(event);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setDeleteCandidate(null);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!deleteCandidate) {
      return;
    }
    setEvents((prev) => {
      const next = prev.filter((item) => item.id !== deleteCandidate.id);
      void saveEvents(next);
      return next;
    });
    setDeleteCandidate(null);
  }, [deleteCandidate]);

  const filteredCount = filteredEvents.length;
  const showingCount = Math.min(visibleCount, filteredCount);
  const canLoadMore = showingCount < filteredCount;

  const handleLoadMore = useCallback(() => {
    if (!canLoadMore) {
      return;
    }
    setVisibleCount((prev) => Math.min(prev + 10, filteredCount));
  }, [canLoadMore, filteredCount]);

  const handleAutoLoad = useCallback(() => {
    if (!canLoadMore) {
      return;
    }
    if (lastAutoLoadRef.current === visibleCount) {
      return;
    }
    const now = Date.now();
    if (now - lastAutoLoadAtRef.current < 400) {
      return;
    }
    lastAutoLoadRef.current = visibleCount;
    lastAutoLoadAtRef.current = now;
    setVisibleCount((prev) => Math.min(prev + 10, filteredCount));
  }, [canLoadMore, filteredCount, visibleCount]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
      if (!canLoadMore) {
        return;
      }
      const lastVisibleIndex = viewableItems.reduce((max, item) => {
        const index = item.index ?? -1;
        return index > max ? index : max;
      }, -1);
      if (lastVisibleIndex >= paginatedEvents.length - 2) {
        handleAutoLoad();
      }
    },
    [canLoadMore, handleAutoLoad, paginatedEvents.length]
  );

  const handleTabPress = useCallback(
    (nextTab: ActiveTab) => {
      setActiveTab(nextTab);
    },
    [setActiveTab]
  );

  const canShowStats = isPro && !isProLoading;

  const statsData = useMemo(() => {
    if (!canShowStats || activeTab !== 'stats') {
      return null;
    }
    const now = Date.now();
    const bucketConfig = buildBucketConfig(rangeFilter, filteredEvents, now);
    if (bucketConfig.keys.length === 0) {
      return {
        bucketConfig,
        series: [],
        totals: { pee: 0, poop: 0 },
        hasData: false,
        nonZeroBuckets: 0,
      };
    }
    const indexByKey = new Map<string, number>();
    bucketConfig.keys.forEach((key, index) => {
      indexByKey.set(key, index);
    });
    const peeCounts = new Array(bucketConfig.keys.length).fill(0);
    const poopCounts = new Array(bucketConfig.keys.length).fill(0);
    let totalPee = 0;
    let totalPoop = 0;

    filteredEvents.forEach((event) => {
      const key = bucketKey(event.ts, bucketConfig.kind);
      const index = indexByKey.get(key);
      if (index === undefined) {
        return;
      }
      if (event.type === 'pee') {
        peeCounts[index] += 1;
        totalPee += 1;
      } else if (event.type === 'poop') {
        poopCounts[index] += 1;
        totalPoop += 1;
      }
    });

    const peeData = peeCounts.map((count, index) => ({ x: index, y: count }));
    const poopData = poopCounts.map((count, index) => ({ x: index, y: count }));
    const series: Array<{ id: EventType; label: string; data: Array<{ x: number; y: number }> }> = [];
    if (typeFilter === 'all' || typeFilter === 'pee') {
      series.push({ id: 'pee', label: 'Pee', data: peeData });
    }
    if (typeFilter === 'all' || typeFilter === 'poop') {
      series.push({ id: 'poop', label: 'Poo', data: poopData });
    }
    const nonZeroBuckets = new Set<number>();
    series.forEach((line) => {
      line.data.forEach((point) => {
        if (point.y > 0) {
          nonZeroBuckets.add(point.x);
        }
      });
    });
    return {
      bucketConfig,
      series,
      totals: { pee: totalPee, poop: totalPoop },
      hasData: nonZeroBuckets.size > 0,
      nonZeroBuckets: nonZeroBuckets.size,
    };
  }, [activeTab, canShowStats, filteredEvents, rangeFilter, typeFilter]);

  const statsChecking = activeTab === 'stats' && isProLoading;
  const statsLocked = activeTab === 'stats' && !canShowStats && !statsChecking;
  const svgReady =
    Platform.OS === 'web' || Boolean(UIManager.getViewManagerConfig?.('RNSVGLine'));
  const chartComponentsReady = Boolean(LineChart && svgReady);
  const actionLayout =
    width < 380 ? [styles.actionColumn, styles.actionCardFull] : [styles.actionRow, styles.actionCard];
  const chartWidth = Math.max(width - 80, 0);
  const rangeCountLabel = RANGE_SUBLABELS[rangeFilter];
  const chartData = useMemo(() => {
    if (!statsData) {
      return null;
    }
    const labels = statsData.bucketConfig.labels;
    const tickValues = new Set(statsData.bucketConfig.tickValues);
    const sampledLabels = labels.map((label, index) => (tickValues.has(index) ? label : ''));
    const normalizeSeries = (series: {
      id: EventType;
      data: Array<{ x: number; y: number }>;
    }): number[] => {
      if (series.data.length === labels.length) {
        return series.data.map((point) => point.y);
      }
      const values = new Array(labels.length).fill(0);
      series.data.forEach((point) => {
        if (point.x >= 0 && point.x < values.length) {
          values[point.x] = point.y;
        }
      });
      return values;
    };
    return {
      labels: sampledLabels,
      datasets: statsData.series.map((series) => ({
        data: normalizeSeries(series),
        color: () => (series.id === 'pee' ? theme.colors.primary : theme.colors.text),
        strokeWidth: 2,
      })),
    };
  }, [statsData, theme.colors.primary, theme.colors.text]);
  const deleteTypeLabel = deleteCandidate?.type === 'pee' ? 'Pee' : 'Poo';
  const deleteTimeLabel = deleteCandidate ? formatTime(deleteCandidate.ts, timeMode) : '';
  const deleteDateLabel = deleteCandidate ? formatDate(deleteCandidate.ts) : '';
  const headerContent = (
    <View style={styles.headerContent}>
      <View style={actionLayout[0]}>
        <View
          style={[actionLayout[1], { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        >
          <View style={styles.actionHeaderRow}>
            <View style={styles.actionIconColumn}>
              <Text style={styles.actionIcon}>{iconPee}</Text>
            </View>
            <View style={styles.actionCountBlock}>
              <Text style={[styles.actionCount, { color: theme.colors.primary }]}>
                {rangeCounts.pee}
              </Text>
              <Text style={[styles.actionCountSubLabel, { color: theme.colors.muted }]}>
                {rangeCountLabel}
              </Text>
            </View>
            <Pressable
              onPress={() => handleLog('pee')}
              style={[styles.actionAddButton, { backgroundColor: theme.colors.primary }]}
            >
              <Text style={[styles.actionAddText, { color: theme.colors.primaryText }]}>+</Text>
            </Pressable>
          </View>
          <Text style={[styles.actionMeta, { color: theme.colors.muted }]}>
            Last: {lastPee ? formatTime(lastPee.ts, timeMode) : '--'}
          </Text>
        </View>
        <View
          style={[actionLayout[1], { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        >
          <View style={styles.actionHeaderRow}>
            <View style={styles.actionIconColumn}>
              <Text style={styles.actionIcon}>{iconPoop}</Text>
            </View>
            <View style={styles.actionCountBlock}>
              <Text style={[styles.actionCount, { color: theme.colors.primary }]}>
                {rangeCounts.poop}
              </Text>
              <Text style={[styles.actionCountSubLabel, { color: theme.colors.muted }]}>
                {rangeCountLabel}
              </Text>
            </View>
            <Pressable
              onPress={() => handleLog('poop')}
              style={[styles.actionAddButton, { backgroundColor: theme.colors.primary }]}
            >
              <Text style={[styles.actionAddText, { color: theme.colors.primaryText }]}>+</Text>
            </Pressable>
          </View>
          <Text style={[styles.actionMeta, { color: theme.colors.muted }]}>
            Last: {lastPoop ? formatTime(lastPoop.ts, timeMode) : '--'}
          </Text>
        </View>
      </View>

      <View style={styles.filtersSection}>
        <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>Date range</Text>
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
                <Text
                  style={{
                    color: active ? theme.colors.primaryText : theme.colors.text,
                    fontWeight: active ? '600' : '500',
                  }}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>Type</Text>
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
                <Text
                  style={{
                    color: active ? theme.colors.primaryText : theme.colors.text,
                    fontWeight: active ? '600' : '500',
                  }}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View
        style={[
          styles.tabRow,
          { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
        ]}
      >
        {TAB_OPTIONS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => handleTabPress(tab.id)}
              style={[
                styles.tabButton,
                { backgroundColor: active ? theme.colors.primary : 'transparent' },
              ]}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: active ? theme.colors.primaryText : theme.colors.text },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>
        {activeTab === 'events' ? 'Events' : 'Stats'}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <Stack.Screen
        options={{
          title: 'Bathroom Tracker',
          headerLeft: () => (
            <Pressable onPress={() => router.push('/settings')} style={styles.headerButton}>
              <Text style={[styles.headerButtonText, { color: theme.colors.primary }]}>Settings</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={() => router.push('/export')} style={styles.headerButton}>
              <Text style={[styles.headerButtonText, { color: theme.colors.primary }]}>Export</Text>
            </Pressable>
          ),
        }}
      />
      {activeTab === 'events' ? (
        <FlatList
          data={paginatedEvents}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={headerContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={{ color: theme.colors.muted }}>No events yet.</Text>
            </View>
          }
          ListFooterComponent={
            filteredCount > 0 ? (
              <View style={styles.loadMoreSection}>
                <Text style={[styles.loadMoreLabel, { color: theme.colors.muted }]}>
                  Showing {showingCount} of {filteredCount}
                </Text>
                {canLoadMore ? (
                  <Pressable
                    style={[
                      styles.loadMoreButton,
                      { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                    ]}
                    onPress={handleLoadMore}
                  >
                    <Text style={[styles.loadMoreText, { color: theme.colors.text }]}>Load 10 more</Text>
                  </Pressable>
                ) : (
                  <Text style={[styles.endLabel, { color: theme.colors.muted }]}>End</Text>
                )}
              </View>
            ) : null
          }
          onEndReached={handleAutoLoad}
          onEndReachedThreshold={0.2}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          renderItem={({ item }) => (
            <View style={[styles.eventRow, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.eventDate, { color: theme.colors.muted }]}>{formatDate(item.ts)}</Text>
              <Text style={[styles.eventTime, { color: theme.colors.text }]}>
                {formatTime(item.ts, timeMode)}
              </Text>
              <Text style={[styles.eventType, { color: theme.colors.text }]}>
                {item.type === 'pee' ? iconPee : iconPoop} {item.type === 'pee' ? 'Pee' : 'Poo'}
              </Text>
              <Pressable
                onPress={() => handleDeleteEvent(item)}
                style={[styles.eventDelete, { borderColor: theme.colors.border }]}
                hitSlop={8}
              >
                <Text style={[styles.eventDeleteText, { color: theme.colors.muted }]}>X</Text>
              </Pressable>
            </View>
          )}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {headerContent}
          {statsChecking ? (
            <View
              style={[
                styles.statsCard,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.statsMessage, { color: theme.colors.muted }]}>
                Checking Pro status...
              </Text>
            </View>
          ) : null}
          {statsLocked ? (
            <View
              style={[
                styles.statsCard,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
              ]}
            >
              <View style={[styles.lockedChart, { backgroundColor: theme.colors.bg }]}>
                <View style={[styles.lockedLine, { backgroundColor: theme.colors.border }]} />
                <View style={[styles.lockedLine, { backgroundColor: theme.colors.border }]} />
                <View style={[styles.lockedLine, { backgroundColor: theme.colors.border }]} />
              </View>
              <Text style={[styles.statsMessage, { color: theme.colors.text }]}>
                Stats & graphs are a Pro feature.
              </Text>
              <Pressable
                style={[
                  styles.unlockButton,
                  { backgroundColor: theme.colors.primary, borderColor: theme.colors.border },
                ]}
                onPress={openPaywall}
              >
                <Text style={[styles.unlockButtonText, { color: theme.colors.primaryText }]}>
                  Unlock Pro
                </Text>
              </Pressable>
            </View>
          ) : null}
          {canShowStats && statsData ? (
            <View
              style={[
                styles.statsCard,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
              ]}
            >
              {!chartComponentsReady ? (
                <Text style={[styles.statsMessage, { color: theme.colors.muted }]}>
                  Chart is unavailable right now.
                </Text>
              ) : !statsData.hasData ? (
                <Text style={[styles.statsMessage, { color: theme.colors.muted }]}>
                  No data for this range yet.
                </Text>
              ) : statsData.nonZeroBuckets <= 1 ? (
                <Text style={[styles.statsMessage, { color: theme.colors.muted }]}>
                  Not enough data yet.
                </Text>
              ) : (
                <>
                  {chartData ? (
                    <LineChart
                      data={chartData}
                      width={chartWidth}
                      height={220}
                      fromZero
                      yAxisInterval={1}
                      withDots={false}
                      withShadow={false}
                      withVerticalLines={false}
                      chartConfig={{
                        backgroundColor: theme.colors.card,
                        backgroundGradientFrom: theme.colors.card,
                        backgroundGradientTo: theme.colors.card,
                        decimalPlaces: 0,
                        color: () => theme.colors.text,
                        labelColor: () => theme.colors.muted,
                        propsForBackgroundLines: {
                          stroke: theme.colors.border,
                          strokeDasharray: '4,6',
                        },
                      }}
                      style={{ borderRadius: 12, alignSelf: 'center', paddingRight: 32 }}
                    />
                  ) : null}
                  {typeFilter === 'all' ? (
                    <View style={styles.legendRow}>
                      <View
                        style={[styles.legendSwatch, { backgroundColor: theme.colors.primary }]}
                      />
                      <Text style={[styles.legendText, { color: theme.colors.text }]}>Pee</Text>
                      <View
                        style={[styles.legendSwatch, { backgroundColor: theme.colors.text }]}
                      />
                      <Text style={[styles.legendText, { color: theme.colors.text }]}>Poo</Text>
                    </View>
                  ) : null}
                  <Text style={[styles.statsSummary, { color: theme.colors.muted }]}>
                    {typeFilter === 'all'
                      ? `Totals: Pee ${statsData.totals.pee} | Poo ${statsData.totals.poop}`
                      : `Total: ${typeFilter === 'pee' ? statsData.totals.pee : statsData.totals.poop}`}
                  </Text>
                </>
              )}
            </View>
          ) : null}
        </ScrollView>
      )}
      <Modal
        visible={Boolean(deleteCandidate)}
        transparent
        animationType="fade"
        onRequestClose={handleCancelDelete}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleCancelDelete} />
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Delete event?</Text>
            <View style={styles.modalDetails}>
              <Text style={[styles.modalDetailText, { color: theme.colors.text }]}>
                Type: {deleteTypeLabel}
              </Text>
              <Text style={[styles.modalDetailText, { color: theme.colors.text }]}>
                Time: {deleteTimeLabel}
              </Text>
              <Text style={[styles.modalDetailText, { color: theme.colors.text }]}>
                Date: {deleteDateLabel}
              </Text>
            </View>
            <View style={styles.modalButtons}>
              <Pressable
                style={[
                  styles.modalSecondaryButton,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.card },
                ]}
                onPress={handleCancelDelete}
              >
                <Text style={[styles.modalSecondaryText, { color: theme.colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalPrimaryButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleConfirmDelete}
              >
                <Text style={[styles.modalPrimaryText, { color: theme.colors.primaryText }]}>
                  Delete
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  headerButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerContent: {
    gap: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionColumn: {
    flexDirection: 'column',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
  },
  actionCardFull: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 24,
  },
  actionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  actionIconColumn: {
    alignItems: 'center',
    marginRight: 12,
  },
  actionCountBlock: {
    alignItems: 'center',
    marginRight: 12,
  },
  actionAddButton: {
    alignSelf: 'center',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionAddText: {
    fontSize: 20,
    fontWeight: '700',
    includeFontPadding: false,
    lineHeight: 20,
  },
  actionCount: {
    fontSize: 22,
    fontWeight: '700',
  },
  actionCountSubLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '500',
  },
  actionMeta: {
    marginTop: 6,
    fontSize: 12,
    textAlign: 'center',
  },
  filtersSection: {
    gap: 8,
    marginTop: 8,
  },
  sectionLabel: {
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
  tabRow: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  eventDate: {
    fontSize: 12,
    width: 90,
  },
  eventTime: {
    fontSize: 14,
    width: 80,
  },
  eventType: {
    fontSize: 14,
    flex: 1,
  },
  eventDelete: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'center',
  },
  eventDeleteText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  loadMoreSection: {
    marginTop: 8,
    gap: 8,
    alignItems: 'center',
  },
  loadMoreLabel: {
    fontSize: 12,
  },
  loadMoreButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '600',
  },
  endLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  statsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  statsMessage: {
    fontSize: 14,
    textAlign: 'center',
  },
  lockedChart: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
    gap: 12,
  },
  lockedLine: {
    height: 6,
    borderRadius: 6,
    width: '100%',
  },
  unlockButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  unlockButtonText: {
    fontWeight: '600',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statsSummary: {
    fontSize: 12,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalDetails: {
    marginTop: 12,
    gap: 6,
  },
  modalDetailText: {
    fontSize: 14,
  },
  modalButtons: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 8,
  },
  modalSecondaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalSecondaryText: {
    fontWeight: '600',
  },
  modalPrimaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalPrimaryText: {
    fontWeight: '600',
  },
});
