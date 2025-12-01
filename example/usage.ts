/**
 * 使用示例
 */
import { batchLoadCDNResources } from '../src/index';

// 示例 1: 基本使用
async function example1() {
  const result = await batchLoadCDNResources({
    metaUrl: 'https://unpkg.com/monaco-editor@0.54.0/min/?meta',
    concurrency: 5,
    retryCount: 3,
    callbacks: {
      onProgress: (progress, fileInfo) => {
        console.log(`加载进度: ${fileInfo.path} - ${progress.percentage}%`);
      },
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
  
  console.log(`总共: ${result.results.length}, 成功: ${result.successCount}, 失败: ${result.failureCount}`);
}

// 示例 2: 使用文件过滤器
async function example2() {
  const result = await batchLoadCDNResources({
    metaUrl: 'https://unpkg.com/monaco-editor@0.54.0/min/?meta',
    concurrency: 3,
    retryCount: 2,
    fileFilter: (fileInfo) => {
      // 只加载 JavaScript 文件
      return fileInfo.path.endsWith('.js');
    },
    callbacks: {
      onSuccess: async (response, fileInfo) => {
        console.log(`已加载: ${fileInfo.path}`);
      },
    },
  });
  
  console.log(`过滤后加载了 ${result.results.length} 个文件`);
}

// 示例 3: 自定义基础 URL
async function example3() {
  const result = await batchLoadCDNResources({
    metaUrl: 'https://unpkg.com/monaco-editor@0.54.0/min/?meta',
    baseUrl: 'https://unpkg.com/monaco-editor@0.54.0',
    concurrency: 10,
    retryCount: 5,
    retryDelay: 2000,
    callbacks: {
      onProgress: (progress, fileInfo) => {
        if (progress.percentage % 25 === 0) {
          console.log(`${fileInfo.path}: ${progress.percentage}%`);
        }
      },
      onSuccess: async (response, fileInfo) => {
        const contentType = response.headers.get('content-type');
        console.log(`${fileInfo.path} - 类型: ${contentType}`);
      },
      onEnd: async (response, fileInfo) => {
        // 在 onEnd 中可以访问完整的响应数据
        const blob = await response.blob();
        console.log(`${fileInfo.path} 已准备就绪，大小: ${blob.size} 字节`);
      },
    },
  });
  
  return result;
}

// 运行示例（在浏览器环境中）
// example1();
// example2();
// example3();

