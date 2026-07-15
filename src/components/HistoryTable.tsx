import { useMemo, useState } from 'react';
import { MutationRecord } from '../types';
import { Clock, Calendar, MessageSquare, ChevronLeft, ChevronRight, Zap, Trash2 } from 'lucide-react';

interface HistoryTableProps {
  mutations: MutationRecord[];
  onDelete?: (id: string) => Promise<void> | void;
  onCleanDuplicates?: () => Promise<void> | void;
  isCleaning?: boolean;
  kwhTariff?: number;
}

export default function HistoryTable({ mutations, onDelete, onCleanDuplicates, isCleaning, kwhTariff = 1444.7 }: HistoryTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  // Check if there are duplicates based on timestamp (within 1 second) and sisa kWh
  const duplicateCount = useMemo(() => {
    let count = 0;
    const seen = new Set<string>();
    for (const m of mutations) {
      const t = Math.floor(new Date(m.timestamp).getTime() / 1000);
      const kwh = m.remainingKwh.toFixed(2);
      const key = `${t}_${kwh}`;
      if (seen.has(key)) {
        count++;
      } else {
        seen.add(key);
      }
    }
    return count;
  }, [mutations]);

  // Sorted mutations, descending (newest first)

  const sortedMutations = useMemo(() => {
    return [...mutations].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [mutations]);

  // Pagination logic
  const totalPages = Math.ceil(sortedMutations.length / itemsPerPage) || 1;
  const paginatedMutations = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedMutations.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedMutations, currentPage]);

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden transition-colors duration-300">
      <div className="p-5 border-b border-slate-50 dark:border-slate-800/80 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-amber-500" />
            Riwayat Log & Pemakaian kWh
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Pemakaian otomatis terekam dari sisa kWh meter manual</p>
        </div>
        <span className="text-[10px] font-semibold tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 px-2.5 py-1 rounded-full uppercase">
          Supabase Active
        </span>
      </div>

      {duplicateCount > 0 && onCleanDuplicates && (
        <div className="mx-5 mt-4 p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 rounded-xl flex flex-col xs:flex-row items-start xs:items-center justify-between gap-3 text-amber-900 dark:text-amber-200">
          <div className="flex gap-2.5 items-start">
            <Trash2 className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold">Terdeteksi Duplikat Data!</span>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">Ditemukan {duplicateCount} log dengan waktu & sisa kWh yang sama.</p>
            </div>
          </div>
          <button
            onClick={() => onCleanDuplicates()}
            disabled={isCleaning}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white text-xs font-bold rounded-lg transition-colors shadow-xs shrink-0 cursor-pointer flex items-center gap-1"
          >
            {isCleaning ? 'Membersihkan...' : 'Bersihkan Duplikat'}
          </button>
        </div>
      )}


      {sortedMutations.length === 0 ? (
        <div className="p-12 text-center text-sm text-slate-400 dark:text-slate-500">
          Belum ada riwayat pemakaian. Mulai dengan mencatat sisa kWh meter pertama Anda!
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {/* Desktop Table View */}
          <div className="overflow-x-auto hidden sm:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/50 dark:bg-slate-950/40 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Tanggal & Waktu</th>
                  <th className="px-6 py-3.5">Sisa kWh Meter</th>
                  <th className="px-6 py-3.5">Pemakaian</th>
                  <th className="px-6 py-3.5">Tipe</th>
                  {onDelete && <th className="px-6 py-3.5 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {paginatedMutations.map((item) => {
                  const dateStr = new Date(item.timestamp).toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  });
                  const timeStr = new Date(item.timestamp).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{dateStr}</span>
                          <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" /> {timeStr}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {item.remainingKwh.toFixed(2)} <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">kWh</span>
                      </td>
                      <td className={`px-6 py-4 font-mono font-bold text-sm ${
                        item.mutation > 0 
                          ? 'text-teal-600 dark:text-teal-400' 
                          : item.mutation < 0 
                            ? 'text-rose-600 dark:text-rose-400' 
                            : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        {item.mutation > 0 ? '+' : ''}
                        {item.mutation.toFixed(2)}
                        <span className="text-xs font-normal opacity-75 ml-0.5"> kWh</span>
                        {item.mutation !== 0 && (
                          <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">
                            ({formatRupiah(Math.abs(item.mutation) * kwhTariff)})
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium tracking-wide border ${
                          item.type === 'topup'
                            ? 'bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-900/60 text-teal-700 dark:text-teal-300'
                            : item.type === 'consumption'
                              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-300'
                              : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300'
                        }`}>
                          {item.type === 'topup' ? 'Pengisian' : item.type === 'consumption' ? 'Pemakaian' : 'Nilai Awal'}
                        </span>
                      </td>
                      {onDelete && (
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => onDelete(item.id)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Log"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile List View */}
          <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {paginatedMutations.map((item) => {
              const dateStr = new Date(item.timestamp).toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              });
              const timeStr = new Date(item.timestamp).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div key={item.id} className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-all space-y-2 text-slate-700 dark:text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-slate-400" />
                      {dateStr} <span className="text-slate-400 dark:text-slate-500 font-normal">|</span> <Clock className="h-3 w-3 text-slate-400 ml-1" /> {timeStr}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                        item.type === 'topup'
                          ? 'bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-900/60 text-teal-700 dark:text-teal-300'
                          : item.type === 'consumption'
                            ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-300'
                            : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300'
                      }`}>
                        {item.type === 'topup' ? 'Pengisian' : item.type === 'consumption' ? 'Pemakaian' : 'Awal'}
                      </span>
                      {onDelete && (
                        <button
                          onClick={() => onDelete(item.id)}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                          title="Hapus Log"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-xs text-slate-400 dark:text-slate-500">Sisa kWh:</span>{' '}
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{item.remainingKwh.toFixed(2)} kWh</span>
                    </div>
                    <div className="text-right">
                      <div className={`font-mono font-extrabold ${
                        item.mutation > 0 
                          ? 'text-teal-600 dark:text-teal-400' 
                          : item.mutation < 0 
                            ? 'text-rose-600 dark:text-rose-400' 
                            : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        {item.mutation > 0 ? '+' : ''}{item.mutation.toFixed(2)} kWh
                      </div>
                      {item.mutation !== 0 && (
                        <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">
                          ({formatRupiah(Math.abs(item.mutation) * kwhTariff)})
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="p-4 bg-slate-50/40 dark:bg-slate-950/40 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Halaman <span className="font-semibold text-slate-700 dark:text-slate-300">{currentPage}</span> dari <span className="font-semibold text-slate-700 dark:text-slate-300">{totalPages}</span>
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:pointer-events-none cursor-pointer transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className="p-1.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:pointer-events-none cursor-pointer transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
