<?php
/**
 * Sert les fichiers applifonda UNIQUEMENT si session Fondamental valide.
 * Sans session : portail HTML (sans bundles React / cours).
 *
 * Proxy Netlify (force 200!) :
 *   /applifonda/* → /api/fondamental-serve.php?path=:splat
 */
declare(strict_types=1);

require_once __DIR__ . '/fondamental-access-lib.php';

try {
    fondaConfig();
} catch (Throwable $e) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Configuration Fondamental indisponible.';
    exit;
}

$root = fondaAppDir();
$rootReal = realpath($root);
if ($rootReal === false || !is_dir($rootReal)) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Fondamental non déployé sur le VPS (dossier applifonda manquant).';
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
    $session = fondaResolveSession();
    if ($session !== null) {
        fondaPing($session);
        $sessionOk = true;
    }
} catch (Throwable $e) {
    $sessionOk = false;
    torinvestSessionClearCookie('fondamental_access');
}

$isAsset = str_starts_with($path, 'assets/')
    || (bool) preg_match('/\.(js|css|png|svg|webmanifest|map|json)$/i', $path);
$isIndex = ($path === 'index.html')
    || ($validTarget && basename((string) $target) === 'index.html');

// Sans session : assets / fichiers app → toujours 401 (même si le fichier n'existe pas)
if (!$sessionOk) {
    if ($isAsset || !$isIndex) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode([
            'ok' => false,
            'error' => 'FONDA_UNAUTHORIZED',
            'message' => 'Détention KRM ACADEMY (≥ seuil) requise',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    fondaServeGatePage($root);
}

if (!$validTarget) {
    // SPA fallback (routes client) uniquement avec session
    $target = $root . '/index.html';
    $validTarget = is_file($target);
}

if (!$validTarget || !is_file((string) $target)) {
    $target = $root . '/index.html';
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
];
header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
header('Cache-Control: private, no-store');
header('X-Fondamental-Gate: session');
readfile((string) $target);
exit;

function fondaServeGatePage(string $root): void
{
    http_response_code(200);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Fondamental-Gate: login');

    $gateFile = $root . '/index.html';
    if (!is_file($gateFile)) {
        echo '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Fondamental</title></head><body>';
        echo '<p>Connecte Phantom (≥ 250 KRM) pour accéder à Fondamental.</p>';
        echo '<p><a href="/torpass">TorPass</a> · <a href="/">Accueil</a></p>';
        echo '</body></html>';
        exit;
    }

    $html = (string) file_get_contents($gateFile);
    // Sans session : ne pas embarquer les bundles / CSS de l'app (évite fuites + 401 en rafale).
    $html = preg_replace('#<link[^>]+href=["\']/applifonda/assets/[^"\']+["\'][^>]*>#i', '', $html) ?? $html;
    $html = preg_replace('#<script[^>]+src=["\']/applifonda/assets/[^"\']+["\'][^>]*>\s*</script>#i', '', $html) ?? $html;
    echo $html;
    exit;
}
