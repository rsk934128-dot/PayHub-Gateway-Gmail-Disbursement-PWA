import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  Activity,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Transaction } from '../types';

interface Props {
  transactions: Transaction[];
  lang?: 'en' | 'bn';
}

interface DailySummaryPoint {
  date: string;
  fullDate: string;
  totalDisbursedBdt: number;
  bkashBdt: number;
  nagadBdt: number;
  stripeUsd: number;
  totalCount: number;
  completedCount: number;
  pendingCount: number;
  failedCount: number;
  successRate: number | null; // null if no transactions
  displayRate: number;
}

type TimeframeOption = 7 | 14 | 30;
type ViewMode = 'combined' | 'volume' | 'success';

export const LedgerSummaryCard: React.FC<Props> = ({ transactions, lang = 'en' }) => {
  const [timeframe, setTimeframe] = useState<TimeframeOption>(14);
  const [viewMode, setViewMode] = useState<ViewMode>('combined');
  const [isExpanded, setIsExpanded] = useState(true);

  // Compute daily metrics across the selected timeframe
  const { dailyData, summaryStats } = useMemo(() => {
    const dayMap = new Map<
      string,
      {
        bKash: number;
        nagad: number;
        stripe: number;
        totalBdt: number;
        completed: number;
        pending: number;
        failed: number;
        total: number;
      }
    >();

    const now = new Date();
    // Seed calendar days for the timeframe
    for (let i = timeframe - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, {
        bKash: 0,
        nagad: 0,
        stripe: 0,
        totalBdt: 0,
        completed: 0,
        pending: 0,
        failed: 0,
        total: 0,
      });
    }

    let overallCompleted = 0;
    let overallFailed = 0;
    let overallPending = 0;
    let overallDisbursedBdt = 0;
    let overallStripeUsd = 0;
    let daysWithTxns = 0;

    transactions.forEach((tx) => {
      const txKey = new Date(tx.createdAt).toISOString().slice(0, 10);
      const entry = dayMap.get(txKey);
      if (!entry) return;

      entry.total += 1;
      if (tx.status === 'COMPLETED') {
        entry.completed += 1;
        overallCompleted += 1;

        if (tx.gateway === 'BKASH') {
          entry.bKash += tx.amount;
          entry.totalBdt += tx.amount;
          overallDisbursedBdt += tx.amount;
        } else if (tx.gateway === 'NAGAD') {
          entry.nagad += tx.amount;
          entry.totalBdt += tx.amount;
          overallDisbursedBdt += tx.amount;
        } else if (tx.gateway === 'STRIPE') {
          entry.stripe += tx.amount;
          overallStripeUsd += tx.amount;
          // Approximate BDT conversion for unified volume bar (1 USD ~ 120 BDT)
          entry.totalBdt += tx.amount * 120;
        }
      } else if (tx.status === 'FAILED') {
        entry.failed += 1;
        overallFailed += 1;
      } else {
        entry.pending += 1;
        overallPending += 1;
      }
    });

    const points: DailySummaryPoint[] = [];

    dayMap.forEach((val, dateKey) => {
      const dateObj = new Date(dateKey + 'T00:00:00');
      const formattedDate = dateObj.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
        month: 'short',
        day: 'numeric',
      });

      let rate: number | null = null;
      let display = 100;

      if (val.total > 0) {
        daysWithTxns += 1;
        const terminalCount = val.completed + val.failed;
        if (terminalCount > 0) {
          rate = Math.round((val.completed / terminalCount) * 1000) / 10;
        } else {
          rate = 100;
        }
        display = rate;
      }

      points.push({
        date: formattedDate,
        fullDate: dateKey,
        totalDisbursedBdt: Math.round(val.totalBdt),
        bkashBdt: Math.round(val.bKash),
        nagadBdt: Math.round(val.nagad),
        stripeUsd: Math.round(val.stripe),
        totalCount: val.total,
        completedCount: val.completed,
        pendingCount: val.pending,
        failedCount: val.failed,
        successRate: rate,
        displayRate: display,
      });
    });

    const totalTerminal = overallCompleted + overallFailed;
    const overallSuccessRate =
      totalTerminal > 0 ? Math.round((overallCompleted / totalTerminal) * 1000) / 10 : 100;

    const avgDailyVelocity =
      daysWithTxns > 0 ? Math.round(overallDisbursedBdt / daysWithTxns) : 0;

    return {
      dailyData: points,
      summaryStats: {
        totalDisbursedBdt: overallDisbursedBdt,
        totalStripeUsd: overallStripeUsd,
        completedCount: overallCompleted,
        failedCount: overallFailed,
        pendingCount: overallPending,
        totalCount: overallCompleted + overallFailed + overallPending,
        overallSuccessRate,
        avgDailyVelocity,
        activeDays: daysWithTxns,
      },
    };
  }, [transactions, timeframe, lang]);

  // Max volume for Y-axis scaling
  const maxVolume = useMemo(() => {
    const maxVal = Math.max(...dailyData.map((d) => d.totalDisbursedBdt), 1000);
    return Math.ceil(maxVal * 1.15);
  }, [dailyData]);

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const point = payload[0]?.payload as DailySummaryPoint;
    if (!point) return null;

    return (
      <div className="bg-slate-950/95 border border-slate-700/80 p-3.5 rounded-xl shadow-2xl backdrop-blur-md text-xs min-w-[220px]">
        {/* Date header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
          <span className="font-semibold text-white">{point.date}</span>
          <span className="font-mono text-[10px] text-slate-400">{point.fullDate}</span>
        </div>

        <div className="space-y-2">
          {/* Daily Disbursement Total */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">{lang === 'bn' ? 'দৈনিক মোট বিতরণ' : 'Disbursement Total'}</span>
            <span className="font-mono font-bold text-white">
              ৳{point.totalDisbursedBdt.toLocaleString('en-US')}
            </span>
          </div>

          {/* Gateway breakdown if present */}
          {point.totalDisbursedBdt > 0 && (
            <div className="pl-2 border-l border-slate-800 space-y-1 text-[11px]">
              {point.bkashBdt > 0 && (
                <div className="flex justify-between text-pink-400">
                  <span>bKash:</span>
                  <span className="font-mono">৳{point.bkashBdt.toLocaleString()}</span>
                </div>
              )}
              {point.nagadBdt > 0 && (
                <div className="flex justify-between text-orange-400">
                  <span>Nagad:</span>
                  <span className="font-mono">৳{point.nagadBdt.toLocaleString()}</span>
                </div>
              )}
              {point.stripeUsd > 0 && (
                <div className="flex justify-between text-indigo-400">
                  <span>Stripe:</span>
                  <span className="font-mono">${point.stripeUsd.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}

          {/* Success Rate */}
          <div className="border-t border-slate-800/80 pt-2 flex items-center justify-between gap-4">
            <span className="text-slate-400">{lang === 'bn' ? 'সফলতার হার' : 'Success Rate'}</span>
            <div className="flex items-center gap-1.5 font-mono font-bold">
              {point.successRate !== null ? (
                <span
                  className={
                    point.successRate >= 95
                      ? 'text-emerald-400'
                      : point.successRate >= 80
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }
                >
                  {point.successRate.toFixed(1)}%
                </span>
              ) : (
                <span className="text-slate-500 font-normal text-[11px]">
                  {lang === 'bn' ? 'লেনদেন নেই' : 'No txns'}
                </span>
              )}
            </div>
          </div>

          {/* Transaction counts */}
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{lang === 'bn' ? 'স্ট্যাটাস বিভাজন' : 'Volume Status'}</span>
            <span className="font-mono">
              <span className="text-emerald-400 font-semibold">{point.completedCount}✓</span>
              {point.failedCount > 0 && (
                <span className="text-rose-400 font-semibold ml-1.5">{point.failedCount}✕</span>
              )}
              {point.pendingCount > 0 && (
                <span className="text-amber-400 font-semibold ml-1.5">{point.pendingCount}⏳</span>
              )}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden backdrop-blur-sm">
      {/* Top Header & Executive Summary Bar */}
      <div className="p-5 border-b border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Card Title & Icon */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-emerald-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold text-white">
                  {lang === 'bn' ? 'দৈনিক বিতরণ ও সফলতার ড্যাশবোর্ড' : 'Daily Disbursement & Success Rate Analytics'}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-semibold">
                  SLA Target 95%
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {lang === 'bn'
                  ? `বিগত ${timeframe} দিনের দৈনিক পেআউট ভলিউম এবং সাকসেস রেট পারফরম্যান্স মনিটরিং`
                  : `Visualizing ${timeframe}-day daily disbursement totals and real-time completion efficiency`}
              </p>
            </div>
          </div>

          {/* Controls: Timeframe & View Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Buttons */}
            <div className="flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('combined')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  viewMode === 'combined'
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lang === 'bn' ? 'সম্মিলিত ভিউ' : 'Combined'}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('volume')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  viewMode === 'volume'
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lang === 'bn' ? 'বিতরণ' : 'Volume'}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('success')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  viewMode === 'success'
                    ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lang === 'bn' ? 'সফলতার হার' : 'Success Rate'}
              </button>
            </div>

            {/* Timeframe Selector */}
            <div className="flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs font-mono">
              {([7, 14, 30] as TimeframeOption[]).map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setTimeframe(days)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                    timeframe === days
                      ? 'bg-slate-800 text-white font-bold border border-slate-700/80 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {days}D
                </button>
              ))}
            </div>

            {/* Minimize / Maximize */}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              title={isExpanded ? 'Collapse chart' : 'Expand chart'}
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Executive KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/80">
          {/* Period Total Disbursed */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 block">
              {lang === 'bn' ? `${timeframe} দিনের মোট বিতরণ` : `${timeframe}D Total Disbursed`}
            </span>
            <div className="text-lg font-black text-white font-mono mt-0.5">
              ৳{summaryStats.totalDisbursedBdt.toLocaleString('en-US')}
            </div>
            {summaryStats.totalStripeUsd > 0 && (
              <span className="text-[10px] text-indigo-400 font-mono">
                + ${summaryStats.totalStripeUsd.toLocaleString()} USD
              </span>
            )}
          </div>

          {/* Overall Success Rate */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                {lang === 'bn' ? 'গড় সফলতার হার' : 'Success Rate'}
              </span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div
              className={`text-lg font-black font-mono mt-0.5 ${
                summaryStats.overallSuccessRate >= 95
                  ? 'text-emerald-400'
                  : summaryStats.overallSuccessRate >= 80
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {summaryStats.overallSuccessRate.toFixed(1)}%
            </div>
            <span className="text-[10px] text-slate-400">
              {summaryStats.completedCount} / {summaryStats.totalCount} completed
            </span>
          </div>

          {/* Daily Average Velocity */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 block">
              {lang === 'bn' ? 'দৈনিক গড় পেআউট' : 'Avg Daily Velocity'}
            </span>
            <div className="text-lg font-black text-white font-mono mt-0.5">
              ৳{summaryStats.avgDailyVelocity.toLocaleString('en-US')}
            </div>
            <span className="text-[10px] text-slate-400">
              {summaryStats.activeDays} active disbursement days
            </span>
          </div>

          {/* Failed / At-Risk Count */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                {lang === 'bn' ? 'ব্যর্থ / সমাধান প্রয়োজন' : 'Failed Disbursements'}
              </span>
              {summaryStats.failedCount > 0 ? (
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </div>
            <div
              className={`text-lg font-black font-mono mt-0.5 ${
                summaryStats.failedCount > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {summaryStats.failedCount}
            </div>
            <span className="text-[10px] text-slate-400">
              {summaryStats.failedCount === 0 ? 'Zero gateway failures' : 'Requires idempotency check'}
            </span>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      {isExpanded && (
        <div className="p-5">
          {/* Chart Legend / Guide */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs mb-3 text-slate-400">
            <div className="flex flex-wrap items-center gap-4">
              {(viewMode === 'combined' || viewMode === 'volume') && (
                <span className="flex items-center gap-1.5 text-indigo-400 font-medium">
                  <span className="w-2.5 h-2.5 rounded bg-indigo-500 shadow-sm" />
                  <span>{lang === 'bn' ? 'দৈনিক বিতরণ (BDT)' : 'Daily Disbursed Total (৳)'}</span>
                </span>
              )}
              {(viewMode === 'combined' || viewMode === 'success') && (
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm" />
                  <span>{lang === 'bn' ? 'সফলতার হার (%)' : 'Daily Success Rate (%)'}</span>
                </span>
              )}
              <span className="flex items-center gap-1 text-slate-500 text-[11px]">
                <span className="w-3 h-0.5 bg-slate-600 border-dashed" />
                <span>95% Target SLA</span>
              </span>
            </div>

            <div className="text-[11px] font-mono text-slate-400">
              {lang === 'bn' ? 'বামে ভলিউম (৳) · ডানে হার (%)' : 'Left Axis: BDT (৳) · Right Axis: Success %'}
            </div>
          </div>

          {/* Recharts Container */}
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  {/* Gradient for Disbursement Volume Bars / Area */}
                  <linearGradient id="disbursementVolumeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.85} />
                    <stop offset="90%" stopColor="#4338ca" stopOpacity={0.35} />
                  </linearGradient>
                  {/* Subtle Area Glow */}
                  <linearGradient id="successRateGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

                {/* X Axis */}
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />

                {/* Left Y Axis: Disbursement Volume (BDT) */}
                <YAxis
                  yAxisId="volume"
                  orientation="left"
                  stroke="#6366f1"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                  tickFormatter={(val) => (val >= 1000 ? `৳${(val / 1000).toFixed(0)}k` : `৳${val}`)}
                  domain={[0, maxVolume]}
                  hide={viewMode === 'success'}
                />

                {/* Right Y Axis: Success Rate (%) */}
                <YAxis
                  yAxisId="rate"
                  orientation="right"
                  stroke="#10b981"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                  tickFormatter={(val) => `${val}%`}
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 95, 100]}
                  hide={viewMode === 'volume'}
                />

                <Tooltip content={<CustomTooltip />} />

                {/* 95% SLA Target Reference Line */}
                {(viewMode === 'combined' || viewMode === 'success') && (
                  <ReferenceLine
                    yAxisId="rate"
                    y={95}
                    stroke="#059669"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                  />
                )}

                {/* Volume Bar */}
                {(viewMode === 'combined' || viewMode === 'volume') && (
                  <Bar
                    yAxisId="volume"
                    dataKey="totalDisbursedBdt"
                    name="Daily Disbursed"
                    fill="url(#disbursementVolumeGrad)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={32}
                  />
                )}

                {/* Success Rate Area Fill in Success Only mode */}
                {viewMode === 'success' && (
                  <Area
                    yAxisId="rate"
                    type="monotone"
                    dataKey="displayRate"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#successRateGlow)"
                  />
                )}

                {/* Success Rate Line */}
                {(viewMode === 'combined' || viewMode === 'success') && (
                  <Line
                    yAxisId="rate"
                    type="monotone"
                    dataKey="displayRate"
                    name="Success Rate"
                    stroke="#34d399"
                    strokeWidth={2.5}
                    connectNulls={true}
                    dot={{
                      r: 3,
                      fill: '#10b981',
                      stroke: '#064e3b',
                      strokeWidth: 1.5,
                    }}
                    activeDot={{
                      r: 6,
                      fill: '#34d399',
                      stroke: '#ffffff',
                      strokeWidth: 2,
                    }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
