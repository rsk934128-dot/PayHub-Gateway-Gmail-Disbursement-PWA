import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  BarChart3,
  LineChart,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { Transaction } from '../types';

interface Props {
  transactions: Transaction[];
  lang?: 'en' | 'bn';
}

interface DailyPoint {
  date: string;
  fullDate: string;
  bKash: number;
  nagad: number;
  stripe: number;
  total: number;
  count: number;
}

export const DisbursementChart: React.FC<Props> = ({ transactions, lang = 'en' }) => {
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');
  const [gatewayView, setGatewayView] = useState<'ALL' | 'BKASH' | 'NAGAD' | 'STRIPE'>('ALL');
  const [isExpanded, setIsExpanded] = useState(true);

  // Calculate 30-day continuous timeline
  const { chartData, totals } = useMemo(() => {
    const days: DailyPoint[] = [];
    const now = new Date();

    const dayMap = new Map<string, { bKash: number; nagad: number; stripe: number; count: number }>();

    // Seed previous 30 calendar days
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10);
      dayMap.set(dateKey, { bKash: 0, nagad: 0, stripe: 0, count: 0 });
    }

    let bKashTotal = 0;
    let nagadTotal = 0;
    let stripeTotal = 0;

    transactions.forEach((tx) => {
      if (tx.status === 'FAILED') return;
      const txDateKey = new Date(tx.createdAt).toISOString().slice(0, 10);
      const entry = dayMap.get(txDateKey);
      if (entry) {
        entry.count += 1;
        if (tx.gateway === 'BKASH') {
          entry.bKash += tx.amount;
          bKashTotal += tx.amount;
        } else if (tx.gateway === 'NAGAD') {
          entry.nagad += tx.amount;
          nagadTotal += tx.amount;
        } else if (tx.gateway === 'STRIPE') {
          // Normalize USD/EUR to approximate BDT (1 USD = 120 BDT) for unified scale
          const bdtEquiv =
            tx.currency === 'USD'
              ? tx.amount * 120
              : tx.currency === 'EUR'
              ? tx.amount * 130
              : tx.currency === 'GBP'
              ? tx.amount * 155
              : tx.amount;
          entry.stripe += bdtEquiv;
          stripeTotal += bdtEquiv;
        }
      }
    });

    dayMap.forEach((vals, dateKey) => {
      const dateObj = new Date(dateKey + 'T00:00:00');
      const formattedDate = dateObj.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
        month: 'short',
        day: 'numeric',
      });

      days.push({
        date: formattedDate,
        fullDate: dateKey,
        bKash: Math.round(vals.bKash),
        nagad: Math.round(vals.nagad),
        stripe: Math.round(vals.stripe),
        total: Math.round(vals.bKash + vals.nagad + vals.stripe),
        count: vals.count,
      });
    });

    return {
      chartData: days,
      totals: {
        bKash: bKashTotal,
        nagad: nagadTotal,
        stripe: stripeTotal,
        combined: bKashTotal + nagadTotal + stripeTotal,
      },
    };
  }, [transactions, lang]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload as DailyPoint;
      return (
        <div className="bg-slate-950/95 border border-slate-700/80 p-3.5 rounded-xl shadow-2xl backdrop-blur-md text-xs min-w-[200px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 font-mono text-slate-400">
            <span className="font-semibold text-white">{point.date}</span>
            <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
              {point.count} {lang === 'bn' ? 'টি লেনদেন' : 'txns'}
            </span>
          </div>

          <div className="space-y-1.5">
            {(gatewayView === 'ALL' || gatewayView === 'BKASH') && (
              <div className="flex items-center justify-between gap-3 text-pink-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-pink-500" />
                  bKash
                </span>
                <span className="font-mono font-bold">
                  ৳{point.bKash.toLocaleString('en-US')}
                </span>
              </div>
            )}

            {(gatewayView === 'ALL' || gatewayView === 'NAGAD') && (
              <div className="flex items-center justify-between gap-3 text-orange-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  Nagad
                </span>
                <span className="font-mono font-bold">
                  ৳{point.nagad.toLocaleString('en-US')}
                </span>
              </div>
            )}

            {(gatewayView === 'ALL' || gatewayView === 'STRIPE') && (
              <div className="flex items-center justify-between gap-3 text-indigo-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  Stripe (BDT)
                </span>
                <span className="font-mono font-bold">
                  ৳{point.stripe.toLocaleString('en-US')}
                </span>
              </div>
            )}

            {gatewayView === 'ALL' && (
              <div className="border-t border-slate-800/80 pt-1.5 mt-1.5 flex items-center justify-between gap-3 text-slate-200">
                <span className="font-semibold">{lang === 'bn' ? 'দৈনিক মোট' : 'Day Total'}</span>
                <span className="font-mono font-black text-emerald-400">
                  ৳{point.total.toLocaleString('en-US')}
                </span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-slate-900/80 rounded-2xl border border-slate-800 shadow-xl overflow-hidden transition-all">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-white text-sm sm:text-base">
              {lang === 'bn'
                ? 'গত ৩০ দিনের গেটওয়ে ডিসবার্সমেন্ট চিত্র'
                : '30-Day Gateway Disbursement Trends'}
            </h3>
            <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded-full border border-slate-700">
              Recharts
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {lang === 'bn'
              ? 'বিকাশ, নগদ এবং স্ট্রাইপ গেটওয়ের দৈনিক লেনদেন ও ফান্ড আউটফ্লো পরিসংখ্যান।'
              : 'Daily transaction volume and payout trends across bKash, Nagad, and Stripe.'}
          </p>
        </div>

        {/* Controls Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Gateway Filter Tabs */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center text-xs">
            <button
              onClick={() => setGatewayView('ALL')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                gatewayView === 'ALL'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {lang === 'bn' ? 'সব' : 'All'}
            </button>
            <button
              onClick={() => setGatewayView('BKASH')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                gatewayView === 'BKASH'
                  ? 'bg-pink-950 text-pink-300 border border-pink-800/60'
                  : 'text-slate-400 hover:text-pink-400'
              }`}
            >
              bKash
            </button>
            <button
              onClick={() => setGatewayView('NAGAD')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                gatewayView === 'NAGAD'
                  ? 'bg-orange-950 text-orange-300 border border-orange-800/60'
                  : 'text-slate-400 hover:text-orange-400'
              }`}
            >
              Nagad
            </button>
            <button
              onClick={() => setGatewayView('STRIPE')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                gatewayView === 'STRIPE'
                  ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/60'
                  : 'text-slate-400 hover:text-indigo-400'
              }`}
            >
              Stripe
            </button>
          </div>

          {/* Chart Type Toggle */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center text-xs">
            <button
              onClick={() => setChartType('area')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                chartType === 'area'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Area Trend Chart"
            >
              <LineChart className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                chartType === 'bar'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Bar Comparison Chart"
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Expand/Collapse */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            title={isExpanded ? 'Collapse chart' : 'Expand chart'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Chart Content */}
      {isExpanded && (
        <div className="p-4 sm:p-6 space-y-5">
          {/* Quick 30-Day Totals Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-pink-500" />
                bKash (30d)
              </span>
              <div className="text-base font-black font-mono text-pink-400 mt-1">
                ৳{totals.bKash.toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                Nagad (30d)
              </span>
              <div className="text-base font-black font-mono text-orange-400 mt-1">
                ৳{totals.nagad.toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                Stripe Equiv (30d)
              </span>
              <div className="text-base font-black font-mono text-indigo-400 mt-1">
                ৳{totals.stripe.toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {lang === 'bn' ? 'সর্বমোট (৩০ দিন)' : 'Total (30d)'}
              </span>
              <div className="text-base font-black font-mono text-emerald-400 mt-1">
                ৳{totals.combined.toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </div>
            </div>
          </div>

          {/* Recharts Container */}
          <div className="h-[270px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'area' ? (
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorBkash" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorNagad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorStripe" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                    tickFormatter={(val) => `৳${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }}
                  />

                  {(gatewayView === 'ALL' || gatewayView === 'BKASH') && (
                    <Area
                      type="monotone"
                      dataKey="bKash"
                      name="bKash (BDT)"
                      stroke="#ec4899"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorBkash)"
                    />
                  )}

                  {(gatewayView === 'ALL' || gatewayView === 'NAGAD') && (
                    <Area
                      type="monotone"
                      dataKey="nagad"
                      name="Nagad (BDT)"
                      stroke="#f97316"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorNagad)"
                    />
                  )}

                  {(gatewayView === 'ALL' || gatewayView === 'STRIPE') && (
                    <Area
                      type="monotone"
                      dataKey="stripe"
                      name="Stripe (BDT Equiv)"
                      stroke="#6366f1"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorStripe)"
                    />
                  )}
                </AreaChart>
              ) : (
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                    tickFormatter={(val) => `৳${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }}
                  />

                  {(gatewayView === 'ALL' || gatewayView === 'BKASH') && (
                    <Bar
                      dataKey="bKash"
                      name="bKash (BDT)"
                      fill="#ec4899"
                      radius={[3, 3, 0, 0]}
                    />
                  )}

                  {(gatewayView === 'ALL' || gatewayView === 'NAGAD') && (
                    <Bar
                      dataKey="nagad"
                      name="Nagad (BDT)"
                      fill="#f97316"
                      radius={[3, 3, 0, 0]}
                    />
                  )}

                  {(gatewayView === 'ALL' || gatewayView === 'STRIPE') && (
                    <Bar
                      dataKey="stripe"
                      name="Stripe (BDT Equiv)"
                      fill="#6366f1"
                      radius={[3, 3, 0, 0]}
                    />
                  )}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
