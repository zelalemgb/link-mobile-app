/**
 * HEWSyncScreen — Offline queue status and manual sync
 *
 * Shows:
 *  - Count of notes waiting in the offline queue
 *  - Per-item list (patient, note type, queued time, attempt count)
 *  - "Sync now" button to flush the queue when online
 *  - Auto-polls queue count on focus
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { getQueue, clearQueue } from '../../lib/offlineQueue';
import { flushOfflineQueue } from '../../services/hewService';
import { tokens } from '../../theme/tokens';

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatRelative(isoStr) {
  if (!isoStr) return '';
  try {
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return '';
  }
}

function noteTypeLabel(value) {
  return (value ?? 'general').replace(/_/g, ' ');
}

// ─── Queue item row ────────────────────────────────────────────────────────

function QueueItem({ item }) {
  const hasAudio = Boolean(item.audioUri);
  const protocolTitle = item.payload?.guided_protocol?.title;
  const referralUrgency = item.payload?.referral_summary?.urgency;
  return (
    <View style={styles.item}>
      <View style={styles.itemIcon}>
        <Feather
          name={hasAudio ? 'mic' : 'file-text'}
          size={14}
          color={tokens.colors.muted}
        />
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.itemType} numberOfLines={1}>
          {noteTypeLabel(item.payload?.note_type)}
          {hasAudio ? '  🎙' : ''}
        </Text>
        <Text style={styles.itemMeta}>
          Queued {formatRelative(item.queuedAt)}
          {item.attempts > 0 ? `  ·  ${item.attempts} attempt${item.attempts > 1 ? 's' : ''}` : ''}
        </Text>
        {protocolTitle ? (
          <Text style={styles.itemProtocol}>Guided: {protocolTitle}</Text>
        ) : null}
        {referralUrgency ? (
          <Text style={styles.itemReferral}>Referral urgency: {String(referralUrgency).toUpperCase()}</Text>
        ) : null}
        {item.payload?.note_text && item.payload.note_text !== '(voice note)' && (
          <Text style={styles.itemPreview} numberOfLines={1}>
            {item.payload.note_text}
          </Text>
        )}
      </View>
      {item.attempts > 2 && (
        <Feather name="alert-circle" size={14} color="#b91c1c" style={styles.itemWarn} />
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────

export default function HEWSyncScreen() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);

  const loadQueue = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const items = await getQueue();
      setQueue(items);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload whenever the tab comes into focus
  useFocusEffect(
    useCallback(() => {
      loadQueue(false);
    }, [loadQueue])
  );

  const handleSync = async () => {
    if (queue.length === 0) return;
    setSyncing(true);
    try {
      const { flushed, failed } = await flushOfflineQueue();
      setLastSynced(new Date().toISOString());
      await loadQueue(false);
      if (failed === 0) {
        Alert.alert('Sync complete', `${flushed} note${flushed !== 1 ? 's' : ''} uploaded successfully.`);
      } else {
        Alert.alert(
          'Partial sync',
          `${flushed} uploaded, ${failed} failed. Failed items will retry next time.`
        );
      }
    } catch (err) {
      Alert.alert('Sync failed', err?.message ?? 'Check your connection and try again.');
    } finally {
      setSyncing(false);
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear offline queue?',
      'This will permanently delete all queued notes that have not been uploaded. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all',
          style: 'destructive',
          onPress: async () => {
            await clearQueue();
            setQueue([]);
          },
        },
      ]
    );
  };

  const isEmpty = queue.length === 0;

  return (
    <View style={styles.container}>
      {/* Status banner */}
      <View style={[styles.banner, isEmpty ? styles.bannerOk : styles.bannerPending]}>
        <Feather
          name={isEmpty ? 'check-circle' : 'wifi-off'}
          size={18}
          color={isEmpty ? '#065f46' : '#b45309'}
        />
        <View style={styles.bannerText}>
          <Text style={[styles.bannerTitle, { color: isEmpty ? '#065f46' : '#92400e' }]}>
            {isEmpty ? 'All notes synced' : `${queue.length} note${queue.length !== 1 ? 's' : ''} waiting to sync`}
          </Text>
          {lastSynced && (
            <Text style={styles.bannerSub}>
              Last synced {formatRelative(lastSynced)}
            </Text>
          )}
        </View>
      </View>

      {/* Sync button */}
      {!isEmpty && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
            onPress={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="upload-cloud" size={16} color="#fff" />
                <Text style={styles.syncBtnText}>Sync now</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Queue list */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={tokens.colors.primary} />
        </View>
      ) : isEmpty ? (
        <View style={styles.centered}>
          <Feather name="check-circle" size={48} color="#d1fae5" />
          <Text style={styles.emptyTitle}>Queue is empty</Text>
          <Text style={styles.emptyBody}>
            Notes you save while offline will appear here until connectivity is restored.
          </Text>
        </View>
      ) : (
        <FlatList
          data={queue}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => loadQueue(false)}
            />
          }
          renderItem={({ item }) => <QueueItem item={item} />}
          ListFooterComponent={
            queue.length > 0 ? (
              <TouchableOpacity style={styles.clearBtn} onPress={handleClearAll}>
                <Feather name="trash-2" size={13} color="#b91c1c" />
                <Text style={styles.clearBtnText}>Clear all queued notes</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: tokens.colors.background },

  // Banner
  banner:          { flexDirection: 'row', alignItems: 'center', gap: 12, margin: 16, padding: 14, borderRadius: tokens.radii.md, borderWidth: 1 },
  bannerOk:        { backgroundColor: '#d1fae5', borderColor: '#6ee7b7' },
  bannerPending:   { backgroundColor: '#fef3c7', borderColor: '#fcd34d' },
  bannerText:      { flex: 1, gap: 2 },
  bannerTitle:     { fontSize: 14, fontWeight: '600' },
  bannerSub:       { fontSize: 12, color: '#92400e' },

  // Sync button
  actions:         { marginHorizontal: 16, marginBottom: 8 },
  syncBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0f766e', paddingVertical: 12, borderRadius: tokens.radii.md },
  syncBtnDisabled: { opacity: 0.6 },
  syncBtnText:     { color: '#fff', fontWeight: '700', fontSize: 15 },

  // List
  list:            { paddingHorizontal: 16, paddingBottom: 24 },
  item:            { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#fff', borderRadius: tokens.radii.md, borderWidth: 1, borderColor: tokens.colors.border, padding: 12, marginBottom: 10 },
  itemIcon:        { marginTop: 2 },
  itemBody:        { flex: 1, gap: 2 },
  itemType:        { fontSize: 13, fontWeight: '600', color: tokens.colors.ink, textTransform: 'capitalize' },
  itemMeta:        { fontSize: 11, color: tokens.colors.muted },
  itemProtocol:    { fontSize: 11, color: '#0f766e', fontWeight: '600' },
  itemReferral:    { fontSize: 11, color: '#b91c1c', fontWeight: '600' },
  itemPreview:     { fontSize: 12, color: tokens.colors.muted, fontStyle: 'italic' },
  itemWarn:        { marginTop: 2 },

  // Empty / loading
  centered:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  emptyTitle:      { fontSize: 16, fontWeight: '700', color: tokens.colors.ink },
  emptyBody:       { fontSize: 13, color: tokens.colors.muted, textAlign: 'center', lineHeight: 19 },

  // Clear button
  clearBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, marginTop: 4 },
  clearBtnText:    { fontSize: 13, color: '#b91c1c' },
});
