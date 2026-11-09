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
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Csv;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
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

    /**
     * Download Excel or CSV template
     */
    public function downloadTemplate(Request $request): StreamedResponse
    {
        $format = strtolower($request->input('format', 'xlsx'));

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
     * Parse and validate uploaded Excel / CSV file
     */
    public function preview(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'max:5120'], // Max 5MB
        ]);

        $uploadedFile = $request->file('file');
        $extension = strtolower($uploadedFile->getClientOriginalExtension());

        if (!in_array($extension, ['xlsx', 'csv', 'xls', 'txt'])) {
            return response()->json([
                'message' => 'Format file tidak didukung. Harap unggah file .xlsx atau .csv.',
            ], 422);
        }

        $rawRows = [];

        // Parse file
        if ($extension === 'csv' || $extension === 'txt') {
            $filePath = $uploadedFile->getRealPath();
            $handle = fopen($filePath, 'r');
            // Check BOM
            $bom = fread($handle, 3);
            if ($bom !== "\xEF\xBB\xBF") {
                rewind($handle);
            }

            // Read header
            $header = fgetcsv($handle, 4096, ',');
            if (!$header || count($header) < 2) {
                // Try semicolon delimiter
                rewind($handle);
                $header = fgetcsv($handle, 4096, ';');
                $delimiter = ';';
            } else {
                $delimiter = ',';
            }

            $normalizedHeader = array_map(fn($h) => strtolower(trim(str_replace(' ', '_', $h))), $header ?? []);

            while (($row = fgetcsv($handle, 4096, $delimiter)) !== false) {
                if (count(array_filter($row)) === 0) {
                    continue; // skip empty line
                }
                $assoc = [];
                foreach ($normalizedHeader as $idx => $colName) {
                    $assoc[$colName] = $row[$idx] ?? '';
                }
                $rawRows[] = $assoc;
            }
            fclose($handle);
        } else {
            // Excel (.xlsx, .xls)
            $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($uploadedFile->getRealPath());
            $sheet = $spreadsheet->getActiveSheet();
            $rows = $sheet->toArray(null, true, true, false);

            if (empty($rows)) {
                return response()->json(['message' => 'File kosong.'], 422);
            }

            $header = array_shift($rows);
            $normalizedHeader = array_map(fn($h) => strtolower(trim(str_replace(' ', '_', (string) $h))), $header);

            foreach ($rows as $row) {
                if (count(array_filter($row)) === 0) {
                    continue;
                }
                $assoc = [];
                foreach ($normalizedHeader as $idx => $colName) {
                    $assoc[$colName] = $row[$idx] ?? '';
                }
                $rawRows[] = $assoc;
            }
        }

        if (empty($rawRows)) {
            return response()->json(['message' => 'Tidak ada data produk yang ditemukan dalam file.'], 422);
        }

        // Validate rows
        $parsedResults = [];
        $seenSkusInFile = [];
        $existingDbSkus = Product::pluck('sku')->map(fn($s) => strtoupper($s))->flip()->all();

        $validCount = 0;
        $invalidCount = 0;

        foreach ($rawRows as $index => $r) {
            $rowNum = $index + 2; // Row number in spreadsheet (1 is header)
            $errors = [];

            $sku = strtoupper(trim((string) ($r['sku'] ?? '')));
            $name = trim((string) ($r['nama_produk'] ?? ''));
            $category = trim((string) ($r['kategori'] ?? ''));
            $unit = strtolower(trim((string) ($r['satuan'] ?? 'pcs')));
            $hppRaw = trim((string) ($r['harga_modal_hpp'] ?? ''));
            $sellingPriceRaw = trim((string) ($r['harga_jual'] ?? ''));
            $initialStockRaw = trim((string) ($r['stok_awal'] ?? '0'));
            $minStockRaw = trim((string) ($r['stok_minimum'] ?? '5'));
            $expiredRaw = trim((string) ($r['tanggal_expired'] ?? ''));

            // 1. Mandatory checks
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

            // Numeric validations
            if ($hppRaw === '' || !is_numeric($hppRaw) || (float) $hppRaw < 0) {
                $errors[] = 'Harga modal (HPP) harus angka positif atau 0';
            }

            if ($sellingPriceRaw === '' || !is_numeric($sellingPriceRaw) || (float) $sellingPriceRaw < 0) {
                $errors[] = 'Harga jual harus angka positif atau 0';
            }

            if ($initialStockRaw === '' || !is_numeric($initialStockRaw) || (int) $initialStockRaw < 0) {
                $errors[] = 'Stok awal harus angka bulat positif atau 0';
            }

            if ($minStockRaw !== '' && (!is_numeric($minStockRaw) || (int) $minStockRaw < 0)) {
                $errors[] = 'Stok minimum harus angka bulat positif atau 0';
            }

            // Date validation (optional)
            $parsedExpiry = null;
            if ($expiredRaw !== '') {
                try {
                    $d = Carbon::parse($expiredRaw);
                    $parsedExpiry = $d->toDateString();
                } catch (\Throwable $e) {
                    $errors[] = 'Format tanggal expired tidak valid (gunakan YYYY-MM-DD)';
                }
            }

            $isValid = count($errors) === 0;
            if ($isValid) {
                $validCount++;
            } else {
                $invalidCount++;
            }

            $parsedResults[] = [
                'row_number' => $rowNum,
                'sku' => $sku,
                'name' => $name,
                'category' => $category,
                'unit' => $unit,
                'purchase_price' => is_numeric($hppRaw) ? (float) $hppRaw : 0,
                'selling_price' => is_numeric($sellingPriceRaw) ? (float) $sellingPriceRaw : 0,
                'current_stock' => is_numeric($initialStockRaw) ? (int) $initialStockRaw : 0,
                'minimum_stock' => is_numeric($minStockRaw) ? (int) $minStockRaw : 5,
                'expired_date' => $parsedExpiry,
                'is_valid' => $isValid,
                'errors' => $errors,
            ];
        }

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
