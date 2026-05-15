import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';
import { loadHistory, deleteEntry, clearHistory, HistoryEntry } from '../services/history';
import ResultCard from '../components/ResultCard';
import { gradeColor } from '../utils/gradeColor';

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return time;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' · ' + time;
}

export default function HistoryScreen() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadHistory().then(setEntries);
    }, []),
  );

  const handleDelete = (id: string) => {
    Alert.alert('Delete Entry', 'Remove this reality check from history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteEntry(id);
          setEntries((prev) => prev.filter((e) => e.id !== id));
          if (expandedId === id) setExpandedId(null);
        },
      },
    ]);
  };

  const handleClearAll = () => {
    Alert.alert('Clear All History', 'This will delete all saved reality checks.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          await clearHistory();
          setEntries([]);
          setExpandedId(null);
        },
      },
    ]);
  };

  if (entries.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={styles.emptyTitle}>No reality checks yet</Text>
          <Text style={styles.emptySubtitle}>
            Your saved checks will appear here after you get feedback.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderItem = ({ item }: { item: HistoryEntry }) => {
    const expanded = expandedId === item.id;
    const gColor = gradeColor(item.result.grade);

    return (
      <View style={styles.entryWrapper}>
        <TouchableOpacity
          style={styles.entryHeader}
          onPress={() => setExpandedId(expanded ? null : item.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.entryEmoji}>{item.modeEmoji}</Text>
          <View style={styles.entryHeaderText}>
            <Text style={styles.entryMode}>{item.modeTitle}</Text>
            <Text style={styles.entryDate}>{formatDate(item.timestamp)}</Text>
          </View>
          <View style={[styles.gradePill, { borderColor: gColor, backgroundColor: gColor + '26' }]}>
            <Text style={[styles.gradePillText, { color: gColor }]}>{item.result.grade}</Text>
          </View>
          <TouchableOpacity
            onPress={() => handleDelete(item.id)}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            style={styles.deleteButton}
          >
            <Text style={styles.deleteButtonText}>×</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {!expanded && (
          <>
            {!!item.inputPreview && (
              <Text style={styles.entryInput} numberOfLines={1}>
                {item.inputPreview}
              </Text>
            )}
            <Text style={styles.entryPreview} numberOfLines={2}>
              &ldquo;{item.result.verdict}&rdquo;
            </Text>
          </>
        )}

        {expanded && (
          <View style={styles.expandedContent}>
            <ResultCard result={item.result} />
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.headerTitle}>History</Text>
            <TouchableOpacity onPress={handleClearAll} activeOpacity={0.7}>
              <Text style={styles.clearAll}>Clear All</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: FONT_SIZES.md * 1.5,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerTitle: { fontSize: FONT_SIZES.xl, fontWeight: '900', color: COLORS.text },
  clearAll: { fontSize: FONT_SIZES.sm, color: COLORS.error, fontWeight: '600' },
  list: { paddingBottom: SPACING.xxl },
  entryWrapper: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  entryEmoji: { fontSize: 24, marginRight: SPACING.sm },
  entryHeaderText: { flex: 1 },
  entryMode: { fontSize: FONT_SIZES.sm, fontWeight: '700', color: COLORS.text },
  entryDate: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, marginTop: 2 },
  gradePill: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    marginRight: SPACING.sm,
  },
  gradePillText: { fontSize: FONT_SIZES.sm, fontWeight: '800' },
  deleteButton: { padding: 4 },
  deleteButtonText: { fontSize: 20, color: COLORS.textMuted, lineHeight: 22 },
  entryInput: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  entryPreview: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.md,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    lineHeight: FONT_SIZES.sm * 1.5,
  },
  expandedContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
});
