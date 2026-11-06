import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Search,
  Eye,
  RefreshCw,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import type { Sale } from '../types';

export const SalesHistoryView: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const fetchSales = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getSales({
        search: search.trim() || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setSales(res.data.data);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
        setError(err.message);
      } else {
        setError('Gagal memuat riwayat penjualan.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [search, dateFrom, dateTo]);

  const formatRupiah = (val: number): string => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Riwayat Transaksi Penjualan</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar lengkap struk/invoice kasir, pendapatan kotor, dan laba per transaksi
          </p>
        </div>

        <button
          onClick={() => fetchSales()}
          title="Muat ulang"
          className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari berdasarkan nomor invoice..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          />
        </div>

        <div className="flex items-center space-x-1.5">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700"
          />
          <span className="text-xs text-slate-400">s/d</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700"
          />
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {error}
        </div>
      )}

      {/* Sales Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">No. Invoice</th>
                <th className="py-3 px-4">Waktu Transaksi</th>
                <th className="py-3 px-4">Kasir</th>
                <th className="py-3 px-4 text-center">Metode</th>
                <th className="py-3 px-4 text-center">Item</th>
                <th className="py-3 px-4 text-right">Total Tagihan</th>
                <th className="py-3 px-4 text-right">Laba Kotor</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium">Belum ada transaksi penjualan yang sesuai.</p>
                  </td>
                </tr>
              ) : (
                sales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      {s.invoice_number}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">{s.created_at}</td>
                    <td className="py-3 px-4 font-medium text-slate-700">{s.user?.name || 'Kasir'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 uppercase">
                        {s.payment_method}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono">{s.total_items} unit</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatRupiah(s.total_amount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                      {formatRupiah(s.total_profit)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedSale(s)}
                        className="p-1 rounded text-slate-600 hover:text-emerald-600 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Lihat Detail Transaksi"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sale Detail Modal */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Detail Nota Penjualan</h3>
                <p className="font-mono text-xs text-slate-500">{selectedSale.invoice_number}</p>
              </div>
              <button
                onClick={() => setSelectedSale(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <div>
                  <span className="text-slate-500 block">Waktu:</span>
                  <span className="font-mono font-semibold text-slate-800">{selectedSale.created_at}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Kasir:</span>
                  <span className="font-semibold text-slate-800">{selectedSale.user?.name || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Metode Pembayaran:</span>
                  <span className="uppercase font-semibold text-slate-800">{selectedSale.payment_method}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Total Unit:</span>
                  <span className="font-semibold text-slate-800">{selectedSale.total_items} barang</span>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="font-semibold text-slate-700 mb-2">Daftar Barang:</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="min-w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                      <tr>
                        <th className="py-2 px-3">Produk</th>
                        <th className="py-2 px-2 text-right">Harga</th>
                        <th className="py-2 px-2 text-center">Qty</th>
                        <th className="py-2 px-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedSale.items?.map((it, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-semibold text-slate-800">{it.product_name}</td>
                          <td className="py-2 px-2 text-right font-mono text-slate-600">
                            {formatRupiah(it.selling_price)}
                          </td>
                          <td className="py-2 px-2 text-center font-mono">{it.quantity}</td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                            {formatRupiah(it.subtotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total & Profit breakdown */}
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Total Omzet (Revenue):</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {formatRupiah(selectedSale.total_amount)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total Modal (HPP):</span>
                  <span className="font-mono text-slate-600">{formatRupiah(selectedSale.total_cost)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-semibold bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                  <span>Total Laba Kotor:</span>
                  <span className="font-mono font-bold text-sm">
                    {formatRupiah(selectedSale.total_profit)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
