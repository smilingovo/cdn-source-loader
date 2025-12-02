import { defineConfig } from "vite";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export function getLibConfig() {
  return defineConfig({
    plugins: [],
    build: {
      lib: {
        entry: resolve(__dirname, "../src/index.ts"),
        name: "CdnSourceLoader",
        fileName: (format) => {
          // 统一文件名格式，匹配 package.json
          if (format === "es") {
            return "index.esm.js";
          }
          return `index.${format}.js`;
        },
        formats: ["es", "cjs", "umd"],
      },
      outDir: "dist",
      emptyOutDir: false, // 不清空，保留 tsc 生成的类型声明文件
      copyPublicDir: false,
    },
  });
}
