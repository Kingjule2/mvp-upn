import React, { useState } from 'react';
import { X, ArrowDownRight, ArrowUpRight, AlertCircle, Save } from 'lucide-react';
import { api } from '../api/client';
import type { Product } from '../types';

interface StockAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product: Product | null;
}

export const StockAdjustModal: React.FC<StockAdjustModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  product,
}) => {
  const [type, setType] = useState<'INBOUND' | 'ADJUSTMENT'>('INBOUND');
  const [quantity, setQuantity] = useState<string>('');
  const [isNegative, setIsNegative] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !product) return null;

  const currentStock = product.current_stock;
  const numQty = Number(quantity) || 0;
  const effectiveQty = type === 'ADJUSTMENT' && isNegative ? -Math.abs(numQty) : Math.abs(numQty);
  const projectedBalance = currentStock + effectiveQty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (numQty <= 0) {
      setError('Jumlah mutasi harus lebih besar dari 0.');
      return;
    }

    if (projectedBalance < 0) {
      setError(`Pengurangan melebihi stok yang ada (sisa: ${currentStock}).`);
      return;
    }

    if (!notes.trim()) {
      setError('Keterangan atau alasan mutasi wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.adjustStock(product.id, {
        type,
        quantity: effectiveQty,
        notes: notes.trim(),
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
        setError(err.message);
      } else {
        setError('Gagal mencatat mutasi stok.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Input Mutasi / Penyesuaian Stok</h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              {product.sku} · {product.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Current Stock Banner */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-slate-500 block">Sisa Stok Saat Ini:</span>
              <span className="text-lg font-bold text-slate-900">
                {currentStock} <span className="text-xs font-normal text-slate-500">{product.unit}</span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block">Proyeksi Saldo Akhir:</span>
              <span className={`text-lg font-bold ${projectedBalance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {projectedBalance} <span className="text-xs font-normal text-slate-500">{product.unit}</span>
              </span>
            </div>
          </div>

          {/* Type Selector */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Jenis Mutasi
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setType('INBOUND');
                  setIsNegative(false);
                }}
                className={`flex items-center justify-center space-x-2 py-2 px-3 rounded-lg border font-medium transition-all cursor-pointer ${
                  type === 'INBOUND'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                <span>Restock (Masuk)</span>
              </button>

              <button
                type="button"
                onClick={() => setType('ADJUSTMENT')}
                className={`flex items-center justify-center space-x-2 py-2 px-3 rounded-lg border font-medium transition-all cursor-pointer ${
                  type === 'ADJUSTMENT'
                    ? 'border-amber-500 bg-amber-50 text-amber-800'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <ArrowUpRight className="w-4 h-4 text-amber-600" />
                <span>Opname / Selisih</span>
              </button>
            </div>
          </div>

          {/* Direction toggle for ADJUSTMENT */}
          {type === 'ADJUSTMENT' && (
            <div className="flex items-center space-x-4 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="adjust_dir"
                  checked={!isNegative}
                  onChange={() => setIsNegative(false)}
                  className="text-emerald-600"
                />
                <span className="text-slate-700 font-medium">Penambahan (+)</span>
              </label>

              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="adjust_dir"
                  checked={isNegative}
                  onChange={() => setIsNegative(true)}
                  className="text-rose-600"
                />
                <span className="text-slate-700 font-medium">Pengurangan (-)</span>
              </label>
            </div>
          )}

          {/* Quantity */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Jumlah ({product.unit}) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              required
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="cth: 20"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-mono"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Alasan / Keterangan Mutasi <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="cth: Penerimaan kiriman supplier PT ABC / Temuan stock opname fisik"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Mencatat...' : 'Simpan Mutasi'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
