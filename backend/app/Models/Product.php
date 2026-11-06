<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'sku',
        'name',
        'category_id',
        'unit',
        'purchase_price',
        'selling_price',
        'current_stock',
        'minimum_stock',
        'expired_date',
    ];

    protected $casts = [
        'purchase_price' => 'decimal:2',
        'selling_price' => 'decimal:2',
        'current_stock' => 'integer',
        'minimum_stock' => 'integer',
        'expired_date' => 'date:Y-m-d',
    ];

    protected $appends = [
        'status',
        'is_expiring_soon',
        'is_expired',
    ];

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function stockMovements()
    {
        return $this->hasMany(StockMovement::class)->latest();
    }

    public function saleItems()
    {
        return $this->hasMany(SaleItem::class);
    }

    public function getStatusAttribute(): string
    {
        if ($this->current_stock <= 0) {
            return 'Habis';
        }
        if ($this->current_stock <= $this->minimum_stock) {
            return 'Stok Tipis';
        }
        return 'Aman';
    }

    public function getIsExpiringSoonAttribute(): bool
    {
        if (!$this->expired_date) {
            return false;
        }
        $today = Carbon::today();
        $expiry = Carbon::parse($this->expired_date);
        return $expiry->isFuture() && $expiry->diffInDays($today) <= 30;
    }

    public function getIsExpiredAttribute(): bool
    {
        if (!$this->expired_date) {
            return false;
        }
        return Carbon::parse($this->expired_date)->isPast();
    }
}
