<?php

use Illuminate\Support\Facades\Route;

/*
| Laravel API routes — use these when moving logic off Supabase.
| All routes are prefixed with /api automatically.
|
| Example:
| Route::get('/health', fn () => response()->json(['ok' => true]));
*/

Route::get('/health', fn () => response()->json([
    'status' => 'ok',
    'app' => config('app.name'),
]));
