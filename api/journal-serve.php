<?php
/**
 * Sert les fichiers appjournal UNIQUEMENT si session Journal valide.
 *
 * Proxy Netlify / formation :
 *   /appjournal/* → /api/journal-serve.php?path=:splat
 */
declare(strict_types=1);

require_once __DIR__ . '/journal-access-lib.php';

try {
    journalConfig();
} catch (Throwable $e) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Configuration Journal indisponible.';
    exit;
}

$root = journalAppDir();
$rootReal = realpath($root);
if ($rootReal === false || !is_dir($rootReal)) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Trading Journal non déployé sur le VPS (dossier appjournal manquant).';
    exit;
}
$root = $rootReal;

$path = (string) ($_GET['path'] ?? '');
$path = str_replace(["\0", '\\'], '', $path);
$path = ltrim($path, '/');
if ($path === '' || substr($path, -1) === '/') {
    $path = 'index.html';
}

$target = realpath($root . '/' . $path);
$validTarget = $target !== false && str_starts_with($target, $root . DIRECTORY_SEPARATOR);

$sessionOk = false;
try {
    $session = journalResolveSession();
    if ($session !== null) {
        journalPing($session);
        $sessionOk = true;
    }
} catch (Throwable $e) {
    $sessionOk = false;
    torinvestSessionClearCookie('journal_access');
}

$isAsset = str_starts_with($path, 'assets/')
    || (bool) preg_match('/\.(js|css|png|svg|webmanifest|map|json|woff2?)$/i', $path);
$isIndex = ($path === 'index.html')
    || ($validTarget && basename((string) $target) === 'index.html');

if (!$sessionOk) {
    if ($isAsset || !$isIndex) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode([
            'ok' => false,
            'error' => 'JOURNAL_UNAUTHORIZED',
            'message' => 'Session La Forge Premium requise',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    http_response_code(200);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Journal-Gate: login');
    echo '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Trading Journal</title></head><body>';
    echo '<p>Ouvre le Journal depuis <a href="https://app.torinvest-trading.com/journal.html">La Forge</a> (Premium).</p>';
    echo '</body></html>';
    exit;
}

if (!$validTarget) {
    $target = $root . '/index.html';
    $validTarget = is_file($target);
}

if (!$validTarget || !is_file((string) $target)) {
    $target = $root . '/index.html';
}

if (!is_file((string) $target)) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Trading Journal : index.html manquant dans appjournal.';
    exit;
}

$ext = strtolower(pathinfo((string) $target, PATHINFO_EXTENSION));
$types = [
    'html' => 'text/html; charset=utf-8',
    'js' => 'application/javascript; charset=utf-8',
    'css' => 'text/css; charset=utf-8',
    'json' => 'application/json; charset=utf-8',
    'webmanifest' => 'application/manifest+json',
    'svg' => 'image/svg+xml',
    'png' => 'image/png',
    'ico' => 'image/x-icon',
    'map' => 'application/json',
    'woff' => 'font/woff',
    'woff2' => 'font/woff2',
];
header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
header('Cache-Control: private, no-store');
header('X-Journal-Gate: session');
readfile((string) $target);
exit;
