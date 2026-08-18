import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  // GitHub Pages liegt unter /baumkarte/ (Repo-Name). Auf moosburg.eu haengt
  // die Karte am Data Hub, dort ueberschreibt `npm run build:hostinger` den
  // Pfad mit --base=/data/baumkarte/.
  base: "/baumkarte/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
