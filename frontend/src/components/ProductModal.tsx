import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  AlertCircle,
  UploadCloud,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  FileText,
  FileSpreadsheet,
  PackagePlus,
} from 'lucide-react';
import { api } from '../api/client';
import type { Category, ImportPreviewResponse, ImportRow, Product } from '../types';

export type ProductModalMode = 'manual' | 'import';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: Product | null;
  categories: Category[];
  initialMode?: ProductModalMode;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  product,
  categories,
  initialMode = 'manual',
}) => {
  const isEditing = !!product;
  const [activeMode, setActiveMode] = useState<ProductModalMode>('manual');

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [categoryName, setCategoryName] = useState('');
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [unit, setUnit] = useState('pcs');
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [sellingPrice, setSellingPrice] = useState<string>('');
  const [currentStock, setCurrentStock] = useState<string>('0');
  const [minimumStock, setMinimumStock] = useState<string>('5');
  const [expiredDate, setExpiredDate] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bulk Import state
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [previewData, setPreviewData] = useState<ImportPreviewResponse | null>(null);
  const [filterRows, setFilterRows] = useState<'all' | 'valid' | 'invalid'>('all');
  const [executionMode, setExecutionMode] = useState<'valid_only' | 'all_or_nothing'>('valid_only');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<{
    message: string;
    batch_id: string;
    imported_count: number;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setActiveMode('manual');
      setSku(product.sku);
      setName(product.name);
      setCategoryId(product.category_id ? String(product.category_id) : '');
      setIsNewCategory(false);
      setCategoryName('');
      setUnit(product.unit);
      setPurchasePrice(String(product.purchase_price));
      setSellingPrice(String(product.selling_price));
      setCurrentStock(String(product.current_stock));
      setMinimumStock(String(product.minimum_stock));
      setExpiredDate(product.expired_date || '');
    } else {
      setActiveMode(initialMode);
      setSku('');
      setName('');
      setCategoryId(categories.length > 0 ? String(categories[0].id) : '');
      setIsNewCategory(categories.length === 0);
      setCategoryName('');
      setUnit('pcs');
      setPurchasePrice('');
      setSellingPrice('');
      setCurrentStock('0');
      setMinimumStock('5');
      setExpiredDate('');
    }
    setError(null);
    setFile(null);
    setPreviewData(null);
    setExecutionResult(null);
    setImportError(null);
  }, [product, categories, isOpen, initialMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const payload = {
        sku,
        name,
        category_id: isNewCategory ? undefined : (categoryId ? Number(categoryId) : undefined),
        category_name: isNewCategory ? categoryName : undefined,
        unit,
        purchase_price: Number(purchasePrice),
        selling_price: Number(sellingPrice),
        current_stock: isEditing ? undefined : Number(currentStock),
        minimum_stock: Number(minimumStock) || 5,
        expired_date: expiredDate ? expiredDate : undefined,
      };

      if (isEditing && product) {
        await api.updateProduct(product.id, payload);
      } else {
        await api.createProduct(payload);
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
        setError(err.message);
      } else {
        setError('Gagal menyimpan data produk.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (selectedFile: File) => {
    setImportError(null);
    setExecutionResult(null);
    setPreviewData(null);

    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'csv', 'xls'].includes(ext || '')) {
      setImportError('Format file tidak didukung. Mohon gunakan file berekstensi .csv, .xlsx, atau .xls');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setImportError('Ukuran file melebihi batas maksimum 10MB.');
      return;
    }

    setFile(selectedFile);
    uploadAndPreview(selectedFile);
  };

  const uploadAndPreview = async (fileToUpload: File) => {
    setIsValidating(true);
    setImportError(null);
    try {
      const res = await api.previewImport(fileToUpload);
      setPreviewData(res);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
        setImportError(err.message);
      } else {
        setImportError('Gagal membaca dan memvalidasi file.');
      }
    } finally {
      setIsValidating(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!previewData) return;
    setImportError(null);
    setIsExecuting(true);

    try {
      const res = await api.executeImport(previewData.preview_id, executionMode);
      setExecutionResult(res);
      setPreviewData(null);
      setFile(null);
      onSuccess();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
        setImportError(err.message);
      } else {
        setImportError('Gagal mengeksekusi impor produk.');
      }
    } finally {
      setIsExecuting(false);
    }
  };

  const resetImport = () => {
    setFile(null);
    setPreviewData(null);
    setExecutionResult(null);
    setImportError(null);
  };

  const displayedRows = (previewData?.rows || []).filter((r: ImportRow) => {
    if (filterRows === 'valid') return r.is_valid;
    if (filterRows === 'invalid') return !r.is_valid;
    return true;
  });

  const isImportMode = !isEditing && activeMode === 'import';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div
        className={`bg-white rounded-2xl w-full shadow-2xl border border-slate-200 overflow-hidden transition-all ${
          isImportMode ? 'max-w-5xl' : 'max-w-lg'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isEditing
                ? 'Ubah Data Produk'
                : isImportMode
                ? 'Tambah Produk via Upload CSV / Excel (Impor Massal)'
                : 'Tambah Produk Baru'}
            </h2>
            {!isEditing && (
              <p className="text-[11px] text-slate-500 mt-0.5">
                Pilih input produk satuan atau unggah massal via CSV / Excel (mendukung Stock Opname 2026.xlsx)
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs when Adding Product */}
        {!isEditing && (
          <div className="px-6 pt-4">
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setActiveMode('manual')}
                className={`flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeMode === 'manual'
                    ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <PackagePlus className="w-4 h-4 shrink-0" />
                <span>Input Produk Manual</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMode('import')}
                className={`flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeMode === 'import'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UploadCloud className="w-4 h-4 shrink-0" />
                <span>Upload CSV / Excel</span>
              </button>
            </div>
          </div>
        )}

        {!isImportMode && error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!isImportMode ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
            {/* SKU & Name */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="block font-semibold text-slate-700 mb-1">
                  SKU / Barcode <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  placeholder="BRG-001"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Produk <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="cth: Roti Cokelat Kampus"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
            </div>

            {/* Category & Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">Kategori</label>
                  <button
                    type="button"
                    onClick={() => setIsNewCategory(!isNewCategory)}
                    className="text-[11px] text-emerald-600 hover:underline cursor-pointer"
                  >
                    {isNewCategory ? 'Pilih dari daftar' : '+ Buat baru'}
                  </button>
                </div>

                {isNewCategory ? (
                  <input
                    type="text"
                    required
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="Kategori baru"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                ) : (
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                  >
                    <option value="">Pilih Kategori...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Satuan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="pcs, botol, dus, kotak"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
            </div>

            {/* Pricing: HPP & Selling Price */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Harga Modal (HPP) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-medium">Rp</span>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    placeholder="0"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Harga Jual <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-medium">Rp</span>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    placeholder="0"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Stock & Expiration */}
            <div className="grid grid-cols-3 gap-3">
              {!isEditing && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Stok Awal
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={currentStock}
                    onChange={(e) => setCurrentStock(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Stok Minimum
                </label>
                <input
                  type="number"
                  min="0"
                  value={minimumStock}
                  onChange={(e) => setMinimumStock(e.target.value)}
                  placeholder="5"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-mono"
                />
              </div>

              <div className={isEditing ? 'col-span-2' : 'col-span-1'}>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tanggal Expired (Opsional)
                </label>
                <input
                  type="date"
                  value={expiredDate}
                  onChange={(e) => setExpiredDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
            </div>

            {/* Action Buttons */}
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
                <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Produk'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-5 text-xs">
            {/* Template Download Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <div className="font-semibold text-slate-800 flex items-center space-x-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Format File yang Didukung</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Mendukung langsung file <strong>STOCK OPNAME 2026.xlsx</strong> maupun template standar CSV / Excel koperasi.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <a
                  href={api.getTemplateUrl('csv')}
                  download="template_import_produk_koperasi.csv"
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Template .CSV</span>
                </a>
                <a
                  href={api.getTemplateUrl('xlsx')}
                  download="template_import_produk_koperasi.xlsx"
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Template .XLSX</span>
                </a>
                <a
                  href={api.getTemplateUrl('stock_opname')}
                  download="STOCK_OPNAME_2026_template.xlsx"
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg border border-emerald-200 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Template Stock Opname 2026</span>
                </a>
              </div>
            </div>

            {importError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            {/* Success Result Banner */}
            {executionResult && (
              <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900">
                <div className="flex items-start space-x-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="space-y-1 flex-1">
                    <h3 className="font-bold text-sm text-emerald-900">Impor Produk Selesai Berhasil!</h3>
                    <p className="text-xs text-emerald-800">{executionResult.message}</p>
                    <div className="flex flex-wrap items-center gap-4 pt-1.5 text-xs">
                      <div>
                        <span className="text-emerald-700">Batch Referensi ID:</span>{' '}
                        <span className="font-mono font-bold text-emerald-900">{executionResult.batch_id}</span>
                      </div>
                      <div>
                        <span className="text-emerald-700">Jumlah Produk:</span>{' '}
                        <span className="font-bold text-emerald-900">{executionResult.imported_count} produk</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-emerald-700 italic pt-1">
                      * Seluruh stok awal telah otomatis dicatat pada riwayat kartu stok dengan kode mutasi INBOUND_INITIAL.
                    </p>
                    <div className="pt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={resetImport}
                        className="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Upload File Lainnya
                      </button>
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Selesai &amp; Lihat Katalog
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Drag & Drop Area */}
            {!previewData && !executionResult && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all bg-white ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/50 scale-[1.01]'
                    : 'border-slate-300 hover:border-slate-400'
                }`}
              >
                <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 shadow-xs">
                  <UploadCloud className="w-7 h-7" />
                </div>

                <h3 className="text-sm font-bold text-slate-800">
                  {isValidating ? 'Memvalidasi data baris...' : 'Tarik & Letakkan file CSV / Excel di sini'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Unggah file <strong>.csv</strong>, <strong>.xlsx</strong>, atau <strong>STOCK OPNAME 2026.xlsx</strong> (maks. 10MB)
                </p>

                <div className="mt-4">
                  <label className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer">
                    <UploadCloud className="w-4 h-4" />
                    <span>Pilih File CSV / Excel</span>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileInput}
                      className="hidden"
                      disabled={isValidating}
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Preview Section & Validation Results */}
            {previewData && (
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-xs font-bold text-slate-900 mr-1 flex items-center space-x-1.5">
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      <span className="truncate max-w-[200px]">{file ? file.name : 'Hasil Validasi'}:</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFilterRows('all')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        filterRows === 'all'
                          ? 'bg-slate-900 text-white'
                          : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                      }`}
                    >
                      Semua ({previewData.summary.total_rows})
                    </button>

                    <button
                      type="button"
                      onClick={() => setFilterRows('valid')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer ${
                        filterRows === 'valid'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Valid ({previewData.summary.valid_count})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFilterRows('invalid')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer ${
                        filterRows === 'invalid'
                          ? 'bg-rose-600 text-white'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Bermasalah ({previewData.summary.invalid_count})</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={executionMode}
                      onChange={(e) => setExecutionMode(e.target.value as 'valid_only' | 'all_or_nothing')}
                      className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="valid_only">Hanya Proses Baris Valid</option>
                      <option value="all_or_nothing">Batalkan Semua Jika Ada Error</option>
                    </select>

                    <button
                      type="button"
                      onClick={resetImport}
                      className="px-3 py-1.5 border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                    >
                      Ganti File
                    </button>

                    <button
                      type="button"
                      onClick={handleExecuteImport}
                      disabled={
                        isExecuting ||
                        (executionMode === 'all_or_nothing' && previewData.summary.invalid_count > 0) ||
                        previewData.summary.valid_count === 0
                      }
                      className="flex items-center space-x-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>{isExecuting ? 'Mengeksekusi...' : 'Konfirmasi & Eksekusi Impor'}</span>
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto max-h-[380px]">
                    <table className="min-w-full text-xs text-left">
                      <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                        <tr>
                          <th className="py-2 px-3 text-center">Baris</th>
                          <th className="py-2 px-3 text-center">Status</th>
                          <th className="py-2 px-3">SKU</th>
                          <th className="py-2 px-3">Nama Produk</th>
                          <th className="py-2 px-3">Kategori</th>
                          <th className="py-2 px-3">Satuan</th>
                          <th className="py-2 px-3 text-right">HPP</th>
                          <th className="py-2 px-3 text-right">Harga Jual</th>
                          <th className="py-2 px-3 text-right">Stok Awal</th>
                          <th className="py-2 px-3">Catatan / Error</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {displayedRows.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="py-8 text-center text-slate-400">
                              Tidak ada baris data pada filter ini.
                            </td>
                          </tr>
                        ) : (
                          displayedRows.map((r) => (
                            <tr
                              key={`${r.row_number}-${r.sku}`}
                              className={
                                r.is_valid
                                  ? 'bg-emerald-50/30 hover:bg-emerald-50/60'
                                  : 'bg-rose-50/40 hover:bg-rose-50/70'
                              }
                            >
                              <td className="py-2 px-3 text-center font-mono text-slate-500 font-bold">
                                {r.row_number}
                              </td>
                              <td className="py-2 px-3 text-center">
                                {r.is_valid ? (
                                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Valid</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800">
                                    <XCircle className="w-3 h-3" />
                                    <span>Error</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 font-mono font-semibold text-slate-800">{r.sku}</td>
                              <td className="py-2 px-3 font-semibold text-slate-900">{r.name}</td>
                              <td className="py-2 px-3 text-slate-600">{r.category}</td>
                              <td className="py-2 px-3 text-slate-600 lowercase">{r.unit}</td>
                              <td className="py-2 px-3 text-right font-mono text-slate-600">
                                {r.purchase_price.toLocaleString('id-ID')}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                                {r.selling_price.toLocaleString('id-ID')}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                                {r.current_stock}
                              </td>
                              <td className="py-2 px-3">
                                {r.errors && r.errors.length > 0 ? (
                                  <div className="space-y-0.5">
                                    {r.errors.map((errText, eIdx) => (
                                      <div key={eIdx} className="text-rose-600 font-semibold text-[11px]">
                                        • {errText}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-emerald-600 text-[11px] font-medium">Siap diimpor</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
