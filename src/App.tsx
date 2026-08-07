import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { sendTelegramNotification } from './lib/telegram';
import { AppSettings } from './types';
import { useAppStore } from './store/useAppStore';
import { useTokenMutations, useAddMutation, useDeleteMutation } from './hooks/useMutations';

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

// Lazy loaded components (Optimasi Performa)
const Dashboard = lazy(() => import('./components/Dashboard'));
const ManualInput = lazy(() => import('./components/ManualInput'));
const HistoryTable = lazy(() => import('./components/HistoryTable'));
const SettingsPanel = lazy(() => import('./components/SettingsPanel'));

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
  
  // Menggunakan Zustand untuk pengaturan dan state activeTab
  const { settings, setSettings, activeTab, setActiveTab } = useAppStore();
  
  // Menggunakan React Query untuk fetch data dari RxDB
  const { data: mutations = [], isLoading: mutationsLoading } = useTokenMutations();
  const addMutation = useAddMutation();
  const deleteMutation = useDeleteMutation();
  
  const [showSupabaseErrorModal, setShowSupabaseErrorModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  const isCloudflareProxy = useMemo(() => {
    return window.location.hostname === 'token.haris443.workers.dev' || window.location.hostname.includes('workers.dev');
  }, []);

  const isOnline = useOnlineStatus();
  const bannerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showBanner = (type: 'success' | 'error' | 'warning', message: string) => {
    setBanner({ type, message });
    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    bannerTimeoutRef.current = setTimeout(() => {
      setBanner(prev => prev?.message === message ? null : prev);
      bannerTimeoutRef.current = null;
    }, 6000);
  };

  useEffect(() => {
    return () => {
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const initialize = async () => {
      try {
        // Jalankan migrasi data dari localStorage ke RxDB jika ada
        const { migrateFromLocalStorage } = await import('./lib/database/migrate');
        await migrateFromLocalStorage();

        if (!settings.supabaseUrl || !settings.supabaseAnonKey) {
          setActiveTab('settings');
        }
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setLoading(false);
      }
    };
    initialize();
  }, [settings.supabaseUrl, settings.supabaseAnonKey, setActiveTab]);

  const handleAddMutation = async (newRecord: { remainingKwh: number; timestamp: string; notes: string; type: 'consumption' | 'topup' | 'initial' }) => {
    setIsSaving(true);
    try {
      const newTimestamp = new Date(newRecord.timestamp).getTime();
      const chronological = [...mutations].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      const prevRecord = chronological.filter(r => new Date(r.timestamp).getTime() < newTimestamp).pop() ?? null;
      
      let mutationAmount = 0;
      let finalType = newRecord.type;
      
      if (prevRecord) {
        mutationAmount = newRecord.remainingKwh - prevRecord.remainingKwh;
        finalType = mutationAmount >= 0 ? 'topup' : 'consumption';
      } else {
        finalType = 'initial';
      }
      
      const recordToSave = {
        timestamp: newRecord.timestamp,
        remainingKwh: newRecord.remainingKwh,
        mutation: mutationAmount,
        type: finalType,
        notes: newRecord.notes,
      };
      
      // Simpan menggunakan hook React Query (menyimpan ke RxDB)
      await addMutation.mutateAsync(recordToSave);
      showBanner('success', 'Pencatatan berhasil disimpan secara lokal (Offline-First).');
      
      // Notifikasi Telegram
      if (settings.telegramEnabled && newRecord.remainingKwh <= settings.lowThreshold) {
        const formattedDate = new Date(newRecord.timestamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
        const alertMsg = `⚠️ *Token.ku - Sisa kWh Rendah!* ⚠️\n\n🔋 *Sisa kWh:* ${newRecord.remainingKwh.toFixed(2)} kWh\n📉 *Ambang Batas:* ${settings.lowThreshold.toFixed(2)} kWh\n⏰ *Waktu:* ${formattedDate}\n\n📝 *Catatan:* ${newRecord.notes || '-'}\n\nSegera lakukan pengisian token.`;
        
        const telSuccess = await sendTelegramNotification(settings.telegramToken, settings.telegramChatId, alertMsg);
        if (telSuccess) showBanner('warning', 'Peringatan saldo rendah terkirim ke Telegram.');
      }
      setActiveTab('dashboard');
    } catch (err) {
      console.error(err);
      showBanner('error', 'Gagal menyimpan pencatatan.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMutation = async (id: string) => {
    setIsSaving(true);
    try {
      await deleteMutation.mutateAsync(id);
      showBanner('success', 'Pencatatan berhasil dihapus.');
    } catch (err) {
      console.error(err);
      showBanner('error', 'Gagal menghapus data.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCleanDuplicates = async () => {
    // Dengan arsitektur RxDB, duplicate clean harus dilakukan di level query database
    showBanner('warning', 'Fitur clean duplicates sedang dinonaktifkan dalam arsitektur baru.');
  };

  const toggleTheme = () => {
    useAppStore.getState().toggleTheme();
  };

  const handleAutoSaveLocal = (newSettings: AppSettings) => {
    setSettings(newSettings);
  };

  const handleSaveSettings = async (newSettings: AppSettings, silent: boolean = false) => {
    setIsSaving(true);
    try {
      setSettings(newSettings);
      if (!silent) showBanner('success', 'Konfigurasi berhasil disimpan.');
      
      // Setup Supabase Replication via RxDB jika dikonfigurasi
      if (newSettings.supabaseUrl && newSettings.supabaseAnonKey) {
         const { getDatabase, setupSupabaseReplication } = await import('./lib/database/rxdb');
         const db = await getDatabase();
         await setupSupabaseReplication(db, newSettings.supabaseUrl, newSettings.supabaseAnonKey);
         if (!silent) showBanner('success', 'Replikasi cloud (Supabase) berhasil diaktifkan.');
      }
    } catch (err) {
      console.error(err);
      if (!silent) showBanner('error', 'Gagal menyimpan konfigurasi.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMirrorAllToSupabase = async () => {
    return { successCount: 0, failedCount: 0 }; // Diurus oleh RxDB Replication
  };

  const handleSeedSampleData = async () => {
    // Seed logika perlu disesuaikan dengan RxDB
    showBanner('warning', 'Fitur seed data belum tersedia di arsitektur RxDB.');
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
        <p className="text-xs text-slate-400 mt-1">Menginisialisasi arsitektur baru...</p>
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
      
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800/80 sticky top-0 z-40 py-3.5 px-4 sm:px-6 transition-colors duration-300">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3.5">
          {/* Logo & Status Badge */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center shadow-md shadow-amber-500/20">
              <Zap className="h-5 w-5 text-white fill-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-black tracking-tight font-display text-slate-900 dark:text-white flex items-center gap-2">
                Token.ku
                {isCloudflareProxy && (
                  <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-1.5 py-0.5 rounded-md capitalize tracking-wider flex items-center gap-1 border border-orange-200/40 dark:border-orange-900/40">
                    <Cloud className="h-3 w-3 text-orange-500" />
                    CF
                  </span>
                )}
              </h1>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Monitoring kWh Listrik
              </span>
            </div>
          </div>

          {/* Controls (Database status + Theme Toggle) */}
          <div className="flex items-center gap-2">
            <div
              title={isOnline ? (settings?.supabaseUrl ? 'Cloud Connected' : 'Lokal Mode') : 'Offline'}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border flex items-center gap-1.5 ${
                settings?.supabaseUrl 
                  ? (isOnline ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-300')
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              <span>{settings?.supabaseUrl ? (isOnline ? 'Cloud' : 'Offline') : 'Lokal'}</span>
            </div>

            <button
              onClick={toggleTheme}
              title={settings?.theme === 'dark' ? "Ubah ke Mode Terang" : "Ubah ke Mode Gelap"}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              {settings?.theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-600" />
              )}
            </button>
          </div>
        </div>
      </header>
      
      {mutationsLoading && (
        <div className="w-full h-1 bg-indigo-100 dark:bg-slate-800 overflow-hidden relative">
          <div className="h-full bg-indigo-600 w-1/3 rounded-full animate-[loading_1.5s_infinite_ease-in-out]" style={{
            animationName: 'shimmer',
            animationDuration: '1.5s',
            animationIterationCount: 'infinite'
          }} />
        </div>
      )}
      
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 pb-24 space-y-6">
        {!isOnline && settings?.supabaseUrl && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 rounded-2xl flex items-center gap-3 text-xs font-medium">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <strong>Anda sedang offline.</strong> Data ditampilkan dari cache lokal. Sinkronisasi akan otomatis dilakukan saat koneksi tersedia.
            </div>
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
            <Suspense fallback={
              <div className="flex justify-center p-10">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              </div>
            }>
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
                  onAutoSaveLocal={handleAutoSaveLocal} 
                  onSeedSampleData={handleSeedSampleData}
                  onMirrorAllToSupabase={handleMirrorAllToSupabase}
                  isLoading={isSaving} 
                />
              )}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
      
      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 py-2.5 px-4 transition-colors duration-300">
        <div className="max-w-md mx-auto flex items-center justify-around gap-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            title="Dashboard"
            className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
              activeTab === 'dashboard'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
          </button>

          <button
            onClick={() => setActiveTab('prediction')}
            title="Prediksi"
            className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
              activeTab === 'prediction'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <TrendingUp className="h-5 w-5" />
          </button>

          <button
            onClick={() => setActiveTab('input')}
            title="Catat kWh"
            className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
              activeTab === 'input'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Plus className="h-5 w-5" />
          </button>

          <button
            onClick={() => setActiveTab('history')}
            title="Riwayat"
            className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <History className="h-5 w-5" />
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            title="Pengaturan"
            className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
              activeTab === 'settings'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <SettingsIcon className="h-5 w-5" />
          </button>
        </div>
      </nav>
      
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