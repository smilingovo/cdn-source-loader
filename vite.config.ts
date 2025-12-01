import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: "./test",
  server: {
    port: 3000,
    open: true,
    hmr: true, // 启用热更新
  },
  resolve: {
    alias: {
      "@": resolve(process.cwd(), "./src"),
    },
  },
  build: {
    outDir: "../dist-test",
    emptyOutDir: true,
  },
});
