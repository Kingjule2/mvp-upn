<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('type', 32)->index(); // INBOUND, INBOUND_INITIAL, OUTBOUND_SALE, ADJUSTMENT
            $table->integer('quantity'); // Positive for add, negative for deduction
            $table->integer('balance_after'); // Stock after this movement
            $table->string('reference_type')->nullable(); // sale, import, manual
            $table->string('reference_id')->nullable(); // sale invoice / batch id
            $table->text('notes')->nullable(); // Reason / note
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
