<?php

use Illuminate\Support\Facades\Route;

/*
| SPA catch-all: every web URL returns the React app shell.
| Static Vite assets in /build are served directly from public/.
| API routes (if added later) should live in routes/api.php under /api.
*/
Route::view('/{any?}', 'app')
    ->where('any', '.*')
    ->name('spa');
