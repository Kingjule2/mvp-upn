<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use App\Models\StockMovement;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Product::with('category')->latest();

        // Search by name or SKU
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                  ->orWhere('sku', 'ilike', "%{$search}%");
            });
        }

        // Filter by category
        if ($categoryId = $request->input('category_id')) {
            $query->where('category_id', $categoryId);
        }

        // Filter by status (Aman, Stok Tipis, Habis)
        if ($status = $request->input('status')) {
            if ($status === 'Habis') {
                $query->where('current_stock', '<=', 0);
            } elseif ($status === 'Stok Tipis') {
                $query->where('current_stock', '>', 0)
                      ->whereColumn('current_stock', '<=', 'minimum_stock');
            } elseif ($status === 'Aman') {
                $query->whereColumn('current_stock', '>', 'minimum_stock');
            }
        }

        // Filter expiring soon (< 30 days)
        if ($request->boolean('expiring_soon')) {
            $today = Carbon::today()->toDateString();
            $in30Days = Carbon::today()->addDays(30)->toDateString();
            $query->whereNotNull('expired_date')
                  ->where('expired_date', '>=', $today)
                  ->where('expired_date', '<=', $in30Days);
        }

        // Filter already expired
        if ($request->boolean('expired')) {
            $today = Carbon::today()->toDateString();
            $query->whereNotNull('expired_date')
                  ->where('expired_date', '<', $today);
        }

        // Pagination or all
        $perPage = (int) $request->input('per_page', 15);
        $products = $perPage === -1 ? $query->get() : $query->paginate($perPage);

        // Summary counts for badges
        $summary = [
            'total_products' => Product::count(),
            'total_low_stock' => Product::where('current_stock', '>', 0)
                ->whereColumn('current_stock', '<=', 'minimum_stock')->count(),
            'total_out_of_stock' => Product::where('current_stock', '<=', 0)->count(),
            'total_expiring_soon' => Product::whereNotNull('expired_date')
                ->where('expired_date', '>=', Carbon::today()->toDateString())
                ->where('expired_date', '<=', Carbon::today()->addDays(30)->toDateString())->count(),
        ];

        return response()->json([
            'data' => $products,
            'summary' => $summary,
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $product = Product::with(['category', 'stockMovements.user'])->findOrFail($id);

        return response()->json([
            'data' => $product,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'sku' => ['required', 'string', 'max:64', 'unique:products,sku'],
            'name' => ['required', 'string', 'max:255'],
            'category_id' => ['nullable', 'exists:categories,id'],
            'category_name' => ['nullable', 'string', 'max:100'],
            'unit' => ['required', 'string', 'max:32'],
            'purchase_price' => ['required', 'numeric', 'min:0'],
            'selling_price' => ['required', 'numeric', 'min:0'],
            'current_stock' => ['nullable', 'integer', 'min:0'],
            'minimum_stock' => ['nullable', 'integer', 'min:0'],
            'expired_date' => ['nullable', 'date'],
        ]);

        $product = DB::transaction(function () use ($validated, $request) {
            // Find or create category if category_name is passed
            $categoryId = $validated['category_id'] ?? null;
            if (!$categoryId && !empty($validated['category_name'])) {
                $category = Category::firstOrCreate(['name' => trim($validated['category_name'])]);
                $categoryId = $category->id;
            }

            $initialStock = (int) ($validated['current_stock'] ?? 0);

            $product = Product::create([
                'sku' => strtoupper(trim($validated['sku'])),
                'name' => trim($validated['name']),
                'category_id' => $categoryId,
                'unit' => strtolower(trim($validated['unit'])),
                'purchase_price' => $validated['purchase_price'],
                'selling_price' => $validated['selling_price'],
                'current_stock' => $initialStock,
                'minimum_stock' => $validated['minimum_stock'] ?? 5,
                'expired_date' => $validated['expired_date'] ?? null,
            ]);

            if ($initialStock > 0) {
                StockMovement::create([
                    'product_id' => $product->id,
                    'user_id' => $request->user()?->id,
                    'type' => 'INBOUND_INITIAL',
                    'quantity' => $initialStock,
                    'balance_after' => $initialStock,
                    'reference_type' => 'manual_create',
                    'reference_id' => 'INIT-' . $product->sku,
                    'notes' => 'Input produk baru manual',
                ]);
            }

            return $product;
        });

        return response()->json([
            'message' => 'Produk berhasil ditambahkan',
            'data' => $product->load('category'),
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $product = Product::findOrFail($id);

        $validated = $request->validate([
            'sku' => ['required', 'string', 'max:64', Rule::unique('products', 'sku')->ignore($product->id)],
            'name' => ['required', 'string', 'max:255'],
            'category_id' => ['nullable', 'exists:categories,id'],
            'category_name' => ['nullable', 'string', 'max:100'],
            'unit' => ['required', 'string', 'max:32'],
            'purchase_price' => ['required', 'numeric', 'min:0'],
            'selling_price' => ['required', 'numeric', 'min:0'],
            'minimum_stock' => ['nullable', 'integer', 'min:0'],
            'expired_date' => ['nullable', 'date'],
        ]);

        $categoryId = $validated['category_id'] ?? $product->category_id;
        if (!empty($validated['category_name'])) {
            $category = Category::firstOrCreate(['name' => trim($validated['category_name'])]);
            $categoryId = $category->id;
        }

        $product->update([
            'sku' => strtoupper(trim($validated['sku'])),
            'name' => trim($validated['name']),
            'category_id' => $categoryId,
            'unit' => strtolower(trim($validated['unit'])),
            'purchase_price' => $validated['purchase_price'],
            'selling_price' => $validated['selling_price'],
            'minimum_stock' => $validated['minimum_stock'] ?? $product->minimum_stock,
            'expired_date' => $validated['expired_date'] ?? null,
        ]);

        return response()->json([
            'message' => 'Produk berhasil diperbarui',
            'data' => $product->load('category'),
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $product = Product::findOrFail($id);
        $product->delete(); // Soft delete

        return response()->json([
            'message' => 'Produk berhasil dihapus (soft-delete)',
        ]);
    }

    public function adjustStock(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'type' => ['required', Rule::in(['INBOUND', 'ADJUSTMENT'])],
            'quantity' => ['required', 'integer'],
            'notes' => ['required', 'string', 'max:500'],
        ]);

        $type = $request->input('type');
        $qty = (int) $request->input('quantity');
        $notes = $request->input('notes');

        if ($qty === 0) {
            return response()->json(['message' => 'Jumlah mutasi tidak boleh nol.'], 422);
        }

        if ($type === 'INBOUND' && $qty < 0) {
            $qty = abs($qty);
        }

        $product = Product::findOrFail($id);

        $newBalance = DB::transaction(function () use ($product, $type, $qty, $notes, $request) {
            // Lock row for update
            $lockedProduct = Product::where('id', $product->id)->lockForUpdate()->first();
            $calculatedBalance = $lockedProduct->current_stock + $qty;

            if ($calculatedBalance < 0) {
                abort(422, 'Pengurangan stok melebihi sisa stok saat ini (sisa: ' . $lockedProduct->current_stock . ').');
            }

            $lockedProduct->current_stock = $calculatedBalance;
            $lockedProduct->save();

            StockMovement::create([
                'product_id' => $lockedProduct->id,
                'user_id' => $request->user()?->id,
                'type' => $type,
                'quantity' => $qty,
                'balance_after' => $calculatedBalance,
                'reference_type' => 'stock_adjustment',
                'reference_id' => 'ADJ-' . time(),
                'notes' => $notes,
            ]);

            return $calculatedBalance;
        });

        return response()->json([
            'message' => 'Mutasi stok berhasil dicatat',
            'current_stock' => $newBalance,
            'product' => $product->fresh()->load('category'),
        ]);
    }
}
