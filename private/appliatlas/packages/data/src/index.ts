/**
 * Ré-export typé des données de seed.
 * Ces données sont un contenu initial de démonstration, à enrichir et à
 * faire vérifier (voir le champ needsReview / reviewNotes de chaque entrée).
 */
import countries from "../seed/countries.json" with { type: "json" };
import sources from "../seed/sources.json" with { type: "json" };
import conflicts from "../seed/conflicts.json" with { type: "json" };
import territories from "../seed/territories.json" with { type: "json" };

export { countries, sources, conflicts, territories };
