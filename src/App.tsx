import { useState, useEffect, useMemo, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  initAuth, 
  signInWithEmail, 
  signUpWithEmail,
  signInWithGoogle,
  logoutSupabase, 
  getSupabaseClient,
  SupabaseUserMapped
} from './lib/supabaseAuth';
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
  PlusCircle, 
  History, 
  Settings as SettingsIcon, 
  LogOut, 
  ShieldAlert, 
  Loader2, 
  CheckCircle, 
  AlertTriangle, 
  Info,
  Battery,
  AlertOctagon,
  TrendingDown,
  TrendingUp,
  Cloud,
  X,
  Copy,
  Sun,
  Moon,
  Plus
} from 'lucide-react';

// Components
import Dashboard from './components/Dashboard';
import ManualInput from './components/ManualInput';
import HistoryTable from './components/HistoryTable';
import SettingsPanel from './components/SettingsPanel';

export default function App() {
  const [user, setUser] = useState<SupabaseUserMapped | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [isAdminRestricted, setIsAdminRestricted] = useState(false);

  const [mutations, setMutations] = useState<MutationRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings>(() => loadLocalSettings());
  const [showSupabaseErrorModal, setShowSupabaseErrorModal] = useState(false);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'input' | 'prediction' | 'history' | 'settings'>('dashboard');
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // Supabase Custom Login Form States
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [showConfigInput, setShowConfigInput] = useState(false);
  const [tempSupabaseUrl, setTempSupabaseUrl] = useState(() => {
    const s = loadLocalSettings();
    return s.supabaseUrl || (import.meta as any).env.VITE_SUPABASE_URL || '';
  });
  const [tempSupabaseAnonKey, setTempSupabaseAnonKey] = useState(() => {
    const s = loadLocalSettings();
    return s.supabaseAnonKey || (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';
  });

  const isCloudflareProxy = useMemo(() => {
    return window.location.hostname === 'token.haris443.workers.dev' || window.location.hostname.includes('workers.dev');
  }, []);

  const showBanner = (type: 'success' | 'error' | 'warning', message: string) => {
    setBanner({ type, message });
    setTimeout(() => {
      setBanner(prev => prev?.message === message ? null : prev);
    }, 6000);
  };

  const initAuthListener = () => {
    return initAuth(
      async (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        
        // Strictly check if email is admin's
        if (!currentUser.email || currentUser.email.toLowerCase() !== 'haris443@gmail.com') {
          setIsAdminRestricted(true);
          setLoading(false);
          return;
        }

        setIsAdminRestricted(false);
        await loadAppConfigAndData();
        setLoading(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setLoading(false);
      }
    );
  };

  // Check auth state on mount
  useEffect(() => {
    const unsubscribe = initAuthListener();
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  // Synchronize Dark / Light Theme classes on settings update
  useEffect(() => {
    if (settings?.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings?.theme]);

  const loadAppConfigAndData = async () => {
    setDataLoading(true);
    try {
      // Sync Room Database with local storage before reading
      await syncLocalStorageWithRoomDb();
      let loadedSettings = loadLocalSettings();

      // Load remote settings from Supabase if configured
      if (loadedSettings.supabaseUrl && loadedSettings.supabaseAnonKey) {
        try {
          const remoteSettings = await loadSupabaseSettings(loadedSettings.supabaseUrl, loadedSettings.supabaseAnonKey);
          if (remoteSettings) {
            loadedSettings = {
              ...loadedSettings,
              telegramToken: remoteSettings.telegramToken ?? loadedSettings.telegramToken,
              telegramChatId: remoteSettings.telegramChatId ?? loadedSettings.telegramChatId,
              lowThreshold: remoteSettings.lowThreshold !== undefined ? remoteSettings.lowThreshold : loadedSettings.lowThreshold,
              telegramEnabled: remoteSettings.telegramEnabled !== undefined ? remoteSettings.telegramEnabled : loadedSettings.telegramEnabled,
              theme: remoteSettings.theme ?? loadedSettings.theme,
              supabaseUrl: remoteSettings.supabaseUrl || loadedSettings.supabaseUrl,
              supabaseAnonKey: remoteSettings.supabaseAnonKey || loadedSettings.supabaseAnonKey
            };
            saveLocalSettings(loadedSettings);
          }
        } catch (settingsErr) {
          console.warn('Failed to fetch remote settings, using local settings as fallback:', settingsErr);
        }
      }

      setSettings(loadedSettings);

      let localMutations = loadLocalMutations();
      
      // Auto-clean any local duplicates right away
      const uniqueLocal = deduplicateMutations(localMutations);
      if (uniqueLocal.length !== localMutations.length) {
        localStorage.setItem('tokenpro_mutations', JSON.stringify(uniqueLocal));
        localMutations = uniqueLocal;
      }

      if (loadedSettings.supabaseUrl && loadedSettings.supabaseAnonKey) {
        try {
          // Auto-clean any duplicates inside Supabase database on startup
          try {
            await cleanSupabaseDuplicates(loadedSettings.supabaseUrl, loadedSettings.supabaseAnonKey);
          } catch (cleanErr) {
            console.warn('Failed to auto-clean Supabase duplicates on load:', cleanErr);
          }

          // Push any offline-recorded local mutations to Supabase (Auto-Sync)
          if (localMutations.length > 0) {
            try {
              await mirrorAllToSupabase(loadedSettings.supabaseUrl, loadedSettings.supabaseAnonKey, localMutations);
            } catch (syncErr) {
              console.warn('Failed to auto-push local mutations to Supabase on load:', syncErr);
            }
          }

          // Pull latest consolidated mutations from Supabase
          const loadedMutations = await loadSupabaseMutations(loadedSettings.supabaseUrl, loadedSettings.supabaseAnonKey);
          localStorage.setItem('tokenpro_mutations', JSON.stringify(loadedMutations));
          setMutations(loadedMutations);
        } catch (err) {
          console.error('Failed to load mutations from Supabase, falling back to local storage:', err);
          setMutations(localMutations);
          showBanner('warning', 'Supabase tidak terjangkau. Menggunakan data cadangan lokal.');
        }
      } else {
        setMutations(localMutations);
      }
    } catch (err) {
      console.error('Error loading config/data:', err);
      showBanner('error', 'Gagal memuat konfigurasi atau data.');
    } finally {
      setDataLoading(false);
    }
  };

  const handleRefreshDashboard = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await syncLocalStorageWithRoomDb();
      let loadedSettings = loadLocalSettings();

      // Load remote settings from Supabase if configured
      if (loadedSettings.supabaseUrl && loadedSettings.supabaseAnonKey) {
        try {
          const remoteSettings = await loadSupabaseSettings(loadedSettings.supabaseUrl, loadedSettings.supabaseAnonKey);
          if (remoteSettings) {
            loadedSettings = {
              ...loadedSettings,
              telegramToken: remoteSettings.telegramToken ?? loadedSettings.telegramToken,
              telegramChatId: remoteSettings.telegramChatId ?? loadedSettings.telegramChatId,
              lowThreshold: remoteSettings.lowThreshold !== undefined ? remoteSettings.lowThreshold : loadedSettings.lowThreshold,
              telegramEnabled: remoteSettings.telegramEnabled !== undefined ? remoteSettings.telegramEnabled : loadedSettings.telegramEnabled,
              theme: remoteSettings.theme ?? loadedSettings.theme,
              supabaseUrl: remoteSettings.supabaseUrl || loadedSettings.supabaseUrl,
              supabaseAnonKey: remoteSettings.supabaseAnonKey || loadedSettings.supabaseAnonKey
            };
            saveLocalSettings(loadedSettings);
            setSettings(loadedSettings);
          }
        } catch (settingsErr) {
          console.warn('Failed to fetch remote settings during manual refresh:', settingsErr);
        }
      }

      let localMutations = loadLocalMutations();
      
      // Auto-clean any local duplicates
      const uniqueLocal = deduplicateMutations(localMutations);
      if (uniqueLocal.length !== localMutations.length) {
        localStorage.setItem('tokenpro_mutations', JSON.stringify(uniqueLocal));
        localMutations = uniqueLocal;
      }

      if (loadedSettings.supabaseUrl && loadedSettings.supabaseAnonKey) {
        // Auto-clean any duplicates inside Supabase database
        try {
          await cleanSupabaseDuplicates(loadedSettings.supabaseUrl, loadedSettings.supabaseAnonKey);
        } catch (cleanErr) {
          console.warn('Failed to clean Supabase duplicates on manual refresh:', cleanErr);
        }

        // Push offline mutations to Supabase
        if (localMutations.length > 0) {
          try {
            await mirrorAllToSupabase(loadedSettings.supabaseUrl, loadedSettings.supabaseAnonKey, localMutations);
          } catch (syncErr) {
            console.warn('Failed to auto-push local mutations on manual refresh:', syncErr);
          }
        }

        // Pull latest from Supabase
        const loadedMutations = await loadSupabaseMutations(loadedSettings.supabaseUrl, loadedSettings.supabaseAnonKey);
        localStorage.setItem('tokenpro_mutations', JSON.stringify(loadedMutations));
        setMutations(loadedMutations);
        showBanner('success', 'Data berhasil diperbarui dari Supabase!');
      } else {
        setMutations(localMutations);
        showBanner('success', 'Data offline lokal berhasil diperbarui!');
      }
    } catch (err: any) {
      console.error('Error refreshing data:', err);
      showBanner('error', 'Gagal memperbarui data: ' + (err.message || err));
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSaveSupabaseConfigOnLogin = () => {
    if (!tempSupabaseUrl || !tempSupabaseAnonKey) {
      showBanner('error', 'URL dan Anon Key tidak boleh kosong!');
      return;
    }
    const currentSettings = loadLocalSettings();
    const updated = {
      ...currentSettings,
      supabaseUrl: tempSupabaseUrl.trim(),
      supabaseAnonKey: tempSupabaseAnonKey.trim(),
    };
    saveLocalSettings(updated);
    setSettings(updated);
    showBanner('success', 'Koneksi Supabase berhasil disimpan! Silakan lakukan login atau pendaftaran.');
    setShowConfigInput(false);
    
    // Re-initialize listener
    setTimeout(() => {
      initAuthListener();
    }, 100);
  };

  const handleLogin = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!authEmail || !authPassword) {
      showBanner('error', 'Email dan password harus diisi.');
      return;
    }

    setLoading(true);
    try {
      const client = getSupabaseClient();
      if (!client) {
        setShowConfigInput(true);
        throw new Error('Supabase belum terhubung. Konfigurasikan URL & Anon Key di bawah.');
      }

      const result = await signInWithEmail(authEmail.trim(), authPassword);
      setUser(result.user);
      setToken(result.token);
      
      if (!result.user.email || result.user.email.toLowerCase() !== 'haris443@gmail.com') {
        setIsAdminRestricted(true);
        setLoading(false);
        return;
      }

      setIsAdminRestricted(false);
      await loadAppConfigAndData();
      showBanner('success', `Selamat datang kembali, ${result.user.displayName}!`);
    } catch (err: any) {
      console.error('Sign-in failed:', err);
      showBanner('error', err.message || 'Login gagal. Silakan periksa kembali email & password Anda.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!authEmail || !authPassword) {
      showBanner('error', 'Email dan password harus diisi.');
      return;
    }

    if (authPassword.length < 6) {
      showBanner('error', 'Password minimal harus 6 karakter.');
      return;
    }

    setLoading(true);
    try {
      const client = getSupabaseClient();
      if (!client) {
        setShowConfigInput(true);
        throw new Error('Supabase belum terhubung. Konfigurasikan URL & Anon Key di bawah.');
      }

      await signUpWithEmail(authEmail.trim(), authPassword);
      showBanner('success', 'Registrasi sukses! Silakan cek email masuk/spam untuk verifikasi, atau coba masuk.');
      setAuthMode('login');
    } catch (err: any) {
      console.error('Registration failed:', err);
      showBanner('error', err.message || 'Registrasi gagal. Pastikan format email benar.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const client = getSupabaseClient();
      if (!client) {
        setShowConfigInput(true);
        throw new Error('Supabase belum terhubung. Konfigurasikan URL & Anon Key di bawah.');
      }
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      showBanner('error', err.message || 'Gagal login menggunakan Google.');
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logoutSupabase();
      setUser(null);
      setToken(null);
      setMutations([]);
      setSettings(loadLocalSettings());
      setIsAdminRestricted(false);
      setActiveTab('dashboard');
      showBanner('success', 'Anda telah berhasil keluar.');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMutation = async (newRecord: { 
    remainingKwh: number; 
    timestamp: string; 
    notes: string; 
    type: 'consumption' | 'topup' | 'initial' 
  }) => {
    if (!settings) return;
    setIsSaving(true);
    try {
      // Get the latest chronological record to compute accurate relative mutation
      const chronological = [...mutations].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const latestRecord = chronological.length > 0 ? chronological[chronological.length - 1] : null;

      let mutation = 0;
      let finalType = newRecord.type;

      if (latestRecord) {
        mutation = newRecord.remainingKwh - latestRecord.remainingKwh;
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

      // Save to local storage first as primary log
      const updatedLocal = saveLocalMutation(recordToSave);

      // Save to Supabase if configured
      if (settings.supabaseUrl && settings.supabaseAnonKey) {
        try {
          await saveSupabaseMutation(settings.supabaseUrl, settings.supabaseAnonKey, recordToSave);
          // Load updated from Supabase
          const updated = await loadSupabaseMutations(settings.supabaseUrl, settings.supabaseAnonKey);
          setMutations(updated);
          showBanner('success', 'Pencatatan sisa kWh berhasil disimpan di Supabase Cloud.');
        } catch (sbErr) {
          console.error('Failed to save to Supabase, using local fallback:', sbErr);
          setMutations(updatedLocal);
          showBanner('warning', 'Gagal menyimpan ke Supabase Cloud. Disimpan di penyimpanan lokal saja.');
        }
      } else {
        setMutations(updatedLocal);
        showBanner('success', 'Pencatatan sisa kWh berhasil disimpan di penyimpanan lokal.');
      }

      // Telegram alerting triggers
      if (newRecord.remainingKwh <= settings.lowThreshold && settings.telegramEnabled) {
        const formattedDate = new Date(newRecord.timestamp).toLocaleString('id-ID', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });
        const alertMsg = `⚠️ *TokenPro - Sisa kWh Rendah!* ⚠️\n\nSisa kWh listrik pada meteran Anda telah mencapai ambang batas rendah!\n\n🔋 *Sisa kWh:* ${newRecord.remainingKwh.toFixed(2)} kWh\n📉 *Ambang Batas:* ${settings.lowThreshold.toFixed(2)} kWh\n⏰ *Waktu:* ${formattedDate}\n\n📝 *Catatan:* ${newRecord.notes || '-'}\n\nSegera lakukan pengisian token agar terhindar dari pemadaman.`;
        
        const telSuccess = await sendTelegramNotification(settings.telegramToken, settings.telegramChatId, alertMsg);
        if (telSuccess) {
          showBanner('warning', 'Peringatan terkirim! Saldo rendah, alarm telah dikirim ke Telegram.');
        } else {
          showBanner('error', 'Pencatatan disimpan, namun notifikasi Telegram gagal terkirim.');
        }
      }

      setActiveTab('dashboard');
    } catch (err) {
      console.error('Error saving record:', err);
      showBanner('error', 'Gagal menyimpan pencatatan.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMutation = async (id: string) => {
    if (!settings) return;
    setIsSaving(true);

    const recordToDelete = mutations.find(m => m.id && String(m.id) === String(id));

    try {
      // Delete from local storage by id
      const updatedLocal = deleteLocalMutation(id);

      // Delete from Supabase if configured
      if (recordToDelete && settings.supabaseUrl && settings.supabaseAnonKey) {
        try {
          await deleteSupabaseMutation(settings.supabaseUrl, settings.supabaseAnonKey, recordToDelete.timestamp);
          // Reload from Supabase
          const updated = await loadSupabaseMutations(settings.supabaseUrl, settings.supabaseAnonKey);
          setMutations(updated);
          showBanner('success', 'Pencatatan sisa kWh berhasil dihapus dari Supabase Cloud.');
        } catch (sbErr) {
          console.error('Failed to delete from Supabase, applying local fallback deletion:', sbErr);
          setMutations(updatedLocal);
          showBanner('warning', 'Gagal menghapus dari Supabase Cloud. Dihapus dari penyimpanan lokal saja.');
        }
      } else {
        setMutations(updatedLocal);
        showBanner('success', 'Pencatatan sisa kWh berhasil dihapus dari penyimpanan lokal.');
      }
    } catch (err) {
      console.error('Error deleting record:', err);
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

       // Reload mutations based on new config and auto-mirror existing data
       if (newSettings.supabaseUrl && newSettings.supabaseAnonKey) {
         (window as any).__missingTable = false;
         try {
           // Try saving settings to Supabase
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
           // Auto-mirror any existing local data into Supabase
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
      // 1. Clean Supabase duplicates if configured
      if (settings.supabaseUrl && settings.supabaseAnonKey) {
        try {
          const res = await cleanSupabaseDuplicates(settings.supabaseUrl, settings.supabaseAnonKey);
          sbCleaned = res.cleanedCount;
        } catch (sbErr) {
          console.error('Failed to clean duplicates from Supabase:', sbErr);
        }
      }

      // 2. Clean local storage duplicates
      const localMutations = loadLocalMutations();
      const uniqueLocal = deduplicateMutations(localMutations);
      localStorage.setItem('tokenpro_mutations', JSON.stringify(uniqueLocal));

      // 3. Reload everything
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

  // Get the absolute latest record by sorting dates descending
  const lastRecord = useMemo(() => {
    if (mutations.length === 0) return null;
    return [...mutations].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }, [mutations]);

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-800">
        <Loader2 className="h-10 w-10 text-indigo-600 animate-spin mb-4" />
        <h2 className="text-lg font-bold font-display tracking-wide">Memuat TokenPro...</h2>
        <p className="text-xs text-slate-400 mt-1">Menginisialisasi sistem keamanan & koneksi cloud</p>
      </div>
    );
  }

  // Access Denied Restricted Admin Screen
  if (isAdminRestricted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-800">
        <div className="max-w-md w-full bg-white border border-rose-100 rounded-2xl shadow-xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <ShieldAlert className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold font-display tracking-tight text-slate-900">Akses Ditolak (Locked)</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Sistem autentikasi TokenPro dikunci khusus hanya untuk akun admin pribadi pemilik aplikasi. Anda masuk dengan email:
            </p>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-mono text-xs font-semibold text-slate-700">
              {user?.email}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <LogOut className="h-4 w-4" />
            <span>Keluar & Ganti Akun</span>
          </button>
        </div>
      </div>
    );
  }

  // Sign In / Sign Up Screen (Supabase Auth)
  if (!user || !token) {
    const isSupabaseConfigured = !!getSupabaseClient();
    
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-800 dark:text-slate-100 transition-colors duration-300">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
          {/* Header design decoration */}
          <div className="bg-indigo-600 p-8 text-white text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-indigo-800 opacity-90" />
            <div className="relative z-10 space-y-2">
              <div className="h-12 w-12 bg-white/10 rounded-2xl flex items-center justify-center mx-auto backdrop-blur-md">
                <Battery className="h-7 w-7 text-white" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight font-display">TokenPro</h1>
              <p className="text-xs text-indigo-100 uppercase tracking-widest font-semibold">Autentikasi Supabase Cloud</p>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Custom Mode Tabs */}
            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200/50 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  authMode === 'login'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  authMode === 'register'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Daftar Baru
              </button>
            </div>

            {/* Error or Warning if Supabase is not configured */}
            {!isSupabaseConfigured && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900 text-amber-800 dark:text-amber-200 rounded-2xl text-xs space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                  <span className="font-bold">Supabase belum terhubung!</span>
                </div>
                <p className="leading-relaxed">Silakan masukkan URL & Anon Key di bagian "Konfigurasi Supabase" di bawah terlebih dahulu agar sistem registrasi dan login dapat berfungsi.</p>
              </div>
            )}

            {/* Main Auth Form */}
            <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Alamat Email</label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950/30 text-sm outline-none transition-all placeholder:text-slate-400 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950/30 text-sm outline-none transition-all placeholder:text-slate-400 dark:text-slate-200"
                />
                {authMode === 'register' && (
                  <span className="text-[10px] text-slate-400 mt-1 block">Minimal 6 karakter</span>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold tracking-wider uppercase transition-all shadow-md shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : authMode === 'login' ? (
                  'Masuk Sekarang'
                ) : (
                  'Daftar Akun Baru'
                )}
              </button>
            </form>

            {/* Collapsible Supabase Configuration */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setShowConfigInput(!showConfigInput)}
                className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer py-1"
              >
                <span className="flex items-center gap-1.5">
                  <SettingsIcon className="h-4 w-4" />
                  Konfigurasi URL & Anon Key Supabase
                </span>
                <span>{showConfigInput ? '▲ Sembunyikan' : '▼ Tampilkan'}</span>
              </button>

              {showConfigInput && (
                <div className="mt-4 space-y-4 p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-100 dark:border-slate-850">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Supabase URL</label>
                      <input
                        type="url"
                        value={tempSupabaseUrl}
                        onChange={(e) => setTempSupabaseUrl(e.target.value)}
                        placeholder="https://xxxxxx.supabase.co"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs outline-none focus:border-indigo-500 placeholder:text-slate-450 text-slate-700 dark:text-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Supabase Anon Key</label>
                      <textarea
                        rows={2}
                        value={tempSupabaseAnonKey}
                        onChange={(e) => setTempSupabaseAnonKey(e.target.value)}
                        placeholder="eyJhbGciOi..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs outline-none focus:border-indigo-500 placeholder:text-slate-450 text-slate-700 dark:text-slate-300 font-mono resize-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveSupabaseConfigOnLogin}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Simpan Koneksi Supabase
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    );
  }

  // Active Main Panel View
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300">
      
      {/* Dynamic Toast Banners */}
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

      {/* Main Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 py-4 px-6 sticky top-0 z-30 shadow-xs transition-colors duration-300">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-sm shadow-indigo-200 dark:shadow-none">
              <Battery className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight font-display text-slate-950 dark:text-white flex items-center gap-1.5 flex-wrap">
                TokenPro
                <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded-md uppercase tracking-wider">H</span>
                {isCloudflareProxy && (
                  <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-1.5 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1 border border-orange-200/40 dark:border-orange-900/40">
                    <Cloud className="h-3.5 w-3.5 text-orange-500 animate-pulse" />
                    Cloudflare Active
                  </span>
                )}
              </h1>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium tracking-wide flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Supabase</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              title={settings?.theme === 'dark' ? "Ubah ke Mode Terang" : "Ubah ke Mode Gelap"}
              className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 dark:hover:text-amber-400 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center active:scale-95"
            >
              {settings?.theme === 'dark' ? (
                <Sun className="h-5 w-5 text-amber-500 transition-transform hover:rotate-45 duration-300" />
              ) : (
                <Moon className="h-5 w-5 text-indigo-500 transition-transform hover:-rotate-12 duration-300" />
              )}
            </button>

            <button
              onClick={handleLogout}
              title="Keluar dari akun"
              className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Data loading progress bar */}
      {dataLoading && (
        <div className="w-full h-1 bg-indigo-100 dark:bg-slate-800 overflow-hidden relative">
          <div className="h-full bg-indigo-600 w-1/3 rounded-full animate-[loading_1.5s_infinite_ease-in-out]" style={{
            animationName: 'shimmer',
            animationDuration: '1.5s',
            animationIterationCount: 'infinite'
          }} />
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 pb-16 space-y-6">
        
        {/* Sync notification block if loading */}
        {dataLoading && (
          <div className="p-4 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-2xl flex items-center gap-3 text-xs border border-slate-200/60 dark:border-slate-800 font-medium font-sans">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
            <span>Sedang memuat pemakaian dan konfigurasi TokenPro Anda...</span>
          </div>
        )}

        {/* Floating Top Tab Bar */}
        {!dataLoading && (
          <div className="sticky top-20 z-40 w-full max-w-xs sm:max-w-md mx-auto my-2">
            <div className="flex items-center justify-around gap-1 p-1.5 bg-slate-100/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/60 rounded-[22px] shadow-lg shadow-slate-900/5 dark:shadow-black/30">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex-1 flex items-center justify-center py-3 px-4 rounded-[16px] transition-all duration-200 active:scale-95 cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                }`}
                title="Dashboard"
              >
                <LayoutDashboard className="h-5 w-5 shrink-0" />
              </button>
              <button
                onClick={() => setActiveTab('input')}
                className={`flex-1 flex items-center justify-center py-3 px-4 rounded-[16px] transition-all duration-200 active:scale-95 cursor-pointer ${
                  activeTab === 'input'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                }`}
                title="Input"
              >
                <Plus className="h-5 w-5 shrink-0" />
              </button>
              <button
                onClick={() => setActiveTab('prediction')}
                className={`flex-1 flex items-center justify-center py-3 px-4 rounded-[16px] transition-all duration-200 active:scale-95 cursor-pointer ${
                  activeTab === 'prediction'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                }`}
                title="Prediksi"
              >
                <TrendingUp className="h-5 w-5 shrink-0" />
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 flex items-center justify-center py-3 px-4 rounded-[16px] transition-all duration-200 active:scale-95 cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                }`}
                title="Riwayat"
              >
                <History className="h-5 w-5 shrink-0" />
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex-1 flex items-center justify-center py-3 px-4 rounded-[16px] transition-all duration-200 active:scale-95 cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                }`}
                title="Seting"
              >
                <SettingsIcon className="h-5 w-5 shrink-0" />
              </button>
            </div>
          </div>
        )}

        {/* Inner Content Area */}
        <AnimatePresence mode="wait">
          {!dataLoading && (
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
                  onRefresh={handleRefreshDashboard}
                  isRefreshing={isRefreshing}
                />
              )}

              {activeTab === 'prediction' && (
                <Dashboard 
                  mutations={mutations} 
                  lowThreshold={settings?.lowThreshold || 15.0} 
                  kwhTariff={settings?.kwhTariff || 1444.7} 
                  activeTab="prediction"
                  onRefresh={handleRefreshDashboard}
                  isRefreshing={isRefreshing}
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
          )}
        </AnimatePresence>
      </main>

      {/* Styled Footer */}
      <footer className="mt-auto py-6 px-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-400 dark:text-slate-500 transition-colors duration-300">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} TokenPro.</p>
          <div className="flex items-center gap-4">
            {settings?.supabaseUrl ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Supabase Cloud
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-500 font-semibold flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Mode Lokal (Offline)
              </span>
            )}
          </div>
        </div>
      </footer>

      {/* Modern Modal for missing Supabase token_settings table */}
      <AnimatePresence>
        {showSupabaseErrorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSupabaseErrorModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
            />
            
            {/* Dialog Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden max-h-[90vh] flex flex-col z-10"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowSupabaseErrorModal(false)}
                className="absolute right-4 top-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Header */}
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

              {/* Instructions & Code area */}
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

              {/* Footer */}
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
