import React, { useState } from 'react';
import {
  Download,
  UploadCloud,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  FileText,
} from 'lucide-react';
import { api } from '../api/client';
import type { ImportPreviewResponse, ImportRow } from '../types';

export const BulkImportView: React.FC = () => {
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
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    setExecutionResult(null);
    setPreviewData(null);

    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'csv', 'xls'].includes(ext || '')) {
      setError('Format file tidak didukung. Mohon gunakan file berekstensi .xlsx atau .csv');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('Ukuran file melebihi batas maksimum 5MB.');
      return;
    }

    setFile(selectedFile);
    uploadAndPreview(selectedFile);
  };

  const uploadAndPreview = async (fileToUpload: File) => {
    setIsValidating(true);
    setError(null);
    try {
      const res = await api.previewImport(fileToUpload);
      setPreviewData(res);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
        setError(err.message);
      } else {
        setError('Gagal membaca dan memvalidasi file.');
      }
    } finally {
      setIsValidating(false);
    }
  };

  const handleExecute = async () => {
    if (!previewData) return;
    setError(null);
    setIsExecuting(true);

    try {
      const res = await api.executeImport(previewData.preview_id, executionMode);
      setExecutionResult(res);
      setPreviewData(null);
      setFile(null);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
        setError(err.message);
      } else {
        setError('Gagal mengeksekusi impor produk.');
      }
    } finally {
      setIsExecuting(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setPreviewData(null);
    setExecutionResult(null);
    setError(null);
  };

  const displayedRows = (previewData?.rows || []).filter((r: ImportRow) => {
    if (filterRows === 'valid') return r.is_valid;
    if (filterRows === 'invalid') return !r.is_valid;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Impor Massal Produk via Excel (.xlsx) & CSV (.csv)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Migrasi cepat ratusan data produk baru beserta saldo stok awal dan mutasi awal otomatis
          </p>
        </div>

        {/* Download Template Buttons */}
        <div className="flex items-center space-x-2">
          <a
            href={api.getTemplateUrl('xlsx')}
            download="template_import_produk_koperasi.xlsx"
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Unduh Template .XLSX</span>
          </a>

          <a
            href={api.getTemplateUrl('csv')}
            download="template_import_produk_koperasi.csv"
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Unduh Template .CSV</span>
          </a>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Success Result Banner */}
      {executionResult && (
        <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900 shadow-xs">
          <div className="flex items-start space-x-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <h3 className="font-bold text-base text-emerald-900">Impor Produk Selesai Berhasil!</h3>
              <p className="text-xs text-emerald-800">{executionResult.message}</p>
              <div className="flex items-center space-x-4 pt-2 text-xs">
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
              <div className="pt-3">
                <button
                  onClick={resetAll}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Impor File Lainnya
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drag & Drop Area (If not previewing) */}
      {!previewData && !executionResult && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all bg-white ${
            isDragging
              ? 'border-emerald-500 bg-emerald-50/50 scale-[1.01]'
              : 'border-slate-300 hover:border-slate-400'
          }`}
        >
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 shadow-xs">
            <UploadCloud className="w-8 h-8" />
          </div>

          <h3 className="text-sm font-bold text-slate-800">
            {isValidating ? 'Memvalidasi data baris...' : 'Tarik & Letakkan file Excel / CSV di sini'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Mendukung format .xlsx, .xls, dan .csv dengan batas ukuran file maksimal 5MB
          </p>

          <div className="mt-5">
            <label className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer">
              <span>Pilih File dari Komputer</span>
              <input
                type="file"
                accept=".xlsx,.csv,.xls"
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
          {/* Summary Chips & Mode Action */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs font-bold text-slate-900 mr-2 flex items-center space-x-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>{file ? file.name : 'Hasil Validasi'}:</span>
              </div>
              <button
                onClick={() => setFilterRows('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filterRows === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Semua Baris ({previewData.summary.total_rows})
              </button>

              <button
                onClick={() => setFilterRows('valid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                  filterRows === 'valid'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Baris Valid ({previewData.summary.valid_count})</span>
              </button>

              <button
                onClick={() => setFilterRows('invalid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                  filterRows === 'invalid'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-800'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Baris Bermasalah ({previewData.summary.invalid_count})</span>
              </button>
            </div>

            {/* Mode selection & Confirmation Execute button */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-xs">
                <select
                  value={executionMode}
                  onChange={(e) => setExecutionMode(e.target.value as 'valid_only' | 'all_or_nothing')}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="valid_only">Hanya Proses Baris Valid</option>
                  <option value="all_or_nothing">Batalkan Semua Jika Ada Error</option>
                </select>
              </div>

              <button
                onClick={resetAll}
                className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium rounded-lg transition-colors cursor-pointer"
              >
                Batal / Ganti File
              </button>

              <button
                onClick={handleExecute}
                disabled={
                  isExecuting ||
                  (executionMode === 'all_or_nothing' && previewData.summary.invalid_count > 0) ||
                  previewData.summary.valid_count === 0
                }
                className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{isExecuting ? 'Mengeksekusi...' : 'Konfirmasi & Eksekusi Impor'}</span>
              </button>
            </div>
          </div>

          {/* Preview Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="min-w-full text-xs text-left">
                <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 text-center">Baris</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Nama Produk</th>
                    <th className="py-2.5 px-3">Kategori</th>
                    <th className="py-2.5 px-3">Satuan</th>
                    <th className="py-2.5 px-3 text-right">HPP</th>
                    <th className="py-2.5 px-3 text-right">Harga Jual</th>
                    <th className="py-2.5 px-3 text-right">Stok Awal</th>
                    <th className="py-2.5 px-3 text-right">Min. Stok</th>
                    <th className="py-2.5 px-3 text-center">Expired</th>
                    <th className="py-2.5 px-3">Catatan / Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedRows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-8 text-center text-slate-400">
                        Tidak ada baris data pada filter ini.
                      </td>
                    </tr>
                  ) : (
                    displayedRows.map((r) => (
                      <tr
                        key={r.row_number}
                        className={
                          r.is_valid
                            ? 'bg-emerald-50/30 hover:bg-emerald-50/60'
                            : 'bg-rose-50/40 hover:bg-rose-50/70'
                        }
                      >
                        <td className="py-2.5 px-3 text-center font-mono text-slate-500 font-bold">
                          {r.row_number}
                        </td>
                        <td className="py-2.5 px-3 text-center">
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
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">{r.sku}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{r.name}</td>
                        <td className="py-2.5 px-3 text-slate-600">{r.category}</td>
                        <td className="py-2.5 px-3 text-slate-600 lowercase">{r.unit}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          {r.purchase_price.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                          {r.selling_price.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                          {r.current_stock}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                          {r.minimum_stock}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                          {r.expired_date || '-'}
                        </td>
                        <td className="py-2.5 px-3">
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
  );
};
