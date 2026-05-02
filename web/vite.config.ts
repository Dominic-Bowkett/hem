import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/hem/",
  plugins: [react()],
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
