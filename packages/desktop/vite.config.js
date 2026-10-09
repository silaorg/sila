import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

const connection = {
  host: "127.0.0.1",
  port: Number(process.env.HESWE_DASHBOARD_PORT || 39901),
  strictPort: true,
  proxy: {
    "/api": {
      target: process.env.HESWE_API_URL || "http://127.0.0.1:39900",
      changeOrigin: false,
    },
  },
};

export default defineConfig({
  plugins: [svelte()],
  server: connection,
  preview: connection,
  build: { outDir: "build", emptyOutDir: true },
});
