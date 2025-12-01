# Smiling CDN Source Collect

一个用于批量加载 CDN 资源的 TypeScript 库，支持从 unpkg.com 等 CDN 服务获取资源元数据并批量加载资源。

## 功能特性

- ✅ 通过元数据 API 获取资源列表
- ✅ 批量并发加载资源
- ✅ 并发数量控制
- ✅ 自动重试机制
- ✅ 加载进度跟踪
- ✅ 完整的回调支持（onProgress, onSuccess, onError, onEnd）
- ✅ 文件过滤功能
- ✅ 基于 Fetch API，支持现代浏览器

## 安装

```bash
npm install
npm run build
```

## 使用方法

### 基本使用

```typescript
import { batchLoadCDNResources } from 'smiling-cdn-source-collect';

const result = await batchLoadCDNResources({
  metaUrl: 'https://unpkg.com/monaco-editor@0.54.0/min/?meta',
  concurrency: 5,
  retryCount: 3,
  callbacks: {
    onProgress: (progress, fileInfo) => {
      console.log(`${fileInfo.path}: ${progress.percentage}%`);
    },
    onSuccess: async (response, fileInfo) => {
      const data = await response.text();
      console.log(`成功加载: ${fileInfo.path}`);
    },
    onError: (error, fileInfo) => {
      console.error(`加载失败: ${fileInfo.path}`, error);
    },
    onEnd: async (response, fileInfo) => {
      console.log(`完成: ${fileInfo.path}`);
      // 可以在这里处理资源，例如添加到页面
    },
  },
});

console.log(`成功: ${result.successCount}, 失败: ${result.failureCount}`);
```

### 使用文件过滤器

```typescript
const result = await batchLoadCDNResources({
  metaUrl: 'https://unpkg.com/monaco-editor@0.54.0/min/?meta',
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
```

### 自定义配置

```typescript
const result = await batchLoadCDNResources({
  metaUrl: 'https://unpkg.com/monaco-editor@0.54.0/min/?meta',
  baseUrl: 'https://unpkg.com/monaco-editor@0.54.0', // 自定义基础 URL
  concurrency: 10,      // 并发数量
  retryCount: 5,        // 重试次数
  retryDelay: 2000,     // 重试延迟（毫秒）
  callbacks: {
    // ... 回调函数
  },
});
```

## API 文档

### `batchLoadCDNResources(options: BatchLoadOptions): Promise<BatchLoadResult>`

批量加载 CDN 资源的主函数。

#### 参数

- `metaUrl` (string, 必需): 元数据 URL 地址，例如 `https://unpkg.com/monaco-editor@0.54.0/min/?meta`
- `concurrency` (number, 可选): 并发数量，默认 5
- `retryCount` (number, 可选): 重试次数，默认 3
- `retryDelay` (number, 可选): 重试延迟（毫秒），默认 1000
- `baseUrl` (string, 可选): 基础 URL，如果不提供，将从 metaUrl 中提取
- `fileFilter` (function, 可选): 文件过滤器，用于过滤需要加载的文件
- `callbacks` (object, 可选): 回调函数对象
  - `onProgress` (function): 加载进度回调 `(progress: ResourceProgress, fileInfo: CDNFileInfo) => void`
  - `onSuccess` (function): 加载成功回调 `(response: Response, fileInfo: CDNFileInfo) => void`
  - `onError` (function): 加载失败回调 `(error: Error, fileInfo: CDNFileInfo) => void`
  - `onEnd` (function): 加载完成回调 `(response: Response, fileInfo: CDNFileInfo) => void`

#### 返回值

返回一个 Promise，解析为 `BatchLoadResult` 对象：

```typescript
{
  results: LoadResult[];      // 所有加载结果
  successCount: number;       // 成功的数量
  failureCount: number;       // 失败的数量
  metadata: CDNMetadata;      // 元数据信息
}
```

## 类型定义

### `CDNFileInfo`

```typescript
{
  path: string;        // 文件路径
  size: number;        // 文件大小
  type: string;       // 文件类型
  integrity?: string; // 完整性哈希（如果可用）
}
```

### `ResourceProgress`

```typescript
{
  loaded: number;     // 已加载字节数
  total: number;      // 总字节数
  percentage: number; // 加载百分比
}
```

## 注意事项

1. 本库使用 Fetch API，需要现代浏览器支持
2. 进度跟踪会读取响应体，因此 `onSuccess` 和 `onEnd` 中接收的 Response 对象包含完整的数据
3. 如果不需要进度跟踪，响应体不会被预先读取，可以在回调中按需处理
4. 并发控制使用队列机制，确保同时进行的请求数量不超过设定值

## 开发

```bash
# 编译 TypeScript
npm run build

# 监听模式
npm run dev
```

## 许可证

MIT

