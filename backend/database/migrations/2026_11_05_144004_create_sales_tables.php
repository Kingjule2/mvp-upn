<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->string('invoice_number')->unique()->index();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('total_amount', 15, 2)->default(0); // Omzet (Gross Revenue)
            $table->decimal('total_cost', 15, 2)->default(0); // HPP akumulasi
            $table->decimal('total_profit', 15, 2)->default(0); // Laba Kotor (Gross Profit)
            $table->integer('total_items')->default(0);
            $table->string('payment_method')->default('cash'); // cash, qris, transfer
            $table->decimal('payment_amount', 15, 2)->nullable();
            $table->decimal('change_amount', 15, 2)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('sale_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->string('product_name');
            $table->string('product_sku');
            $table->integer('quantity');
            $table->decimal('cost_price', 15, 2)->default(0); // HPP unit
            $table->decimal('selling_price', 15, 2)->default(0); // Selling price unit
            $table->decimal('subtotal', 15, 2)->default(0); // quantity * selling_price
            $table->decimal('profit', 15, 2)->default(0); // quantity * (selling_price - cost_price)
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_items');
        Schema::dropIfExists('sales');
    }
};
