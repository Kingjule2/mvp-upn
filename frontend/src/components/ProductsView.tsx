import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  ArrowUpDown,
  RefreshCw,
  Package,
  Calendar,
} from 'lucide-react';
import { api } from '../api/client';
import type { Category, Product } from '../types';
import { ProductModal } from './ProductModal';
import { StockAdjustModal } from './StockAdjustModal';
import { useAuth } from '../context/AuthContext';

interface ProductsViewProps {
  initialStatusFilter?: string;
}

export const ProductsView: React.FC<ProductsViewProps> = ({ initialStatusFilter = '' }) => {
  const { isAdmin } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<{
    total_products: number;
    total_low_stock: number;
    total_out_of_stock: number;
    total_expiring_soon: number;
  }>({
    total_products: 0,
    total_low_stock: 0,
    total_out_of_stock: 0,
    total_expiring_soon: 0,
  });

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [expiringSoonFilter, setExpiringSoonFilter] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);

  const fetchCategories = async () => {
    try {
      const res = await api.getCategories();
      setCategories(res.data);
    } catch {
      // ignore
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getProducts({
        search: search.trim() || undefined,
        category_id: categoryFilter || undefined,
        status: statusFilter || undefined,
        expiring_soon: expiringSoonFilter || undefined,
        per_page: 50,
      });

      const list = Array.isArray(res.data) ? res.data : res.data.data;
      setProducts(list);
      if (res.summary) {
        setSummary(res.summary);
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
        setError(err.message);
      } else {
        setError('Gagal mengambil daftar produk.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [search, categoryFilter, statusFilter, expiringSoonFilter]);

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Yakin ingin menghapus produk "${name}"? Data akan diarsipkan (soft-delete).`)) {
      return;
    }
    try {
      await api.deleteProduct(id);
      fetchProducts();
    } catch (err: unknown) {
      alert('Gagal menghapus produk: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const formatRupiah = (val: number): string => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Rekapitulasi Master Produk</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar katalog master produk, pemantauan stok real-time, dan status ketersediaan
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => fetchProducts()}
            title="Muat ulang data"
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {isAdmin && (
            <button
              onClick={() => {
                setEditingProduct(null);
                setIsProductModalOpen(true);
              }}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Produk Manual</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Chips / Filter Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => {
            setStatusFilter('');
            setExpiringSoonFilter(false);
          }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === '' && !expiringSoonFilter
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
          }`}
        >
          <div className="text-[11px] font-semibold opacity-75">Semua Produk</div>
          <div className="text-xl font-bold mt-1">{summary.total_products}</div>
        </button>

        <button
          onClick={() => {
            setStatusFilter('Stok Tipis');
            setExpiringSoonFilter(false);
          }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'Stok Tipis'
              ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
              : 'bg-white hover:bg-amber-50/50 border-slate-200 text-slate-700'
          }`}
        >
          <div className="text-[11px] font-semibold text-amber-600">Stok Tipis (≤ Min)</div>
          <div className="text-xl font-bold mt-1 text-amber-700">{summary.total_low_stock}</div>
        </button>

        <button
          onClick={() => {
            setStatusFilter('Habis');
            setExpiringSoonFilter(false);
          }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'Habis'
              ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
              : 'bg-white hover:bg-rose-50/50 border-slate-200 text-slate-700'
          }`}
        >
          <div className="text-[11px] font-semibold text-rose-600">Stok Habis (0)</div>
          <div className="text-xl font-bold mt-1 text-rose-700">{summary.total_out_of_stock}</div>
        </button>

        <button
          onClick={() => {
            setExpiringSoonFilter(!expiringSoonFilter);
            setStatusFilter('');
          }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            expiringSoonFilter
              ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
              : 'bg-white hover:bg-orange-50/50 border-slate-200 text-slate-700'
          }`}
        >
          <div className="text-[11px] font-semibold text-orange-600">&lt; 30 Hari Expired</div>
          <div className="text-xl font-bold mt-1 text-orange-700">{summary.total_expiring_soon}</div>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari berdasarkan Barcode / SKU atau Nama Produk..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="relative min-w-[160px]">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative min-w-[140px]">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setExpiringSoonFilter(false);
              }}
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Semua Status</option>
              <option value="Aman">Stok Aman</option>
              <option value="Stok Tipis">Stok Tipis</option>
              <option value="Habis">Stok Habis</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {error}
        </div>
      )}

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">SKU / Barcode</th>
                <th className="py-3 px-4">Nama Produk</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4 text-right">Harga Modal (HPP)</th>
                <th className="py-3 px-4 text-right">Harga Jual</th>
                <th className="py-3 px-4 text-right">Sisa Stok</th>
                <th className="py-3 px-4 text-center">Satuan</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Expired</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium">Tidak ada produk yang cocok dengan pencarian / filter.</p>
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  let statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  if (p.status === 'Habis') {
                    statusBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
                  } else if (p.status === 'Stok Tipis') {
                    statusBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                  }

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-slate-700">
                        {p.sku}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {p.name}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {p.category?.name || '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {formatRupiah(p.purchase_price)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                        {formatRupiah(p.selling_price)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`font-mono font-bold ${
                            p.current_stock <= 0
                              ? 'text-rose-600'
                              : p.current_stock <= p.minimum_stock
                              ? 'text-amber-600'
                              : 'text-slate-900'
                          }`}
                        >
                          {p.current_stock}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1">/ min {p.minimum_stock}</span>
                      </td>
                      <td className="py-3 px-4 text-center text-slate-600 lowercase">
                        {p.unit}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadgeClass}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        {p.expired_date ? (
                          <span
                            className={`inline-flex items-center space-x-1 ${
                              p.is_expired
                                ? 'text-rose-600 font-bold'
                                : p.is_expiring_soon
                                ? 'text-orange-600 font-semibold'
                                : 'text-slate-500'
                            }`}
                          >
                            <Calendar className="w-3 h-3" />
                            <span>{p.expired_date}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => {
                              setAdjustingProduct(p);
                              setIsAdjustModalOpen(true);
                            }}
                            title="Mutasi Stok (+ / -)"
                            className="p-1 rounded text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer font-semibold"
                          >
                            <ArrowUpDown className="w-3.5 h-3.5" />
                          </button>

                          {isAdmin && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingProduct(p);
                                  setIsProductModalOpen(true);
                                }}
                                title="Ubah Produk"
                                className="p-1 rounded text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDelete(p.id, p.name)}
                                title="Hapus Produk (Soft-Delete)"
                                className="p-1 rounded text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSuccess={() => fetchProducts()}
        product={editingProduct}
        categories={categories}
      />

      <StockAdjustModal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        onSuccess={() => fetchProducts()}
        product={adjustingProduct}
      />
    </div>
  );
};
