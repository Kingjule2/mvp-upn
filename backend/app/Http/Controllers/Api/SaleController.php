<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\StockMovement;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SaleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Sale::with(['user', 'items.product'])->latest('id');

        if ($search = $request->input('search')) {
            $query->where('invoice_number', 'ilike', "%{$search}%");
        }

        if ($dateFrom = $request->input('date_from')) {
            $query->whereDate('created_at', '>=', $dateFrom);
        }

        if ($dateTo = $request->input('date_to')) {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        $perPage = (int) $request->input('per_page', 15);
        $sales = $query->paginate($perPage);

        return response()->json([
            'data' => $sales,
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $sale = Sale::with(['user', 'items.product'])->findOrFail($id);

        return response()->json([
            'data' => $sale,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'payment_method' => ['required', 'string', 'in:cash,qris,transfer'],
            'payment_amount' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $itemsInput = $request->input('items');
        $paymentMethod = $request->input('payment_method');
        $paymentAmount = (float) $request->input('payment_amount', 0);
        $notes = $request->input('notes');
        $user = $request->user();

        $sale = DB::transaction(function () use ($itemsInput, $paymentMethod, $paymentAmount, $notes, $user) {
            $now = Carbon::now();
            $invoiceNumber = 'INV-' . $now->format('Ymd') . '-' . strtoupper(substr(uniqid(), -5));

            $totalAmount = 0.0;
            $totalCost = 0.0;
            $totalProfit = 0.0;
            $totalItems = 0;

            // Pre-create the sale shell
            $sale = Sale::create([
                'invoice_number' => $invoiceNumber,
                'user_id' => $user?->id,
                'total_amount' => 0,
                'total_cost' => 0,
                'total_profit' => 0,
                'total_items' => 0,
                'payment_method' => $paymentMethod,
                'payment_amount' => $paymentAmount,
                'change_amount' => 0,
                'notes' => $notes,
            ]);

            foreach ($itemsInput as $item) {
                $qty = (int) $item['quantity'];

                // Lock product row for atomic stock check and decrement
                $product = Product::where('id', $item['product_id'])->lockForUpdate()->firstOrFail();

                if ($product->current_stock < $qty) {
                    abort(422, "Stok untuk produk {$product->name} (SKU: {$product->sku}) tidak mencukupi. Sisa stok: {$product->current_stock}, diminta: {$qty}.");
                }

                $newStock = $product->current_stock - $qty;
                $product->current_stock = $newStock;
                $product->save();

                $costPrice = (float) $product->purchase_price;
                $sellingPrice = (float) $product->selling_price;
                $subtotal = $qty * $sellingPrice;
                $costSubtotal = $qty * $costPrice;
                $itemProfit = $subtotal - $costSubtotal;

                $totalAmount += $subtotal;
                $totalCost += $costSubtotal;
                $totalProfit += $itemProfit;
                $totalItems += $qty;

                SaleItem::create([
                    'sale_id' => $sale->id,
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'product_sku' => $product->sku,
                    'quantity' => $qty,
                    'cost_price' => $costPrice,
                    'selling_price' => $sellingPrice,
                    'subtotal' => $subtotal,
                    'profit' => $itemProfit,
                ]);

                // Create immutable StockMovement
                StockMovement::create([
                    'product_id' => $product->id,
                    'user_id' => $user?->id,
                    'type' => 'OUTBOUND_SALE',
                    'quantity' => -$qty,
                    'balance_after' => $newStock,
                    'reference_type' => 'sale',
                    'reference_id' => $invoiceNumber,
                    'notes' => "Penjualan Kasir Nota #{$invoiceNumber}",
                ]);
            }

            $changeAmount = $paymentMethod === 'cash' ? max(0, $paymentAmount - $totalAmount) : 0;

            $sale->update([
                'total_amount' => $totalAmount,
                'total_cost' => $totalCost,
                'total_profit' => $totalProfit,
                'total_items' => $totalItems,
                'payment_amount' => $paymentAmount > 0 ? $paymentAmount : $totalAmount,
                'change_amount' => $changeAmount,
            ]);

            return $sale;
        });

        return response()->json([
            'message' => 'Transaksi berhasil diproses',
            'data' => $sale->fresh(['items.product', 'user']),
        ], 201);
    }
}
