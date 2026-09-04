/**
 * Catalogue bibliothèque La Forge — Fondamental / économie / monnaie / macro.
 * PDF hors Git : /var/lib/torinvest/books/<file> (ou FORGE_BOOKS_DIR).
 * Les autres PDF du dossier VPS ne sont pas listés ici.
 */
(function (global) {
  "use strict";

  /** @type {Array<{id:string,file:string,title:string,author:string,topics:string[]}>} */
  var FORGE_BOOKS = [
    {
      id: "kabbaj-psychologie-grands-traders",
      file: "363761278-Psychologie-Des-Grands-Traders-Thami-Kabbaj.pdf",
      title: "Psychologie des grands traders",
      author: "Thami Kabbaj",
      topics: ["psychologie", "trading"],
    },
    {
      id: "gayraud-art-guerre-financiere",
      file: "355382178-Jean-Francois-Gayraud-L-Art-de-La-Guerre-Financiere.pdf",
      title: "L'art de la guerre financière",
      author: "Jean-François Gayraud",
      topics: ["finance", "stratégie"],
    },
    {
      id: "hayek-prix-production",
      file: "147137301-Friedrich-HAYEK-Prix-Et-Production.pdf",
      title: "Prix et production",
      author: "Friedrich Hayek",
      topics: ["économie", "monnaie"],
    },
    {
      id: "keynes-essais-monnaie",
      file: "239277619-John-Maynard-Keynes-Essais-Sur-La-Monnaie-Et-l-Economie-Payot-1990-1.pdf",
      title: "Essais sur la monnaie et l'économie",
      author: "John Maynard Keynes",
      topics: ["monnaie", "économie"],
    },
    {
      id: "histoire-monnaie",
      file: "381132056-L-Histoire-de-La-Monnaie-Pour-Comprendre-l-Economie-French-Edition.pdf",
      title: "L'histoire de la monnaie pour comprendre l'économie",
      author: "—",
      topics: ["monnaie", "histoire"],
    },
    {
      id: "monnaie-pieges",
      file: "102928126-La-Monnaie-Et-Ses-Pieges.pdf",
      title: "La monnaie et ses pièges",
      author: "—",
      topics: ["monnaie"],
    },
    {
      id: "monnaie-mecanismes",
      file: "111311835-La-monnaie-et-ses-mecanismes.pdf",
      title: "La monnaie et ses mécanismes",
      author: "—",
      topics: ["monnaie"],
    },
    {
      id: "liquidite-incontrolable",
      file: "260896588-La-Liquidite-Incontrolable.pdf",
      title: "La liquidité incontrôlable",
      author: "—",
      topics: ["liquidité", "macro"],
    },
    {
      id: "histoire-unions-monetaires",
      file: "320164484-Histoire-des-unions-monetaires-pdf.pdf",
      title: "Histoire des unions monétaires",
      author: "—",
      topics: ["monnaie", "histoire"],
    },
    {
      id: "fonds-souverains",
      file: "52586431-Les-Fonds-Sou-Vera-Ins.pdf",
      title: "Les fonds souverains",
      author: "—",
      topics: ["finance", "institutions"],
    },
    {
      id: "liberalisme-contre-capitalisme",
      file: "52586908-LibA-ralisme-contre-capitalisme.pdf",
      title: "Libéralisme contre capitalisme",
      author: "—",
      topics: ["économie", "philosophie"],
    },
    {
      id: "capitalisme-pulsion-mort",
      file: "303165060-Capitalisme-Et-Pulsion-de-Mort.pdf",
      title: "Capitalisme et pulsion de mort",
      author: "—",
      topics: ["philosophie", "économie"],
    },
  ];

  function getForgeBooks() {
    return FORGE_BOOKS.slice();
  }

  function getForgeBookById(id) {
    var key = String(id || "");
    for (var i = 0; i < FORGE_BOOKS.length; i++) {
      if (FORGE_BOOKS[i].id === key) return FORGE_BOOKS[i];
    }
    return null;
  }

  function forgeBookFileUrl(book) {
    if (!book || !book.file) return "#";
    return "/api/books/file?name=" + encodeURIComponent(book.file);
  }

  global.FORGE_BOOKS = FORGE_BOOKS;
  global.getForgeBooks = getForgeBooks;
  global.getForgeBookById = getForgeBookById;
  global.forgeBookFileUrl = forgeBookFileUrl;
})(typeof window !== "undefined" ? window : global);
