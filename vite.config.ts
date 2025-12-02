import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: "./test",
  plugins: [vue()],
  server: {
    port: 3000,
    open: true,
    hmr: true, // 启用热更新
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "../dist-test",
    emptyOutDir: true,
  },
});
