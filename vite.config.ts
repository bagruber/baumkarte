import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  // GitHub Pages liegt unter /baumkarte/. Fuer moosburg.eu setzt der
  // Hostinger-Workflow BASE_PATH — "/" fuer eine Subdomain,
  // "/baumkarte/" fuer einen Unterordner.
  base: process.env.BASE_PATH ?? "/baumkarte/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
