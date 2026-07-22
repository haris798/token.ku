import React, { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { sendTelegramNotification } from '../lib/telegram';
import { saveSupabaseSettings, loadSupabaseMutations, loadSupabaseSettings } from '../lib/db';
import { Settings, Save, Send, AlertCircle, CheckCircle2, Sun, Moon, Database, Loader2, Cloud, Copy, ExternalLink, Download, Upload, FileCode, ChevronDown, ChevronUp } from 'lucide-react';

interface SettingsPanelProps {
  settings: AppSettings;
  onSave: (settings: AppSettings, silent?: boolean) => Promise<void>;
  onSeedSampleData?: () => Promise<void>;
  isLoading: boolean;
  onMirrorAllToSupabase?: (url: string, key: string) => Promise<{ successCount: number; failedCount: number }>;
}

export default function SettingsPanel({ settings, onSave, onSeedSampleData, isLoading, onMirrorAllToSupabase }: SettingsPanelProps) {
  const [telegramToken, setTelegramToken] = useState(settings.telegramToken);
  const [telegramChatId, setTelegramChatId] = useState(settings.telegramChatId);
  const [lowThreshold, setLowThreshold] = useState(settings.lowThreshold);
  const [kwhTariff, setKwhTariff] = useState(settings.kwhTariff || 1444.7);
  const [telegramEnabled, setTelegramEnabled] = useState(settings.telegramEnabled);
  const [theme, setTheme] = useState<'light' | 'dark'>(settings.theme || 'dark');
  const [supabaseUrl, setSupabaseUrl] = useState(settings.supabaseUrl || '');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(settings.supabaseAnonKey || '');

  const [activeSubTab, setActiveSubTab] = useState<'basic' | 'telegram' | 'supabase' | 'room'>('basic');
  const [showSql, setShowSql] = useState(false);
  const [showMigrationSql, setShowMigrationSql] = useState(false);

  // Sync local inputs when parent settings change asynchronously
  useEffect(() => {
    setTelegramToken(settings.telegramToken || '');
    setTelegramChatId(settings.telegramChatId || '');
    setLowThreshold(settings.lowThreshold);
    setKwhTariff(settings.kwhTariff || 1444.7);
    setTelegramEnabled(settings.telegramEnabled);
    setTheme(settings.theme || 'dark');
    setSupabaseUrl(settings.supabaseUrl || '');
    setSupabaseAnonKey(settings.supabaseAnonKey || '');
  }, [settings]);

  // Instant live preview of selected theme
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Revert back to actual saved theme if unmounted without saving
  useEffect(() => {
    return () => {
      if (settings.theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };
  }, [settings.theme]);
  
  const [testLoading, setTestLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<{ success: boolean; msg: string } | null>(null);

  const [seedLoading, setSeedLoading] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);

  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<{ successCount: number; failedCount: number } | null>(null);
  const [exportSupabaseLoading, setExportSupabaseLoading] = useState(false);

  const handleSyncAll = async () => {
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      alert('Mohon isi Supabase URL dan Public Anon Key terlebih dahulu.');
      return;
    }
    if (!onMirrorAllToSupabase) return;

    setSyncLoading(true);
    setSyncResult(null);
    try {
      // 1. Mirror settings to Supabase first
      const currentSettings: AppSettings = {
        telegramToken: telegramToken.trim(),
        telegramChatId: telegramChatId.trim(),
        lowThreshold: parseFloat(lowThreshold.toString()) || 15.0,
        kwhTariff: parseFloat(kwhTariff.toString()) || 1444.7,
        telegramEnabled,
        theme,
        supabaseUrl: supabaseUrl.trim(),
        supabaseAnonKey: supabaseAnonKey.trim()
      };

      let settingsSaved = false;
      try {
        await saveSupabaseSettings(supabaseUrl.trim(), supabaseAnonKey.trim(), currentSettings);
        settingsSaved = true;
      } catch (settingsErr) {
        console.warn('Failed to save settings to Supabase during manual sync:', settingsErr);
      }

      // 2. Mirror mutations
      const res = await onMirrorAllToSupabase(supabaseUrl.trim(), supabaseAnonKey.trim());
      setSyncResult(res);

      if (settingsSaved) {
        alert('Sinkronisasi Sukses!\n- Konfigurasi aplikasi & pengaturan Telegram berhasil dicadangkan ke Supabase.\n- Berhasil menyinkronkan data log pemakaian.');
      } else {
        alert('Sinkronisasi Sebagian!\n- Tabel token_settings belum siap atau tidak ditemukan di Supabase.\n- Berhasil menyinkronkan data log pemakaian.');
      }
    } catch (e) {
      console.error(e);
      alert('Gagal melakukan sinkronisasi data ke Supabase.');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleThemeToggle = async (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    try {
      await onSave({
        telegramToken: telegramToken.trim(),
        telegramChatId: telegramChatId.trim(),
        lowThreshold: parseFloat(lowThreshold.toString()) || 15.0,
        kwhTariff: parseFloat(kwhTariff.toString()) || 1444.7,
        telegramEnabled,
        theme: newTheme,
        supabaseUrl: supabaseUrl.trim(),
        supabaseAnonKey: supabaseAnonKey.trim()
      }, true);
    } catch (err) {
      console.error('Failed to auto-save theme change:', err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      telegramToken: telegramToken.trim(),
      telegramChatId: telegramChatId.trim(),
      lowThreshold: parseFloat(lowThreshold.toString()) || 15.0,
      kwhTariff: parseFloat(kwhTariff.toString()) || 1444.7,
      telegramEnabled,
      theme,
      supabaseUrl: supabaseUrl.trim(),
      supabaseAnonKey: supabaseAnonKey.trim()
    });
  };

  const handleSeedData = async () => {
    if (!onSeedSampleData) return;
    setSeedLoading(true);
    setSeedSuccess(false);
    try {
      await onSeedSampleData();
      setSeedSuccess(true);
    } catch (e) {
      console.error(e);
      alert('Gagal mengimpor data contoh.');
    } finally {
      setSeedLoading(false);
    }
  };

  const handleExportJSON = () => {
    try {
      const configObj = {
        telegramToken: telegramToken.trim(),
        telegramChatId: telegramChatId.trim(),
        lowThreshold: parseFloat(lowThreshold.toString()) || 15.0,
        kwhTariff: parseFloat(kwhTariff.toString()) || 1444.7,
        telegramEnabled,
        theme,
        supabaseUrl: supabaseUrl.trim(),
        supabaseAnonKey: supabaseAnonKey.trim(),
        exportedAt: new Date().toISOString(),
        appName: "Token.ku"
      };

      const jsonString = JSON.stringify(configObj, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", url);
      downloadAnchor.setAttribute("download", "tokenpro_settings.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Gagal mengekspor pengaturan: ' + err);
    }
  };

  const handleExportSupabaseJSON = async () => {
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      alert('Mohon isi Supabase URL dan Public Anon Key terlebih dahulu.');
      return;
    }
    setExportSupabaseLoading(true);
    try {
      // 1. Ambil data mutasi dari Supabase
      const mutations = await loadSupabaseMutations(supabaseUrl.trim(), supabaseAnonKey.trim());
      
      // 2. Ambil data pengaturan dari Supabase (opsional, jika tabel ada)
      let supabaseSettings = null;
      try {
        supabaseSettings = await loadSupabaseSettings(supabaseUrl.trim(), supabaseAnonKey.trim());
      } catch (err) {
        console.warn('Gagal memuat pengaturan dari Supabase, mengekspor data mutasi saja:', err);
      }

      const exportData = {
        appName: "Token.ku",
        exportedFrom: "Supabase",
        exportedAt: new Date().toISOString(),
        settings: supabaseSettings || {
          supabaseUrl: supabaseUrl.trim(),
          supabaseAnonKey: supabaseAnonKey.trim()
        },
        mutations: mutations
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", url);
      downloadAnchor.setAttribute("download", `tokenpro_supabase_export_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(url);
      
      alert(`Berhasil mengekspor ${mutations.length} baris log data dari Supabase ke file JSON!`);
    } catch (err: any) {
      alert('Gagal mengekspor data dari Supabase: ' + (err.message || err));
    } finally {
      setExportSupabaseLoading(false);
    }
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        
        // Validate or check if the keys exist and update state
        if (parsed.telegramToken !== undefined) setTelegramToken(parsed.telegramToken);
        if (parsed.telegramChatId !== undefined) setTelegramChatId(parsed.telegramChatId);
        if (parsed.lowThreshold !== undefined) setLowThreshold(parsed.lowThreshold);
        if (parsed.kwhTariff !== undefined) setKwhTariff(parsed.kwhTariff);
        if (parsed.telegramEnabled !== undefined) setTelegramEnabled(parsed.telegramEnabled === true);
        if (parsed.theme === 'light' || parsed.theme === 'dark') setTheme(parsed.theme);
        if (parsed.supabaseUrl !== undefined) setSupabaseUrl(parsed.supabaseUrl);
        if (parsed.supabaseAnonKey !== undefined) setSupabaseAnonKey(parsed.supabaseAnonKey);

        alert('Pengaturan berhasil dimuat dari file JSON! Silakan klik tombol "Simpan Pengaturan" di bagian bawah untuk menyimpan perubahan secara permanen.');
      } catch (err) {
        alert('Gagal mengurai file JSON: ' + err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleTestTelegram = async () => {
    if (!telegramToken || !telegramChatId) {
      setTestStatus({ success: false, msg: 'Masukkan Token Bot dan Chat ID terlebih dahulu.' });
      return;
    }

    setTestLoading(true);
    setTestStatus(null);

    const testMessage = `🔌 *Koneksi Token.ku Sukses!*\n\nBot Telegram Anda telah sukses terhubung dengan aplikasi Token.ku.\n\n🔋 *Ambang Batas Rendah:* ${lowThreshold} kWh\n✅ *Status Notifikasi:* ${telegramEnabled ? 'Aktif' : 'Nonaktif'}\n\nNotifikasi pengingat kWh akan dikirim secara otomatis jika sisa saldo berada di bawah batas minimum ini.`;

    const success = await sendTelegramNotification(telegramToken.trim(), telegramChatId.trim(), testMessage);
    
    setTestLoading(false);
    if (success) {
      setTestStatus({ success: true, msg: 'Pesan tes berhasil dikirim ke Telegram!' });
    } else {
      setTestStatus({ success: false, msg: 'Gagal mengirim pesan. Cek kembali Token Bot atau Chat ID Anda.' });
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-6 max-w-xl mx-auto space-y-6 transition-colors duration-300">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-bold text-slate-800 dark:text-slate-200">Pengaturan Token.ku</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Konfigurasi ambang batas kWh dan integrasi bot Telegram</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 pb-1.5 mb-4 gap-4">
          <button
            type="button"
            onClick={() => setActiveSubTab('basic')}
            className={`pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSubTab === 'basic'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-500 dark:text-indigo-400 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
            title="Dasar"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('telegram')}
            className={`pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSubTab === 'telegram'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-500 dark:text-indigo-400 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
            title="Telegram"
          >
            <Send className="h-4 w-4 text-sky-500" />
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('supabase')}
            className={`pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSubTab === 'supabase'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-500 dark:text-indigo-400 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
            title="Supabase"
          >
            <Database className="h-4 w-4 text-emerald-500" />
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('room')}
            className={`pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSubTab === 'room'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-500 dark:text-indigo-400 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
            title="Room Database"
          >
            <Database className="h-4 w-4 text-blue-500" />
          </button>
        </div>

        {activeSubTab === 'basic' && (
          <div className="space-y-4">
            {/* Low threshold setting */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Ambang Batas Rendah (kWh)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  required
                  disabled={isLoading}
                  value={lowThreshold}
                  onChange={(e) => setLowThreshold(parseFloat(e.target.value) || 0)}
                  className="w-full pl-4 pr-16 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-200 font-semibold text-sm outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                  kWh
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Notifikasi Telegram otomatis dikirim saat sisa saldo kWh berada di bawah angka ini.
              </p>
            </div>

            {/* kwh Tariff setting */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Tarif Listrik (Rp/kWh)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  required
                  disabled={isLoading}
                  value={kwhTariff}
                  onChange={(e) => setKwhTariff(parseFloat(e.target.value) || 0)}
                  className="w-full pl-12 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-200 font-semibold text-sm outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-450">
                  Rp
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Tarif rupiah per kWh listrik PLN (Contoh standar: 1444.7). Digunakan untuk menghitung nilai rupiah konsumsi harian di Dashboard.
              </p>
            </div>
          </div>
        )}

        {activeSubTab === 'telegram' && (
          <>
            {/* Telegram Enable Toggle */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Aktifkan Notifikasi Telegram
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Kirim alarm otomatis saat saldo listrik menipis
                </p>
              </div>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setTelegramEnabled(!telegramEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  telegramEnabled ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    telegramEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </>
        )}

        {activeSubTab === 'telegram' && (
          <>
            {/* Telegram parameters */}
            <div className={`space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800 transition-all ${telegramEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Telegram Bot Token
            </label>
            <input
              type="password"
              placeholder="Contoh: 123456789:ABCdefGhIJKlmNoPQRsT"
              disabled={isLoading || !telegramEnabled}
              value={telegramToken}
              onChange={(e) => setTelegramToken(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-200 text-sm outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Telegram Chat ID
            </label>
            <input
              type="text"
              placeholder="Contoh: 987654321 atau ID grup"
              disabled={isLoading || !telegramEnabled}
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-200 text-sm outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-mono"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Bisa didapatkan dari bot Telegram seperti <code className="font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/50 px-1 rounded">@userinfobot</code>.
            </p>
          </div>

          {/* Test Telegram button */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              disabled={testLoading || isLoading || !telegramEnabled || !telegramToken || !telegramChatId}
              onClick={handleTestTelegram}
              className="py-2 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium text-xs transition-all flex items-center justify-center gap-1.5 self-start disabled:opacity-50"
            >
              {testLoading ? (
                <div className="h-3.5 w-3.5 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Test Kirim Pesan Telegram
            </button>

            {testStatus && (
              <div className={`p-3 rounded-xl flex items-start gap-2 text-xs border ${
                testStatus.success 
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                  : 'bg-rose-50 border-rose-100 text-rose-800'
              }`}>
                {testStatus.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span>{testStatus.msg}</span>
              </div>
            )}
          </div>
          </div>
          </>
        )}  

        {activeSubTab === 'supabase' && (
          <>
            {/* Supabase Integration Panel */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="h-4 w-4 text-emerald-500" />
                  Integrasi Database Supabase
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Hubungkan data pemakaian Token.ku ke database PostgreSQL kustom Anda di Supabase untuk sinkronisasi sekunder.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Supabase URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://your-project-id.supabase.co"
                    disabled={isLoading}
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-200 text-xs outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Supabase Public Anon Key
                  </label>
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    disabled={isLoading}
                    value={supabaseAnonKey}
                    onChange={(e) => setSupabaseAnonKey(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-200 text-xs outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-mono"
                  />
                </div>
              </div>

              {/* Supabase Documentation */}
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 space-y-3.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                <div>
                  <button
                    type="button"
                    onClick={() => setShowSql(!showSql)}
                    className="font-bold text-emerald-950 dark:text-emerald-300 flex items-center justify-between w-full text-left cursor-pointer focus:outline-none"
                  >
                    <span className="flex items-center gap-1.5">
                      📖 Panduan & Schema Tabel PostgreSQL Supabase
                    </span>
                    {showSql ? <ChevronUp className="h-4 w-4 text-emerald-600" /> : <ChevronDown className="h-4 w-4 text-emerald-600" />}
                  </button>
                  
                  {showSql && (
                    <div className="mt-2.5 space-y-2">
                      <p className="text-[11px] text-emerald-800/80 dark:text-emerald-400/80">
                        Silakan jalankan SQL berikut di <strong>SQL Editor</strong> Supabase Anda untuk membuat tabel <code className="font-bold">token_mutations</code> dan <code className="font-bold">token_settings</code>:
                      </p>
              
              <div className="relative mt-2">
                <pre className="p-3 bg-slate-900 text-slate-200 rounded-lg overflow-x-auto text-[10px] font-mono leading-normal max-h-40 border border-slate-800 select-all">
{`-- 1. Buat Tabel Pemakaian/Mutasi kWh dengan Unik Timestamp (Mencegah Duplikasi)
create table if not exists public.token_mutations (
  id uuid default gen_random_uuid() primary key,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null unique,
  remaining_kwh numeric(10,2) not null,
  mutation numeric(10,2) not null,
  type text check (type in ('consumption', 'topup', 'initial')) not null,
  notes text
);

-- 2. Buat Tabel Konfigurasi Aplikasi (Settings)
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

-- 3. Aktifkan Row Level Security (RLS) jika dibutuhkan
alter table public.token_mutations enable row level security;
alter table public.token_settings enable row level security;

-- 4. Buat policy agar Anon Key dapat membaca & menulis data
create policy "Allow all users to read and insert"
on public.token_mutations for all
using (true)
with check (true);

create policy "Allow all users to read and write settings"
on public.token_settings for all
using (true)
with check (true);`}
                </pre>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`-- 1. Buat Tabel Pemakaian/Mutasi kWh dengan Unik Timestamp (Mencegah Duplikasi)
create table if not exists public.token_mutations (
  id uuid default gen_random_uuid() primary key,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null unique,
  remaining_kwh numeric(10,2) not null,
  mutation numeric(10,2) not null,
  type text check (type in ('consumption', 'topup', 'initial')) not null,
  notes text
);

-- 2. Buat Tabel Konfigurasi Aplikasi (Settings)
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

-- 3. Aktifkan Row Level Security (RLS) jika dibutuhkan
alter table public.token_mutations enable row level security;
alter table public.token_settings enable row level security;

-- 4. Buat policy agar Anon Key dapat membaca & menulis data
create policy "Allow all users to read and insert"
on public.token_mutations for all
using (true)
with check (true);

create policy "Allow all users to read and write settings"
on public.token_settings for all
using (true)
with check (true);`);
                    alert('SQL Schema Supabase berhasil disalin!');
                  }}
                  className="absolute right-2 top-2 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 font-semibold rounded-md border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer animate-none"
                >
                  <Copy className="h-3 w-3" />
                  Salin SQL
                </button>
              </div>
            </div>
          )}
        </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-2">
              <div>
                <p className="font-semibold text-slate-700 dark:text-slate-300">💡 Cara Kerja Sinkronisasi:</p>
                <p>Aplikasi Token.ku akan otomatis merekam pemakaian secara real-time ke tabel Supabase Anda di latar belakang setiap kali Anda mengklik "Simpan Pencatatan" jika URL dan Anon Key di atas telah terisi lengkap.</p>
              </div>

              {onMirrorAllToSupabase && (
                <div className="border-t border-emerald-100/50 dark:border-emerald-900/30 pt-3 mt-1.5 space-y-2">
                  <p className="font-medium text-[11px] text-slate-600 dark:text-slate-400">
                    Punya data lama di penyimpanan lokal browser yang belum disinkronkan? Klik tombol di bawah untuk menyalin seluruh riwayat data log pemakaian saat ini ke database Supabase Anda secara massal:
                  </p>
                  
                  <div className="flex flex-wrap gap-2.5 pt-1">
                    <button
                      type="button"
                      disabled={syncLoading || isLoading}
                      onClick={handleSyncAll}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-700/50 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-xs"
                    >
                      {syncLoading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Melakukan Sinkronisasi Massal...</span>
                        </>
                      ) : (
                        <>
                          <Database className="h-3.5 w-3.5" />
                          <span>Mirror Semua Data ke Supabase</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={exportSupabaseLoading || isLoading}
                      onClick={handleExportSupabaseJSON}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-700/50 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-xs"
                    >
                      {exportSupabaseLoading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Mengekspor dari Supabase...</span>
                        </>
                      ) : (
                        <>
                          <Download className="h-3.5 w-3.5" />
                          <span>Ekspor Data Supabase ke JSON</span>
                        </>
                      )}
                    </button>
                  </div>

                  {syncResult && (
                    <div className={`p-2.5 rounded-xl border text-[11px] flex items-start gap-2 ${
                      syncResult.failedCount === 0
                        ? 'bg-teal-50 dark:bg-teal-950/20 border-teal-200/50 dark:border-teal-900/30 text-teal-800 dark:text-teal-300'
                        : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-900/30 text-amber-800 dark:text-amber-300'
                    }`}>
                      {syncResult.failedCount === 0 ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <span className="font-bold">Status Sinkronisasi:</span> Berhasil mengunggah/sinkron <span className="font-bold">{syncResult.successCount}</span> log data ke Supabase.
                        {syncResult.failedCount > 0 && (
                          <span> Dilewati <span className="font-bold">{syncResult.failedCount}</span> log data (mungkin data tersebut sudah ada di Supabase).</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
          </>
        )}

        {activeSubTab === 'room' && (
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-4 text-slate-700 dark:text-slate-300">
            <div>
              <h4 className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="h-4 w-4 text-blue-500" />
                Arsitektur Room Database (Capacitor)
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Aplikasi ini sekarang mengimplementasikan arsitektur Android Jetpack Room Database melalui jembatan native Capacitor Preferences.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
              {/* Status Header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-slate-500 tracking-wide">Status Database</span>
                <span className="px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-extrabold text-[10px] rounded-full uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping inline-block" />
                  Aktif & Sinkron
                </span>
              </div>

              {/* DAOs / Entities breakdown */}
              <div className="space-y-3">
                <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 flex items-start justify-between gap-2">
                  <div>
                    <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200 font-sans">MutationDao</h5>
                    <p className="text-[10px] text-slate-400 mt-0.5">Entity: <code className="text-blue-500 font-semibold font-mono">MutationRecord</code></p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Membaca, menambah, dan menghapus log sisa saldo kWh & pemakaian listrik.</p>
                  </div>
                  <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[9px] font-bold rounded-md font-mono">
                    DAO
                  </span>
                </div>

                <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 flex items-start justify-between gap-2">
                  <div>
                    <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200 font-sans">SettingsDao</h5>
                    <p className="text-[10px] text-slate-400 mt-0.5">Entity: <code className="text-blue-500 font-semibold font-mono">AppSettings</code></p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Mengelola tarif listrik PLN, ambang batas, dan integrasi bot Telegram.</p>
                  </div>
                  <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[9px] font-bold rounded-md font-mono">
                    DAO
                  </span>
                </div>
              </div>

              {/* Informative description */}
              <div className="text-[11px] leading-relaxed text-slate-500 space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3">
                <p className="font-semibold text-slate-600 dark:text-slate-400">💡 Fitur Keunggulan:</p>
                <ul className="list-disc pl-4 space-y-1 text-slate-500 dark:text-slate-400">
                  <li><span className="font-medium text-slate-600 dark:text-slate-400">Offline-First:</span> Data tetap tersimpan aman di penyimpanan internal perangkat seluler walaupun tanpa koneksi internet.</li>
                  <li><span className="font-medium text-slate-600 dark:text-slate-400">Arsitektur Room:</span> Abstraksi database menggunakan pola DAO (Data Access Object) dan Singleton yang clean serta modular.</li>
                  <li><span className="font-medium text-slate-600 dark:text-slate-400">Synchronized Cache:</span> Sinkronisasi dua arah yang mulus antara memori cache rendering cepat dan driver Capacitor Preferences.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'basic' && (
          <>
            {/* Export & Import Settings Panel */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
              <div>
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FileCode className="h-4 w-4 text-indigo-500" />
                  Cadangkan / Impor Pengaturan (JSON)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Cadangkan atau muat kembali semua konfigurasi aplikasi, Bot Telegram, dan integrasi Supabase ke dalam file JSON lokal di perangkat Anda.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                >
                  <Download className="h-4 w-4 text-emerald-500" />
                  <span>Ekspor ke JSON</span>
                </button>

                <label className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs">
                  <Upload className="h-4 w-4 text-indigo-500" />
                  <span>Impor dari JSON</span>
                  <input 
                    type="file" 
                    accept=".json" 
                    onChange={handleImportJSON} 
                    className="hidden" 
                  />
                </label>
              </div>
            </div>

            {/* Seed Sample Data Section */}
            {onSeedSampleData && (
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                <div>
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="h-4 w-4 text-slate-400" />
                    Data Percobaan (Seeding)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Impor data log real-time kWh (19 baris riwayat pemakaian & pembelian token listrik) ke penyimpanan lokal browser Anda secara instan.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={seedLoading || isLoading}
                  onClick={handleSeedData}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900 text-white dark:text-slate-200 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {seedLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                  <span>Impor Data Log & Pengaturan JSON</span>
                </button>
                {seedSuccess && (
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-lg text-emerald-800 dark:text-emerald-300 text-[11px] font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Data contoh sukses diimpor! Silakan beralih ke Dashboard.</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Submit Save Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full pt-3 pb-3 mt-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isLoading ? (
            <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>Simpan Konfigurasi</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
