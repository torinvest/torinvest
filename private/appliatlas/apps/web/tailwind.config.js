/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Palette "atlas géopolitique" (voir cahier des charges)
        base: {
          bg: "#0B1120",
          surface: "#111827",
          surface2: "#1F2937",
        },
        content: {
          primary: "#F9FAFB",
          secondary: "#9CA3AF",
        },
        // Accents par catégorie d'intervention
        category: {
          direct: "#DC6B6B", // rouge atténué - guerre directe
          limited: "#E8925A", // orange doux - intervention limitée
          indirect: "#E3A857", // orange - conflit indirect
          covert: "#9B7EDE", // violet - opération clandestine
          economic: "#5B9BD5", // bleu - pression économique
          hybrid: "#D4C05A", // jaune - conflit hybride
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
