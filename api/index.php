<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;

define('LARAVEL_START', microtime(true));

$backendPath = realpath(__DIR__ . '/../backend');

// Determine if running in a serverless/read-only environment (e.g. Vercel)
// or without a local backend/.env file.
$isServerless = isset($_ENV['VERCEL'])
    || isset($_SERVER['VERCEL'])
    || isset($_ENV['LAMBDA_TASK_ROOT'])
    || isset($_SERVER['LAMBDA_TASK_ROOT'])
    || !file_exists($backendPath . '/.env')
    || !is_writable($backendPath . '/storage');

$setDefaultEnv = static function (string $key, string $value): void {
    if (getenv($key) === false && !isset($_ENV[$key]) && !isset($_SERVER[$key])) {
        putenv("{$key}={$value}");
        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
    }
};

$forceEnv = static function (string $key, string $value): void {
    putenv("{$key}={$value}");
    $_ENV[$key] = $value;
    $_SERVER[$key] = $value;
};

if ($isServerless) {
    $tmpRoot = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . '/koperasi_upn';
    $storagePath = $tmpRoot . '/storage';
    $bootstrapCachePath = $tmpRoot . '/bootstrap/cache';

    $dirs = [
        $storagePath . '/app/public',
        $storagePath . '/framework/cache/data',
        $storagePath . '/framework/sessions',
        $storagePath . '/framework/testing',
        $storagePath . '/framework/views',
        $storagePath . '/logs',
        $bootstrapCachePath,
    ];

    foreach ($dirs as $dir) {
        if (!is_dir($dir)) {
            @mkdir($dir, 0777, true);
        }
    }

    $setDefaultEnv('APP_NAME', 'Koperasi UPN');
    $setDefaultEnv('APP_ENV', 'production');
    $setDefaultEnv('APP_DEBUG', 'false');
    $setDefaultEnv('APP_KEY', 'base64:YVJ2c01kU2t5bVpxTnI4d1p5VkdacW15bVpxTnI4d1o=');
    $setDefaultEnv('BCRYPT_ROUNDS', '10');
    $setDefaultEnv('LOG_CHANNEL', 'stderr');
    $setDefaultEnv('SESSION_DRIVER', 'cookie');
    $setDefaultEnv('CACHE_STORE', 'database');
    $setDefaultEnv('DB_CONNECTION', 'sqlite');

    $forceEnv('LARAVEL_STORAGE_PATH', $storagePath);
    $forceEnv('VIEW_COMPILED_PATH', $storagePath . '/framework/views');
    if (str_starts_with($bootstrapCachePath, '/') || !is_writable($backendPath . '/bootstrap/cache')) {
        $forceEnv('APP_SERVICES_CACHE', $bootstrapCachePath . '/services.php');
        $forceEnv('APP_PACKAGES_CACHE', $bootstrapCachePath . '/packages.php');
        $forceEnv('APP_CONFIG_CACHE', $bootstrapCachePath . '/config.php');
        $forceEnv('APP_ROUTES_CACHE', $bootstrapCachePath . '/routes.php');
        $forceEnv('APP_EVENTS_CACHE', $bootstrapCachePath . '/events.php');
    }

    $dbConnection = getenv('DB_CONNECTION') ?: ($_ENV['DB_CONNECTION'] ?? 'sqlite');
    if ($dbConnection === 'sqlite') {
        $sqlitePath = getenv('DB_DATABASE') ?: ($_ENV['DB_DATABASE'] ?? '');
        if ($sqlitePath === '' || !is_writable(dirname($sqlitePath))) {
            $sqlitePath = $tmpRoot . '/database.sqlite';
            $forceEnv('DB_DATABASE', $sqlitePath);
        }
        if (!file_exists($sqlitePath)) {
            @touch($sqlitePath);
        }
    }
}

// Normalize $_SERVER globals so Symfony Request::capture() preserves the /api/* prefix
// instead of stripping dirname('/api/index.php') === '/api' as the base URL.
$_SERVER['SCRIPT_NAME'] = '/index.php';
$_SERVER['SCRIPT_FILENAME'] = $backendPath . '/public/index.php';
$_SERVER['PHP_SELF'] = '/index.php';

require $backendPath . '/vendor/autoload.php';

/** @var Application $app */
$app = require_once $backendPath . '/bootstrap/app.php';

if ($isServerless && isset($storagePath)) {
    $app->useStoragePath($storagePath);
}

$app->booted(function () use ($isServerless): void {
    $dbConnection = config('database.default');
    $autoMigrate = $isServerless || filter_var( env('AUTO_MIGRATE', false), FILTER_VALIDATE_BOOLEAN);

    if ($autoMigrate && $dbConnection === 'sqlite') {
        try {
            if (!Schema::hasTable('users')) {
                Artisan::call('migrate', [
                    '--force' => true,
                    '--seed' => true,
                ]);
            }
        } catch (\Throwable $e) {
            error_log('Auto-migration error: ' . $e->getMessage());
        }
    }
});

$app->handleRequest(Request::capture());
