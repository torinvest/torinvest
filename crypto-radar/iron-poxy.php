<?php
require_once __DIR__ . '/accompagnement-gate.php';
header('Content-Type: application/json');

$allowedOrigins = [
    'https://www.torinvest-trading.com',
    'https://torinvest-trading.com',
    'https://torinvest-trading.netlify.app',
    'https://radar.torinvest-trading.com',
    'https://app.torinvest-trading.com',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$originHost = parse_url($origin, PHP_URL_HOST) ?? '';
$isNetlifyPreview = (bool) preg_match('/\.netlify\.app$/', $originHost);
if (in_array($origin, $allowedOrigins, true) || $isNetlifyPreview) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}

$address = 'd572538e2ddbc02611f9ab5033be81b17cb4fcb7756865742523861ca320b107';

$api = 'https://ironfish.herominers.com/api/stats_address?address=' . $address;

echo file_get_contents($api);
