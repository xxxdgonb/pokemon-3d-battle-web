import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:" + (process.env.SHOWDOWN_PORT ?? "8787"),
      "/showdown": {target: "ws://localhost:" + (process.env.SHOWDOWN_PORT ?? "8787"), ws: true},
    },
  },
  build: {
    target: "es2022",
    sourcemap: true
  }
});
