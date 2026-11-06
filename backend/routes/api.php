<?php

use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ProductImportController;
use App\Http\Controllers\Api\SaleController;
use App\Http\Controllers\Api\StockMovementController;
use Illuminate\Support\Facades\Route;

// Public Auth routes
Route::post('/login', [AuthController::class, 'login']);

// Download template (accessible or protected)
Route::get('/import/template', [ProductImportController::class, 'downloadTemplate']);

// Protected API routes
Route::middleware('auth:sanctum')->group(function () {
    // Auth & Profile
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // Analytics / Dashboard
    Route::get('/dashboard', [AnalyticsController::class, 'dashboard']);

    // Categories
    Route::get('/categories', [CategoryController::class, 'index']);
    Route::post('/categories', [CategoryController::class, 'store']);

    // Products
    Route::get('/products', [ProductController::class, 'index']);
    Route::post('/products', [ProductController::class, 'store']);
    Route::get('/products/{id}', [ProductController::class, 'show']);
    Route::put('/products/{id}', [ProductController::class, 'update']);
    Route::delete('/products/{id}', [ProductController::class, 'destroy']);
    Route::post('/products/{id}/adjust-stock', [ProductController::class, 'adjustStock']);

    // Stock Movement History (Immutable Audit Log)
    Route::get('/stock-movements', [StockMovementController::class, 'index']);

    // Sales & POS Checkout
    Route::get('/sales', [SaleController::class, 'index']);
    Route::post('/sales', [SaleController::class, 'store']);
    Route::get('/sales/{id}', [SaleController::class, 'show']);

    // Bulk Import (Excel / CSV)
    Route::post('/import/preview', [ProductImportController::class, 'preview']);
    Route::post('/import/execute', [ProductImportController::class, 'execute']);
});
