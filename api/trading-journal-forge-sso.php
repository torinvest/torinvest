<?php
/**
 * SSO La Forge Premium → Trading Journal Pro.
 * Inclus au début de /var/www/torinvest/trading_journal.php via patch-trading-journal-sso.sh
 *
 * Token : même HMAC que Fondamental (ai_access_hmac_secret).
 * Query/cookie/header : forge_sso | X-Forge-Journal-Sso
 */
declare(strict_types=1);

function torinvest_journal_forge_sso_boot(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        @session_start();
    }

    if (torinvest_journal_session_looks_logged_in()) {
        return;
    }

    $token = '';
    if (!empty($_GET['forge_sso'])) {
        $token = trim((string) $_GET['forge_sso']);
    } elseif (!empty($_COOKIE['forge_tj_sso'])) {
        $token = trim((string) $_COOKIE['forge_tj_sso']);
    } elseif (!empty($_SERVER['HTTP_X_FORGE_JOURNAL_SSO'])) {
        $token = trim((string) $_SERVER['HTTP_X_FORGE_JOURNAL_SSO']);
    }

    if ($token === '') {
        return;
    }

    $apiLib = __DIR__ . '/ai-access-lib.php';
    if (!is_file($apiLib)) {
        // trading_journal.php est à la racine DocumentRoot ; api/ à côté
        $apiLib = dirname(__DIR__) . '/api/ai-access-lib.php';
    }
    if (!is_file($apiLib)) {
        $apiLib = __DIR__ . '/api/ai-access-lib.php';
    }
    if (!is_file($apiLib)) {
        return;
    }

    require_once $apiLib;

    try {
        $secret = aiAccessHmacSecret();
        $session = aiAccessVerifyToken($token, $secret);
    } catch (Throwable $e) {
        return;
    }

    if ($session === null) {
        return;
    }

    $meta = is_array($session['meta'] ?? null) ? $session['meta'] : [];
    $source = (string) ($meta['source'] ?? '');
    $email = trim((string) ($meta['email'] ?? ''));
    if ($email === '') {
        return;
    }
    if (
        $source !== 'forge_journal_sso' &&
        $source !== 'forge_formation' &&
        $source !== 'forge_formation_journal'
    ) {
        return;
    }

    torinvest_journal_mark_logged_in($email);
}

function torinvest_journal_session_looks_logged_in(): bool
{
    $keys = [
        'logged_in',
        'authenticated',
        'auth',
        'login',
        'is_logged_in',
        'user_logged_in',
        'tj_logged_in',
        'journal_logged_in',
        'admin',
        'username',
        'user',
        'email',
    ];
    foreach ($keys as $k) {
        if (!array_key_exists($k, $_SESSION)) {
            continue;
        }
        $v = $_SESSION[$k];
        if ($v === true || $v === 1 || $v === '1') {
            return true;
        }
        if (is_string($v) && trim($v) !== '') {
            return true;
        }
        if (is_array($v) && $v !== []) {
            return true;
        }
    }
    return false;
}

function torinvest_journal_mark_logged_in(string $email): void
{
    $email = trim($email);
    $_SESSION['tj_forge_sso'] = true;
    $_SESSION['tj_logged_in'] = true;
    $_SESSION['journal_logged_in'] = true;
    $_SESSION['logged_in'] = true;
    $_SESSION['is_logged_in'] = true;
    $_SESSION['user_logged_in'] = true;
    $_SESSION['authenticated'] = true;
    $_SESSION['auth'] = true;
    $_SESSION['login'] = true;
    $_SESSION['admin'] = true;
    $_SESSION['role'] = 'admin';
    $_SESSION['username'] = $email !== '' ? $email : 'forge';
    $_SESSION['user'] = $email !== '' ? $email : 'forge';
    $_SESSION['email'] = $email;
    $_SESSION['name'] = $email !== '' ? $email : 'La Forge Premium';

    // Clés additionnelles détectées au patch (fichier .sso-session-keys)
    $keysFile = dirname(__DIR__) . '/api/data/journal-sso-session-keys.txt';
    if (!is_file($keysFile)) {
        $keysFile = __DIR__ . '/data/journal-sso-session-keys.txt';
    }
    if (is_file($keysFile)) {
        $extra = preg_split('/\R/', (string) file_get_contents($keysFile)) ?: [];
        foreach ($extra as $k) {
            $k = trim($k);
            if ($k === '' || !preg_match('/^[a-zA-Z0-9_]+$/', $k)) {
                continue;
            }
            if (!array_key_exists($k, $_SESSION) || $_SESSION[$k] === null || $_SESSION[$k] === false || $_SESSION[$k] === '') {
                $_SESSION[$k] = true;
            }
        }
    }
}
