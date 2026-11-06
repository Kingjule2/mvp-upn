<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    public function dashboard(Request $request): JsonResponse
    {
        $period = $request->input('period', '7days'); // today, 7days, month, custom
        $dateFromInput = $request->input('date_from');
        $dateToInput = $request->input('date_to');

        $now = Carbon::now();

        switch ($period) {
            case 'today':
                $startDate = Carbon::today()->startOfDay();
                $endDate = Carbon::today()->endOfDay();
                break;
            case 'month':
                $startDate = Carbon::now()->startOfMonth()->startOfDay();
                $endDate = Carbon::now()->endOfMonth()->endOfDay();
                break;
            case 'custom':
                $startDate = $dateFromInput ? Carbon::parse($dateFromInput)->startOfDay() : Carbon::today()->subDays(6)->startOfDay();
                $endDate = $dateToInput ? Carbon::parse($dateToInput)->endOfDay() : Carbon::today()->endOfDay();
                break;
            case '7days':
            default:
                $startDate = Carbon::today()->subDays(6)->startOfDay();
                $endDate = Carbon::today()->endOfDay();
                break;
        }

        // 1. Summary Cards
        $salesQuery = Sale::whereBetween('created_at', [$startDate, $endDate]);

        $totalRevenue = (float) $salesQuery->sum('total_amount');
        $totalCost = (float) $salesQuery->sum('total_cost');
        $totalProfit = (float) $salesQuery->sum('total_profit');
        $totalTransactions = (int) $salesQuery->count();
        $totalUnitsSold = (int) $salesQuery->sum('total_items');

        // Profit Margin Percentage
        $profitMargin = $totalRevenue > 0 ? round(($totalProfit / $totalRevenue) * 100, 2) : 0.0;

        // 2. Quick Alerts
        $todayStr = Carbon::today()->toDateString();
        $in30DaysStr = Carbon::today()->addDays(30)->toDateString();

        $lowStockProducts = Product::where('current_stock', '>', 0)
            ->whereColumn('current_stock', '<=', 'minimum_stock')
            ->orderBy('current_stock', 'asc')
            ->take(5)
            ->get();

        $outOfStockProducts = Product::where('current_stock', '<=', 0)
            ->take(5)
            ->get();

        $expiringSoonProducts = Product::whereNotNull('expired_date')
            ->where('expired_date', '>=', $todayStr)
            ->where('expired_date', '<=', $in30DaysStr)
            ->orderBy('expired_date', 'asc')
            ->take(5)
            ->get();

        $expiredProducts = Product::whereNotNull('expired_date')
            ->where('expired_date', '<', $todayStr)
            ->take(5)
            ->get();

        $alertsCount = [
            'low_stock' => Product::where('current_stock', '>', 0)
                ->whereColumn('current_stock', '<=', 'minimum_stock')->count(),
            'out_of_stock' => Product::where('current_stock', '<=', 0)->count(),
            'expiring_soon' => Product::whereNotNull('expired_date')
                ->where('expired_date', '>=', $todayStr)
                ->where('expired_date', '<=', $in30DaysStr)->count(),
            'expired' => Product::whereNotNull('expired_date')
                ->where('expired_date', '<', $todayStr)->count(),
        ];

        // 3. Sales Trend (Daily chart data)
        // PostgreSQL date truncation
        $dailyTrends = Sale::whereBetween('created_at', [$startDate, $endDate])
            ->select(
                DB::raw("DATE(created_at) as date"),
                DB::raw("SUM(total_amount) as revenue"),
                DB::raw("SUM(total_cost) as cost"),
                DB::raw("SUM(total_profit) as profit"),
                DB::raw("COUNT(*) as transaction_count"),
                DB::raw("SUM(total_items) as items_sold")
            )
            ->groupBy(DB::raw("DATE(created_at)"))
            ->orderBy(DB::raw("DATE(created_at)"), 'asc')
            ->get();

        // 4. Top 5 Fast-Moving Products
        $topProducts = SaleItem::whereHas('sale', function ($q) use ($startDate, $endDate) {
                $q->whereBetween('created_at', [$startDate, $endDate]);
            })
            ->select(
                'product_id',
                'product_name',
                'product_sku',
                DB::raw("SUM(quantity) as total_sold"),
                DB::raw("SUM(subtotal) as total_revenue"),
                DB::raw("SUM(profit) as total_profit")
            )
            ->groupBy('product_id', 'product_name', 'product_sku')
            ->orderByDesc('total_revenue')
            ->take(5)
            ->get();

        return response()->json([
            'period' => [
                'type' => $period,
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
            ],
            'summary' => [
                'total_revenue' => $totalRevenue,
                'total_cost' => $totalCost,
                'total_profit' => $totalProfit,
                'profit_margin' => $profitMargin,
                'total_transactions' => $totalTransactions,
                'total_units_sold' => $totalUnitsSold,
            ],
            'alerts_count' => $alertsCount,
            'alerts_list' => [
                'low_stock' => $lowStockProducts,
                'out_of_stock' => $outOfStockProducts,
                'expiring_soon' => $expiringSoonProducts,
                'expired' => $expiredProducts,
            ],
            'trends' => $dailyTrends,
            'top_products' => $topProducts,
        ]);
    }
}
