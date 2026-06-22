<?php
/**
 * Contexte date + consignes Mistral (analyses temps reel, pas memoire 2024).
 */
declare(strict_types=1);

if (!function_exists('radarMistralDateContext')) {
    function radarMistralDateContext(): string
    {
        return 'REFERENCE TEMPORELLE: ' . date('d/m/Y H:i') . ' (Europe/Paris). '
            . 'Les prix, variations et scores ci-dessous viennent de CoinGecko / du dashboard en temps reel. '
            . 'Base ton analyse UNIQUEMENT sur ces chiffres — pas sur ta memoire du marche. '
            . 'Ne cite pas 2024 ou des dates passees sauf si elles figurent dans les donnees. '
            . 'Ne invente pas de prix ni d\'evenements.' . "\n\n";
    }
}

if (!function_exists('radarMistralSystem')) {
    function radarMistralSystem(string $role): string
    {
        return trim($role . ' ' . radarMistralDateContext() . 'Reponds en francais.');
    }
}
