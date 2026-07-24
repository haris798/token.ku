import { useState, useMemo } from 'react';
import { MutationRecord } from '../types';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Battery, Zap, AlertTriangle, Calendar, Timer, Filter, Activity, TrendingUp, Sparkles, Clock, CheckCircle, Download } from 'lucide-react';

interface DashboardProps {
  mutations: MutationRecord[];
  lowThreshold: number;
  kwhTariff?: number;
  activeTab?: 'dashboard' | 'prediction';
}

export default function Dashboard({ 
  mutations, 
  lowThreshold, 
  kwhTariff = 1444.7, 
  activeTab = 'dashboard'
}: DashboardProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  const handleExportCSV = () => {
    if (monthlyData.length === 0) return;
    
    // Prepare headers and rows
    const headers = ["Bulan", "Konsumsi (kWh)", "Tarif (Rp/kWh)", "Biaya Listrik (Rupiah)"];
    const rows = monthlyData.map(item => [
      item.month,
      item.kWh.toFixed(2),
      kwhTariff.toString(),
      Math.round(item.kWh * kwhTariff).toString()
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `akumulasi_konsumsi_bulanan_${new Date().getFullYear()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sort mutations chronological for analysis
  const sortedMutations = useMemo(() => {
    return [...mutations].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [mutations]);

  // Current stats
  const currentKwh = useMemo(() => {
    if (mutations.length === 0) return 0;
    // Get latest by date
    const latest = [...mutations].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    return latest.remainingKwh;
  }, [mutations]);


  const isLow = currentKwh <= lowThreshold;

  // Extract all unique months for filtering
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    mutations.forEach(m => {
      if (m.type === 'consumption' || (m.mutation < 0)) {
        const date = new Date(m.timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        monthsSet.add(`${year}-${month}`);
      }
    });
    return Array.from(monthsSet).sort().reverse();
  }, [mutations]);

  // Format month labels nicely (e.g. "Juli 2026")
  const monthOptions = useMemo(() => {
    return availableMonths.map(ym => {
      const [year, month] = ym.split('-');
      const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      const label = date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      return { value: ym, label };
    });
  }, [availableMonths]);

  // Calculate daily consumption with month filter support
  const dailyData = useMemo(() => {
    const dailyMap: Record<string, number> = {};
    
    // Sort mutations chronologically first to render correctly
    const chronologicalMutations = [...mutations].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    chronologicalMutations.forEach(m => {
      if (m.type === 'consumption' || (m.mutation < 0)) {
        const dateObj = new Date(m.timestamp);
        
        // Filter by month
        if (selectedMonth !== 'all') {
          const year = dateObj.getFullYear();
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          if (`${year}-${month}` !== selectedMonth) {
            return;
          }
        }

        const dateStr = dateObj.toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
        });
        const amount = Math.abs(m.mutation);
        dailyMap[dateStr] = (dailyMap[dateStr] || 0) + amount;
      }
    });

    const entries = Object.entries(dailyMap).map(([date, kWh]) => ({
      date,
      kWh: parseFloat(kWh.toFixed(2)),
    }));

    return entries;
  }, [mutations, selectedMonth]);

  // Calculate statistics specifically for the selected month filter
  const selectedMonthStats = useMemo(() => {
    let total = 0;
    const dailyMap: Record<string, number> = {};
    
    mutations.forEach(m => {
      if (m.type === 'consumption' || (m.mutation < 0)) {
        const dateObj = new Date(m.timestamp);
        
        // Filter by month
        if (selectedMonth !== 'all') {
          const year = dateObj.getFullYear();
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          if (`${year}-${month}` !== selectedMonth) {
            return;
          }
        }

        const amount = Math.abs(m.mutation);
        total += amount;

        const dayKey = dateObj.toDateString();
        dailyMap[dayKey] = (dailyMap[dayKey] || 0) + amount;
      }
    });

    const daysCount = Object.keys(dailyMap).length;
    const average = daysCount > 0 ? parseFloat((total / daysCount).toFixed(2)) : 0;

    return {
      total: parseFloat(total.toFixed(2)),
      average
    };
  }, [mutations, selectedMonth]);

  // Compute total consumption this month with auto fallback to latest recorded month
  const statsThisMonth = useMemo(() => {
    const now = new Date();
    const currentY = now.getFullYear();
    const currentM = String(now.getMonth() + 1).padStart(2, '0');
    const currentYM = `${currentY}-${currentM}`; // "2026-07"
    
    const hasCurrentMonthData = mutations.some(m => {
      if (m.type === 'consumption' || m.mutation < 0) {
        const d = new Date(m.timestamp);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === currentYM;
      }
      return false;
    });

    const targetYM = (hasCurrentMonthData || availableMonths.length === 0) 
      ? currentYM 
      : availableMonths[0];
      
    let total = 0;
    const dailyMap: Record<string, number> = {};
    
    mutations.forEach(m => {
      if (m.type === 'consumption' || m.mutation < 0) {
        const dateObj = new Date(m.timestamp);
        const y = dateObj.getFullYear();
        const mon = String(dateObj.getMonth() + 1).padStart(2, '0');
        if (`${y}-${mon}` === targetYM) {
          const amount = Math.abs(m.mutation);
          total += amount;
          const dayKey = dateObj.toDateString();
          dailyMap[dayKey] = (dailyMap[dayKey] || 0) + amount;
        }
      }
    });
    
    const daysCount = Object.keys(dailyMap).length;
    const average = daysCount > 0 ? parseFloat((total / daysCount).toFixed(2)) : 0;
    
    const [yStr, mStr] = targetYM.split('-');
    const dateObj = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1);
    const monthLabel = dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    
    return {
      total: parseFloat(total.toFixed(2)),
      average,
      monthLabel,
      daysCount,
      isCurrentMonth: targetYM === currentYM
    };
  }, [mutations, availableMonths]);

  // Average daily usage: total consumption / difference between earliest date and today
  const overallAverageUsageStats = useMemo(() => {
    const negativeMutations = mutations.filter(m => m.mutation < 0 || m.type === 'consumption');
    if (negativeMutations.length === 0) {
      return { average: 0, totalConsumption: 0, diffDays: 0, earliestDateStr: '-' };
    }

    const totalConsumption = negativeMutations.reduce((sum, m) => sum + Math.abs(m.mutation), 0);
    
    // Sort chronological to find earliest date
    const chronological = [...mutations].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    if (chronological.length === 0) {
      return { average: 0, totalConsumption: 0, diffDays: 0, earliestDateStr: '-' };
    }
    
    const earliestTime = new Date(chronological[0].timestamp).getTime();
    const todayTime = new Date().getTime();
    
    const diffMs = todayTime - earliestTime;
    const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    
    const earliestDateStr = new Date(chronological[0].timestamp).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    
    const average = parseFloat((totalConsumption / diffDays).toFixed(2));
    
    return {
      average,
      totalConsumption,
      diffDays,
      earliestDateStr
    };
  }, [mutations]);

  const overallAverageUsage = overallAverageUsageStats.average;

  // Calculate monthly consumption
  const monthlyData = useMemo(() => {
    const monthlyMap: Record<string, number> = {};
    
    mutations.forEach(m => {
      if (m.type === 'consumption' || (m.mutation < 0)) {
        const monthStr = new Date(m.timestamp).toLocaleDateString('id-ID', {
          month: 'short',
          year: '2-digit',
        });
        const amount = Math.abs(m.mutation);
        monthlyMap[monthStr] = (monthlyMap[monthStr] || 0) + amount;
      }
    });

    return Object.entries(monthlyMap).map(([month, kwh]) => ({
      month,
      kWh: parseFloat(kwh.toFixed(2)),
    }));
  }, [mutations]);

  // Calculate weekly consumption (Monday - Sunday)
  const weeklyData = useMemo(() => {
    const weeklyMap: Record<string, { total: number; start: Date; end: Date }> = {};
    
    mutations.forEach(m => {
      if (m.type === 'consumption' || (m.mutation < 0)) {
        const dateObj = new Date(m.timestamp);
        
        // Find Monday of the week
        const day = dateObj.getDay();
        const diff = dateObj.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday (0) vs Monday (1)
        const monday = new Date(dateObj);
        monday.setDate(diff);
        monday.setHours(0, 0, 0, 0);
        
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        const weekKey = monday.toISOString().split('T')[0];
        const amount = Math.abs(m.mutation);
        
        if (!weeklyMap[weekKey]) {
          weeklyMap[weekKey] = {
            total: 0,
            start: monday,
            end: sunday
          };
        }
        weeklyMap[weekKey].total += amount;
      }
    });

    return Object.entries(weeklyMap).map(([key, item]) => {
      const startStr = item.start.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      const endStr = item.end.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      return {
        week: `${startStr} - ${endStr}`,
        kWh: parseFloat(item.total.toFixed(2)),
        rawDate: key
      };
    }).sort((a, b) => a.rawDate.localeCompare(b.rawDate));
  }, [mutations]);

  // Weekly statistics
  const weeklyStats = useMemo(() => {
    if (weeklyData.length === 0) {
      return { average: 0, peak: 0, peakWeek: '-' };
    }
    const total = weeklyData.reduce((sum, w) => sum + w.kWh, 0);
    const average = parseFloat((total / weeklyData.length).toFixed(2));
    
    const peakObj = [...weeklyData].sort((a, b) => b.kWh - a.kWh)[0];
    
    return {
      average,
      peak: peakObj.kWh,
      peakWeek: peakObj.week
    };
  }, [weeklyData]);

  // Average daily usage over the last 7 calendar days
  const averageDailyUsage = useMemo(() => {
    const negativeMutations = sortedMutations.filter(m => m.mutation < 0);
    if (negativeMutations.length === 0) return 0;

    const latestTime = new Date(sortedMutations[sortedMutations.length - 1].timestamp).getTime();
    const sevenDaysAgo = latestTime - (7 * 24 * 60 * 60 * 1000);

    const recordsInLast7Days = negativeMutations.filter(m => {
      const t = new Date(m.timestamp).getTime();
      return t >= sevenDaysAgo;
    });

    const totalConsumption = recordsInLast7Days.reduce((sum, m) => sum + Math.abs(m.mutation), 0);

    const firstTimeInDataset = new Date(sortedMutations[0].timestamp).getTime();
    const totalSpanDays = Math.max(1, Math.ceil((latestTime - firstTimeInDataset) / (24 * 60 * 60 * 1000)));
    const divisor = Math.min(7, totalSpanDays);

    return parseFloat((totalConsumption / divisor).toFixed(2));
  }, [sortedMutations]);


  // Battery percentage for gauge (assuming full meter token typical max is ~250 kWh, customizable)
  const batteryPercentage = Math.min(100, Math.max(0, (currentKwh / 200) * 100));

  // End of Month Prediction based on current monthly consumption and 7-day trend
  const endOfMonthPrediction = useMemo(() => {
    if (mutations.length === 0) return null;

    // Filter mutations for consumption only
    const consumptions = mutations.filter(m => m.mutation < 0 || m.type === 'consumption');
    if (consumptions.length === 0) return null;

    // Get the latest consumption date as the reference point for the month
    const latestCons = [...consumptions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    const latestDate = new Date(latestCons.timestamp);

    const year = latestDate.getFullYear();
    const monthIndex = latestDate.getMonth(); // 0-11
    const monthLabel = latestDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    // Days in this month
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const dayOfMonth = latestDate.getDate();
    const remainingDays = Math.max(0, daysInMonth - dayOfMonth);

    // Current month consumption total
    const currentSpent = statsThisMonth.total;

    // Daily usage trend: prefer averageDailyUsage (last 7 days), then statsThisMonth.average, then overallAverageUsage
    const dailyTrend = averageDailyUsage > 0 
      ? averageDailyUsage 
      : (statsThisMonth.average > 0 ? statsThisMonth.average : overallAverageUsage);

    // simple linear projection
    const projectedAdditional = parseFloat((dailyTrend * remainingDays).toFixed(2));
    const projectedTotal = parseFloat((currentSpent + projectedAdditional).toFixed(2));

    // Will they run out of energy before the month ends?
    // They will run out if current balance (currentKwh) is less than the projected additional usage.
    const willRunOut = currentKwh < projectedAdditional;
    
    // When will they run out?
    let runOutDateStr = '';
    if (willRunOut && dailyTrend > 0) {
      const daysToRunOut = currentKwh / dailyTrend;
      const runOutDate = new Date(latestDate.getTime() + daysToRunOut * 24 * 60 * 60 * 1000);
      runOutDateStr = runOutDate.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    }

    return {
      monthLabel,
      daysInMonth,
      dayOfMonth,
      remainingDays,
      currentSpent,
      dailyTrend,
      projectedAdditional,
      projectedTotal,
      willRunOut,
      runOutDateStr,
      currentKwh
    };
  }, [mutations, statsThisMonth, averageDailyUsage, overallAverageUsage, currentKwh]);

  // Average daily usage over the last 30 calendar days
  const averageDailyUsage30Days = useMemo(() => {
    const negativeMutations = sortedMutations.filter(m => m.mutation < 0);
    if (negativeMutations.length === 0) return 0;

    const latestTime = new Date(sortedMutations[sortedMutations.length - 1].timestamp).getTime();
    const thirtyDaysAgo = latestTime - (30 * 24 * 60 * 60 * 1000);

    const recordsInLast30Days = negativeMutations.filter(m => {
      const t = new Date(m.timestamp).getTime();
      return t >= thirtyDaysAgo;
    });

    const totalConsumption = recordsInLast30Days.reduce((sum, m) => sum + Math.abs(m.mutation), 0);

    const firstTimeInDataset = new Date(sortedMutations[0].timestamp).getTime();
    const totalSpanDays = Math.max(1, Math.ceil((latestTime - firstTimeInDataset) / (24 * 60 * 60 * 1000)));
    const divisor = Math.min(30, totalSpanDays);

    return parseFloat((totalConsumption / divisor).toFixed(2));
  }, [sortedMutations]);

  // Prediksi kapan saldo kWh akan habis berdasarkan rata-rata pemakaian 30 hari terakhir
  const prediction30Days = useMemo(() => {
    const negativeMutations = sortedMutations.filter(m => m.mutation < 0);
    if (negativeMutations.length === 0 || currentKwh <= 0 || averageDailyUsage30Days <= 0) {
      return {
        daysRemaining: 0,
        depletionDateStr: '-',
        status: 'unknown',
        total30DaysConsumption: 0,
        recordsCount: 0
      };
    }

    const latestTime = new Date(sortedMutations[sortedMutations.length - 1].timestamp).getTime();
    const thirtyDaysAgo = latestTime - (30 * 24 * 60 * 60 * 1000);
    const recordsInLast30Days = negativeMutations.filter(m => {
      const t = new Date(m.timestamp).getTime();
      return t >= thirtyDaysAgo;
    });
    
    const total30DaysConsumption = recordsInLast30Days.reduce((sum, m) => sum + Math.abs(m.mutation), 0);
    const recordsCount = recordsInLast30Days.length;

    const daysRemaining = parseFloat((currentKwh / averageDailyUsage30Days).toFixed(1));
    const depletionDate = new Date(latestTime + daysRemaining * 24 * 60 * 60 * 1000);
    const depletionDateStr = depletionDate.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    let status: 'critical' | 'warning' | 'safe' = 'safe';
    if (daysRemaining <= 3) {
      status = 'critical';
    } else if (daysRemaining <= 10) {
      status = 'warning';
    }

    return {
      daysRemaining,
      depletionDateStr,
      status,
      total30DaysConsumption,
      recordsCount
    };
  }, [currentKwh, averageDailyUsage30Days, sortedMutations]);

  return (
    <div className="space-y-6">
      {activeTab === 'dashboard' && (
        <>
          {/* Kartu Ringkasan Konsumsi Bulan Ini */}
      <div className="p-6 bg-gradient-to-r from-indigo-500/10 to-blue-500/10 dark:from-indigo-950/25 dark:to-blue-950/25 border border-indigo-100/80 dark:border-indigo-900/40 rounded-2xl shadow-sm transition-all hover:shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-indigo-500/15 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl shadow-inner">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5 flex-wrap">
                Ringkasan Pemakaian Bulan Ini
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-full capitalize tracking-wider">
                  {statsThisMonth.monthLabel}
                </span>
              </h3>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3.5 sm:flex sm:items-center sm:gap-4.5 w-full sm:w-auto">
            <div className="bg-white/80 dark:bg-slate-900/80 p-3.5 rounded-xl border border-indigo-100/45 dark:border-indigo-900/30 text-center sm:text-left min-w-[125px] flex-1 sm:flex-none">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold capitalize tracking-wider block">Total Konsumsi</span>
              <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 block mt-0.5">
                {statsThisMonth.total.toFixed(2)} <span className="text-xs font-bold text-slate-500 dark:text-slate-400">kWh</span>
              </span>
            </div>
            <div className="bg-white/80 dark:bg-slate-900/80 p-3.5 rounded-xl border border-indigo-100/45 dark:border-indigo-900/30 text-center sm:text-left min-w-[145px] flex-1 sm:flex-none">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold capitalize tracking-wider block">Estimasi Biaya</span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 block mt-0.5">
                {formatRupiah(statsThisMonth.total * kwhTariff)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Main Remaining kWh Gauge */}
        <div className={`p-5 rounded-2xl border transition-all ${
          isLow 
            ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-100' 
            : 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-100'
        } md:col-span-2 shadow-sm`}>
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold tracking-wider capitalize opacity-85">
                Sisa kWh Meter
              </span>
              <div className="text-4xl font-extrabold tracking-tight mt-1 flex items-baseline">
                {currentKwh.toFixed(2)}
                <span className="text-lg font-medium ml-1">kWh</span>
              </div>
              <div className="text-xs font-bold opacity-85 mt-1 flex items-center gap-1">
                <span className="bg-slate-950/10 dark:bg-white/10 px-2 py-0.5 rounded">Setara {formatRupiah(currentKwh * kwhTariff)}</span>
              </div>
            </div>
            <div className={`p-3 rounded-xl ${isLow ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'}`}>
              {isLow ? <AlertTriangle className="h-6 w-6 animate-pulse" /> : <Battery className="h-6 w-6" />}
            </div>
          </div>

          {/* Battery level bar */}
          <div className="mt-4">
            <div className="h-2 w-full bg-slate-200/60 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${isLow ? 'bg-rose-500' : 'bg-emerald-500'}`}
                style={{ width: `${batteryPercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-medium opacity-75 mt-1.5">
              <span>Batas Rendah: {lowThreshold} kWh</span>
              <span>Kapasitas Acuan: 200 kWh</span>
            </div>
          </div>

          {isLow && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-rose-700 dark:text-rose-300 bg-rose-100/50 dark:bg-rose-900/30 p-2 rounded-lg font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Sisa saldo rendah! Telegram alert telah dikirim atau disiapkan.</span>
            </div>
          )}
        </div>

        {/* Card: Rata-rata Penggunaan */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col justify-between md:col-span-2 transition-all hover:shadow-md text-slate-800 dark:text-slate-100">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold tracking-wider capitalize text-slate-500 dark:text-slate-400">
                Rata-rata Penggunaan
              </span>
              <div className="text-4xl font-extrabold tracking-tight mt-1 flex items-baseline">
                {overallAverageUsage.toFixed(2)}
                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 ml-1">kWh/hari</span>
              </div>
              <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                <span>≈ {formatRupiah(overallAverageUsage * kwhTariff)}/hari</span>
              </div>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
              <Activity className="h-6 w-6 animate-pulse" />
            </div>
          </div>
          
          <div className="mt-4 pt-3 border-t border-slate-50 dark:border-slate-800/60">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Total Konsumsi: <span className="font-semibold text-slate-700 dark:text-slate-300">{overallAverageUsageStats.totalConsumption.toFixed(2)} kWh</span> ({overallAverageUsageStats.diffDays} hari sejak {overallAverageUsageStats.earliestDateStr})
            </p>
          </div>
        </div>
      </div>
      </>
      )}

      {activeTab === 'prediction' && (
        <>
          {/* Prediksi Konsumsi Akhir Bulan Card */}
      {endOfMonthPrediction && (
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm transition-all hover:shadow-md space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-50 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <TrendingUp className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
                  Proyeksi & Prediksi Akhir Bulan
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full capitalize">
                    Estimasi Cerdas
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Estimasi total konsumsi listrik untuk bulan {endOfMonthPrediction.monthLabel} berdasarkan tren pemakaian saat ini.
                </p>
              </div>
            </div>
            
            <div className="text-left sm:text-right flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 sm:gap-0 bg-slate-50 dark:bg-slate-950/40 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800/60">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold capitalize tracking-wider">Tren Harian</span>
              <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{endOfMonthPrediction.dailyTrend.toFixed(2)} kWh/hari</span>
            </div>
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Progress Visualization */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>Alur Akumulasi Bulan Ini</span>
                <span className="text-slate-400">Target: {endOfMonthPrediction.daysInMonth} Hari</span>
              </div>
              
              {/* Stacked Progress Bar */}
              <div className="space-y-2">
                <div className="h-4.5 w-full bg-slate-100 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800/80 rounded-full overflow-hidden flex">
                  {/* Current Spent Progress */}
                  <div 
                    className="h-full bg-indigo-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, (endOfMonthPrediction.currentSpent / Math.max(1, endOfMonthPrediction.projectedTotal)) * 100)}%` }}
                    title={`Sudah Terpakai: ${endOfMonthPrediction.currentSpent} kWh`}
                  />
                  {/* Projected Additional Progress */}
                  <div 
                    className="h-full bg-amber-400 dark:bg-amber-500/80 transition-all duration-500 border-l border-white/25"
                    style={{ width: `${Math.min(100, (endOfMonthPrediction.projectedAdditional / Math.max(1, endOfMonthPrediction.projectedTotal)) * 100)}%` }}
                    title={`Estimasi Tambahan: ${endOfMonthPrediction.projectedAdditional} kWh`}
                  />
                </div>
                
                {/* Progress Legend */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] font-bold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-indigo-500 rounded-sm inline-block" />
                    <span className="text-slate-600 dark:text-slate-400">Sudah Terpakai ({endOfMonthPrediction.dayOfMonth} Hari): <span className="text-slate-900 dark:text-slate-200">{endOfMonthPrediction.currentSpent.toFixed(2)} kWh ({formatRupiah(endOfMonthPrediction.currentSpent * kwhTariff)})</span></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-amber-400 dark:bg-amber-500/80 rounded-sm inline-block" />
                    <span className="text-slate-600 dark:text-slate-400">Proyeksi Tambahan ({endOfMonthPrediction.remainingDays} Hari): <span className="text-slate-900 dark:text-slate-200">{endOfMonthPrediction.projectedAdditional.toFixed(2)} kWh ({formatRupiah(endOfMonthPrediction.projectedAdditional * kwhTariff)})</span></span>
                  </div>
                </div>
              </div>

              {/* Explanatory Formula Text */}
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50/50 dark:bg-slate-950/20 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/40">
                💡 <span className="font-semibold text-slate-700 dark:text-slate-300">Bagaimana ini dihitung?</span> Berdasarkan riwayat harian, Anda telah mengonsumsi <span className="font-bold text-indigo-600 dark:text-indigo-400">{endOfMonthPrediction.currentSpent.toFixed(2)} kWh</span> hingga hari ke-{endOfMonthPrediction.dayOfMonth}. Di sisa <span className="font-bold">{endOfMonthPrediction.remainingDays} hari</span> bulan ini, estimasi konsumsi Anda adalah <span className="font-bold text-amber-500">{endOfMonthPrediction.projectedAdditional.toFixed(2)} kWh</span> (diperoleh dari {endOfMonthPrediction.remainingDays} hari × rata-rata {endOfMonthPrediction.dailyTrend.toFixed(2)} kWh/hari), sehingga total estimasi akhir bulan mencapai <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{endOfMonthPrediction.projectedTotal.toFixed(2)} kWh ({formatRupiah(endOfMonthPrediction.projectedTotal * kwhTariff)})</span>.
              </p>
            </div>

            {/* Right: Feasibility Status (Kelayakan Token) */}
            <div className="lg:col-span-5 flex flex-col justify-between">
              {endOfMonthPrediction.willRunOut ? (
                <div className="p-4 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex flex-col h-full justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-extrabold text-xs tracking-wide capitalize">
                      <AlertTriangle className="h-4.5 w-4.5 text-rose-500 shrink-0 animate-pulse" />
                      <span>Sisa Token Tidak Cukup!</span>
                    </div>
                    <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">
                      Sisa saldo token Anda saat ini (<span className="font-extrabold">{endOfMonthPrediction.currentKwh.toFixed(2)} kWh</span>) diprediksi <span className="font-bold text-rose-600 dark:text-rose-400">habis sebelum akhir bulan</span> karena kebutuhan proyeksi tambahan Anda adalah <span className="font-bold">{endOfMonthPrediction.projectedAdditional.toFixed(2)} kWh</span>.
                    </p>
                  </div>
                  
                  <div className="bg-white/85 dark:bg-slate-950/80 p-3 rounded-xl border border-rose-100 dark:border-rose-900/20 text-center space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 capitalize tracking-widest flex items-center justify-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      Estimasi Tanggal Habis
                    </div>
                    <div className="text-lg font-black text-rose-600 dark:text-rose-400">
                      {endOfMonthPrediction.runOutDateStr}
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      Sekitar {Math.floor(endOfMonthPrediction.currentKwh / endOfMonthPrediction.dailyTrend)} hari lagi dari sekarang
                    </div>
                  </div>
                  
                  <p className="text-[10px] font-medium text-rose-600 dark:text-rose-400 text-center italic mt-1">
                    💡 Disarankan untuk melakukan Top Up token minimal sebesar {(endOfMonthPrediction.projectedAdditional - endOfMonthPrediction.currentKwh).toFixed(2)} kWh untuk mencukupi kebutuhan bulan ini.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl flex flex-col h-full justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-extrabold text-xs tracking-wide capitalize">
                      <CheckCircle className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
                      <span>Saldo Token Aman!</span>
                    </div>
                    <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                      Sisa Token saat ini (<span className="font-extrabold">{endOfMonthPrediction.currentKwh.toFixed(2)} kWh</span>) diperkirakan <span className="font-bold text-emerald-600 dark:text-emerald-400">cukup</span> hingga akhir bulan {endOfMonthPrediction.monthLabel}. 
                    </p>
                  </div>
                  
                  <div className="bg-white/85 dark:bg-slate-950/80 p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-900/20 text-center space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 capitalize tracking-widest flex items-center justify-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                      Estimasi Sisa Cadangan
                    </div>
                    <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                      +{(endOfMonthPrediction.currentKwh - endOfMonthPrediction.projectedAdditional).toFixed(2)} kWh
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      Cadangan aman melewati akhir bulan
                    </div>
                  </div>
                  
                  <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 text-center italic mt-1">
                    Aktivitas konsumsi Anda sangat efisien dan stabil di bawah kapasitas token saat ini.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Analisis Prediksi Kehabisan Saldo 30 Hari Card */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm transition-all hover:shadow-md space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-50 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
              <Timer className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
                Prediksi Sisa Hari & Deplesi Saldo
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full capitalize">
                  Pola 30 Hari Terakhir
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Analisis sisa waktu pemakaian listrik Anda berdasarkan rata-rata harian 30 hari terakhir.
              </p>
            </div>
          </div>
          
          <div className="text-left sm:text-right flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 sm:gap-0 bg-slate-50 dark:bg-slate-950/40 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800/60">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold capitalize tracking-wider">Rerata 30 Hari</span>
            <span className="text-sm font-black text-amber-600 dark:text-amber-400">{averageDailyUsage30Days.toFixed(2)} kWh/hari</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left panel: Data Summary */}
          <div className="lg:col-span-7 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Statistik Konsumsi 30 Hari Terakhir
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800/60 text-center">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 capitalize">Total Terpakai</div>
                  <div className="text-sm font-extrabold text-slate-800 dark:text-slate-200 mt-1">
                    {prediction30Days.total30DaysConsumption.toFixed(1)} kWh
                  </div>
                  <div className="text-[9px] font-medium text-slate-400 dark:text-slate-500">
                    {formatRupiah(prediction30Days.total30DaysConsumption * kwhTariff)}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800/60 text-center">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 capitalize">Frekuensi Catat</div>
                  <div className="text-sm font-extrabold text-slate-800 dark:text-slate-200 mt-1">
                    {prediction30Days.recordsCount} Kali
                  </div>
                  <div className="text-[9px] font-medium text-slate-400 dark:text-slate-500">
                    Pencatatan harian
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800/60 text-center">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 capitalize">Sisa Saldo</div>
                  <div className="text-sm font-extrabold text-slate-800 dark:text-slate-200 mt-1">
                    {currentKwh.toFixed(1)} kWh
                  </div>
                  <div className="text-[9px] font-medium text-slate-400 dark:text-slate-500">
                    Setara {formatRupiah(currentKwh * kwhTariff)}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50/50 dark:bg-slate-950/20 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/40">
                💡 <span className="font-semibold text-slate-700 dark:text-slate-300">Penjelasan Analisis:</span> Dengan sisa saldo <span className="font-bold">{currentKwh.toFixed(2)} kWh</span> dan pola konsumsi rata-rata <span className="font-bold">{averageDailyUsage30Days.toFixed(2)} kWh/hari</span> yang dihitung dari akumulasi pemakaian sebesar <span className="font-bold">{prediction30Days.total30DaysConsumption.toFixed(2)} kWh</span> selama periode 30 hari terakhir, sisa energi listrik Anda diproyeksikan akan habis dalam waktu <span className="font-extrabold text-amber-600 dark:text-amber-400">{prediction30Days.daysRemaining} hari</span>.
              </p>
            </div>
            
            {/* Recommendations / Top up Simulator */}
            {averageDailyUsage30Days > 0 && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 capitalize tracking-wider block mb-2">Simulasi Durasi Tambahan Top Up:</span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="px-2 py-1.5 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100/40 dark:border-emerald-900/10 rounded-lg text-center">
                    <span className="block text-[10px] font-bold text-emerald-800 dark:text-emerald-300">Rp 50.000</span>
                    <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 block mt-0.5">+{(50000 / kwhTariff / averageDailyUsage30Days).toFixed(1)} Hari</span>
                    <span className="text-[9px] text-slate-450 block">≈ {(50000 / kwhTariff).toFixed(1)} kWh</span>
                  </div>
                  <div className="px-2 py-1.5 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100/40 dark:border-emerald-900/10 rounded-lg text-center">
                    <span className="block text-[10px] font-bold text-emerald-800 dark:text-emerald-300">Rp 100.000</span>
                    <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 block mt-0.5">+{(100000 / kwhTariff / averageDailyUsage30Days).toFixed(1)} Hari</span>
                    <span className="text-[9px] text-slate-450 block">≈ {(100000 / kwhTariff).toFixed(1)} kWh</span>
                  </div>
                  <div className="px-2 py-1.5 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100/40 dark:border-emerald-900/10 rounded-lg text-center">
                    <span className="block text-[10px] font-bold text-emerald-800 dark:text-emerald-300">Rp 250.000</span>
                    <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 block mt-0.5">+{(250000 / kwhTariff / averageDailyUsage30Days).toFixed(1)} Hari</span>
                    <span className="text-[9px] text-slate-450 block">≈ {(250000 / kwhTariff).toFixed(1)} kWh</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right panel: Prediction Output & Status */}
          <div className="lg:col-span-5">
            {prediction30Days.status === 'critical' ? (
              <div className="p-4 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex flex-col h-full justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-extrabold text-xs tracking-wide capitalize">
                    <AlertTriangle className="h-4.5 w-4.5 text-rose-500 shrink-0 animate-pulse" />
                    <span>Kehabisan Sangat Dekat!</span>
                  </div>
                  <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">
                    Berdasarkan rata-rata pemakaian 30 hari terakhir, sisa energi kWh Anda diperkirakan akan <span className="font-bold text-rose-600 dark:text-rose-400">habis dalam waktu sangat dekat (di bawah 3 hari)</span>.
                  </p>
                </div>
                
                <div className="bg-white/85 dark:bg-slate-950/80 p-3.5 rounded-xl border border-rose-100 dark:border-rose-900/20 text-center space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 capitalize tracking-widest flex items-center justify-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Perkiraan Tanggal Habis
                  </div>
                  <div className="text-lg font-black text-rose-600 dark:text-rose-400">
                    {prediction30Days.depletionDateStr}
                  </div>
                  <div className="text-[10px] font-bold text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 py-0.5 rounded inline-block px-2 mt-1">
                    Sekitar {prediction30Days.daysRemaining} hari lagi
                  </div>
                </div>
                
                <p className="text-[10px] font-medium text-rose-600 dark:text-rose-400 text-center italic mt-1">
                  ⚠️ Segera top up untuk menghindari listrik padam mendadak!
                </p>
              </div>
            ) : prediction30Days.status === 'warning' ? (
              <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl flex flex-col h-full justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-extrabold text-xs tracking-wide capitalize">
                    <AlertTriangle className="h-4.5 w-4.5 text-amber-500 shrink-0" />
                    <span>Waspada Batas Saldo!</span>
                  </div>
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    Konsumsi energi Anda stabil, namun sisa saldo saat ini diperkirakan hanya cukup untuk <span className="font-bold text-amber-600 dark:text-amber-400">7 hingga 10 hari ke depan</span>.
                  </p>
                </div>
                
                <div className="bg-white/85 dark:bg-slate-950/80 p-3.5 rounded-xl border border-amber-100 dark:border-amber-900/20 text-center space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 capitalize tracking-widest flex items-center justify-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Perkiraan Tanggal Habis
                  </div>
                  <div className="text-lg font-black text-amber-600 dark:text-amber-400">
                    {prediction30Days.depletionDateStr}
                  </div>
                  <div className="text-[10px] font-bold text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 py-0.5 rounded inline-block px-2 mt-1">
                    Sekitar {prediction30Days.daysRemaining} hari lagi
                  </div>
                </div>
                
                <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400 text-center italic mt-1">
                  💡 Persiapkan anggaran top up dalam beberapa hari ke depan.
                </p>
              </div>
            ) : prediction30Days.status === 'safe' ? (
              <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl flex flex-col h-full justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-extrabold text-xs tracking-wide capitalize">
                    <CheckCircle className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
                    <span>Cadangan Saldo Sangat Aman</span>
                  </div>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                    Sisa kWh saat ini melimpah! Berdasarkan rata-rata penggunaan 30 hari terakhir, saldo Anda akan bertahan <span className="font-bold text-emerald-600 dark:text-emerald-400">lebih dari 10 hari</span>.
                  </p>
                </div>
                
                <div className="bg-white/85 dark:bg-slate-950/80 p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-900/20 text-center space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 capitalize tracking-widest flex items-center justify-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                    Perkiraan Tanggal Habis
                  </div>
                  <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                    {prediction30Days.depletionDateStr}
                  </div>
                  <div className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 py-0.5 rounded inline-block px-2 mt-1">
                    Sekitar {prediction30Days.daysRemaining} hari lagi
                  </div>
                </div>
                
                <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 text-center italic mt-1">
                  🎉 Pertahankan pola penggunaan hemat energi Anda!
                </p>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl flex flex-col h-full justify-center items-center text-center p-6 space-y-2">
                <Activity className="h-8 w-8 text-slate-400 animate-pulse" />
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Data Tidak Mencukupi</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                  Sistem membutuhkan setidaknya beberapa catatan mutasi pengurangan konsumsi harian untuk membuat kalkulasi prediksi 30 hari.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
        </>
      )}

      {/* Grid of Charts */}
      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 gap-6">
        {/* Daily chart (Full Width) with Integrated Filter */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800/60">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-indigo-500 animate-pulse" />
                Tren Pemakaian Listrik
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedMonth === 'all' 
                  ? 'Pemakaian daya listrik seluruh riwayat data harian (kWh)' 
                  : `Pemakaian daya listrik harian untuk ${monthOptions.find(o => o.value === selectedMonth)?.label || ''} (kWh)`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 bg-slate-50 dark:bg-slate-900/40 p-2 rounded-xl border border-slate-100 dark:border-slate-800/50 self-start lg:self-center">
              <div className="flex items-center gap-1 px-1">
                <Filter className="h-3.5 w-3.5 text-indigo-500" />
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 capitalize tracking-wider hidden xs:inline">Filter</span>
              </div>
              <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden xs:block" />
              
              <div className="flex flex-col text-right">
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium capitalize tracking-wider leading-none mb-1">
                  {selectedMonth === 'all' ? 'Total Riwayat' : 'Total Konsumsi'}
                </span>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400" title={formatRupiah(selectedMonthStats.total * kwhTariff)}>
                  {selectedMonthStats.total.toFixed(2)} kWh ({formatRupiah(selectedMonthStats.total * kwhTariff)})
                </span>
              </div>
              <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
              <div className="flex flex-col text-right">
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium capitalize tracking-wider leading-none mb-1">Rata-rata</span>
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400" title={formatRupiah(selectedMonthStats.average * kwhTariff)}>
                  {selectedMonthStats.average.toFixed(2)} kWh/hari
                </span>
              </div>
              
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-lg text-slate-700 dark:text-slate-200 text-xs font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer min-w-[130px] shadow-2xs"
              >
                <option value="all">Semua Data</option>
                {monthOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="h-[250px] w-full">
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorDaily" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                  <XAxis dataKey="date" stroke="var(--chart-text)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--chart-text)" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--chart-tooltip-bg)', borderRadius: '12px', border: '1px solid var(--chart-tooltip-border)', fontSize: '12px', color: 'var(--chart-text)' }}
                    labelStyle={{ fontWeight: 'bold' }}
                    formatter={(value: any) => [
                      `${parseFloat(value).toFixed(2)} kWh (${formatRupiah(parseFloat(value) * kwhTariff)})`,
                      'Konsumsi'
                    ]}
                  />
                  <Area type="monotone" dataKey="kWh" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorDaily)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">
                Belum ada data konsumsi harian.
              </div>
            )}
          </div>
        </div>

        {/* Two-column layout for Weekly and Monthly */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weekly consumption trend chart */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-violet-500" />
                    Tren Konsumsi Mingguan
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total pemakaian kWh yang dikelompokkan per minggu</p>
                </div>
                {weeklyData.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <div className="px-2 py-0.5 rounded-md bg-violet-50 dark:bg-violet-950/40 border border-violet-100/50 dark:border-violet-900/30 text-[10px] text-violet-700 dark:text-violet-450 font-bold">
                      Rata-rata: {weeklyStats.average.toFixed(2)} kWh
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="h-[250px] w-full mt-2">
              {weeklyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorWeekly" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                    <XAxis dataKey="week" stroke="var(--chart-text)" fontSize={11} tickLine={false} />
                    <YAxis stroke="var(--chart-text)" fontSize={11} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--chart-tooltip-bg)', borderRadius: '12px', border: '1px solid var(--chart-tooltip-border)', fontSize: '12px', color: 'var(--chart-text)' }}
                      labelStyle={{ fontWeight: 'bold' }}
                      formatter={(value: any) => [
                        `${parseFloat(value).toFixed(2)} kWh (${formatRupiah(parseFloat(value) * kwhTariff)})`,
                        'Konsumsi'
                      ]}
                    />
                    <Area type="monotone" dataKey="kWh" stroke="#8b5cf6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorWeekly)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">
                  Belum ada data konsumsi mingguan.
                </div>
              )}
            </div>

            {weeklyData.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-50 dark:border-slate-800/60 flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                <span>Puncak Pemakaian: <span className="text-violet-600 dark:text-violet-400">{weeklyStats.peak.toFixed(2)} kWh</span></span>
                <span>Periode Puncak: <span className="text-slate-700 dark:text-slate-300">{weeklyStats.peakWeek}</span></span>
              </div>
            )}
          </div>

          {/* Monthly chart */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-emerald-500" />
                    Akumulasi Konsumsi Bulanan
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Jumlah pemakaian kWh kumulatif per bulan</p>
                </div>
                {monthlyData.length > 0 && (
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-450 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
                    title="Ekspor ke CSV"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden xs:inline">Ekspor CSV</span>
                  </button>
                )}
              </div>
            </div>
            
            <div className="h-[250px] w-full mt-2">
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                    <XAxis dataKey="month" stroke="var(--chart-text)" fontSize={11} tickLine={false} />
                    <YAxis stroke="var(--chart-text)" fontSize={11} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--chart-tooltip-bg)', borderRadius: '12px', border: '1px solid var(--chart-tooltip-border)', fontSize: '12px', color: 'var(--chart-text)' }}
                      labelStyle={{ fontWeight: 'bold' }}
                      formatter={(value: any) => [
                        `${parseFloat(value).toFixed(2)} kWh (${formatRupiah(parseFloat(value) * kwhTariff)})`,
                        'Konsumsi'
                      ]}
                    />
                    <Bar dataKey="kWh" fill="#0d9488" radius={[6, 6, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">
                  Belum ada data konsumsi bulanan.
                </div>
              )}
            </div>

            {monthlyData.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 space-y-3">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  <span>Rata-rata Bulanan: <span className="text-emerald-600 dark:text-emerald-400">{(monthlyData.reduce((sum, m) => sum + m.kWh, 0) / monthlyData.length).toFixed(2)} kWh ({formatRupiah((monthlyData.reduce((sum, m) => sum + m.kWh, 0) / monthlyData.length) * kwhTariff)})</span></span>
                  <span>Total Bulan: <span className="text-slate-700 dark:text-slate-300">{monthlyData.length} Bulan</span></span>
                </div>

                <div className="bg-slate-50/50 dark:bg-slate-950/20 rounded-xl p-3 border border-slate-100 dark:border-slate-800/40">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 capitalize tracking-wider block mb-2">Riwayat Detail Bulanan & Rupiah</span>
                  <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                    {[...monthlyData].reverse().map((item, index) => (
                      <div key={index} className="flex justify-between items-center text-xs py-1 px-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50">
                        <span className="font-semibold text-slate-600 dark:text-slate-400">{item.month}</span>
                        <div className="flex items-center gap-3 font-mono font-bold">
                          <span className="text-slate-700 dark:text-slate-300">{item.kWh.toFixed(2)} kWh</span>
                          <span className="text-emerald-600 dark:text-emerald-400">{formatRupiah(item.kWh * kwhTariff)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
