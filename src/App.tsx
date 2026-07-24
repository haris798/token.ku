import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  loadLocalSettings,
  saveLocalSettings,
  loadLocalMutations,
  saveLocalMutation,
  deleteLocalMutation,
  seedLocalData,
  loadSupabaseMutations,
  saveSupabaseMutation,
  deleteSupabaseMutation,
  mirrorAllToSupabase,
  deduplicateMutations,
  cleanSupabaseDuplicates,
  loadSupabaseSettings,
  saveSupabaseSettings,
  syncLocalStorageWithRoomDb
} from './lib/db';
import { sendTelegramNotification } from './lib/telegram';
import { MutationRecord, AppSettings } from './types';

// Icons
import {
  LayoutDashboard,
  History,
  Settings as SettingsIcon,
  Zap,
  Loader2,
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
  TrendingUp,
  Cloud,
  X,
  Copy,
  Sun,
  Moon,
  Plus,
  Database
} from 'lucide-react';

// Components
import Dashboard from './components/Dashboard';
import ManualInput from './components/ManualInput';
import HistoryTable from './components/HistoryTable';
import SettingsPanel from './components/SettingsPanel';

// ✅ INLINE HOOK: Deteksi koneksi internet (menghindari error file tidak ditemukan)
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [mutations, setMutations] = useState<MutationRecord[]>(() => loadLocalMutations());
  const [settings, setSettings] = useState<AppSettings>(() => loadLocalSettings());
  const [showSupabaseErrorModal, setShowSupabaseErrorModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'input' | 'prediction' | 'history' | 'settings'>('dashboard');
  const [isSaving, setIsSaving] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  const isCloudflareProxy = useMemo(() => {
    return window.location.hostname === 'token.haris443.workers.dev' || window.location.hostname.includes('workers.dev');
  }, []);

  // ✅ BARU: State & Refs untuk Offline-First & Race Condition Guard
  const isOnline = useOnlineStatus();
  const isLoadingDataRef = useRef(false);
  const bannerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevOnlineRef = useRef(isOnline);

  // ✅ FIX: showBanner dengan cleanup timeout (cegah memory leak)
  const showBanner = (type: 'success' | 'error' | 'warning', message: string) => {
    setBanner({ type, message });
    
    if (bannerTimeoutRef.current) {
      clearTimeout(bannerTimeoutRef.current);
    }
    
    bannerTimeoutRef.current = setTimeout(() => {
      setBanner(prev => prev?.message === message ? null : prev);
      bannerTimeoutRef.current = null;
    }, 6000);
  };

  // Cleanup banner timeout saat unmount
  useEffect(() => {
    return () => {
      if (bannerTimeoutRef.current) {
        clearTimeout(bannerTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const initialize = async () => {
      try {
        // 1. Baca data lokal secara sinkron untuk offline-first
        const loadedSettings = loadLocalSettings();
        setSettings(loadedSettings);
        
        let localMutations = loadLocalMutations();
        const uniqueLocal = deduplicateMutations(localMutations);
        if (uniqueLocal.length !== localMutations.length) {
          localStorage.setItem('tokenpro_mutations', JSON.stringify(uniqueLocal));
          localMutations = uniqueLocal;
        }
        setMutations(localMutations);

        if (!loadedSettings.supabaseUrl || !loadedSettings.supabaseAnonKey) {
          setActiveTab('settings');
        }
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        // 2. Langsung matikan layar loading agar UI tampil seketika
        setLoading(false);
      }

      // 3. Jalankan sinkronisasi cloud di background
      loadAppConfigAndData();
    };
    initialize();
  }, []);

  // ✅ Auto-sync saat koneksi kembali online
  useEffect(() => {
    const wasOffline = prevOnlineRef.current === false;
    const isNowOnline = isOnline === true;
    
    if (wasOffline && isNowOnline) {
      console.log('[App] Connection restored, auto-syncing...');
      showBanner('success', 'Koneksi pulih! Melakukan sinkronisasi data...');
      loadAppConfigAndData();
    }
    
    prevOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    if (settings?.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings?.theme]);

  // ✅ REFACTOR: Offline-first + Race condition guard
  const loadAppConfigAndData = async () => {
    // GUARD: Cegah race condition (double load)
    if (isLoadingDataRef.current) {
      console.log('[loadAppConfigAndData] Skipped: already loading');
      return;
    }
    isLoadingDataRef.current = true;
    
    try {
      // ═══════════════════════════════════════════════════════
      // STEP 1: BACA DATA LOKAL DULU (OFFLINE-FIRST)
      // ═══════════════════════════════════════════════════════
      let loadedSettings = loadLocalSettings();
      setSettings(loadedSettings);
      
      let localMutations = loadLocalMutations();
      const uniqueLocal = deduplicateMutations(localMutations);
      if (uniqueLocal.length !== localMutations.length) {
        localStorage.setItem('tokenpro_mutations', JSON.stringify(uniqueLocal));
        localMutations = uniqueLocal;
      }
      setMutations(localMutations);
      
      // ═══════════════════════════════════════════════════════
      // STEP 2: CEK KONEKSI INTERNET
      // ═══════════════════════════════════════════════════════
      const hasInternet = navigator.onLine;
      const hasSupabaseConfig = !!(loadedSettings.supabaseUrl && loadedSettings.supabaseAnonKey);
      
      if (!hasInternet || !hasSupabaseConfig) {
        if (!hasInternet && hasSupabaseConfig) {
          showBanner('warning', 'Mode Offline: Menampilkan data lokal terakhir. Sinkronisasi ditunda.');
        }
        return; // Selesai - data lokal sudah di-set
      }
      
      // ═══════════════════════════════════════════════════════
      // STEP 3: ONLINE + ADA CONFIG → Sync ke Supabase
      // ═══════════════════════════════════════════════════════
      setDataLoading(true);
      
      try {
        await syncLocalStorageWithRoomDb();
        
        loadedSettings = loadLocalSettings();
        localMutations = loadLocalMutations();
        const uniqueLocalSync = deduplicateMutations(localMutations);
        if (uniqueLocalSync.length !== localMutations.length) {
          localStorage.setItem('tokenpro_mutations', JSON.stringify(uniqueLocalSync));
          localMutations = uniqueLocalSync;
        }
        setSettings(loadedSettings);
        setMutations(localMutations);
        
        try {
          const remoteSettings = await loadSupabaseSettings(
            loadedSettings.supabaseUrl, 
            loadedSettings.supabaseAnonKey
          );
          if (remoteSettings) {
            loadedSettings = {
              ...loadedSettings,
              telegramToken: remoteSettings.telegramToken ?? loadedSettings.telegramToken,
              telegramChatId: remoteSettings.telegramChatId ?? loadedSettings.telegramChatId,
              lowThreshold: remoteSettings.lowThreshold !== undefined 
                ? remoteSettings.lowThreshold : loadedSettings.lowThreshold,
              telegramEnabled: remoteSettings.telegramEnabled !== undefined 
                ? remoteSettings.telegramEnabled : loadedSettings.telegramEnabled,
              theme: remoteSettings.theme ?? loadedSettings.theme,
              supabaseUrl: remoteSettings.supabaseUrl || loadedSettings.supabaseUrl,
              supabaseAnonKey: remoteSettings.supabaseAnonKey || loadedSettings.supabaseAnonKey
            };
            saveLocalSettings(loadedSettings);
            setSettings(loadedSettings);
          }
        } catch (err) {
          console.warn('[loadAppConfigAndData] Failed to load remote settings:', err);
        }
        
        cleanSupabaseDuplicates(loadedSettings.supabaseUrl, loadedSettings.supabaseAnonKey)
          .catch(err => console.warn('[loadAppConfigAndData] Failed to clean Supabase duplicates:', err));
        
        if (localMutations.length > 0) {
          mirrorAllToSupabase(loadedSettings.supabaseUrl, loadedSettings.supabaseAnonKey, localMutations)
            .catch(err => console.warn('[loadAppConfigAndData] Failed to mirror local data:', err));
        }
        
        try {
          const loadedMutations = await loadSupabaseMutations(
            loadedSettings.supabaseUrl, 
            loadedSettings.supabaseAnonKey
          );
          localStorage.setItem('tokenpro_mutations', JSON.stringify(loadedMutations));
          setMutations(loadedMutations);
        } catch (err) {
          console.warn('[loadAppConfigAndData] Failed to pull from Supabase, keeping local data:', err);
        }
      } catch (err) {
        console.error('[loadAppConfigAndData] Sync error, fallback to local:', err);
      } finally {
        setDataLoading(false);
      }
    } finally {
      isLoadingDataRef.current = false;
    }
  };


  // ✅ FIX: handleAddMutation - retroaktif akurat + Telegram fix
  const handleAddMutation = async (newRecord: {
    remainingKwh: number;
    timestamp: string;
    notes: string;
    type: 'consumption' | 'topup' | 'initial'
  }) => {
    if (!settings) return;
    setIsSaving(true);
    
    try {
      const newTimestamp = new Date(newRecord.timestamp).getTime();
      
      // Urutkan kronologis
      const chronological = [...mutations].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      // ✅ FIX: Cari record terdekat SEBELUM timestamp input (bukan yang terbaru)
      const prevRecord = chronological
        .filter(r => new Date(r.timestamp).getTime() < newTimestamp)
        .pop() ?? null;
      
      let mutation = 0;
      let finalType = newRecord.type;
      
      if (prevRecord) {
        mutation = newRecord.remainingKwh - prevRecord.remainingKwh;
        finalType = mutation >= 0 ? 'topup' : 'consumption';
      } else {
        finalType = 'initial';
      }
      
      const recordToSave = {
        timestamp: newRecord.timestamp,
        remainingKwh: newRecord.remainingKwh,
        mutation,
        type: finalType,
        notes: newRecord.notes,
      };
      
      // OFFLINE-FIRST: Simpan lokal DULU, baru sync jika online
      const updatedLocal = saveLocalMutation(recordToSave);
      setMutations(updatedLocal); // Update UI langsung dari lokal
      
      const hasInternet = navigator.onLine;
      const hasSupabase = !!(settings.supabaseUrl && settings.supabaseAnonKey);
      
      if (hasInternet && hasSupabase) {
        try {
          await saveSupabaseMutation(settings.supabaseUrl, settings.supabaseAnonKey, recordToSave);
          const updated = await loadSupabaseMutations(settings.supabaseUrl, settings.supabaseAnonKey);
          setMutations(updated);
          showBanner('success', 'Pencatatan berhasil disimpan ke Supabase Cloud.');
        } catch (sbErr) {
          console.error('[handleAddMutation] Supabase save failed, keeping local:', sbErr);
          showBanner('warning', 'Gagal sync ke Supabase. Data tersimpan di lokal.');
        }
      } else if (!hasInternet) {
        showBanner('warning', 'Mode Offline: Data tersimpan di lokal. Akan di-sync saat online.');
      } else {
        showBanner('success', 'Pencatatan berhasil disimpan di penyimpanan lokal.');
      }
      
      // ✅ FIX: Telegram alert berdasarkan STATE TERKINI, bukan record input
      if (settings.telegramEnabled) {
        const currentLatest = [...updatedLocal].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[0];
        
        if (currentLatest && currentLatest.remainingKwh <= settings.lowThreshold) {
          const formattedDate = new Date(currentLatest.timestamp).toLocaleString('id-ID', {
            dateStyle: 'medium',
            timeStyle: 'short',
          });
          const alertMsg = `⚠️ *Token.ku - Sisa kWh Rendah!* ⚠️\n\n🔋 *Sisa kWh:* ${currentLatest.remainingKwh.toFixed(2)} kWh\n📉 *Ambang Batas:* ${settings.lowThreshold.toFixed(2)} kWh\n⏰ *Waktu:* ${formattedDate}\n\n📝 *Catatan:* ${currentLatest.notes || '-'}\n\nSegera lakukan pengisian token.`;
          
          const telSuccess = await sendTelegramNotification(
            settings.telegramToken, 
            settings.telegramChatId, 
            alertMsg
          );
          
          if (telSuccess) {
            showBanner('warning', 'Peringatan saldo rendah terkirim ke Telegram.');
          } else {
            showBanner('error', 'Notifikasi Telegram gagal terkirim.');
          }
        }
      }
      
      setActiveTab('dashboard');
    } catch (err) {
      console.error('[handleAddMutation] Error:', err);
      showBanner('error', 'Gagal menyimpan pencatatan.');
    } finally {
      setIsSaving(false);
    }
  };

  // ✅ FIX: handleDeleteMutation - pakai id bukan timestamp
  const handleDeleteMutation = async (id: string) => {
    if (!settings) return;
    setIsSaving(true);
    
    const recordToDelete = mutations.find(m => m.id && String(m.id) === String(id));
    
    try {
      // Delete lokal by id
      const updatedLocal = deleteLocalMutation(id);
      setMutations(updatedLocal);
      
      const hasInternet = navigator.onLine;
      const hasSupabase = !!(settings.supabaseUrl && settings.supabaseAnonKey);
      
      if (hasInternet && hasSupabase && recordToDelete) {
        try {
          // ✅ FIX: Delete by ID, bukan timestamp (hindari hapus data lain)
          await deleteSupabaseMutation(
            settings.supabaseUrl, 
            settings.supabaseAnonKey, 
            recordToDelete.id || recordToDelete.timestamp
          );
          
          const updated = await loadSupabaseMutations(settings.supabaseUrl, settings.supabaseAnonKey);
          setMutations(updated);
          showBanner('success', 'Pencatatan berhasil dihapus dari Supabase Cloud.');
        } catch (sbErr) {
          console.error('[handleDeleteMutation] Supabase delete failed:', sbErr);
          showBanner('warning', 'Gagal hapus dari Supabase. Dihapus dari lokal saja.');
        }
      } else if (!hasInternet) {
        showBanner('warning', 'Mode Offline: Dihapus dari lokal. Akan di-sync saat online.');
      } else {
        showBanner('success', 'Pencatatan berhasil dihapus dari penyimpanan lokal.');
      }
    } catch (err) {
      console.error('[handleDeleteMutation] Error:', err);
      showBanner('error', 'Gagal menghapus data.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTheme = async () => {
    if (!settings) return;
    const currentTheme = settings.theme || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    const updatedSettings: AppSettings = {
      ...settings,
      theme: newTheme
    };
    await handleSaveSettings(updatedSettings, true);
  };

  const handleSaveSettings = async (newSettings: AppSettings, silent: boolean = false) => {
    setIsSaving(true);
    try {
      saveLocalSettings(newSettings);
      setSettings(newSettings);
      
      const localMutations = loadLocalMutations();
      
      if (newSettings.supabaseUrl && newSettings.supabaseAnonKey) {
        (window as any).__missingTable = false;
        try {
          let supabaseSettingsDetails = '';
          try {
            await saveSupabaseSettings(newSettings.supabaseUrl, newSettings.supabaseAnonKey, newSettings);
            supabaseSettingsDetails = ' Pengaturan disimpan ke cloud';
          } catch (setErr) {
            console.warn('Could not save settings to Supabase:', setErr);
            supabaseSettingsDetails = ' (Tabel token_settings tidak ditemukan, simpan lokal sukses)';
            (window as any).__missingTable = true;
          }
          
          let syncDetails = '';
          if (localMutations.length > 0) {
            try {
              const syncResult = await mirrorAllToSupabase(newSettings.supabaseUrl, newSettings.supabaseAnonKey, localMutations);
              if (syncResult.successCount > 0) {
                syncDetails = ` (Menyinkronkan ${syncResult.successCount} data log baru, melewati ${syncResult.failedCount} data duplikat)`;
              } else if (syncResult.failedCount > 0) {
                syncDetails = ` (Semua ${syncResult.failedCount} data sudah sinkron)`;
              }
            } catch (syncErr) {
              console.warn('Failed to auto-mirror existing data to Supabase during config update:', syncErr);
            }
          }
          
          const loadedMutations = await loadSupabaseMutations(newSettings.supabaseUrl, newSettings.supabaseAnonKey);
          localStorage.setItem('tokenpro_mutations', JSON.stringify(loadedMutations));
          setMutations(loadedMutations);
          
          if ((window as any).__missingTable) {
            (window as any).__missingTable = false;
            setShowSupabaseErrorModal(true);
            if (!silent) showBanner('warning', `Konfigurasi disimpan secara lokal!`);
          } else {
            if (!silent) showBanner('success', `${supabaseSettingsDetails} & sync data Supabase${syncDetails}.`);
          }
        } catch (err) {
          console.error('Failed to load from new Supabase config, using local instead:', err);
          setMutations(localMutations);
          if (!silent) showBanner('warning', 'Konfigurasi disimpan secara lokal. Supabase baru tidak dapat dihubungi.');
        }
      } else {
        setMutations(localMutations);
        if (!silent) showBanner('success', 'Konfigurasi berhasil disimpan secara lokal.');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      if (!silent) showBanner('error', 'Gagal menyimpan konfigurasi.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMirrorAllToSupabase = async (url: string, key: string): Promise<{ successCount: number; failedCount: number }> => {
    return await mirrorAllToSupabase(url, key, mutations);
  };

  const handleCleanDuplicates = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
      let sbCleaned = 0;
      
      if (settings.supabaseUrl && settings.supabaseAnonKey) {
        try {
          const res = await cleanSupabaseDuplicates(settings.supabaseUrl, settings.supabaseAnonKey);
          sbCleaned = res.cleanedCount;
        } catch (sbErr) {
          console.error('Failed to clean duplicates from Supabase:', sbErr);
        }
      }
      
      const localMutations = loadLocalMutations();
      const uniqueLocal = deduplicateMutations(localMutations);
      localStorage.setItem('tokenpro_mutations', JSON.stringify(uniqueLocal));
      
      if (settings.supabaseUrl && settings.supabaseAnonKey) {
        const loadedMutations = await loadSupabaseMutations(settings.supabaseUrl, settings.supabaseAnonKey);
        localStorage.setItem('tokenpro_mutations', JSON.stringify(loadedMutations));
        setMutations(loadedMutations);
      } else {
        setMutations(uniqueLocal);
      }
      
      const totalRemoved = (localMutations.length - uniqueLocal.length) + sbCleaned;
      if (totalRemoved > 0) {
        showBanner('success', `Berhasil membersihkan ${totalRemoved} data duplikat!`);
      } else {
        showBanner('success', 'Semua data sudah bersih dari duplikat.');
      }
    } catch (err) {
      console.error('Error cleaning duplicates:', err);
      showBanner('error', 'Gagal membersihkan data duplikat.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSeedSampleData = async () => {
    setIsSaving(true);
    try {
      const seeded = seedLocalData();
      setSettings(seeded.settings);
      setMutations(seeded.mutations);
      showBanner('success', 'Data log dan pengaturan contoh berhasil diimpor ke penyimpanan lokal!');
    } catch (err) {
      console.error('Error seeding data:', err);
      showBanner('error', 'Gagal mengimpor data contoh.');
    } finally {
      setIsSaving(false);
    }
  };

  const lastRecord = useMemo(() => {
    if (mutations.length === 0) return null;
    return [...mutations].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }, [mutations]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-800">
        <Loader2 className="h-10 w-10 text-indigo-600 animate-spin mb-4" />
        <h2 className="text-lg font-bold font-display tracking-wide">Memuat Token.ku...</h2>
        <p className="text-xs text-slate-400 mt-1">Menginisialisasi sistem...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300 overflow-x-hidden w-full relative">
      <AnimatePresence>
        {banner && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
          >
            <div className={`p-4 rounded-xl shadow-lg border flex items-start gap-3 ${
              banner.type === 'success' 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200' 
                : banner.type === 'warning'
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900 text-amber-800 dark:text-amber-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-100 dark:border-rose-900 text-rose-800 dark:text-rose-200'
            }`}>
              {banner.type === 'success' && <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />}
              {banner.type === 'warning' && <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />}
              {banner.type === 'error' && <AlertOctagon className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />}
              <div className="text-xs font-semibold leading-relaxed">
                {banner.message}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <header className="bg-slate-50 dark:bg-[#0a0f1c] pt-8 pb-6 px-4 shrink-0 transition-colors duration-300">
        <div className="max-w-md mx-auto flex flex-col items-center gap-6">
          {/* Logo & Title */}
          <div className="flex items-center justify-center gap-4 w-full">
            <div className="h-[52px] w-[52px] shrink-0 bg-amber-500/10 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center shadow-sm">
              <Zap className="h-7 w-7 text-amber-500 dark:text-amber-400 fill-amber-500/20 dark:fill-amber-400/20" />
            </div>
            <div className="flex flex-col items-start">
              <h1 className="text-[28px] leading-none font-bold tracking-tight font-display text-slate-900 dark:text-white flex items-center gap-2">
                Token.ku
                {isCloudflareProxy && (
                  <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-1.5 py-0.5 rounded-md capitalize tracking-wider flex items-center gap-1 border border-orange-200/40 dark:border-orange-900/40">
                    <Cloud className="h-3.5 w-3.5 text-orange-500 animate-pulse" />
                    CF
                  </span>
                )}
              </h1>
            </div>
          </div>

          {/* Navigation Pill */}
          <div className="flex items-center justify-center gap-2.5 w-full max-w-full overflow-x-auto hide-scrollbar pb-2 sm:pb-0">
            <div className="flex items-center gap-1.5 p-1.5 bg-transparent border border-slate-200 dark:border-[#1f2937] rounded-3xl">
              <button
                onClick={() => setActiveTab('dashboard')}
                title="Dashboard"
                className={`p-2.5 rounded-2xl transition-all duration-300 cursor-pointer flex items-center justify-center active:scale-95 ${
                  activeTab === 'dashboard'
                    ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-md shadow-indigo-500/25'
                    : 'bg-slate-100 dark:bg-[#1e293b] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#2d3748]'
                }`}
              >
                <LayoutDashboard className="h-5 w-5" />
              </button>
              <button
                onClick={() => setActiveTab('input')}
                title="Input"
                className={`p-2.5 rounded-2xl transition-all duration-300 cursor-pointer flex items-center justify-center active:scale-95 ${
                  activeTab === 'input'
                    ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-md shadow-indigo-500/25'
                    : 'bg-slate-100 dark:bg-[#1e293b] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#2d3748]'
                }`}
              >
                <Plus className="h-5 w-5" />
              </button>
              <button
                onClick={() => setActiveTab('prediction')}
                title="Prediksi"
                className={`p-2.5 rounded-2xl transition-all duration-300 cursor-pointer flex items-center justify-center active:scale-95 ${
                  activeTab === 'prediction'
                    ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-md shadow-indigo-500/25'
                    : 'bg-slate-100 dark:bg-[#1e293b] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#2d3748]'
                }`}
              >
                <TrendingUp className="h-5 w-5" />
              </button>
              <button
                onClick={() => setActiveTab('history')}
                title="Riwayat"
                className={`p-2.5 rounded-2xl transition-all duration-300 cursor-pointer flex items-center justify-center active:scale-95 ${
                  activeTab === 'history'
                    ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-md shadow-indigo-500/25'
                    : 'bg-slate-100 dark:bg-[#1e293b] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#2d3748]'
                }`}
              >
                <History className="h-5 w-5" />
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                title="Pengaturan"
                className={`p-2.5 rounded-2xl transition-all duration-300 cursor-pointer flex items-center justify-center active:scale-95 ${
                  activeTab === 'settings'
                    ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-md shadow-indigo-500/25'
                    : 'bg-slate-100 dark:bg-[#1e293b] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#2d3748]'
                }`}
              >
                <SettingsIcon className="h-5 w-5" />
              </button>
            </div>

            <button
              title={isOnline ? (settings?.supabaseUrl ? 'Supabase Terhubung' : 'Online (Tanpa Supabase)') : 'Mode Offline'}
              className={`p-3 rounded-2xl border transition-all duration-300 flex items-center justify-center shadow-sm dark:shadow-none flex-shrink-0 ${
                settings?.supabaseUrl 
                  ? (isOnline ? 'bg-transparent border-emerald-500/30 text-emerald-600 dark:text-emerald-500' : 'bg-transparent border-amber-500/30 text-amber-600 dark:text-amber-500')
                  : 'bg-transparent border-slate-200 dark:border-[#1f2937] text-slate-400 dark:text-slate-600'
              }`}
            >
              <Database className="h-5 w-5" />
            </button>

            <button
              onClick={toggleTheme}
              title={settings?.theme === 'dark' ? "Ubah ke Mode Terang" : "Ubah ke Mode Gelap"}
              className={`p-3 rounded-2xl bg-transparent border transition-all duration-300 flex items-center justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-[#1e293b] active:scale-95 shadow-sm dark:shadow-none flex-shrink-0 ${
                settings?.theme === 'dark' 
                 ? 'border-amber-500/30' 
                 : 'border-indigo-500/30'
              }`}
            >
              {settings?.theme === 'dark' ? (
                <Sun className="h-5 w-5 text-amber-500 transition-transform hover:rotate-90 duration-300" />
              ) : (
                <Moon className="h-5 w-5 text-indigo-500 transition-transform hover:-rotate-12 duration-300" />
              )}
            </button>
          </div>
        </div>
      </header>
      
      {dataLoading && (
        <div className="w-full h-1 bg-indigo-100 dark:bg-slate-800 overflow-hidden relative">
          <div className="h-full bg-indigo-600 w-1/3 rounded-full animate-[loading_1.5s_infinite_ease-in-out]" style={{
            animationName: 'shimmer',
            animationDuration: '1.5s',
            animationIterationCount: 'infinite'
          }} />
        </div>
      )}
      
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 pb-16 space-y-6">
        {!isOnline && settings?.supabaseUrl && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 rounded-2xl flex items-center gap-3 text-xs font-medium">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <strong>Anda sedang offline.</strong> Data ditampilkan dari cache lokal. Sinkronisasi akan otomatis dilakukan saat koneksi tersedia.
            </div>
          </div>
        )}
        
        {dataLoading && (
          <div className="p-4 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-2xl flex items-center gap-3 text-xs border border-slate-200/60 dark:border-slate-800 font-medium font-sans">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
            <span>Sedang memuat pemakaian dan konfigurasi Token.ku Anda...</span>
          </div>
        )}
        
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="outline-none"
          >
            {activeTab === 'dashboard' && (
              <Dashboard 
                mutations={mutations} 
                lowThreshold={settings?.lowThreshold || 15.0} 
                kwhTariff={settings?.kwhTariff || 1444.7} 
                activeTab="dashboard"
              />
            )}
            {activeTab === 'prediction' && (
              <Dashboard 
                mutations={mutations} 
                lowThreshold={settings?.lowThreshold || 15.0} 
                kwhTariff={settings?.kwhTariff || 1444.7} 
                activeTab="prediction"
              />
            )}
            {activeTab === 'input' && (
              <ManualInput 
                lastRecord={lastRecord} 
                onSubmit={handleAddMutation} 
                isLoading={isSaving} 
              />
            )}
            {activeTab === 'history' && (
              <HistoryTable 
                mutations={mutations} 
                onDelete={handleDeleteMutation}
                onCleanDuplicates={handleCleanDuplicates}
                isCleaning={isSaving}
                kwhTariff={settings?.kwhTariff || 1444.7}
              />
            )}
            {activeTab === 'settings' && settings && (
              <SettingsPanel 
                settings={settings} 
                onSave={handleSaveSettings} 
                onSeedSampleData={handleSeedSampleData}
                onMirrorAllToSupabase={handleMirrorAllToSupabase}
                isLoading={isSaving} 
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      
      <footer className="mt-auto py-6 px-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-400 dark:text-slate-500 transition-colors duration-300">
        <div className="max-w-5xl mx-auto flex flex-col items-center justify-center gap-3">
          <p>© {new Date().getFullYear()} Token.ku.</p>
        </div>
      </footer>
      
      <AnimatePresence>
        {showSupabaseErrorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSupabaseErrorModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden max-h-[90vh] flex flex-col z-10"
            >
              <button
                onClick={() => setShowSupabaseErrorModal(false)}
                className="absolute right-4 top-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Tabel <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-rose-600 dark:text-rose-400 font-mono text-sm">token_settings</code> Belum Ada di Supabase!
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Aplikasi berhasil menyimpan konfigurasi <strong>secara lokal di browser Anda</strong>. Namun, sinkronisasi cloud pengaturan gagal karena tabel konfigurasi belum dibuat di Supabase Anda.
                  </p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                <div className="bg-slate-50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <span className="font-bold text-slate-800 dark:text-slate-200">💡 Cara Mengatasi:</span>
                  <p>Buka dashboard <strong>Supabase</strong> Anda, pilih <strong>SQL Editor</strong>, dan jalankan perintah SQL berikut untuk membuat tabel tersebut:</p>
                </div>
                <div className="relative">
                  <pre className="p-3 bg-slate-950 text-slate-200 rounded-xl overflow-x-auto text-[10px] font-mono leading-normal max-h-52 border border-slate-800/80 select-all">
{`-- Buat Tabel Konfigurasi Aplikasi (Settings)
create table if not exists public.token_settings (
  id text primary key,
  telegram_token text,
  telegram_chat_id text,
  low_threshold numeric(10,2) not null default 15.0,
  kwh_tariff numeric(10,2) not null default 1444.7,
  telegram_enabled boolean not null default true,
  theme text not null default 'light',
  supabase_url text,
  supabase_anon_key text
);

-- Aktifkan Row Level Security (RLS) jika dibutuhkan
alter table public.token_settings enable row level security;

-- Buat policy agar Anon Key dapat membaca & menulis data
create policy "Allow all users to read and insert"
on public.token_settings for all
using (true)
with check (true);`}
                  </pre>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`create table if not exists public.token_settings (
  id text primary key,
  telegram_token text,
  telegram_chat_id text,
  low_threshold numeric(10,2) not null default 15.0,
  kwh_tariff numeric(10,2) not null default 1444.7,
  telegram_enabled boolean not null default true,
  theme text not null default 'light',
  supabase_url text,
  supabase_anon_key text
);
alter table public.token_settings enable row level security;
create policy "Allow all users to read and insert"
on public.token_settings for all
using (true)
with check (true);`);
                      alert('Perintah SQL berhasil disalin!');
                    }}
                    className="absolute right-2.5 top-2.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 font-semibold rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="h-3 w-3" />
                    Salin Perintah SQL
                  </button>
                </div>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-end gap-3 shrink-0">
                <button
                  onClick={() => setShowSupabaseErrorModal(false)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-100 dark:shadow-none cursor-pointer"
                >
                  Selesai & Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}