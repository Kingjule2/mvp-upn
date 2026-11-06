import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  RefreshCw,
} from 'lucide-react';
import { api } from '../api/client';
import type { StockMovement } from '../types';

export const StockMovementView: React.FC = () => {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMovements = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getStockMovements({
        search: search.trim() || undefined,
        type: typeFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        per_page: 50,
      });
      setMovements(res.data.data);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
        setError(err.message);
      } else {
        setError('Gagal memuat riwayat mutasi stok.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, [search, typeFilter, dateFrom, dateTo]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Riwayat Kartu Stok & Audit Trail</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              Immutable Log
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Catatan permanen setiap mutasi barang masuk, penjualan kasir, dan penyesuaian opname stok
          </p>
        </div>

        <button
          onClick={() => fetchMovements()}
          title="Muat ulang riwayat"
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
            placeholder="Cari produk atau SKU..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[150px]">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Semua Jenis Mutasi</option>
              <option value="INBOUND">INBOUND (Restock Masuk)</option>
              <option value="INBOUND_INITIAL">INBOUND_INITIAL (Stok Awal)</option>
              <option value="OUTBOUND_SALE">OUTBOUND_SALE (Penjualan)</option>
              <option value="ADJUSTMENT">ADJUSTMENT (Opname)</option>
            </select>
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
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {error}
        </div>
      )}

      {/* Movements Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Waktu & Tanggal</th>
                <th className="py-3 px-4">SKU & Nama Produk</th>
                <th className="py-3 px-4 text-center">Jenis Mutasi</th>
                <th className="py-3 px-4 text-right">Jumlah (+/-)</th>
                <th className="py-3 px-4 text-right">Saldo Akhir</th>
                <th className="py-3 px-4">Petugas / Operator</th>
                <th className="py-3 px-4">Alasan / Referensi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium">Belum ada catatan mutasi stok yang sesuai.</p>
                  </td>
                </tr>
              ) : (
                movements.map((m) => {
                  let badge = 'bg-slate-100 text-slate-700 border-slate-200';
                  if (m.type === 'INBOUND' || m.type === 'INBOUND_INITIAL') {
                    badge = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  } else if (m.type === 'OUTBOUND_SALE') {
                    badge = 'bg-blue-50 text-blue-700 border-blue-200';
                  } else if (m.type === 'ADJUSTMENT') {
                    badge = 'bg-amber-50 text-amber-700 border-amber-200';
                  }

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {m.created_at}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{m.product?.name || 'Produk Dihapus'}</div>
                        <div className="font-mono text-[11px] text-slate-400">{m.product?.sku}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge}`}>
                          {m.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`font-mono font-bold ${
                            m.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                        {m.balance_after}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {m.user?.name || 'System / Auto'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                        <span className="font-medium text-slate-700">{m.notes}</span>
                        {m.reference_id && (
                          <span className="block text-[11px] font-mono text-slate-400 mt-0.5">
                            Ref: {m.reference_id}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
