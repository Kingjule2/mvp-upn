<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\StockMovement;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Create Default Users (Admin & Kasir)
        $admin = User::firstOrCreate(
            ['email' => 'admin@koperasi.ac.id'],
            [
                'name' => 'Manajer Koperasi',
                'username' => 'admin',
                'password' => Hash::make('password123'),
                'role' => 'admin',
                'is_active' => true,
            ]
        );

        $kasir = User::firstOrCreate(
            ['email' => 'kasir@koperasi.ac.id'],
            [
                'name' => 'Kasir Utama',
                'username' => 'kasir',
                'password' => Hash::make('password123'),
                'role' => 'kasir',
                'is_active' => true,
            ]
        );

        // 2. Categories
        $categoriesData = [
            ['name' => 'Makanan & Minuman', 'description' => 'Snack, minuman kemasan, roti'],
            ['name' => 'Alat Tulis Kantor', 'description' => 'Buku, pulpen, map, binder'],
            ['name' => 'Perlengkapan Kuliah', 'description' => 'Jas lab, kalkulator, modul'],
            ['name' => 'Merchandise Kampus', 'description' => 'Kaos, lanyard, tumbler, totebag'],
            ['name' => 'Kebutuhan Harian', 'description' => 'Tisu, sabun, masker, obat ringan'],
        ];

        $categories = [];
        foreach ($categoriesData as $catData) {
            $categories[$catData['name']] = Category::firstOrCreate(['name' => $catData['name']], $catData);
        }

        // 3. Sample Products
        $productsSeed = [
            [
                'sku' => 'SNK-001',
                'name' => 'Roti Cokelat Kampus',
                'category' => 'Makanan & Minuman',
                'unit' => 'pcs',
                'purchase_price' => 3500,
                'selling_price' => 5000,
                'current_stock' => 45,
                'minimum_stock' => 10,
                'expired_date' => Carbon::now()->addDays(14)->format('Y-m-d'), // Expiring soon (<30 days)
            ],
            [
                'sku' => 'MNM-002',
                'name' => 'Air Mineral Botol 600ml',
                'category' => 'Makanan & Minuman',
                'unit' => 'botol',
                'purchase_price' => 2000,
                'selling_price' => 3500,
                'current_stock' => 120,
                'minimum_stock' => 24,
                'expired_date' => Carbon::now()->addMonths(6)->format('Y-m-d'),
            ],
            [
                'sku' => 'ATK-001',
                'name' => 'Buku Tulis Bergaris B5',
                'category' => 'Alat Tulis Kantor',
                'unit' => 'pcs',
                'purchase_price' => 4500,
                'selling_price' => 7000,
                'current_stock' => 80,
                'minimum_stock' => 15,
                'expired_date' => null,
            ],
            [
                'sku' => 'ATK-002',
                'name' => 'Pulpen Gel Hitam 0.5',
                'category' => 'Alat Tulis Kantor',
                'unit' => 'pcs',
                'purchase_price' => 2500,
                'selling_price' => 4000,
                'current_stock' => 4, // Low stock alert! (<= 5)
                'minimum_stock' => 10,
                'expired_date' => null,
            ],
            [
                'sku' => 'MERCH-001',
                'name' => 'Lanyard Resmi Kampus UPN',
                'category' => 'Merchandise Kampus',
                'unit' => 'pcs',
                'purchase_price' => 12000,
                'selling_price' => 25000,
                'current_stock' => 50,
                'minimum_stock' => 10,
                'expired_date' => null,
            ],
            [
                'sku' => 'KUL-001',
                'name' => 'Jas Laboratorium Putih (L)',
                'category' => 'Perlengkapan Kuliah',
                'unit' => 'pcs',
                'purchase_price' => 65000,
                'selling_price' => 95000,
                'current_stock' => 2, // Low stock alert! (<= 5)
                'minimum_stock' => 5,
                'expired_date' => null,
            ],
            [
                'sku' => 'HRI-001',
                'name' => 'Tisu Saku Kuliah 50s',
                'category' => 'Kebutuhan Harian',
                'unit' => 'pcs',
                'purchase_price' => 1800,
                'selling_price' => 3000,
                'current_stock' => 0, // Out of stock alert! (0)
                'minimum_stock' => 10,
                'expired_date' => Carbon::now()->addMonths(12)->format('Y-m-d'),
            ],
            [
                'sku' => 'SNK-003',
                'name' => 'Susu Kotak UHT 250ml',
                'category' => 'Makanan & Minuman',
                'unit' => 'kotak',
                'purchase_price' => 4500,
                'selling_price' => 6500,
                'current_stock' => 30,
                'minimum_stock' => 10,
                'expired_date' => Carbon::now()->addDays(5)->format('Y-m-d'), // Expiring very soon!
            ],
        ];

        $createdProducts = [];
        foreach ($productsSeed as $p) {
            $catId = $categories[$p['category']]->id;
            $product = Product::firstOrCreate(
                ['sku' => $p['sku']],
                [
                    'name' => $p['name'],
                    'category_id' => $catId,
                    'unit' => $p['unit'],
                    'purchase_price' => $p['purchase_price'],
                    'selling_price' => $p['selling_price'],
                    'current_stock' => $p['current_stock'],
                    'minimum_stock' => $p['minimum_stock'],
                    'expired_date' => $p['expired_date'],
                ]
            );
            $createdProducts[$p['sku']] = $product;

            // Inbound Initial Movement
            StockMovement::firstOrCreate(
                [
                    'product_id' => $product->id,
                    'type' => 'INBOUND_INITIAL',
                ],
                [
                    'user_id' => $admin->id,
                    'quantity' => $p['current_stock'],
                    'balance_after' => $p['current_stock'],
                    'reference_type' => 'initial_seed',
                    'reference_id' => 'INIT-' . $product->sku,
                    'notes' => 'Stok awal sistem koperasi',
                    'created_at' => Carbon::now()->subDays(7),
                ]
            );
        }

        // 4. Sample Sales Data for Analytics & Charts
        // Create transactions spanning the last 5 days
        $daysBack = [4, 3, 2, 1, 0];
        $invoiceIndex = 1;

        foreach ($daysBack as $day) {
            $transDate = Carbon::now()->subDays($day)->setTime(rand(9, 16), rand(10, 50));
            
            // Sale 1 on that day
            $p1 = $createdProducts['SNK-001'];
            $p2 = $createdProducts['MNM-002'];
            $q1 = rand(2, 5);
            $q2 = rand(3, 8);
            
            $sub1 = $q1 * $p1->selling_price;
            $prof1 = $q1 * ($p1->selling_price - $p1->purchase_price);
            $cost1 = $q1 * $p1->purchase_price;

            $sub2 = $q2 * $p2->selling_price;
            $prof2 = $q2 * ($p2->selling_price - $p2->purchase_price);
            $cost2 = $q2 * $p2->purchase_price;

            $totAmt = $sub1 + $sub2;
            $totCost = $cost1 + $cost2;
            $totProf = $prof1 + $prof2;

            $invNum = 'INV-' . $transDate->format('Ymd') . '-' . str_pad($invoiceIndex++, 4, '0', STR_PAD_LEFT);

            $sale = Sale::create([
                'invoice_number' => $invNum,
                'user_id' => $kasir->id,
                'total_amount' => $totAmt,
                'total_cost' => $totCost,
                'total_profit' => $totProf,
                'total_items' => $q1 + $q2,
                'payment_method' => 'cash',
                'payment_amount' => $totAmt + 5000,
                'change_amount' => 5000,
                'notes' => 'Transaksi kasir shift reguler',
                'created_at' => $transDate,
                'updated_at' => $transDate,
            ]);

            SaleItem::create([
                'sale_id' => $sale->id,
                'product_id' => $p1->id,
                'product_name' => $p1->name,
                'product_sku' => $p1->sku,
                'quantity' => $q1,
                'cost_price' => $p1->purchase_price,
                'selling_price' => $p1->selling_price,
                'subtotal' => $sub1,
                'profit' => $prof1,
                'created_at' => $transDate,
                'updated_at' => $transDate,
            ]);

            StockMovement::create([
                'product_id' => $p1->id,
                'user_id' => $kasir->id,
                'type' => 'OUTBOUND_SALE',
                'quantity' => -$q1,
                'balance_after' => max(0, $p1->current_stock),
                'reference_type' => 'sale',
                'reference_id' => $invNum,
                'notes' => 'Penjualan kasir nota ' . $invNum,
                'created_at' => $transDate,
                'updated_at' => $transDate,
            ]);

            SaleItem::create([
                'sale_id' => $sale->id,
                'product_id' => $p2->id,
                'product_name' => $p2->name,
                'product_sku' => $p2->sku,
                'quantity' => $q2,
                'cost_price' => $p2->purchase_price,
                'selling_price' => $p2->selling_price,
                'subtotal' => $sub2,
                'profit' => $prof2,
                'created_at' => $transDate,
                'updated_at' => $transDate,
            ]);

            StockMovement::create([
                'product_id' => $p2->id,
                'user_id' => $kasir->id,
                'type' => 'OUTBOUND_SALE',
                'quantity' => -$q2,
                'balance_after' => max(0, $p2->current_stock),
                'reference_type' => 'sale',
                'reference_id' => $invNum,
                'notes' => 'Penjualan kasir nota ' . $invNum,
                'created_at' => $transDate,
                'updated_at' => $transDate,
            ]);

            // Merchandise sale on some days
            if ($day % 2 === 0) {
                $p3 = $createdProducts['MERCH-001'];
                $q3 = rand(1, 2);
                $sub3 = $q3 * $p3->selling_price;
                $cost3 = $q3 * $p3->purchase_price;
                $prof3 = $q3 * ($p3->selling_price - $p3->purchase_price);

                $invNum2 = 'INV-' . $transDate->format('Ymd') . '-' . str_pad($invoiceIndex++, 4, '0', STR_PAD_LEFT);
                $sale2 = Sale::create([
                    'invoice_number' => $invNum2,
                    'user_id' => $kasir->id,
                    'total_amount' => $sub3,
                    'total_cost' => $cost3,
                    'total_profit' => $prof3,
                    'total_items' => $q3,
                    'payment_method' => 'qris',
                    'payment_amount' => $sub3,
                    'change_amount' => 0,
                    'notes' => 'Pembayaran QRIS',
                    'created_at' => $transDate->copy()->addMinutes(45),
                    'updated_at' => $transDate->copy()->addMinutes(45),
                ]);

                SaleItem::create([
                    'sale_id' => $sale2->id,
                    'product_id' => $p3->id,
                    'product_name' => $p3->name,
                    'product_sku' => $p3->sku,
                    'quantity' => $q3,
                    'cost_price' => $p3->purchase_price,
                    'selling_price' => $p3->selling_price,
                    'subtotal' => $sub3,
                    'profit' => $prof3,
                    'created_at' => $transDate->copy()->addMinutes(45),
                    'updated_at' => $transDate->copy()->addMinutes(45),
                ]);

                StockMovement::create([
                    'product_id' => $p3->id,
                    'user_id' => $kasir->id,
                    'type' => 'OUTBOUND_SALE',
                    'quantity' => -$q3,
                    'balance_after' => max(0, $p3->current_stock),
                    'reference_type' => 'sale',
                    'reference_id' => $invNum2,
                    'notes' => 'Penjualan merchandise nota ' . $invNum2,
                    'created_at' => $transDate->copy()->addMinutes(45),
                    'updated_at' => $transDate->copy()->addMinutes(45),
                ]);
            }
        }
    }
}
