import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import type { AppSettings, BathroomEvent, EventType } from '../src/types';
import { appendEvent, loadEvents, loadSettings } from '../src/lib/storage';
import { getTheme } from '../src/lib/theme';
import { formatDate, formatTime } from '../src/lib/time';

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
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('today');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

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

  const theme = getTheme(settings?.themeId ?? 't1');
  const timeMode = settings?.timeFormat ?? '24h';
  const iconPee = settings?.iconPee ?? 'P';
  const iconPoop = settings?.iconPoop ?? 'C';

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

  const actionLayout =
    width < 380 ? [styles.actionColumn, styles.actionCardFull] : [styles.actionRow, styles.actionCard];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <Stack.Screen
        options={{
          title: 'BathroomCounter',
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
            <Text style={[styles.title, { color: theme.colors.text }]}>BathroomCounter</Text>
            <View style={actionLayout[0]}>
              <Pressable
                style={[actionLayout[1], { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                onPress={() => handleLog('pee')}
              >
                <Text style={styles.actionIcon}>{iconPee}</Text>
                <Text style={[styles.actionLabel, { color: theme.colors.text }]}>Pee</Text>
                <Text style={[styles.actionCount, { color: theme.colors.primary }]}>{todayCounts.pee}</Text>
                <Text style={[styles.actionMeta, { color: theme.colors.muted }]}>
                  Last: {lastPee ? formatTime(lastPee.ts, timeMode) : '--'}
                </Text>
              </Pressable>
              <Pressable
                style={[actionLayout[1], { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                onPress={() => handleLog('poop')}
              >
                <Text style={styles.actionIcon}>{iconPoop}</Text>
                <Text style={[styles.actionLabel, { color: theme.colors.text }]}>Poop</Text>
                <Text style={[styles.actionCount, { color: theme.colors.primary }]}>{todayCounts.poop}</Text>
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
          </View>
        )}
        contentContainerStyle={styles.listContent}
      />
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
  },
  actionCardFull: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    minHeight: 140,
  },
  actionIcon: {
    fontSize: 28,
  },
  actionLabel: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  actionCount: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: '700',
  },
  actionMeta: {
    marginTop: 4,
    fontSize: 12,
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
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
});
