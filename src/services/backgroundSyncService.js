import { Platform } from 'react-native';
import { runSyncNow } from './syncService';

// Native-only modules — skip on web to avoid crash
let TaskManager = null;
let BackgroundFetch = null;
if (Platform.OS !== 'web') {
  TaskManager = require('expo-task-manager');
  BackgroundFetch = require('expo-background-fetch');
}

export const WAVE2_BACKGROUND_SYNC_TASK = 'link-wave2-background-sync';
const MIN_INTERVAL_SECONDS = 15 * 60;

if (TaskManager && !TaskManager.isTaskDefined(WAVE2_BACKGROUND_SYNC_TASK)) {
  TaskManager.defineTask(WAVE2_BACKGROUND_SYNC_TASK, async () => {
    try {
      console.log('[sync-bg] task-start');
      const result = await runSyncNow({
        includePull: true,
        pushMaxBatches: 5,
        pullMaxPages: 2,
      });

      const pushed = result?.push?.pushed ?? 0;
      const pulled = result?.pull?.pulledOps ?? 0;
      const tombstones = result?.pull?.appliedTombstones ?? 0;
      const changed = pushed > 0 || pulled > 0 || tombstones > 0;
      console.log(
        `[sync-bg] task-result pushed=${pushed} pulled=${pulled} tombstones=${tombstones} changed=${changed}`
      );

      return changed
        ? BackgroundFetch.BackgroundFetchResult.NewData
        : BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (error) {
      console.warn('[sync-bg] background sync failed:', error?.message || error);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

const isNative = () => Platform.OS === 'android' || Platform.OS === 'ios';

export const registerBackgroundSyncAsync = async () => {
  if (!isNative() || !BackgroundFetch || !TaskManager) return { ok: false, reason: 'UNSUPPORTED_PLATFORM' };

  const status = await BackgroundFetch.getStatusAsync();
  console.log(`[sync-bg] register-status=${status}`);
  if (
    status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
    status === BackgroundFetch.BackgroundFetchStatus.Denied
  ) {
    console.warn('[sync-bg] register-unavailable');
    return { ok: false, reason: 'BACKGROUND_FETCH_UNAVAILABLE' };
  }

  const alreadyRegistered = await TaskManager.isTaskRegisteredAsync(
    WAVE2_BACKGROUND_SYNC_TASK
  );
  console.log(`[sync-bg] already-registered=${alreadyRegistered}`);
  if (!alreadyRegistered) {
    await BackgroundFetch.registerTaskAsync(WAVE2_BACKGROUND_SYNC_TASK, {
      minimumInterval: MIN_INTERVAL_SECONDS,
      stopOnTerminate: false,
      startOnBoot: true,
    });
    console.log('[sync-bg] task-registered');
  }

  return { ok: true };
};

export const unregisterBackgroundSyncAsync = async () => {
  if (!isNative() || !BackgroundFetch || !TaskManager) return;
  const registered = await TaskManager.isTaskRegisteredAsync(
    WAVE2_BACKGROUND_SYNC_TASK
  );
  if (registered) {
    await BackgroundFetch.unregisterTaskAsync(WAVE2_BACKGROUND_SYNC_TASK);
    console.log('[sync-bg] task-unregistered');
  }
};

export const getBackgroundSyncRegistrationAsync = async () => {
  if (!isNative() || !TaskManager) {
    return { platform: Platform.OS, registered: false };
  }
  const registered = await TaskManager.isTaskRegisteredAsync(
    WAVE2_BACKGROUND_SYNC_TASK
  );
  return {
    platform: 'android',
    registered,
  };
};
