<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use App\Models\StockMovement;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Csv;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProductImportController extends Controller
{
    private const REQUIRED_HEADERS = [
        'sku',
        'nama_produk',
        'kategori',
        'satuan',
        'harga_modal_hpp',
        'harga_jual',
        'stok_awal',
        'stok_minimum',
        'tanggal_expired',
    ];

    private const SECTION_CATEGORIES = [
        'SEMBAKO' => 'Sembako',
        'SNACK' => 'Snack & Makanan Ringan',
        'ANEKA PLASTIK' => 'Aneka Plastik & Kemasan',
        'ATK' => 'ATK (Alat Tulis Kantor)',
        'OBAT-OBATAN' => 'Obat-obatan & Kesehatan',
        'MINUMAN' => 'Minuman',
        'MAKANAN' => 'Makanan',
        'KONSINYASI' => 'Konsinyasi',
        'KEBERSIHAN' => 'Kebutuhan Rumah Tangga',
        'RUMAH TANGGA' => 'Kebutuhan Rumah Tangga',
        'ALAT TULIS' => 'ATK (Alat Tulis Kantor)',
        'PERLENGKAPAN' => 'Perlengkapan',
        'LAIN-LAIN' => 'Lain-lain',
        'LAINNYA' => 'Lain-lain',
    ];

    /**
     * Download Excel or CSV template
     */
    public function downloadTemplate(Request $request): StreamedResponse|BinaryFileResponse
    {
        $format = strtolower($request->input('format', 'xlsx'));

        if ($format === 'stock_opname') {
            $stockOpnamePath = base_path('../STOCK OPNAME 2026 (1).xlsx');
            if (file_exists($stockOpnamePath)) {
                return response()->download(
                    $stockOpnamePath,
                    'STOCK_OPNAME_2026_template.xlsx',
                    [
                        'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        'Cache-Control' => 'max-age=0',
                    ]
                );
            }
        }

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Template Import');

        // Headers
        $headers = self::REQUIRED_HEADERS;
        $sheet->fromArray([$headers], null, 'A1');

        // Auto-fit column widths
        foreach (range('A', 'I') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        if ($format === 'csv') {
            $fileName = 'template_import_produk_koperasi.csv';
            $writer = new Csv($spreadsheet);
            $writer->setUseBOM(true);
            $contentType = 'text/csv; charset=UTF-8';
        } else {
            $fileName = 'template_import_produk_koperasi.xlsx';
            $writer = new Xlsx($spreadsheet);
            $contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        }

        return response()->streamDownload(function () use ($writer) {
            $writer->save('php://output');
        }, $fileName, [
            'Content-Type' => $contentType,
            'Cache-Control' => 'max-age=0',
        ]);
    }

    /**
     * Parse and validate uploaded Excel / CSV file (supports both standard template & STOCK OPNAME 2026.xlsx)
     */
    public function preview(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'max:10240'], // Max 10MB
        ]);

        $uploadedFile = $request->file('file');
        $extension = strtolower($uploadedFile->getClientOriginalExtension());

        if (!in_array($extension, ['xlsx', 'csv', 'xls', 'txt'], true)) {
            return response()->json([
                'message' => 'Format file tidak didukung. Harap unggah file .xlsx, .xls, atau .csv.',
            ], 422);
        }

        $grid = [];

        if ($extension === 'csv' || $extension === 'txt') {
            $filePath = $uploadedFile->getRealPath();
            $handle = fopen($filePath, 'r');
            if ($handle === false) {
                return response()->json(['message' => 'Gagal membuka file.'], 422);
            }

            // Check UTF-8 BOM
            $bom = fread($handle, 3);
            if ($bom !== "\xEF\xBB\xBF") {
                rewind($handle);
            }

            // Detect delimiter from first non-empty line
            $delimiter = ',';
            $pos = ftell($handle);
            while (($probeLine = fgets($handle)) !== false) {
                if (trim($probeLine) === '') {
                    continue;
                }
                if (substr_count($probeLine, ';') > substr_count($probeLine, ',')) {
                    $delimiter = ';';
                }
                break;
            }
            fseek($handle, $pos);

            while (($row = fgetcsv($handle, 8192, $delimiter)) !== false) {
                $grid[] = $row;
            }
            fclose($handle);
        } else {
            // Excel (.xlsx, .xls)
            $filePath = $uploadedFile->getRealPath();
            $reader = IOFactory::createReaderForFile($filePath);
            $reader->setReadDataOnly(true);

            $sheetNames = method_exists($reader, 'listWorksheetNames')
                ? $reader->listWorksheetNames($filePath)
                : [];

            $requestedSheet = $request->input('sheet');
            $selectedSheet = null;

            if ($requestedSheet && in_array($requestedSheet, $sheetNames, true)) {
                $selectedSheet = $requestedSheet;
            } elseif (!empty($sheetNames)) {
                foreach ($sheetNames as $name) {
                    if (preg_match('/stock\s*op|opname|produk|katalog|master|import|template/i', $name)) {
                        $selectedSheet = $name;
                        break;
                    }
                }
                if ($selectedSheet === null) {
                    $selectedSheet = $sheetNames[0];
                }
            }

            if ($selectedSheet !== null && method_exists($reader, 'setLoadSheetsOnly')) {
                $reader->setLoadSheetsOnly([$selectedSheet]);
            }

            $spreadsheet = $reader->load($filePath);
            $sheet = $spreadsheet->getSheet(0);

            try {
                $grid = $sheet->toArray(null, true, false, false);
            } catch (\Throwable) {
                $grid = $sheet->toArray(null, false, false, false);
            }
        }

        if (empty($grid)) {
            return response()->json(['message' => 'File kosong.'], 422);
        }

        $existingDbSkus = Product::withTrashed()
            ->pluck('sku')
            ->map(fn($s) => strtoupper((string) $s))
            ->flip()
            ->all();

        $detected = $this->detectFormatAndHeader($grid);
        if ($detected['type'] === 'stock_opname') {
            $parsedResults = $this->parseStockOpnameGrid($grid, $detected['header_index'], $existingDbSkus);
        } else {
            $parsedResults = $this->parseStandardGrid($grid, $detected['header_index'], $existingDbSkus);
        }

        if (empty($parsedResults)) {
            return response()->json(['message' => 'Tidak ada data produk yang ditemukan dalam file.'], 422);
        }

        $validCount = count(array_filter($parsedResults, fn($r) => $r['is_valid']));
        $invalidCount = count($parsedResults) - $validCount;

        $previewId = (string) Str::uuid();
        Cache::put("import_preview_{$previewId}", $parsedResults, now()->addHours(2));

        return response()->json([
            'preview_id' => $previewId,
            'summary' => [
                'total_rows' => count($parsedResults),
                'valid_count' => $validCount,
                'invalid_count' => $invalidCount,
                'can_execute' => $validCount > 0,
            ],
            'rows' => $parsedResults,
        ]);
    }

    /**
     * Detect whether the grid uses the standard template or the Stock Opname 2026 layout
     */
    private function detectFormatAndHeader(array $grid): array
    {
        $maxScan = min(15, count($grid));
        for ($i = 0; $i < $maxScan; $i++) {
            $norm = array_map(fn($c) => $this->normalizeHeaderCell($c), $grid[$i] ?? []);

            // Standard template check
            if (
                in_array('nama_produk', $norm, true) ||
                in_array('harga_modal_hpp', $norm, true) ||
                (in_array('sku', $norm, true) && (in_array('harga_jual', $norm, true) || in_array('kategori', $norm, true)))
            ) {
                return ['type' => 'standard', 'header_index' => $i];
            }

            // Stock Opname 2026 check
            if (
                in_array('nama_barang', $norm, true) ||
                in_array('jenis_barang', $norm, true)
            ) {
                return ['type' => 'stock_opname', 'header_index' => $i];
            }
        }

        // Fallback: first non-empty row as standard
        for ($i = 0; $i < count($grid); $i++) {
            if (count(array_filter($grid[$i], fn($v) => $v !== null && trim((string) $v) !== '')) > 0) {
                return ['type' => 'standard', 'header_index' => $i];
            }
        }

        return ['type' => 'standard', 'header_index' => 0];
    }

    private function normalizeHeaderCell(mixed $value): string
    {
        return strtolower(preg_replace('/\s+/', '_', trim((string) $value)));
    }

    private function parseNumber(mixed $val): ?float
    {
        if ($val === null) {
            return null;
        }
        if (is_int($val) || is_float($val)) {
            return (float) $val;
        }

        $str = trim((string) $val);
        if ($str === '' || $str === '-' || $str === '--' || str_starts_with($str, '#')) {
            return null;
        }

        // Handle broken Excel cell ref strings like "0+C4:D17"
        if (preg_match('/^(\d+)\+[A-Z]+\d+/i', $str, $m)) {
            return (float) $m[1];
        }

        // Handle simple addition strings like "4+2+2+1"
        if (preg_match('/^\d+(\+\d+)+\+?$/', $str)) {
            $parts = array_filter(explode('+', $str), fn($p) => $p !== '');
            return (float) array_sum(array_map('intval', $parts));
        }

        $str = preg_replace('/^(rp\.?|idr)\s*/i', '', $str);
        $str = trim($str);

        if (preg_match('/^-?\d{1,3}(,\d{3})+(\.\d+)?$/', $str)) {
            $str = str_replace(',', '', $str);
        } elseif (preg_match('/^-?\d{1,3}(\.\d{3})+(,\d+)?$/', $str)) {
            $str = str_replace('.', '', $str);
            $str = str_replace(',', '.', $str);
        } else {
            $str = str_replace(',', '', $str);
        }

        return is_numeric($str) ? (float) $str : null;
    }

    /**
     * Parse standard CSV/XLSX template rows
     */
    private function parseStandardGrid(array $grid, int $headerIndex, array $existingDbSkus): array
    {
        $header = $grid[$headerIndex] ?? [];
        $normalizedHeader = array_map(fn($h) => $this->normalizeHeaderCell($h), $header);

        $parsedResults = [];
        $seenSkusInFile = [];

        for ($i = $headerIndex + 1; $i < count($grid); $i++) {
            $row = $grid[$i];
            if (count(array_filter($row, fn($v) => $v !== null && trim((string) $v) !== '')) === 0) {
                continue;
            }

            $r = [];
            foreach ($normalizedHeader as $idx => $colName) {
                if ($colName !== '') {
                    $r[$colName] = $row[$idx] ?? '';
                }
            }

            $rowNum = $i + 1;
            $errors = [];

            $sku = strtoupper(trim((string) ($r['sku'] ?? $r['kode'] ?? $r['barcode'] ?? '')));
            $name = trim((string) ($r['nama_produk'] ?? $r['nama_barang'] ?? $r['nama'] ?? ''));
            $category = trim((string) ($r['kategori'] ?? ''));
            $unit = strtolower(trim((string) ($r['satuan'] ?? 'pcs')));
            $hppRaw = trim((string) ($r['harga_modal_hpp'] ?? $r['harga_modal'] ?? $r['hpp'] ?? $r['harga_beli'] ?? ''));
            $sellingPriceRaw = trim((string) ($r['harga_jual'] ?? ''));
            $initialStockRaw = trim((string) ($r['stok_awal'] ?? $r['qty'] ?? $r['stok'] ?? '0'));
            $minStockRaw = trim((string) ($r['stok_minimum'] ?? $r['min_stok'] ?? '5'));
            $expiredRaw = trim((string) ($r['tanggal_expired'] ?? $r['expired'] ?? ''));

            if ($sku === '') {
                $errors[] = 'SKU wajib diisi';
            } elseif (isset($seenSkusInFile[$sku])) {
                $errors[] = "SKU duplikat dalam file impor (baris {$seenSkusInFile[$sku]})";
            } elseif (isset($existingDbSkus[$sku])) {
                $errors[] = "SKU '{$sku}' sudah terdaftar di database";
            } else {
                $seenSkusInFile[$sku] = $rowNum;
            }

            if ($name === '') {
                $errors[] = 'Nama produk wajib diisi';
            }

            if ($category === '') {
                $errors[] = 'Kategori produk wajib diisi';
            }

            if ($unit === '') {
                $unit = 'pcs';
            }

            $hppVal = $this->parseNumber($hppRaw);
            if ($hppRaw === '' || $hppVal === null || $hppVal < 0) {
                $errors[] = 'Harga modal (HPP) harus angka positif atau 0';
            }

            $sellVal = $this->parseNumber($sellingPriceRaw);
            if ($sellingPriceRaw === '' || $sellVal === null || $sellVal < 0) {
                $errors[] = 'Harga jual harus angka positif atau 0';
            }

            $stockVal = $this->parseNumber($initialStockRaw);
            if ($initialStockRaw === '' || $stockVal === null || $stockVal < 0) {
                $errors[] = 'Stok awal harus angka bulat positif atau 0';
            }

            $minStockVal = $minStockRaw !== '' ? $this->parseNumber($minStockRaw) : 5.0;
            if ($minStockRaw !== '' && ($minStockVal === null || $minStockVal < 0)) {
                $errors[] = 'Stok minimum harus angka bulat positif atau 0';
            }

            $parsedExpiry = null;
            if ($expiredRaw !== '') {
                try {
                    $d = Carbon::parse($expiredRaw);
                    $parsedExpiry = $d->toDateString();
                } catch (\Throwable) {
                    $errors[] = 'Format tanggal expired tidak valid (gunakan YYYY-MM-DD)';
                }
            }

            $isValid = count($errors) === 0;

            $parsedResults[] = [
                'row_number' => $rowNum,
                'sku' => $sku,
                'name' => $name,
                'category' => $category,
                'unit' => $unit,
                'purchase_price' => $hppVal !== null && $hppVal >= 0 ? (float) $hppVal : 0,
                'selling_price' => $sellVal !== null && $sellVal >= 0 ? (float) $sellVal : 0,
                'current_stock' => $stockVal !== null && $stockVal >= 0 ? (int) round($stockVal) : 0,
                'minimum_stock' => $minStockVal !== null && $minStockVal >= 0 ? (int) round($minStockVal) : 5,
                'expired_date' => $parsedExpiry,
                'is_valid' => $isValid,
                'errors' => $errors,
            ];
        }

        return $parsedResults;
    }

    /**
     * Parse STOCK OPNAME 2026.xlsx (and CSV exported from it)
     */
    private function parseStockOpnameGrid(array $grid, int $headerIndex, array $existingDbSkus): array
    {
        $hRow = array_map(fn($c) => $this->normalizeHeaderCell($c), $grid[$headerIndex] ?? []);
        $subRow = array_map(fn($c) => $this->normalizeHeaderCell($c), $grid[$headerIndex + 1] ?? []);

        $hasSubHeader = in_array('modal', $subRow, true)
            || in_array('jual', $subRow, true)
            || in_array('beli', $subRow, true)
            || in_array('qty', $subRow, true);

        $dataStartIdx = $headerIndex + ($hasSubHeader ? 2 : 1);

        $noCol = array_search('no', $hRow, true);
        if ($noCol === false) {
            $noCol = 0;
        }

        $skuCol = array_search('sku', $hRow, true);
        if ($skuCol === false) {
            $skuCol = array_search('kode', $hRow, true);
        }

        $nameCol = array_search('nama_barang', $hRow, true);
        if ($nameCol === false) {
            $nameCol = array_search('jenis_barang', $hRow, true);
        }
        if ($nameCol === false) {
            $nameCol = 2;
        }

        $catCol = array_search('kategori', $hRow, true);

        $qtyCols = [];
        $unitCols = [];
        $hppCols = [];
        $sellCols = [];

        $maxCols = max(count($hRow), count($subRow));
        for ($c = 0; $c < $maxCols; $c++) {
            $h = $hRow[$c] ?? '';
            $s = $subRow[$c] ?? '';

            if ($h === 'qty' || $s === 'qty' || $h === 'stok' || $h === 'stok_awal') {
                $qtyCols[] = $c;
            }
            if (in_array($h, ['satuan', 'stuan'], true) || in_array($s, ['satuan', 'stuan'], true)) {
                $unitCols[] = $c;
            }
            if (
                $h === 'harga_modal' ||
                $h === 'harga_beli' ||
                ($h === 'harga' && in_array($s, ['modal', 'beli'], true)) ||
                ($h === '' && in_array($s, ['modal', 'beli'], true))
            ) {
                $hppCols[] = $c;
            }
            if (
                $h === 'harga_jual' ||
                ($h === 'harga' && $s === 'jual') ||
                ($h === '' && $s === 'jual') ||
                ($s === 'harga' && $c > 10)
            ) {
                $sellCols[] = $c;
            }
        }

        $primaryQtyCol = $qtyCols[0] ?? 3;
        $inQtyCol = $qtyCols[1] ?? null;
        $outQtyCol = $qtyCols[2] ?? null;

        $primaryUnitCol = $unitCols[0] ?? 4;
        $inUnitCol = $unitCols[1] ?? null;
        $outUnitCol = $unitCols[2] ?? null;

        $primaryHppCol = $hppCols[0] ?? 5;
        $inHppCol = $hppCols[1] ?? null;

        $primarySellCol = $sellCols[0] ?? 6;
        $inSellCol = $sellCols[1] ?? null;
        $outSellCol = $sellCols[2] ?? null;

        $allDataCols = array_values(array_unique(array_filter(
            array_merge($qtyCols, $unitCols, $hppCols, $sellCols),
            fn($c) => $c !== null
        )));

        $currentCategory = 'Kebutuhan Rumah Tangga';
        $parsedResults = [];
        $seenSkusInFile = [];
        $autoCounter = 250;

        for ($i = $dataStartIdx; $i < count($grid); $i++) {
            $r = $grid[$i];
            $rowNum = $i + 1;

            $name = trim(preg_replace('/\s+/', ' ', (string) ($r[$nameCol] ?? '')));
            $noRaw = trim((string) ($r[$noCol] ?? ''));

            if ($name === '') {
                continue;
            }

            $upperName = strtoupper($name);

            // Repeated sub-table header row (e.g. Row 292 "NO | NAMA BARANG | QTY | SATUAN | HARGA")
            if (
                in_array($upperName, ['NAMA BARANG', 'JENIS BARANG', 'NAMA PRODUK'], true) ||
                strtoupper($noRaw) === 'NO'
            ) {
                $currentCategory = 'Minuman';
                continue;
            }

            // Check if any data column is populated on this row
            $hasDataCell = false;
            foreach ($allDataCols as $dc) {
                $v = trim((string) ($r[$dc] ?? ''));
                if ($v !== '' && $v !== '-' && $v !== '--' && !str_starts_with($v, '#')) {
                    $hasDataCell = true;
                    break;
                }
            }

            if (!$hasDataCell) {
                if (isset(self::SECTION_CATEGORIES[$upperName])) {
                    $currentCategory = self::SECTION_CATEGORIES[$upperName];
                    continue;
                }
                if ($noRaw === '') {
                    // Stray note/blank line without item number or figures
                    continue;
                }
            }

            // Determine Category
            $rowCategory = $catCol !== false ? trim((string) ($r[$catCol] ?? '')) : '';
            if ($rowCategory === '') {
                $rowCategory = $currentCategory;
            }

            // Determine SKU
            $explicitSku = $skuCol !== false ? strtoupper(trim((string) ($r[$skuCol] ?? ''))) : '';
            if ($explicitSku !== '') {
                $sku = $explicitSku;
            } else {
                $noNum = is_numeric($noRaw) ? (int) $noRaw : null;
                if ($noNum !== null && $noNum > 0) {
                    $candidate = sprintf('SO-%03d', $noNum);
                } else {
                    $autoCounter++;
                    $candidate = sprintf('SO-%03d', $autoCounter);
                }
                while (isset($seenSkusInFile[$candidate]) || isset($existingDbSkus[$candidate])) {
                    $autoCounter++;
                    $candidate = sprintf('SO-%03d', $autoCounter);
                }
                $sku = $candidate;
            }

            // Determine Stock
            $qtyVal = $this->parseNumber($r[$primaryQtyCol] ?? null);
            $inQtyVal = $inQtyCol !== null ? $this->parseNumber($r[$inQtyCol] ?? null) : null;
            if ($qtyVal !== null && $qtyVal > 0) {
                $stock = (int) round($qtyVal);
            } elseif ($inQtyVal !== null && $inQtyVal > 0) {
                $stock = (int) round($inQtyVal);
            } else {
                $stock = 0;
            }

            // Determine Unit
            $unitRaw = trim((string) ($r[$primaryUnitCol] ?? ''));
            if ($unitRaw === '' && $inUnitCol !== null) {
                $unitRaw = trim((string) ($r[$inUnitCol] ?? ''));
            }
            if ($unitRaw === '' && $outUnitCol !== null) {
                $candidateUnit = trim((string) ($r[$outUnitCol] ?? ''));
                if ($candidateUnit !== '' && !is_numeric($candidateUnit)) {
                    $unitRaw = $candidateUnit;
                }
            }
            $unit = strtolower($unitRaw !== '' ? $unitRaw : 'pcs');
            $unitMap = [
                'psc' => 'pcs',
                'suset' => 'sachet',
                'pac.' => 'pak',
                'pac' => 'pak',
                'pack' => 'pak',
            ];
            if (isset($unitMap[$unit])) {
                $unit = $unitMap[$unit];
            }
            $unit = substr($unit, 0, 32);

            // Determine HPP & Selling Price
            $hppVal = $this->parseNumber($r[$primaryHppCol] ?? null);
            $sellVal = $this->parseNumber($r[$primarySellCol] ?? null);
            $inHppVal = $inHppCol !== null ? $this->parseNumber($r[$inHppCol] ?? null) : null;
            $inSellVal = $inSellCol !== null ? $this->parseNumber($r[$inSellCol] ?? null) : null;
            $outSellVal = $outSellCol !== null ? $this->parseNumber($r[$outSellCol] ?? null) : null;
            $outQtyVal = $outQtyCol !== null ? $this->parseNumber($r[$outQtyCol] ?? null) : null;
            $outUnitNum = $outUnitCol !== null ? $this->parseNumber($r[$outUnitCol] ?? null) : null;

            if (($hppVal === null || $hppVal <= 0) && $inHppVal !== null && $inHppVal > 0) {
                if ($inQtyVal !== null && $inQtyVal > 1) {
                    if ($inSellVal !== null && $inSellVal > 0 && abs(($inHppVal * $inQtyVal) - $inSellVal) < 100) {
                        $hppVal = $inHppVal;
                    } else {
                        $hppVal = round($inHppVal / $inQtyVal, 2);
                    }
                } else {
                    $hppVal = $inHppVal;
                }
            }

            if ($sellVal === null || $sellVal <= 0) {
                if ($inSellVal !== null && $inSellVal > 0) {
                    $sellVal = ($inQtyVal !== null && $inQtyVal > 1)
                        ? round($inSellVal / $inQtyVal, 2)
                        : $inSellVal;
                } elseif ($outSellVal !== null && $outSellVal > 0) {
                    // In some rows Col P has unit price and Col Q has total (O * P)
                    if ($outQtyVal !== null && $outQtyVal > 1 && $outUnitNum !== null && $outUnitNum > 0 && abs(($outQtyVal * $outUnitNum) - $outSellVal) < 100) {
                        $sellVal = $outUnitNum;
                    } else {
                        $sellVal = $outSellVal;
                    }
                } elseif ($hppVal !== null && $hppVal > 0) {
                    $sellVal = $hppVal;
                }
            }

            $finalHpp = ($hppVal !== null && $hppVal >= 0) ? (float) $hppVal : 0.0;
            $finalSell = ($sellVal !== null && $sellVal >= 0) ? (float) $sellVal : 0.0;

            $errors = [];
            if (isset($seenSkusInFile[$sku])) {
                $errors[] = "SKU duplikat dalam file impor (baris {$seenSkusInFile[$sku]})";
            } elseif (isset($existingDbSkus[$sku])) {
                $errors[] = "SKU '{$sku}' sudah terdaftar di database";
            } else {
                $seenSkusInFile[$sku] = $rowNum;
            }

            $parsedResults[] = [
                'row_number' => $rowNum,
                'sku' => $sku,
                'name' => $name,
                'category' => $rowCategory,
                'unit' => $unit,
                'purchase_price' => $finalHpp,
                'selling_price' => $finalSell,
                'current_stock' => max(0, $stock),
                'minimum_stock' => 5,
                'expired_date' => null,
                'is_valid' => count($errors) === 0,
                'errors' => $errors,
            ];
        }

        return $parsedResults;
    }

    /**
     * Execute bulk import from validated preview
     */
    public function execute(Request $request): JsonResponse
    {
        $request->validate([
            'preview_id' => ['required', 'string'],
            'mode' => ['required', 'string', 'in:valid_only,all_or_nothing'],
        ]);

        $previewId = $request->input('preview_id');
        $mode = $request->input('mode');

        $rows = Cache::get("import_preview_{$previewId}");
        if (!$rows) {
            return response()->json([
                'message' => 'Sesi pratinjau kedaluwarsa atau tidak valid. Silakan unggah ulang file.',
            ], 404);
        }

        $invalidCount = count(array_filter($rows, fn($r) => !$r['is_valid']));
        if ($mode === 'all_or_nothing' && $invalidCount > 0) {
            return response()->json([
                'message' => "Impor dibatalkan: Terdapat {$invalidCount} baris bermasalah dan mode yang dipilih adalah Batalkan Semua jika ada error.",
            ], 422);
        }

        $rowsToImport = array_filter($rows, fn($r) => $r['is_valid']);
        if (empty($rowsToImport)) {
            return response()->json([
                'message' => 'Tidak ada baris valid untuk diimpor.',
            ], 422);
        }

        $user = $request->user();
        $importBatchId = 'IMP-' . strtoupper(Str::random(8));

        $importedCount = DB::transaction(function () use ($rowsToImport, $user, $importBatchId) {
            // Pre-load all categories in memory
            $categoryCache = Category::all()->pluck('id', 'name')->toArray();

            $productsData = [];
            $now = Carbon::now();

            foreach ($rowsToImport as $row) {
                $categoryName = trim($row['category']);
                if (!isset($categoryCache[$categoryName])) {
                    $cat = Category::firstOrCreate(['name' => $categoryName]);
                    $categoryCache[$categoryName] = $cat->id;
                }
                $categoryId = $categoryCache[$categoryName];

                $product = Product::create([
                    'sku' => $row['sku'],
                    'name' => $row['name'],
                    'category_id' => $categoryId,
                    'unit' => $row['unit'],
                    'purchase_price' => $row['purchase_price'],
                    'selling_price' => $row['selling_price'],
                    'current_stock' => $row['current_stock'],
                    'minimum_stock' => $row['minimum_stock'],
                    'expired_date' => $row['expired_date'],
                ]);

                if ($row['current_stock'] > 0) {
                    StockMovement::create([
                        'product_id' => $product->id,
                        'user_id' => $user?->id,
                        'type' => 'INBOUND_INITIAL',
                        'quantity' => $row['current_stock'],
                        'balance_after' => $row['current_stock'],
                        'reference_type' => 'bulk_import',
                        'reference_id' => $importBatchId,
                        'notes' => "Impor massal batch {$importBatchId}",
                    ]);
                }
            }

            return count($rowsToImport);
        });

        // Clean cache
        Cache::forget("import_preview_{$previewId}");

        return response()->json([
            'message' => "Berhasil mengimpor {$importedCount} produk ke sistem koperasi.",
            'batch_id' => $importBatchId,
            'imported_count' => $importedCount,
        ]);
    }
}
