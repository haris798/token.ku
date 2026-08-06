import { useMemo } from 'react';
import { MutationRecord } from '../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Calendar, Download, Zap, CreditCard, TrendingUp, Layers } from 'lucide-react';

interface MonthlySummaryProps {
  mutations: MutationRecord[];
  kwhTariff: number;
}

export default function MonthlySummary({ mutations, kwhTariff }: MonthlySummaryProps) {
  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Group mutations by month (YYYY-MM) and compute statistics
  const monthlySummary = useMemo(() => {
    const monthlyMap: Record<
      string,
      { yearMonth: string; fullMonth: string; shortMonth: string; kwh: number; count: number }
    > = {};

    mutations.forEach((m) => {
      if (m.type === 'consumption' || m.mutation < 0) {
        const d = new Date(m.timestamp);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const amount = Math.abs(m.mutation);

        if (!monthlyMap[ym]) {
          const fullMonth = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
          const shortMonth = d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
          monthlyMap[ym] = {
            yearMonth: ym,
            fullMonth,
            shortMonth,
            kwh: 0,
            count: 0,
          };
        }
        monthlyMap[ym].kwh += amount;
        monthlyMap[ym].count += 1;
      }
    });

    const list = Object.values(monthlyMap)
      .map((item) => {
        const kWh = parseFloat(item.kwh.toFixed(2));
        const estimatedCost = Math.round(item.kwh * kwhTariff);
        return {
          yearMonth: item.yearMonth,
          fullMonth: item.fullMonth,
          shortMonth: item.shortMonth,
          kWh,
          estimatedCost,
          count: item.count,
        };
      })
      .sort((a, b) => b.yearMonth.localeCompare(a.yearMonth)); // Latest first

    const totalKwh = list.reduce((sum, item) => sum + item.kWh, 0);
    const totalCost = list.reduce((sum, item) => sum + item.estimatedCost, 0);
    const avgKwh = list.length > 0 ? parseFloat((totalKwh / list.length).toFixed(2)) : 0;
    const avgCost = Math.round(avgKwh * kwhTariff);

    // Find peak month
    const peakMonth = list.length > 0 ? [...list].sort((a, b) => b.kWh - a.kWh)[0] : null;

    return {
      list,
      totalKwh: parseFloat(totalKwh.toFixed(2)),
      totalCost,
      avgKwh,
      avgCost,
      monthsCount: list.length,
      peakMonth,
    };
  }, [mutations, kwhTariff]);

  const handleExportCSV = () => {
    if (monthlySummary.list.length === 0) return;

    const headers = ['Bulan', 'Pemakaian (kWh)', 'Tarif (Rp/kWh)', 'Estimasi Biaya Listrik (Rp)'];
    const rows = monthlySummary.list.map((item) => [
      item.fullMonth,
      item.kWh.toFixed(2),
      kwhTariff.toString(),
      item.estimatedCost.toString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ringkasan_pemakaian_bulanan_${new Date().getFullYear()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm transition-all hover:shadow-md space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
              Ringkasan Bulanan & Estimasi Biaya
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-900/40">
                Tarif: {formatRupiah(kwhTariff)}/kWh
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Akumulasi total pemakaian kWh dan estimasi tagihan listrik per bulan
            </p>
          </div>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={monthlySummary.list.length === 0}
          className="flex items-center gap-2 px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors disabled:opacity-40 cursor-pointer self-start sm:self-auto"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>

      {monthlySummary.list.length > 0 ? (
        <>
          {/* Top 3 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Metric 1: Total Pemakaian */}
            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/70 dark:border-indigo-900/30 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                  Total Akumulasi
                </span>
                <Zap className="h-4 w-4 text-indigo-500" />
              </div>
              <div className="text-xl font-black text-indigo-900 dark:text-indigo-200">
                {monthlySummary.totalKwh.toFixed(2)}{' '}
                <span className="text-xs font-bold text-slate-500">kWh</span>
              </div>
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                ≈ {formatRupiah(monthlySummary.totalCost)}
              </div>
            </div>

            {/* Metric 2: Rata-rata per Bulan */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Rerata / Bulan
                </span>
                <CreditCard className="h-4 w-4 text-slate-400" />
              </div>
              <div className="text-xl font-black text-slate-800 dark:text-slate-100">
                {monthlySummary.avgKwh.toFixed(2)}{' '}
                <span className="text-xs font-bold text-slate-500">kWh</span>
              </div>
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                ≈ {formatRupiah(monthlySummary.avgCost)}/bulan
              </div>
            </div>

            {/* Metric 3: Bulan Terbanyak */}
            <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100/70 dark:border-amber-900/30 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Konsumsi Tertinggi
                </span>
                <TrendingUp className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-xl font-black text-amber-900 dark:text-amber-200">
                {monthlySummary.peakMonth ? `${monthlySummary.peakMonth.kWh.toFixed(2)} kWh` : '-'}
              </div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {monthlySummary.peakMonth ? monthlySummary.peakMonth.fullMonth : '-'}
              </div>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 px-1">
              <span className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-indigo-500" />
                Grafik Pemakaian Bulanan (kWh)
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                {monthlySummary.monthsCount} Bulan Terdata
              </span>
            </div>
            <div className="h-56 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[...monthlySummary.list].reverse()}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="currentColor"
                    className="text-slate-200 dark:text-slate-800"
                  />
                  <XAxis
                    dataKey="shortMonth"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    className="text-slate-400"
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    className="text-slate-400"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      border: 'none',
                      borderRadius: '12px',
                      color: '#f8fafc',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
                      padding: '10px 14px',
                    }}
                    labelStyle={{ color: '#94a3b8', fontSize: '12px', fontWeight: 'bold' }}
                    formatter={(value: number) => [
                      `${value.toFixed(2)} kWh (≈ ${formatRupiah(value * kwhTariff)})`,
                      'Konsumsi',
                    ]}
                  />
                  <Bar dataKey="kWh" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={38} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed Monthly Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
            <table className="w-full text-sm text-left">
              <thead className="text-[11px] uppercase bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Bulan</th>
                  <th className="px-4 py-3 text-right">Total Pemakaian</th>
                  <th className="px-4 py-3 text-right">Tarif (Rp/kWh)</th>
                  <th className="px-4 py-3 text-right">Estimasi Biaya</th>
                  <th className="px-4 py-3 text-right">Porsi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {monthlySummary.list.map((item, idx) => {
                  const percentage =
                    monthlySummary.totalKwh > 0
                      ? ((item.kWh / monthlySummary.totalKwh) * 100).toFixed(1)
                      : '0';

                  return (
                    <tr
                      key={idx}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                        {item.fullMonth}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {item.kWh.toFixed(2)}{' '}
                        <span className="text-xs text-slate-400 font-normal">kWh</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-500 dark:text-slate-400">
                        {formatRupiah(kwhTariff)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatRupiah(item.estimatedCost)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-400 dark:text-slate-500">
                        {percentage}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50/80 dark:bg-slate-950/80 font-bold border-t border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200">
                <tr>
                  <td className="px-4 py-3">Total Akumulasi</td>
                  <td className="px-4 py-3 text-right font-mono text-indigo-600 dark:text-indigo-400 font-extrabold text-sm">
                    {monthlySummary.totalKwh.toFixed(2)} kWh
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-500">-</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">
                    {formatRupiah(monthlySummary.totalCost)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-400">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : (
        <div className="text-center py-10 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
          <Calendar className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Belum ada data pemakaian bulanan yang terdeteksi.
          </p>
        </div>
      )}
    </div>
  );
}
