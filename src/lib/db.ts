import { MutationRecord, AppSettings } from '../types';
import { getRoomDatabase } from './roomDb';

export const SAMPLE_LOGS: MutationRecord[] = [
  { id: "sample-1", timestamp: "2026-06-06T00:00:00Z", remainingKwh: 194.93, mutation: 0, type: "initial", notes: "Saldo Awal" },
  { id: "sample-2", timestamp: "2026-06-09T00:00:00Z", remainingKwh: 188.59, mutation: -6.34, type: "consumption", notes: "" },
  { id: "sample-3", timestamp: "2026-06-10T00:00:00Z", remainingKwh: 185.79, mutation: -2.80, type: "consumption", notes: "" },
  { id: "sample-4", timestamp: "2026-06-11T00:00:00Z", remainingKwh: 181.89, mutation: -3.90, type: "consumption", notes: "" },
  { id: "sample-5", timestamp: "2026-06-13T00:00:00Z", remainingKwh: 174.65, mutation: -7.24, type: "consumption", notes: "" },
  { id: "sample-6", timestamp: "2026-06-14T00:00:00Z", remainingKwh: 171.38, mutation: -3.27, type: "consumption", notes: "" },
  { id: "sample-7", timestamp: "2026-06-15T00:00:00Z", remainingKwh: 167.36, mutation: -4.02, type: "consumption", notes: "" },
  { id: "sample-8", timestamp: "2026-06-16T00:00:00Z", remainingKwh: 163.12, mutation: -4.24, type: "consumption", notes: "" },
  { id: "sample-9", timestamp: "2026-06-16T00:00:00Z", remainingKwh: 195.22, mutation: 32.10, type: "topup", notes: "Top Up Token" },
  { id: "sample-10", timestamp: "2026-06-17T00:00:00Z", remainingKwh: 189.42, mutation: -5.80, type: "consumption", notes: "" },
  { id: "sample-11", timestamp: "2026-06-19T00:00:00Z", remainingKwh: 184.18, mutation: -5.24, type: "consumption", notes: "" },
  { id: "sample-12", timestamp: "2026-06-20T00:00:00Z", remainingKwh: 181.11, mutation: -3.07, type: "consumption", notes: "" },
  { id: "sample-13", timestamp: "2026-06-21T00:00:00Z", remainingKwh: 177.05, mutation: -4.06, type: "consumption", notes: "" },
  { id: "sample-14", timestamp: "2026-06-23T00:00:00Z", remainingKwh: 170.67, mutation: -6.38, type: "consumption", notes: "" },
  { id: "sample-15", timestamp: "2026-06-25T00:00:00Z", remainingKwh: 165.57, mutation: -5.10, type: "consumption", notes: "" },
  { id: "sample-16", timestamp: "2026-06-26T00:00:00Z", remainingKwh: 161.61, mutation: -3.96, type: "consumption", notes: "" },
  { id: "sample-17", timestamp: "2026-06-28T00:00:00Z", remainingKwh: 156.02, mutation: -5.59, type: "consumption", notes: "" },
  { id: "sample-18", timestamp: "2026-07-02T12:13:35Z", remainingKwh: 151.25, mutation: -4.77, type: "consumption", notes: "Pencatatan Rutin" },
  { id: "sample-19", timestamp: "2026-07-02T13:36:31Z", remainingKwh: 146.28, mutation: -4.97, type: "consumption", notes: "Catatan otomatis via Kamera AI" }
];

export const DEFAULT_SETTINGS: AppSettings = {
  telegramToken: ((import.meta as any).env.VITE_TELEGRAM_TOKEN as string) || '8976922826:AAGHOTDEWnNyNbvDQH0yUl5Cgp-kQM285qQ',
  telegramChatId: ((import.meta as any).env.VITE_TELEGRAM_CHAT_ID as string) || '8768868929',
  lowThreshold: 15.0,
  kwhTariff: 1444.7,
  telegramEnabled: true,
  theme: 'dark',
  supabaseUrl: ((import.meta as any).env.VITE_SUPABASE_URL as string) || '',
  supabaseAnonKey: ((import.meta as any).env.VITE_SUPABASE_ANON_KEY as string) || ''
};

// --- Settings Operations ---

let memorySettingsCache: string | null = null;

export function loadLocalSettings(): AppSettings {
  let cached: string | null = null;
  try {
    cached = localStorage.getItem('tokenpro_settings');
  } catch (e) {
    console.warn('localStorage is not accessible, using memory cache:', e);
    cached = memorySettingsCache;
  }

  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        telegramToken: parsed.telegramToken || ((import.meta as any).env.VITE_TELEGRAM_TOKEN as string) || DEFAULT_SETTINGS.telegramToken,
        telegramChatId: parsed.telegramChatId || ((import.meta as any).env.VITE_TELEGRAM_CHAT_ID as string) || DEFAULT_SETTINGS.telegramChatId,
        supabaseUrl: parsed.supabaseUrl || ((import.meta as any).env.VITE_SUPABASE_URL as string) || DEFAULT_SETTINGS.supabaseUrl,
        supabaseAnonKey: parsed.supabaseAnonKey || ((import.meta as any).env.VITE_SUPABASE_ANON_KEY as string) || DEFAULT_SETTINGS.supabaseAnonKey,
        kwhTariff: parsed.kwhTariff !== undefined && parsed.kwhTariff !== null ? parseFloat(parsed.kwhTariff) : DEFAULT_SETTINGS.kwhTariff,
      };
    } catch (e) {
      console.error('Failed to parse local settings, using default:', e);
    }
  }
  return DEFAULT_SETTINGS;
}

export function saveLocalSettings(settings: AppSettings): void {
  const json = JSON.stringify(settings);
  memorySettingsCache = json;
  try {
    localStorage.setItem('tokenpro_settings', json);
  } catch (e) {
    console.warn('localStorage write failed, stored in memory only:', e);
  }

  // Simpan secara asinkron ke Room Database
  const roomDb = getRoomDatabase();
  roomDb.settingsDao().updateSettings(settings).catch(err => {
    console.error('Failed to write settings to Room Database:', err);
  });
}

// --- Local Mutations Operations (Fallback/Offline) ---

export function deduplicateMutations(mutations: MutationRecord[]): MutationRecord[] {
  const result: MutationRecord[] = [];
  for (const m of mutations) {
    const isDup = result.some(r => {
      const t1 = new Date(m.timestamp).getTime();
      const t2 = new Date(r.timestamp).getTime();
      const timeMatches = Math.abs(t1 - t2) < 1000;
      const kwhMatches = Math.abs(m.remainingKwh - r.remainingKwh) < 0.005;
      return timeMatches && kwhMatches;
    });
    if (!isDup) {
      result.push(m);
    }
  }
  return result;
}

export function loadLocalMutations(): MutationRecord[] {
  const cached = localStorage.getItem('tokenpro_mutations');
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        let modified = false;
        const healed = parsed.map((item: any, idx: number) => {
          if (!item.id) {
            modified = true;
            return {
              ...item,
              id: `local-${idx}-${new Date(item.timestamp).getTime() || Date.now()}`
            };
          }
          return item;
          // Kembalikan item
        });

        const unique = deduplicateMutations(healed);
        if (unique.length !== parsed.length) {
          modified = true;
        }

        if (modified) {
          localStorage.setItem('tokenpro_mutations', JSON.stringify(unique));
        }
        return unique;
      }
    } catch (e) {
      console.error('Failed to parse local mutations:', e);
    }
  }
  // Initialize with sample logs if empty on first startup
  const uniqueSample = deduplicateMutations(SAMPLE_LOGS);
  localStorage.setItem('tokenpro_mutations', JSON.stringify(uniqueSample));
  return uniqueSample;
}

export function saveLocalMutation(record: Omit<MutationRecord, 'id'>): MutationRecord[] {
  const list = loadLocalMutations();
  
  // Check duplication on timestamp + remainingKwh
  const isDup = list.some(r => {
    const t1 = new Date(record.timestamp).getTime();
    const t2 = new Date(r.timestamp).getTime();
    const timeMatches = Math.abs(t1 - t2) < 1000;
    const kwhMatches = Math.abs(record.remainingKwh - r.remainingKwh) < 0.005;
    return timeMatches && kwhMatches;
  });

  if (isDup) {
    console.warn('Attempted to save duplicate local mutation:', record);
    return list;
  }

  const newRecord: MutationRecord = {
    ...record,
    id: `local-${Date.now()}`
  };
  list.push(newRecord);
  localStorage.setItem('tokenpro_mutations', JSON.stringify(list));

  // Simpan secara asinkron ke Room Database
  const roomDb = getRoomDatabase();
  roomDb.mutationDao().insert(newRecord).catch(err => {
    console.error('Failed to write mutation to Room Database:', err);
  });

  return list;
}

export function deleteLocalMutation(id: string): MutationRecord[] {
  const list = loadLocalMutations();
  const filtered = list.filter(m => m.id !== id);
  localStorage.setItem('tokenpro_mutations', JSON.stringify(filtered));

  // Hapus secara asinkron dari Room Database
  const roomDb = getRoomDatabase();
  roomDb.mutationDao().delete(id).catch(err => {
    console.error('Failed to delete mutation from Room Database:', err);
  });

  return filtered;
}

export function seedLocalData(): { settings: AppSettings; mutations: MutationRecord[] } {
  localStorage.setItem('tokenpro_settings', JSON.stringify(DEFAULT_SETTINGS));
  localStorage.setItem('tokenpro_mutations', JSON.stringify(SAMPLE_LOGS));

  // Seeding Room Database secara asinkron
  const roomDb = getRoomDatabase();
  roomDb.settingsDao().updateSettings(DEFAULT_SETTINGS).catch(err => console.error('Room seed settings error:', err));
  roomDb.mutationDao().deleteAll()
    .then(() => roomDb.mutationDao().insertAll(SAMPLE_LOGS))
    .catch(err => console.error('Room seed mutations error:', err));

  return { settings: DEFAULT_SETTINGS, mutations: SAMPLE_LOGS };
}

/**
 * Sinkronisasi data antara LocalStorage (cache render cepat) dan Room Database (Driver Capacitor)
 */
export async function syncLocalStorageWithRoomDb(): Promise<void> {
  try {
    const roomDb = getRoomDatabase();
    
    // 1. Sinkronisasi Pengaturan
    const roomSettings = await roomDb.settingsDao().getSettings();
    const currentSettings = loadLocalSettings();
    if (roomSettings) {
      localStorage.setItem('tokenpro_settings', JSON.stringify(roomSettings));
    } else {
      await roomDb.settingsDao().updateSettings(currentSettings);
    }

    // 2. Sinkronisasi Mutasi
    const roomMutations = await roomDb.mutationDao().getAll();
    const localMutations = loadLocalMutations();
    if (roomMutations.length > 0) {
      localStorage.setItem('tokenpro_mutations', JSON.stringify(roomMutations));
    } else if (localMutations.length > 0) {
      await roomDb.mutationDao().insertAll(localMutations);
    }
  } catch (err) {
    console.error('Failed to sync localStorage with Room Database:', err);
  }
}

// --- Supabase Database Operations (Direct Rest API) ---

export async function loadSupabaseMutations(url: string, key: string): Promise<MutationRecord[]> {
  const cleanUrl = url.replace(/\/$/, '');
  const response = await fetch(`${cleanUrl}/rest/v1/token_mutations?select=*`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase read error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (Array.isArray(data)) {
    // Transform column keys to camelCase if needed, and sort
    const mapped: MutationRecord[] = data.map((item: any) => ({
      id: item.id ? String(item.id) : `sb-${new Date(item.timestamp).getTime() || Date.now()}`,
      timestamp: item.timestamp,
      remainingKwh: parseFloat(item.remaining_kwh),
      mutation: parseFloat(item.mutation),
      type: item.type,
      notes: item.notes || ''
    }));

    // Sort ascending chronologically (oldest to newest) to make dashboards happy
    return mapped.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  return [];
}

export async function saveSupabaseMutation(
  url: string,
  key: string,
  record: Omit<MutationRecord, 'id'>
): Promise<void> {
  const cleanUrl = url.replace(/\/$/, '');
  const response = await fetch(`${cleanUrl}/rest/v1/token_mutations`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      timestamp: record.timestamp,
      remaining_kwh: record.remainingKwh,
      mutation: record.mutation,
      type: record.type,
      notes: record.notes
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase insert error (${response.status}): ${errorText}`);
  }
}

export async function deleteSupabaseMutation(
  url: string,
  key: string,
  timestamp: string
): Promise<void> {
  const cleanUrl = url.replace(/\/$/, '');
  const response = await fetch(`${cleanUrl}/rest/v1/token_mutations?timestamp=eq.${encodeURIComponent(timestamp)}`, {
    method: 'DELETE',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase delete error (${response.status}): ${errorText}`);
  }
}

export async function mirrorAllToSupabase(
  url: string,
  key: string,
  mutations: MutationRecord[]
): Promise<{ successCount: number; failedCount: number }> {
  if (!mutations || mutations.length === 0) {
    return { successCount: 0, failedCount: 0 };
  }

  let remoteMutations: MutationRecord[] = [];
  try {
    remoteMutations = await loadSupabaseMutations(url, key);
  } catch (err) {
    console.warn('Failed to load remote mutations for duplicate check:', err);
  }

  // Filter out duplicates based on timestamp and remainingKwh (sisa kWh)
  const nonDuplicates = mutations.filter(local => {
    const isDup = remoteMutations.some(remote => {
      const localTime = new Date(local.timestamp).getTime();
      const remoteTime = new Date(remote.timestamp).getTime();
      const timeMatches = Math.abs(localTime - remoteTime) < 1000; // within 1 second
      const kwhMatches = Math.abs(local.remainingKwh - remote.remainingKwh) < 0.005; // same kWh (floating precision)
      return timeMatches && kwhMatches;
    });
    return !isDup;
  });

  const duplicateCount = mutations.length - nonDuplicates.length;

  if (nonDuplicates.length === 0) {
    return { successCount: 0, failedCount: duplicateCount };
  }

  const cleanUrl = url.replace(/\/$/, '');
  const payload = nonDuplicates.map(m => ({
    timestamp: m.timestamp,
    remaining_kwh: m.remainingKwh,
    mutation: m.mutation,
    type: m.type,
    notes: m.notes || ''
  }));

  const response = await fetch(`${cleanUrl}/rest/v1/token_mutations`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=ignore-duplicates, return=representation'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase mass sync error: ${response.status} - ${text}`);
  }

  const data = await response.json();
  if (Array.isArray(data)) {
    const successCount = data.length;
    const failedCount = nonDuplicates.length - successCount + duplicateCount;
    return { successCount, failedCount };
  }

  return { successCount: nonDuplicates.length, failedCount: duplicateCount };
}

export async function cleanSupabaseDuplicates(
  url: string,
  key: string
): Promise<{ cleanedCount: number }> {
  // 1. Fetch all remote records
  const remote = await loadSupabaseMutations(url, key);
  if (remote.length === 0) {
    return { cleanedCount: 0 };
  }
  
  // 2. Identify duplicates by grouping by similar timestamp (within 1 second) and similar remainingKwh (within 0.005)
  const duplicatesGrouped: { [key: string]: MutationRecord[] } = {};
  
  remote.forEach(item => {
    const t = new Date(item.timestamp).getTime();
    let foundKey = Object.keys(duplicatesGrouped).find(k => {
      const [kTimeStr, kKwhStr] = k.split('_');
      const kTime = parseFloat(kTimeStr);
      const kKwh = parseFloat(kKwhStr);
      return Math.abs(kTime - t) < 1000 && Math.abs(kKwh - item.remainingKwh) < 0.005;
    });
    
    if (!foundKey) {
      foundKey = `${t}_${item.remainingKwh}`;
    }
    
    if (!duplicatesGrouped[foundKey]) {
      duplicatesGrouped[foundKey] = [];
    }
    duplicatesGrouped[foundKey].push(item);
  });

  let cleanedCount = 0;
  
  // 3. For each group with length > 1, delete all copies from Supabase, then insert exactly ONE copy
  for (const groupKey of Object.keys(duplicatesGrouped)) {
    const group = duplicatesGrouped[groupKey];
    if (group.length > 1) {
      const firstItem = group[0];
      try {
        // delete all items matching this timestamp in Supabase
        await deleteSupabaseMutation(url, key, firstItem.timestamp);
        // insert back exactly one copy
        await saveSupabaseMutation(url, key, firstItem);
        cleanedCount += (group.length - 1);
      } catch (err) {
        console.warn(`Failed to clean duplicate for timestamp ${firstItem.timestamp}:`, err);
      }
    }
  }

  return { cleanedCount };
}

export async function loadSupabaseSettings(
  url: string,
  key: string
): Promise<Partial<AppSettings> | null> {
  const cleanUrl = url.replace(/\/$/, '');
  try {
    const response = await fetch(`${cleanUrl}/rest/v1/token_settings?id=eq.default&select=*`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
      }
    });

    if (!response.ok) {
      console.warn(`Supabase settings table loaded with status ${response.status} (might not be created yet)`);
      return null;
    }

    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      const item = data[0];
      return {
        telegramToken: item.telegram_token ?? '',
        telegramChatId: item.telegram_chat_id ?? '',
        lowThreshold: item.low_threshold !== null ? parseFloat(item.low_threshold) : 15.0,
        kwhTariff: item.kwh_tariff !== null && item.kwh_tariff !== undefined ? parseFloat(item.kwh_tariff) : 1444.7,
        telegramEnabled: item.telegram_enabled ?? true,
        theme: item.theme ?? 'dark',
        supabaseUrl: item.supabase_url ?? '',
        supabaseAnonKey: item.supabase_anon_key ?? ''
      };
    }
  } catch (err) {
    console.warn('Failed to load remote settings from Supabase:', err);
  }
  return null;
}

export async function saveSupabaseSettings(
  url: string,
  key: string,
  settings: AppSettings
): Promise<void> {
  const cleanUrl = url.replace(/\/$/, '');
  
  const payload: any = {
    id: 'default',
    telegram_token: settings.telegramToken,
    telegram_chat_id: settings.telegramChatId,
    low_threshold: settings.lowThreshold,
    kwh_tariff: settings.kwhTariff ?? 1444.7,
    telegram_enabled: settings.telegramEnabled,
    theme: settings.theme,
    supabase_url: settings.supabaseUrl ?? '',
    supabase_anon_key: settings.supabaseAnonKey ?? ''
  };

  // Helper to check if error is due to missing kwh_tariff column
  const isKwhTariffError = (text: string) => {
    return text.includes('kwh_tariff') && (text.includes('column') || text.includes('does not exist') || text.includes('failed to read'));
  };

  // 1. Try atomic POST UPSERT with merge-duplicates header (standard Supabase PostgREST)
  try {
    const response = await fetch(`${cleanUrl}/rest/v1/token_settings`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      return;
    }
    const errText = await response.text();
    console.warn(`Supabase POST upsert settings returned status ${response.status}. Response: ${errText}`);

    // If missing kwh_tariff column, try without it
    if (isKwhTariffError(errText)) {
      console.warn('kwh_tariff column is missing. Retrying POST without it...');
      const retryPayload = { ...payload };
      delete retryPayload.kwh_tariff;

      const retryResp = await fetch(`${cleanUrl}/rest/v1/token_settings`, {
        method: 'POST',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(retryPayload)
      });
      if (retryResp.ok) {
        return;
      }
    }
  } catch (err) {
    console.warn('Supabase POST upsert error, trying fallback:', err);
  }

  // 2. Fallback PUT to id=eq.default (inserts if missing, replaces if exists)
  const fallbackResponse = await fetch(`${cleanUrl}/rest/v1/token_settings?id=eq.default`, {
    method: 'PUT',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(payload)
  });

  if (!fallbackResponse.ok) {
    const errorText = await fallbackResponse.text();
    console.warn(`Supabase PUT settings returned status ${fallbackResponse.status}. Response: ${errorText}`);

    // If missing kwh_tariff column, try PUT without it
    if (isKwhTariffError(errorText)) {
      console.warn('kwh_tariff column is missing. Retrying PUT without it...');
      const retryPayload = { ...payload };
      delete retryPayload.kwh_tariff;

      const retryFallbackResponse = await fetch(`${cleanUrl}/rest/v1/token_settings?id=eq.default`, {
        method: 'PUT',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(retryPayload)
      });
      if (retryFallbackResponse.ok) {
        return;
      }
      const retryErrorText = await retryFallbackResponse.text();
      throw new Error(`Supabase settings save retry error (${retryFallbackResponse.status}): ${retryErrorText}`);
    }

    throw new Error(`Supabase settings save error (${fallbackResponse.status}): ${errorText}`);
  }
}


