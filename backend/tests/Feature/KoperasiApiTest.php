<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\Sale;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class KoperasiApiTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $kasir;
    private Category $category;
    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create([
            'name' => 'Admin Manajer',
            'email' => 'admin@test.com',
            'username' => 'admin',
            'password' => Hash::make('secret123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $this->kasir = User::create([
            'name' => 'Kasir Utama',
            'email' => 'kasir@test.com',
            'username' => 'kasir',
            'password' => Hash::make('secret123'),
            'role' => 'kasir',
            'is_active' => true,
        ]);

        $this->category = Category::create([
            'name' => 'Makanan & Minuman',
            'description' => 'Kategori test',
        ]);

        $this->product = Product::create([
            'sku' => 'TEST-001',
            'name' => 'Roti Manis',
            'category_id' => $this->category->id,
            'unit' => 'pcs',
            'purchase_price' => 3000,
            'selling_price' => 5000,
            'current_stock' => 50,
            'minimum_stock' => 10,
        ]);

        StockMovement::create([
            'product_id' => $this->product->id,
            'user_id' => $this->admin->id,
            'type' => 'INBOUND_INITIAL',
            'quantity' => 50,
            'balance_after' => 50,
            'reference_type' => 'initial_seed',
            'reference_id' => 'INIT-TEST-001',
            'notes' => 'Stok awal',
        ]);
    }

    public function test_login_returns_sanctum_token(): void
    {
        $response = $this->postJson('/api/login', [
            'login' => 'admin',
            'password' => 'secret123',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'token',
                'user' => ['id', 'name', 'email', 'role'],
            ]);
    }

    public function test_product_crud_and_status(): void
    {
        $token = $this->admin->createToken('test')->plainTextToken;

        // List
        $res = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/products');
        $res->assertStatus(200)
            ->assertJsonFragment(['sku' => 'TEST-001', 'status' => 'Aman']);

        // Create
        $createRes = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/products', [
                'sku' => 'NEW-002',
                'name' => 'Air Mineral',
                'category_id' => $this->category->id,
                'unit' => 'botol',
                'purchase_price' => 2000,
                'selling_price' => 3500,
                'current_stock' => 20,
                'minimum_stock' => 5,
            ]);
        $createRes->assertStatus(201);

        $this->assertDatabaseHas('products', ['sku' => 'NEW-002']);
        $this->assertDatabaseHas('stock_movements', [
            'type' => 'INBOUND_INITIAL',
            'quantity' => 20,
        ]);
    }

    public function test_pos_sale_checkout_deducts_stock_and_logs_outbound_sale(): void
    {
        $token = $this->kasir->createToken('pos')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/sales', [
                'items' => [
                    [
                        'product_id' => $this->product->id,
                        'quantity' => 5,
                    ],
                ],
                'payment_method' => 'cash',
                'payment_amount' => 30000,
                'notes' => 'Transaksi Kasir POS Test',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.total_amount', '25000.00') // 5 * 5000
            ->assertJsonPath('data.total_cost', '15000.00')   // 5 * 3000
            ->assertJsonPath('data.total_profit', '10000.00') // 25000 - 15000
            ->assertJsonPath('data.change_amount', '5000.00'); // 30000 - 25000

        // Stock must be decremented: 50 - 5 = 45
        $this->assertEquals(45, $this->product->fresh()->current_stock);

        // Immutable movement recorded
        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $this->product->id,
            'type' => 'OUTBOUND_SALE',
            'quantity' => -5,
            'balance_after' => 45,
        ]);
    }

    public function test_dashboard_analytics_omzet_and_profit_accuracy(): void
    {
        // Execute sale
        $this->test_pos_sale_checkout_deducts_stock_and_logs_outbound_sale();

        $token = $this->admin->createToken('test')->plainTextToken;

        $res = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/dashboard?period=today');

        $res->assertStatus(200)
            ->assertJsonPath('summary.total_revenue', 25000)
            ->assertJsonPath('summary.total_profit', 10000)
            ->assertJsonPath('summary.total_units_sold', 5)
            ->assertJsonPath('summary.total_transactions', 1);
    }

    public function test_bulk_import_preview_and_execute(): void
    {
        $token = $this->admin->createToken('test')->plainTextToken;

        $csv = "sku,nama_produk,kategori,satuan,harga_modal_hpp,harga_jual,stok_awal,stok_minimum,tanggal_expired\n" .
               "BULK-001,Biskuit Enak,Makanan & Minuman,pcs,4000,6000,30,5,2026-12-31\n";

        $file = UploadedFile::fake()->createWithContent('import.csv', $csv);

        $prevRes = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/import/preview', ['file' => $file]);

        $prevRes->assertStatus(200)
            ->assertJsonPath('summary.valid_count', 1)
            ->assertJsonPath('summary.invalid_count', 0);

        $previewId = $prevRes->json('preview_id');

        $execRes = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/import/execute', [
                'preview_id' => $previewId,
                'mode' => 'valid_only',
            ]);

        $execRes->assertStatus(200)
            ->assertJsonPath('imported_count', 1);

        $this->assertDatabaseHas('products', ['sku' => 'BULK-001']);
        $this->assertDatabaseHas('stock_movements', [
            'type' => 'INBOUND_INITIAL',
            'quantity' => 30,
        ]);
    }
}
