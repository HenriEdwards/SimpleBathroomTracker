import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  AppStateStatus,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import type { AppSettings, BathroomEvent, EventType } from '../src/types';
import { appendEvent, loadEvents, loadSettings, saveEvents } from '../src/lib/storage';
import { getTheme, resolveThemeMode } from '../src/lib/theme';
import { formatDate, formatTime } from '../src/lib/time';
import { DEFAULT_PEE_ICON, DEFAULT_POOP_ICON } from '../src/lib/icons';
import {
  clearQueuedWidgetEvents,
  getQueuedWidgetEvents,
  mirrorWidgetSettings,
  mirrorWidgetSummary,
} from '../src/lib/widget-bridge';

type RangeFilter = 'today' | 'week' | 'month' | 'year' | 'all';
type TypeFilter = 'all' | EventType;

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

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [events, setEvents] = useState<BathroomEvent[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<BathroomEvent | null>(null);
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('today');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const systemMode = useColorScheme();
  const isMountedRef = useRef(true);
  const isLoadingRef = useRef(false);

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
      mirrorWidgetSettings(settings);
    }
  }, [settings]);

  useEffect(() => {
    mirrorWidgetSummary(events);
  }, [events]);

  const todayCounts = useMemo(() => {
    const start = startOfDay(Date.now());
    let pee = 0;
    let poop = 0;
    events.forEach((event) => {
      if (event.ts >= start) {
        if (event.type === 'pee') {
          pee += 1;
        } else if (event.type === 'poop') {
          poop += 1;
        }
      }
    });
    return { pee, poop };
  }, [events]);

  const lastPee = useMemo(() => events.find((event) => event.type === 'pee'), [events]);
  const lastPoop = useMemo(() => events.find((event) => event.type === 'poop'), [events]);

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

  const handleLog = async (type: EventType) => {
    const next = await appendEvent(type);
    setEvents((prev) => [next, ...prev]);
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

  const actionLayout =
    width < 380 ? [styles.actionColumn, styles.actionCardFull] : [styles.actionRow, styles.actionCard];
  const deleteTypeLabel = deleteCandidate?.type === 'pee' ? 'Pee' : 'Poop';
  const deleteTimeLabel = deleteCandidate ? formatTime(deleteCandidate.ts, timeMode) : '';
  const deleteDateLabel = deleteCandidate ? formatDate(deleteCandidate.ts) : '';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <Stack.Screen
        options={{
          title: 'Simple Bathroom Tracker',
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
      <FlatList
        data={filteredEvents}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={actionLayout[0]}>
              <Pressable
                style={[actionLayout[1], { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                onPress={() => handleLog('pee')}
              >
                <View style={styles.actionHeaderRow}>
                  <Text style={styles.actionIcon}>{iconPee}</Text>
                  <Text style={[styles.actionLabel, { color: theme.colors.text }]}>PEE</Text>
                  <Text style={[styles.actionCount, { color: theme.colors.primary }]}>{todayCounts.pee}</Text>
                </View>
                <Text style={[styles.actionMeta, { color: theme.colors.muted }]}>
                  Last: {lastPee ? formatTime(lastPee.ts, timeMode) : '--'}
                </Text>
              </Pressable>
              <Pressable
                style={[actionLayout[1], { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                onPress={() => handleLog('poop')}
              >
                <View style={styles.actionHeaderRow}>
                  <Text style={styles.actionIcon}>{iconPoop}</Text>
                  <Text style={[styles.actionLabel, { color: theme.colors.text }]}>POOP</Text>
                  <Text style={[styles.actionCount, { color: theme.colors.primary }]}>{todayCounts.poop}</Text>
                </View>
                <Text style={[styles.actionMeta, { color: theme.colors.muted }]}>
                  Last: {lastPoop ? formatTime(lastPoop.ts, timeMode) : '--'}
                </Text>
              </Pressable>
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
            <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>Events</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={{ color: theme.colors.muted }}>No events yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.eventRow, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.eventDate, { color: theme.colors.muted }]}>{formatDate(item.ts)}</Text>
            <Text style={[styles.eventTime, { color: theme.colors.text }]}>
              {formatTime(item.ts, timeMode)}
            </Text>
            <Text style={[styles.eventType, { color: theme.colors.text }]}>
              {item.type === 'pee' ? iconPee : iconPoop} {item.type === 'pee' ? 'Pee' : 'Poop'}
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
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCardFull: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 24,
  },
  actionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  actionCount: {
    marginLeft: 8,
    fontSize: 22,
    fontWeight: '700',
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
