import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/hem/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "examples/*.json", "weather/*.epw"],
      manifest: {
        name: "HEM Field Assessment Tool",
        short_name: "HEM",
        description:
          "In-browser UK Home Energy Model assessment tool for Domestic Energy Assessors.",
        theme_color: "#1f6feb",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "any",
        scope: "/hem/",
        start_url: "/hem/",
        icons: [
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,wasm,json,svg,epw}"],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        navigateFallback: "/hem/index.html",
        navigateFallbackDenylist: [/^\/hem\/wasm\//],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
