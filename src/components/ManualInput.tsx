import React, { useState, useMemo } from 'react';
import { MutationRecord } from '../types';
import { Zap, ArrowRight, Save, Clock } from 'lucide-react';

interface ManualInputProps {
  lastRecord: MutationRecord | null;
  onSubmit: (data: { remainingKwh: number; timestamp: string; notes: string; type: 'consumption' | 'topup' | 'initial' }) => Promise<void>;
  isLoading: boolean;
}

export default function ManualInput({ lastRecord, onSubmit, isLoading }: ManualInputProps) {
  const [remainingKwhStr, setRemainingKwhStr] = useState('');

  const remainingKwh = parseFloat(remainingKwhStr);

  // Auto calculate mutation preview
  const calculatedMutation = useMemo(() => {
    if (isNaN(remainingKwh) || !lastRecord) return 0;
    return remainingKwh - lastRecord.remainingKwh;
  }, [remainingKwh, lastRecord]);

  const recordType = useMemo<'consumption' | 'topup' | 'initial'>(() => {
    if (!lastRecord) return 'initial';
    return calculatedMutation >= 0 ? 'topup' : 'consumption';
  }, [calculatedMutation, lastRecord]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(remainingKwh) || remainingKwh < 0) {
      alert('Mohon masukkan sisa kWh yang valid (minimal 0).');
      return;
    }

    // Format timestamp to proper ISO string using the current real time
    const nowIso = new Date().toISOString();

    // If sisa kwh naik dari sebelumnya (topup), set notes to "Tambah Token" automatically
    const finalNotes = recordType === 'topup' ? 'Tambah Token' : 'Pencatatan Rutin';

    await onSubmit({
      remainingKwh,
      timestamp: nowIso,
      notes: finalNotes,
      type: recordType,
    });

    // Reset fields on success
    setRemainingKwhStr('');
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-6 max-w-xl mx-auto transition-colors duration-300">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
          <Zap className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Catat Sisa kWh Baru</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Input meter sisa daya listrik saat ini</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Previous reading indicator */}
        {lastRecord && (
          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800/80">
            <span>Pencatatan Terakhir:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {lastRecord.remainingKwh.toFixed(2)} kWh
              <span className="font-normal text-slate-400 dark:text-slate-500 ml-1">
                ({new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(lastRecord.timestamp)).replace(' pukul ', ', ')})
              </span>
            </span>
          </div>
        )}

        {/* Input Sisa kWh */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 capitalize tracking-wider mb-1.5">
            Sisa kWh Meter saat ini (kWh) <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              required
              min="0"
              disabled={isLoading}
              value={remainingKwhStr}
              onChange={(e) => setRemainingKwhStr(e.target.value)}
              placeholder="Contoh: 124.50"
              className="w-full pl-4 pr-16 py-3 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100/50 dark:hover:bg-slate-900 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl transition-all font-medium text-lg outline-none"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
              kWh
            </span>
          </div>
        </div>

        {/* Real-time Calculation Preview */}
        {!isNaN(remainingKwh) && remainingKwh >= 0 && lastRecord && (
          <div className={`p-4 rounded-xl border flex items-center gap-3 transition-colors ${
            recordType === 'topup' 
              ? 'bg-teal-50 dark:bg-teal-950/30 border-teal-100 dark:border-teal-900/60 text-teal-800 dark:text-teal-200' 
              : 'bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/60 text-amber-800 dark:text-amber-200'
          }`}>
            <ArrowRight className="h-5 w-5 shrink-0" />
            <div className="text-xs">
              <span className="font-medium">Deteksi Otomatis: </span>
              <span className="font-bold">
                {recordType === 'topup' ? 'Pengisian Token' : 'Pemakaian Daya'}
              </span>
              <span className="mx-1">•</span>
              <span>Keterangan otomatis: </span>
              <span className="font-bold">
                {recordType === 'topup' ? 'Tambah Token' : 'Pencatatan Rutin'}
              </span>
              <span className="mx-1">•</span>
              <span>Pemakaian: </span>
              <span className="font-extrabold text-sm">
                {calculatedMutation >= 0 ? '+' : ''}{calculatedMutation.toFixed(2)} kWh
              </span>
            </div>
          </div>
        )}

        {/* DateTime Log (Readonly) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 capitalize tracking-wider mb-1.5 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            Waktu Pembacaan (ReadOnly)
          </label>
          <input
            type="text"
            readOnly
            disabled
            value={new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-400 font-medium text-sm outline-none cursor-not-allowed"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || remainingKwhStr === ''}
          className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>Simpan Pencatatan</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
