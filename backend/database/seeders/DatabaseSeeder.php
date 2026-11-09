<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Default Users (Admin & Kasir) for system access; all business data starts empty
        User::firstOrCreate(
            ['email' => 'admin@koperasi.ac.id'],
            [
                'name' => 'Manajer Koperasi',
                'username' => 'admin',
                'password' => Hash::make('password123'),
                'role' => 'admin',
                'is_active' => true,
            ]
        );

        User::firstOrCreate(
            ['email' => 'kasir@koperasi.ac.id'],
            [
                'name' => 'Kasir Utama',
                'username' => 'kasir',
                'password' => Hash::make('password123'),
                'role' => 'kasir',
                'is_active' => true,
            ]
        );
    }
}
