import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  AlertTriangle,
  Layers,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import { api } from '../api/client';
import type { DashboardData } from '../types';

interface DashboardViewProps {
  onNavigateToProducts: (statusFilter?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigateToProducts }) => {
  const [period, setPeriod] = useState<string>('7days');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDashboard({
        period,
        date_from: period === 'custom' ? customStart : undefined,
        date_to: period === 'custom' ? customEnd : undefined,
      });
      setData(res);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
        setError(err.message);
      } else {
        setError('Gagal memuat data analitik dashboard.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (period !== 'custom' || (customStart && customEnd)) {
      fetchDashboard();
    }
  }, [period, customStart, customEnd]);

  const formatRupiah = (val: number): string => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Period Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight flex flex-wrap items-center gap-2">
              <span>Performa Keuangan &amp; Penjualan</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Live Real-Time
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Ringkasan omzet, laba kotor, pergerakan stok, dan peringatan operasional koperasi
            </p>
          </div>
          <button
            onClick={() => fetchDashboard()}
            title="Refresh Data"
            className="sm:hidden p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Period Selector */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
          <div className="grid grid-cols-4 sm:inline-flex rounded-lg bg-slate-100 p-0.5 text-[11px] sm:text-xs font-medium border border-slate-200">
            {[
              { id: 'today', label: 'Hari Ini', shortLabel: 'Hari Ini' },
              { id: '7days', label: '7 Hari Terakhir', shortLabel: '7 Hari' },
              { id: 'month', label: 'Bulan Ini', shortLabel: 'Bulan Ini' },
              { id: 'custom', label: 'Kustom', shortLabel: 'Kustom' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-2 sm:px-3 py-1.5 rounded-md transition-all cursor-pointer text-center truncate ${
                  period === p.id
                    ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="sm:hidden">{p.shortLabel}</span>
                <span className="hidden sm:inline">{p.label}</span>
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="flex-1 sm:flex-initial min-w-0 text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-700"
              />
              <span className="text-xs text-slate-400 shrink-0">s/d</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="flex-1 sm:flex-initial min-w-0 text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-700"
              />
            </div>
          )}

          <button
            onClick={() => fetchDashboard()}
            title="Refresh Data"
            className="hidden sm:inline-flex p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Omzet */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Penjualan / Omzet
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {formatRupiah(data?.summary.total_revenue || 0)}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center">
              <span>Gross Revenue periode terpilih</span>
            </div>
          </div>
        </div>

        {/* Card 2: Laba Kotor */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Laba Kotor
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-blue-700">
              {formatRupiah(data?.summary.total_profit || 0)}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center space-x-1">
              <span className="font-semibold text-emerald-600">
                Margin: {data?.summary.profit_margin || 0}%
              </span>
              <span>· (Harga Jual - HPP)</span>
            </div>
          </div>
        </div>

        {/* Card 3: Transaksi & Unit Terjual */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Transaksi & Unit Terjual
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {data?.summary.total_transactions || 0}{' '}
              <span className="text-sm font-normal text-slate-500">transaksi</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              <span className="font-semibold text-purple-700">{data?.summary.total_units_sold || 0}</span> unit barang keluar
            </div>
          </div>
        </div>

        {/* Card 4: Quick Alerts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Peringatan Operasional
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div
              onClick={() => onNavigateToProducts('Stok Tipis')}
              className="cursor-pointer group"
            >
              <div className="text-xl font-bold text-amber-600 group-hover:underline">
                {data?.alerts_count.low_stock || 0}
              </div>
              <div className="text-xs text-slate-500">Stok Menipis</div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div
              onClick={() => onNavigateToProducts('Habis')}
              className="cursor-pointer group"
            >
              <div className="text-xl font-bold text-rose-600 group-hover:underline">
                {data?.alerts_count.out_of_stock || 0}
              </div>
              <div className="text-xs text-slate-500">Stok Habis</div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="cursor-pointer group">
              <div className="text-xl font-bold text-orange-600 group-hover:underline">
                {data?.alerts_count.expiring_soon || 0}
              </div>
              <div className="text-xs text-slate-500">&lt; 30 Hari Exp</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Chart & Top Fast-Moving Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend Chart (2 Cols) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Grafik Tren Penjualan Harian</h2>
              <p className="text-xs text-slate-500">Perbandingan Pendapatan (Omzet), Modal (HPP), dan Laba Kotor</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-600 font-medium">Omzet</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-slate-600 font-medium">Laba Kotor</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span className="text-slate-600 font-medium">Modal HPP</span>
              </div>
            </div>
          </div>

          {/* SVG Trend Bars / Chart */}
          {(!data?.trends || data.trends.length === 0) ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs">
              <Layers className="w-8 h-8 mb-2 opacity-50" />
              <span>Belum ada transaksi penjualan pada rentang waktu ini</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="h-64 flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-slate-100">
                {data.trends.map((t, idx) => {
                  const maxRevenue = Math.max(...data.trends.map((item) => Number(item.revenue) || 1));
                  const revHeight = Math.max(12, Math.round(((Number(t.revenue) || 0) / maxRevenue) * 180));
                  const profHeight = Math.max(8, Math.round(((Number(t.profit) || 0) / maxRevenue) * 180));

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center group relative">
                      {/* Tooltip on hover */}
                      <div className="absolute -top-16 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-slate-900 text-white text-[11px] py-1.5 px-2.5 rounded-lg shadow-lg z-20 whitespace-nowrap">
                        <div className="font-semibold">{t.date}</div>
                        <div>Omzet: {formatRupiah(Number(t.revenue))}</div>
                        <div>Laba: {formatRupiah(Number(t.profit))}</div>
                        <div>Transaksi: {t.transaction_count} ({t.items_sold} unit)</div>
                      </div>

                      {/* Bar columns */}
                      <div className="w-full flex items-end justify-center space-x-1">
                        <div
                          style={{ height: `${revHeight}px` }}
                          className="w-full max-w-[24px] bg-emerald-500 rounded-t-md hover:bg-emerald-600 transition-all"
                        />
                        <div
                          style={{ height: `${profHeight}px` }}
                          className="w-full max-w-[20px] bg-blue-500 rounded-t-md hover:bg-blue-600 transition-all"
                        />
                      </div>
                      <div className="text-[11px] text-slate-500 mt-2 font-medium truncate w-full text-center">
                        {t.date.split('-').slice(1).join('/')}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-[11px] text-slate-400 text-right">
                * Arahkan kursor pada batang diagram untuk melihat rincian angka
              </div>
            </div>
          )}
        </div>

        {/* Top 5 Fast-Moving Products (1 Col) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Top 5 Produk Terlaris</h2>
              <p className="text-xs text-slate-500">Volume & kontribusi laba tertinggi</p>
            </div>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              Fast-Moving
            </span>
          </div>

          <div className="flex-1 flex flex-col justify-center space-y-3.5">
            {(!data?.top_products || data.top_products.length === 0) ? (
              <div className="text-center text-slate-400 text-xs py-8">
                Belum ada data produk terjual
              </div>
            ) : (
              data.top_products.map((tp, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 flex items-center space-x-1.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <span className="truncate max-w-[150px]">{tp.product_name}</span>
                    </span>
                    <span className="font-bold text-slate-900">
                      {tp.total_sold} <span className="text-[10px] font-normal text-slate-500">terjual</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pl-6.5">
                    <span>Omzet: {formatRupiah(Number(tp.total_revenue))}</span>
                    <span className="text-emerald-600 font-medium">
                      +Laba: {formatRupiah(Number(tp.total_profit))}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden ml-6.5">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (Number(tp.total_sold) /
                              Math.max(...data.top_products.map((p) => Number(p.total_sold) || 1))) *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Alerts Tables: Low Stock & Expiring Soon */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alerts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <h3 className="text-sm font-bold text-slate-900">Perhatian: Stok Menipis & Habis</h3>
            </div>
            <button
              onClick={() => onNavigateToProducts('Stok Tipis')}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center space-x-1 cursor-pointer"
            >
              <span>Lihat Semua</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-medium">
                  <th className="py-2">SKU</th>
                  <th className="py-2">Nama Produk</th>
                  <th className="py-2 text-right">Sisa Stok</th>
                  <th className="py-2 text-right">Min. Stok</th>
                  <th className="py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(!data?.alerts_list.low_stock || data.alerts_list.low_stock.length === 0) &&
                (!data?.alerts_list.out_of_stock || data.alerts_list.out_of_stock.length === 0) ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-400">
                      Semua stok produk saat ini dalam kondisi aman
                    </td>
                  </tr>
                ) : (
                  [...(data?.alerts_list.out_of_stock || []), ...(data?.alerts_list.low_stock || [])]
                    .slice(0, 5)
                    .map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70">
                        <td className="py-2 font-mono font-medium text-slate-600">{p.sku}</td>
                        <td className="py-2 font-semibold text-slate-800">{p.name}</td>
                        <td className="py-2 text-right font-bold text-rose-600">
                          {p.current_stock} {p.unit}
                        </td>
                        <td className="py-2 text-right text-slate-500">{p.minimum_stock}</td>
                        <td className="py-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              p.current_stock <= 0
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {p.current_stock <= 0 ? 'Habis' : 'Stok Tipis'}
                          </span>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expiring Soon Alerts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <h3 className="text-sm font-bold text-slate-900">Peringatan: Kedaluwarsa (&lt; 30 Hari)</h3>
            </div>
            <button
              onClick={() => onNavigateToProducts()}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center space-x-1 cursor-pointer"
            >
              <span>Lihat Semua</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-medium">
                  <th className="py-2">SKU</th>
                  <th className="py-2">Nama Produk</th>
                  <th className="py-2 text-right">Stok Aktif</th>
                  <th className="py-2 text-right">Tgl Expired</th>
                  <th className="py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(!data?.alerts_list.expiring_soon || data.alerts_list.expiring_soon.length === 0) &&
                (!data?.alerts_list.expired || data.alerts_list.expired.length === 0) ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-400">
                      Tidak ada batch produk yang mendekati kedaluwarsa
                    </td>
                  </tr>
                ) : (
                  [...(data?.alerts_list.expired || []), ...(data?.alerts_list.expiring_soon || [])]
                    .slice(0, 5)
                    .map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70">
                        <td className="py-2 font-mono font-medium text-slate-600">{p.sku}</td>
                        <td className="py-2 font-semibold text-slate-800">{p.name}</td>
                        <td className="py-2 text-right font-medium text-slate-700">
                          {p.current_stock} {p.unit}
                        </td>
                        <td className="py-2 text-right font-mono text-slate-600">{p.expired_date}</td>
                        <td className="py-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              p.is_expired
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}
                          >
                            {p.is_expired ? 'Expired' : '< 30 Hari'}
                          </span>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
