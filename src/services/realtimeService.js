/**
 * realtimeService.js — Supabase Realtime subscription manager
 *
 * Subscribes to database changes for the user's facility so the app
 * receives push updates instead of relying solely on polling.
 */

import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { runSyncNow } from './syncService';

const isWeb = Platform.OS === 'web';

let activeChannel = null;
let subscribedFacilityId = null;
let debounceTimer = null;
const DEBOUNCE_MS = 2000; // Debounce rapid changes to avoid sync storms

/**
 * Trigger a debounced sync when a realtime event arrives.
 * Multiple rapid changes within DEBOUNCE_MS are coalesced into one sync.
 */
const onRealtimeChange = (payload) => {
  console.log('[Realtime] Change detected:', payload?.table, payload?.eventType);

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    console.log('[Realtime] Triggering sync pull after debounce...');
    runSyncNow({ includePull: true, pushMaxBatches: 0 }).catch((err) => {
      console.warn('[Realtime] Sync pull after realtime event failed:', err?.message);
    });
  }, DEBOUNCE_MS);
};

/**
 * Subscribe to Realtime changes for a specific facility.
 * Listens to inserts, updates, and deletes on key clinical tables.
 *
 * @param {string} facilityId - The facility to subscribe to
 * @returns {{ ok: boolean, facilityId?: string, error?: string }}
 */
export const subscribeToFacility = (facilityId) => {
  if (isWeb) {
    return { ok: false, error: 'Realtime not supported on web mock mode' };
  }

  if (!facilityId) {
    return { ok: false, error: 'Missing facilityId' };
  }

  // Already subscribed to this facility
  if (activeChannel && subscribedFacilityId === facilityId) {
    return { ok: true, facilityId, status: 'already_subscribed' };
  }

  // Unsubscribe from previous facility
  unsubscribe();

  try {
    const channelName = `facility:${facilityId}`;

    activeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sync_op_ledger',
          filter: `facility_id=eq.${facilityId}`,
        },
        onRealtimeChange
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patients',
          filter: `facility_id=eq.${facilityId}`,
        },
        onRealtimeChange
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visits',
          filter: `facility_id=eq.${facilityId}`,
        },
        onRealtimeChange
      )
      .subscribe((status) => {
        console.log(`[Realtime] Channel ${channelName} status:`, status);
      });

    subscribedFacilityId = facilityId;
    console.log(`[Realtime] Subscribed to facility: ${facilityId}`);
    return { ok: true, facilityId };
  } catch (err) {
    console.error('[Realtime] Subscribe error:', err?.message || err);
    return { ok: false, error: String(err?.message || 'Subscribe failed') };
  }
};

/**
 * Unsubscribe from all Realtime channels.
 */
export const unsubscribe = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  if (activeChannel) {
    try {
      supabase.removeChannel(activeChannel);
    } catch (err) {
      console.warn('[Realtime] Unsubscribe error:', err?.message);
    }
    activeChannel = null;
    subscribedFacilityId = null;
    console.log('[Realtime] Unsubscribed from all channels');
  }
};

/**
 * Get the current subscription state.
 */
export const getRealtimeState = () => ({
  subscribed: !!activeChannel,
  facilityId: subscribedFacilityId,
});
