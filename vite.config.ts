import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    target: "es2022",
    server: {
      proxy: {
        "/api": "http://localhost:8787",
      },
    },
    sourcemap: true
  }
});
