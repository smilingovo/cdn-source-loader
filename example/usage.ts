/**
 * 使用示例
 */
import {
  CdnResource,
  type ResumeConfig,
  type CdnStateInfo,
} from "../src/index";

// 示例 1: 基本使用
async function example1() {
  const resumeConfig: ResumeConfig = {};

  const loader = new CdnResource({
    metaUrl: "https://unpkg.com/monaco-editor@0.54.0/min/?meta",
    concurrency: 5,
    retryCount: 3,
    resumeConfig,
    onState: (stateInfo: CdnStateInfo) => {
      // 监听状态变化
      console.log(`状态: ${stateInfo.state}, 运行中: ${stateInfo.isRunning}`);
      if (stateInfo.progress) {
        console.log(
          `进度: ${stateInfo.progress.completed}/${stateInfo.progress.total} (${stateInfo.progress.percentage}%)`
        );
      }
    },
    onTaskProgress: (progress) => {
      console.log(
        `任务进度: ${progress.completed}/${progress.total} (${progress.percentage}%)`
      );
      console.log(`成功: ${progress.success}, 失败: ${progress.failure}`);
    },
    onTaskEnd: (config) => {
      const completedCount = Object.values(config).filter(
        (value) => value === false
      ).length;
      console.log(`任务完成，共加载 ${completedCount} 个文件`);
    },
    callbacks: {
      onSuccess: async (response, fileInfo) => {
        const data = await response.text();
        console.log(`成功加载: ${fileInfo.path}, 大小: ${data.length} 字节`);
      },
      onError: (error, fileInfo) => {
        console.error(`加载失败: ${fileInfo.path}`, error);
      },
      onEnd: async (response, fileInfo) => {
        // 可以在这里处理加载完成后的操作
        console.log(`完成加载: ${fileInfo.path}`);
        // 例如：将资源添加到页面
        // const data = await response.text();
        // const script = document.createElement('script');
        // script.textContent = data;
        // document.head.appendChild(script);
      },
    },
  });

  // 开始加载
  await loader.start();
}

// 示例 2: 使用文件过滤器
async function example2() {
  const resumeConfig: ResumeConfig = {};

  const loader = new CdnResource({
    metaUrl: "https://unpkg.com/monaco-editor@0.54.0/min/?meta",
    concurrency: 3,
    retryCount: 2,
    resumeConfig,
    fileFilter: (fileInfo) => {
      // 只加载 JavaScript 文件
      return fileInfo.path.endsWith(".js");
    },
    onTaskProgress: (progress) => {
      console.log(`过滤后加载了 ${progress.completed} 个文件`);
    },
    callbacks: {
      onSuccess: async (response, fileInfo) => {
        console.log(`已加载: ${fileInfo.path}`);
      },
    },
  });

  await loader.start();
}

// 示例 3: 自定义基础 URL 和状态监听
async function example3() {
  const resumeConfig: ResumeConfig = {};

  const loader = new CdnResource({
    metaUrl: "https://unpkg.com/monaco-editor@0.54.0/min/?meta",
    baseUrl: "https://unpkg.com/monaco-editor@0.54.0",
    concurrency: 10,
    retryCount: 5,
    retryDelay: 2000,
    resumeConfig,
    onState: (stateInfo: CdnStateInfo) => {
      console.log(`状态: ${stateInfo.state}, 运行中: ${stateInfo.isRunning}`);
      if (stateInfo.progress) {
        console.log(`进度: ${stateInfo.progress.percentage}%`);
      }
    },
    callbacks: {
      onSuccess: async (response, fileInfo) => {
        const contentType = response.headers.get("content-type");
        console.log(`${fileInfo.path} - 类型: ${contentType}`);
      },
      onEnd: async (response, fileInfo) => {
        // 在 onEnd 中可以访问完整的响应数据
        const blob = await response.blob();
        console.log(`${fileInfo.path} 已准备就绪，大小: ${blob.size} 字节`);
      },
    },
  });

  await loader.start();

  return loader;
}

// 示例 4: 停止和继续（断点续传）
async function example4() {
  const resumeConfig: ResumeConfig = {};

  const loader = new CdnResource({
    metaUrl: "https://unpkg.com/monaco-editor@0.54.0/min/?meta",
    concurrency: 5,
    resumeConfig,
    onState: (stateInfo: CdnStateInfo) => {
      console.log(`状态变化: ${stateInfo.state}`);
    },
    onTaskProgress: (progress) => {
      console.log(`进度: ${progress.completed}/${progress.total}`);
    },
  });

  // 开始加载
  const startPromise = loader.start();

  // 3秒后停止
  setTimeout(() => {
    loader.stop();
    console.log("已停止加载");
  }, 3000);

  try {
    await startPromise;
  } catch (error) {
    console.log("加载被停止");
  }

  // 继续加载（从断点处继续）
  await loader.resume();
  console.log("继续加载完成");
}

// 示例 5: 使用 metaData 直接传入元数据（不需要请求 metaUrl）
async function example5() {
  const resumeConfig: ResumeConfig = {};

  // 直接传入元数据，不需要请求 metaUrl
  const metaData: CdnMetaData = {
    package: "monaco-editor",
    version: "0.54.0",
    prefix: "https://unpkg.com/monaco-editor@0.54.0",
    files: [
      {
        path: "/min/vs/loader.js",
        size: 12345,
        type: "application/javascript",
      },
      {
        path: "/min/vs/editor/editor.main.js",
        size: 23456,
        type: "application/javascript",
      },
      // ... 更多文件
    ],
  };

  const loader = new CdnResource({
    metaData, // 直接使用元数据，不需要 metaUrl
    baseUrl: "https://unpkg.com/monaco-editor@0.54.0", // 可选，如果不提供会使用 metaData.prefix
    concurrency: 5,
    resumeConfig,
    onState: (stateInfo: CdnStateInfo) => {
      console.log(`状态: ${stateInfo.state}`);
    },
    onTaskProgress: (progress) => {
      console.log(`进度: ${progress.completed}/${progress.total}`);
    },
    callbacks: {
      onSuccess: async (response, fileInfo) => {
        console.log(`已加载: ${fileInfo.path}`);
      },
    },
  });

  await loader.start();
}

// 运行示例（在浏览器环境中）
// example1();
// example2();
// example3();
// example4();
// example5();
