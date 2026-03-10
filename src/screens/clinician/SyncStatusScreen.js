import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../theme/tokens';
import {
  runSyncNow,
  getSyncStateSnapshot,
  clearConflictAuditTrail,
} from '../../services/syncService';
import { syncQueueRepo } from '../../repositories/syncQueueRepo';

const TEAL = '#0f766e';

const formatTime = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
};

const QueueRow = ({ item }) => (
  <View style={[styles.queueRow, item.isStuck && styles.queueRowStuck]}>
    <View style={styles.queueIcon}>
      <Feather name={item.isStuck ? 'alert-triangle' : 'clock'} size={14} color={item.isStuck ? '#b91c1c' : colors.muted} />
    </View>
    <View style={styles.queueBody}>
      <Text style={styles.queueTitle}>
        {item.entity_type} · {item.op_type}
      </Text>
      <Text style={styles.queueMeta} numberOfLines={1}>
        entity={item.entity_id}
      </Text>
      <Text style={styles.queueMeta}>
        attempts={item.attempts} · queued={formatTime(item.created_at)}
      </Text>
      {item.last_error ? (
        <Text style={styles.queueError} numberOfLines={2}>
          {item.last_error}
        </Text>
      ) : null}
    </View>
  </View>
);

const ConflictRow = ({ item }) => (
  <View style={styles.conflictRow}>
    <Feather name="alert-triangle" size={14} color="#b45309" />
    <View style={styles.conflictBody}>
      <Text style={styles.conflictTitle}>
        {item.entityType} · {item.entityId}
      </Text>
      <Text style={styles.conflictMeta} numberOfLines={2}>
        op={item.opId}
      </Text>
      <Text style={styles.conflictMeta}>
        {formatTime(item.at)}
      </Text>
      <Text style={styles.conflictReason} numberOfLines={2}>
        {item.conflictReason}
      </Text>
    </View>
  </View>
);

export default function SyncStatusScreen() {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [snapshot, setSnapshot] = useState({
    pending: 0,
    stuck: 0,
    queue: [],
    conflictCount: 0,
    conflictAudit: [],
    state: [],
  });
  const [lastRun, setLastRun] = useState(null);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const next = await getSyncStateSnapshot();
      setSnapshot(next);
    } catch (error) {
      Alert.alert('Sync status failed', error?.message || 'Could not load sync status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load])
  );

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const result = await runSyncNow({ includePull: true });
      setLastRun(result);
      await load(false);

      if (!result?.ok) {
        Alert.alert('Sync skipped', result?.message || 'Sync scope unavailable.');
        return;
      }

      const pushed = result?.push?.pushed ?? 0;
      const conflicts = result?.push?.conflicts ?? 0;
      const pulled = result?.pull?.pulledOps ?? 0;
      Alert.alert(
        'Sync complete',
        `Pushed ${pushed}, pulled ${pulled}${conflicts > 0 ? `, conflicts ${conflicts}` : ''}.`
      );
    } catch (error) {
      Alert.alert('Sync failed', error?.message || 'Unable to complete sync.');
    } finally {
      setSyncing(false);
    }
  };

  const handleClearStuck = async () => {
    Alert.alert(
      'Clear stuck operations?',
      'This removes queue rows that exceeded max retry attempts.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await syncQueueRepo.clearStuck();
            await load(false);
          },
        },
      ]
    );
  };

  const handleClearConflicts = async () => {
    Alert.alert(
      'Clear conflict history?',
      'This removes locally stored conflict audit entries from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearConflictAuditTrail();
            await load(false);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <View style={styles.bannerTop}>
          <Text style={styles.bannerTitle}>Sync status</Text>
          {syncing ? <ActivityIndicator size="small" color={TEAL} /> : null}
        </View>
        <Text style={styles.bannerLine}>Pending: {snapshot.pending}</Text>
        <Text style={styles.bannerLine}>Stuck: {snapshot.stuck}</Text>
        <Text style={styles.bannerLine}>Conflicts: {snapshot.conflictCount}</Text>
        <Text style={styles.bannerLine}>Last run: {formatTime(lastRun?.at)}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
          onPress={handleSyncNow}
          disabled={syncing}
        >
          <Feather name="refresh-cw" size={16} color="#fff" />
          <Text style={styles.syncBtnText}>Sync now</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.clearBtn, snapshot.stuck === 0 && styles.clearBtnDisabled]}
          onPress={handleClearStuck}
          disabled={snapshot.stuck === 0}
        >
          <Feather name="trash-2" size={14} color="#b91c1c" />
          <Text style={styles.clearBtnText}>Clear stuck</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      ) : (
        <View style={styles.listWrap}>
          {snapshot.conflictCount > 0 ? (
            <View style={styles.conflictCard}>
              <View style={styles.conflictHeader}>
                <Text style={styles.conflictHeaderTitle}>Conflict audit</Text>
                <TouchableOpacity onPress={handleClearConflicts}>
                  <Text style={styles.conflictClearText}>Clear</Text>
                </TouchableOpacity>
              </View>
              {snapshot.conflictAudit.slice(0, 5).map((item) => (
                <ConflictRow key={item.id} item={item} />
              ))}
            </View>
          ) : null}

          <FlatList
            data={snapshot.queue}
            keyExtractor={(item) => item.op_id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => <QueueRow item={item} />}
            refreshControl={<RefreshControl refreshing={false} onRefresh={() => load(false)} />}
            ListEmptyComponent={
              <View style={styles.centered}>
                <Text style={styles.emptyText}>Outbox is empty.</Text>
              </View>
            }
          />
          {snapshot.conflictCount > 0 ? (
            <View style={styles.conflictFooter}>
              <Text style={styles.conflictFooterText}>
                Server kept newer values for {snapshot.conflictCount} operation(s).
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  banner: {
    margin: 16,
    backgroundColor: '#e6fffb',
    borderColor: '#99f6e4',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  bannerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bannerTitle: { fontSize: 15, fontWeight: '700', color: '#134e4a' },
  bannerLine: { fontSize: 12, color: '#115e59' },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 10 },
  syncBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: TEAL,
  },
  syncBtnDisabled: { opacity: 0.6 },
  syncBtnText: { color: '#fff', fontWeight: '700' },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
  },
  clearBtnDisabled: { opacity: 0.5 },
  clearBtnText: { color: '#b91c1c', fontWeight: '600' },
  listWrap: { flex: 1 },
  conflictCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
    padding: 10,
    gap: 8,
  },
  conflictHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  conflictHeaderTitle: { fontSize: 13, fontWeight: '700', color: '#9a3412' },
  conflictClearText: { color: '#b91c1c', fontWeight: '700', fontSize: 12 },
  conflictRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fdba74',
    backgroundColor: '#fffbeb',
    padding: 8,
    flexDirection: 'row',
    gap: 8,
  },
  conflictBody: { flex: 1, gap: 1 },
  conflictTitle: { fontSize: 12, fontWeight: '700', color: '#7c2d12' },
  conflictMeta: { fontSize: 11, color: '#9a3412' },
  conflictReason: { fontSize: 11, color: '#92400e' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  queueRow: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    gap: 10,
  },
  queueRowStuck: { borderColor: '#fecaca', backgroundColor: '#fff7f7' },
  queueIcon: { marginTop: 2 },
  queueBody: { flex: 1, gap: 2 },
  queueTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  queueMeta: { fontSize: 11, color: colors.muted },
  queueError: { fontSize: 11, color: '#b91c1c' },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: colors.muted, fontSize: 13 },
  conflictFooter: {
    marginHorizontal: 16,
    marginTop: -10,
    marginBottom: 12,
  },
  conflictFooterText: {
    fontSize: 11,
    color: '#9a3412',
  },
});
