import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:8787",
      "/showdown": {target: "ws://localhost:8787", ws: true},
    },
  },
  build: {
    target: "es2022",
    sourcemap: true
  }
});
