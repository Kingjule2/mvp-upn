import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  CreditCard,
  Banknote,
  QrCode,
  Printer,
} from 'lucide-react';
import { api } from '../api/client';
import type { Product, Sale } from '../types';

interface CartItem {
  product: Product;
  quantity: number;
}

export const PosView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris' | 'transfer'>('cash');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  const fetchProducts = async () => {
    try {
      const res = await api.getProducts({ per_page: 100 });
      const list = Array.isArray(res.data) ? res.data : res.data.data;
      setProducts(list);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filteredProducts = products.filter((p) => {
    const s = search.toLowerCase();
    return p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s);
  });

  const addToCart = (product: Product) => {
    setError(null);
    if (product.current_stock <= 0) {
      setError(`Stok produk "${product.name}" habis.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.current_stock) {
          setError(`Maksimal stok tercapai untuk "${product.name}" (sisa: ${product.current_stock}).`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setError(null);
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + delta;
            if (nextQty > item.product.current_stock) {
              setError(`Stok tidak mencukupi (sisa: ${item.product.current_stock}).`);
              return item;
            }
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setPaymentAmount('');
    setNotes('');
    setError(null);
  };

  const totalAmount = cart.reduce(
    (sum, item) => sum + item.quantity * Number(item.product.selling_price),
    0
  );

  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const parsedPayment = Number(paymentAmount) || 0;
  const changeAmount = paymentMethod === 'cash' ? Math.max(0, parsedPayment - totalAmount) : 0;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (cart.length === 0) {
      setError('Keranjang belanja kosong.');
      return;
    }

    if (paymentMethod === 'cash' && parsedPayment < totalAmount) {
      setError(`Uang tunai kurang ${formatRupiah(totalAmount - parsedPayment)}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
        payment_method: paymentMethod,
        payment_amount: paymentMethod === 'cash' ? parsedPayment : totalAmount,
        notes: notes.trim() || undefined,
      };

      const res = await api.createSale(payload);
      setCompletedSale(res.data);
      clearCart();
      fetchProducts(); // Refresh products stock
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
        setError(err.message);
      } else {
        setError('Gagal memproses transaksi kasir.');
      }
    } finally {
      setIsSubmitting(false);
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
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight flex flex-wrap items-center gap-2">
            <span>Kasir / Point of Sale (POS)</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold whitespace-nowrap shrink-0">
              Input Transaksi Harian
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pilih produk, hitung otomatis kembalian, cetak struk dan kurangi stok secara realtime
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {error}
        </div>
      )}

      {/* POS Grid: Catalog on left (3 cols), Cart on right (2 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column: Product Picker (3 Cols) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Search bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari cepat barang dengan mengetik nama atau scan barcode..."
              className="w-full pl-9 pr-3 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none shadow-xs"
            />
          </div>

          {/* Product cards list */}
          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-12 text-center text-slate-400 text-xs">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="font-medium text-slate-500">
                {search ? 'Tidak ada produk yang cocok dengan pencarian.' : 'Belum ada produk tersedia.'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Tambahkan produk terlebih dahulu di menu Produk &amp; Stok atau Impor Excel/CSV.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto p-1">
              {filteredProducts.map((p) => {
                const isOutOfStock = p.current_stock <= 0;
                return (
                  <button
                    key={p.id}
                    disabled={isOutOfStock}
                    onClick={() => addToCart(p)}
                    className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      isOutOfStock
                        ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                        : 'bg-white hover:border-emerald-500 hover:shadow-md border-slate-200/80'
                    }`}
                  >
                    <div>
                      <div className="font-mono text-[10px] text-slate-400">{p.sku}</div>
                      <div className="font-bold text-xs text-slate-900 line-clamp-2 mt-0.5">{p.name}</div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-emerald-600">
                        {formatRupiah(p.selling_price)}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          isOutOfStock
                            ? 'bg-rose-100 text-rose-700'
                            : p.current_stock <= p.minimum_stock
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {p.current_stock} {p.unit}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Active Cart & Checkout (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col h-full max-h-[680px]">
          {/* Cart Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900">Keranjang Belanja</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {totalItemsCount} item
              </span>
            </div>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-xs text-rose-600 hover:underline cursor-pointer"
              >
                Kosongkan
              </button>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-xs">
                <ShoppingCart className="w-8 h-8 mb-2 opacity-30" />
                <span>Keranjang masih kosong</span>
                <span className="text-[11px] text-slate-400 mt-0.5">Klik produk di sebelah kiri untuk menambah</span>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 text-xs"
                >
                  <div className="flex-1 pr-2">
                    <div className="font-semibold text-slate-900 truncate">{item.product.name}</div>
                    <div className="font-mono text-slate-500 text-[11px]">
                      {formatRupiah(item.product.selling_price)} × {item.quantity} ={' '}
                      <span className="font-semibold text-slate-800">
                        {formatRupiah(item.quantity * item.product.selling_price)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center font-mono font-bold">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 ml-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Checkout Form */}
          <form onSubmit={handleCheckout} className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3">
            {/* Total Display */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Tagihan:</span>
              <span className="text-xl font-bold font-mono text-emerald-700">
                {formatRupiah(totalAmount)}
              </span>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {[
                { id: 'cash', label: 'Tunai (Cash)', icon: <Banknote className="w-3 h-3" /> },
                { id: 'qris', label: 'QRIS', icon: <QrCode className="w-3 h-3" /> },
                { id: 'transfer', label: 'Transfer', icon: <CreditCard className="w-3 h-3" /> },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id as 'cash' | 'qris' | 'transfer')}
                  className={`flex items-center justify-center space-x-1 py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    paymentMethod === m.id
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {m.icon}
                  <span>{m.label}</span>
                </button>
              ))}
            </div>

            {/* Cash Payment input */}
            {paymentMethod === 'cash' && (
              <div className="space-y-1.5 pt-1">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 text-xs">
                  <span className="font-semibold text-slate-600">Uang Diterima:</span>
                  <div className="flex flex-wrap items-center gap-1">
                    {[totalAmount, totalAmount + 5000, totalAmount + 10000, 50000, 100000].map((amt, aIdx) => (
                      <button
                        key={aIdx}
                        type="button"
                        onClick={() => setPaymentAmount(String(amt))}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 font-mono cursor-pointer"
                      >
                        {amt.toLocaleString('id-ID')}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={`Min. ${totalAmount}`}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                />

                {/* Change amount */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-500">Kembalian:</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {formatRupiah(changeAmount)}
                  </span>
                </div>
              </div>
            )}

            {/* Notes */}
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan transaksi (opsional)..."
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500"
            />

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || cart.length === 0}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Memproses Transaksi...' : `Bayar & Cetak Nota (${formatRupiah(totalAmount)})`}
            </button>
          </form>
        </div>
      </div>

      {/* Invoice Receipt Modal on Success */}
      {completedSale && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Transaksi Berhasil!</h3>
              <p className="text-xs font-mono text-slate-500">{completedSale.invoice_number}</p>
            </div>

            <div className="border-t border-b border-dashed border-slate-200 py-3 space-y-2 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Waktu:</span>
                <span>{completedSale.created_at}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Kasir:</span>
                <span>{completedSale.user?.name || 'Kasir'}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Metode Pembayaran:</span>
                <span className="uppercase font-semibold">{completedSale.payment_method}</span>
              </div>

              {/* Items */}
              <div className="pt-2 border-t border-slate-100 space-y-1">
                {completedSale.items?.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-[11px]">
                    <span className="truncate max-w-[180px]">
                      {it.product_name} × {it.quantity}
                    </span>
                    <span className="font-mono">{formatRupiah(it.subtotal)}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm">
                <span>Total:</span>
                <span className="text-emerald-700">{formatRupiah(completedSale.total_amount)}</span>
              </div>

              {completedSale.payment_method === 'cash' && (
                <>
                  <div className="flex justify-between text-slate-500">
                    <span>Tunai:</span>
                    <span className="font-mono">{formatRupiah(completedSale.payment_amount || 0)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Kembali:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {formatRupiah(completedSale.change_amount || 0)}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center space-x-1 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Nota</span>
              </button>
              <button
                type="button"
                onClick={() => setCompletedSale(null)}
                className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white flex items-center justify-center cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
