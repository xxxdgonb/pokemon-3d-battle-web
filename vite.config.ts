import { defineConfig } from "vite";

const showdownHost = process.env.SHOWDOWN_HOST ?? "127.0.0.1";
const showdownPort = process.env.SHOWDOWN_PORT ?? "8787";
const showdownHttpTarget = `http://${showdownHost}:${showdownPort}`;
const showdownWsTarget = `ws://${showdownHost}:${showdownPort}`;

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: showdownHttpTarget,
        changeOrigin: true,
      },
      "/showdown": {
        target: showdownWsTarget,
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "es2022",
    sourcemap: true
  }
});
