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

    const nowIso = new Date().toISOString();
    const finalNotes = recordType === 'topup' ? 'Tambah Token' : 'Pencatatan Rutin';

    await onSubmit({
      remainingKwh,
      timestamp: nowIso,
      notes: finalNotes,
      type: recordType,
    });

    setRemainingKwhStr('');
  };

  const handleQuickAdd = (addKwh: number) => {
    const base = lastRecord ? lastRecord.remainingKwh : 0;
    const nextVal = (base + addKwh).toFixed(2);
    setRemainingKwhStr(nextVal);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-6 max-w-xl mx-auto transition-all space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
          <Zap className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Catat Sisa kWh Meter</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Masukkan angka sisa kWh dari meteran listrik Anda</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Last reading badge */}
        {lastRecord && (
          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800/80">
            <span className="font-medium text-slate-500">Pencatatan Terakhir:</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
              {lastRecord.remainingKwh.toFixed(2)} <span className="font-normal text-slate-400">kWh</span>
            </span>
          </div>
        )}

        {/* Input Sisa kWh */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Sisa kWh Meteran Saat Ini <span className="text-rose-500">*</span>
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
              className="w-full pl-4 pr-16 py-3.5 bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl transition-all font-mono font-bold text-xl outline-none"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
              kWh
            </span>
          </div>
        </div>

        {/* Quick Add Token Preset Buttons */}
        {lastRecord && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
              Isi Token Baru (Bantuan Cepat):
            </span>
            <div className="flex flex-wrap gap-2">
              {[20, 50, 100, 200].map((kwh) => (
                <button
                  key={kwh}
                  type="button"
                  onClick={() => handleQuickAdd(kwh)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200/60 dark:border-slate-700/60 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  +{kwh} kWh
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Real-time Calculation Preview */}
        {!isNaN(remainingKwh) && remainingKwh >= 0 && lastRecord && (
          <div className={`p-3.5 rounded-xl border flex items-center gap-3 transition-colors text-xs ${
            recordType === 'topup' 
              ? 'bg-teal-50 dark:bg-teal-950/30 border-teal-200/80 dark:border-teal-900/60 text-teal-800 dark:text-teal-200' 
              : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-900/60 text-amber-800 dark:text-amber-200'
          }`}>
            <ArrowRight className="h-4 w-4 shrink-0" />
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold">
                {recordType === 'topup' ? 'Pengisian Token (+)' : 'Pemakaian kWh (-)'}
              </span>
              <span className="font-mono font-extrabold text-sm">
                {calculatedMutation >= 0 ? '+' : ''}{calculatedMutation.toFixed(2)} kWh
              </span>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || remainingKwhStr === ''}
          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-sm shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
