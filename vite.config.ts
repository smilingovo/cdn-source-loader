import { defineConfig } from "vite";
import { getLibConfig } from "./config/lib.config";
import testConfig from "./config/test.config";

export default defineConfig(({ mode }) => {
  // 根据 mode 选择配置
  if (mode === "lib") {
    // 库构建 - 未压缩
    return getLibConfig();
  } else {
    // 默认使用测试页面配置
    return testConfig;
  }
});
