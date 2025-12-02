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
- ✅ 状态监听（onState）
- ✅ 断点续传支持
- ✅ 停止和继续功能
- ✅ 基于 Fetch API，支持现代浏览器

## 安装

```bash
npm install
npm run build
```

## 使用方法

### 基本使用

```typescript
import { CdnResource, type ResumeConfig } from "smiling-cdn-source-collect";

const resumeConfig: ResumeConfig = {
  completed: new Map(),
};

const loader = new CdnResource({
  metaUrl: "https://unpkg.com/monaco-editor@0.54.0/min/?meta",
  concurrency: 5,
  retryCount: 3,
  resumeConfig,
  onState: (stateInfo) => {
    console.log(`状态: ${stateInfo.state}`);
    if (stateInfo.progress) {
      console.log(`进度: ${stateInfo.progress.percentage}%`);
    }
  },
  onTaskProgress: (progress) => {
    console.log(`任务进度: ${progress.completed}/${progress.total}`);
  },
  onTaskEnd: (config) => {
    console.log(`完成，共加载 ${config.completed.size} 个文件`);
  },
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
    },
  },
});

// 开始加载
await loader.start();
```

### 使用文件过滤器

```typescript
const loader = new CdnResource({
  metaUrl: "https://unpkg.com/monaco-editor@0.54.0/min/?meta",
  fileFilter: (fileInfo) => {
    // 只加载 JavaScript 文件
    return fileInfo.path.endsWith(".js");
  },
  resumeConfig,
  callbacks: {
    onSuccess: async (response, fileInfo) => {
      console.log(`已加载: ${fileInfo.path}`);
    },
  },
});

await loader.start();
```

### 停止和继续（断点续传）

```typescript
const resumeConfig: ResumeConfig = {
  completed: new Map(),
};

const loader = new CdnResource({
  metaUrl: "https://unpkg.com/monaco-editor@0.54.0/min/?meta",
  resumeConfig,
  onState: (stateInfo) => {
    console.log(`状态: ${stateInfo.state}`);
  },
});

// 开始加载
await loader.start();

// 停止加载
loader.stop();

// 继续加载（从断点处继续）
await loader.resume();
```

### 自定义配置

```typescript
const loader = new CdnResource({
  metaUrl: "https://unpkg.com/monaco-editor@0.54.0/min/?meta",
  baseUrl: "https://unpkg.com/monaco-editor@0.54.0", // 自定义基础 URL
  concurrency: 10, // 并发数量
  retryCount: 5, // 重试次数
  retryDelay: 2000, // 重试延迟（毫秒）
  resumeConfig,
  callbacks: {
    // ... 回调函数
  },
});

await loader.start();
```

## API 文档

### `CdnResource`

CDN 资源批量加载器类。

#### 构造函数

```typescript
new CdnResource(options: CdnLoadOptions): CdnResource
```

#### 参数

- `metaUrl` (string, 必需): 元数据 URL 地址，例如 `https://unpkg.com/monaco-editor@0.54.0/min/?meta`
- `concurrency` (number, 可选): 并发数量，默认 5
- `retryCount` (number, 可选): 重试次数，默认 3
- `retryDelay` (number, 可选): 重试延迟（毫秒），默认 1000
- `baseUrl` (string, 可选): 基础 URL，如果不提供，将从 metaUrl 中提取
- `resumeConfig` (ResumeConfig, 可选): 断点续传配置对象
- `fileFilter` (function, 可选): 文件过滤器，用于过滤需要加载的文件
- `onState` (function, 可选): 状态变化回调 `(stateInfo: CdnStateInfo) => void`
- `onTaskProgress` (function, 可选): 任务进度回调 `(progress: TaskProgress) => void`
- `onTaskEnd` (function, 可选): 任务结束回调 `(resumeConfig: ResumeConfig) => void`
- `callbacks` (object, 可选): 回调函数对象
  - `onProgress` (function): 加载进度回调 `(progress: ResourceProgress, fileInfo: CdnFileInfo) => void`
  - `onSuccess` (function): 加载成功回调 `(response: Response, fileInfo: CdnFileInfo) => void`
  - `onError` (function): 加载失败回调 `(error: Error, fileInfo: CdnFileInfo) => void`
  - `onEnd` (function): 加载完成回调 `(response: Response, fileInfo: CdnFileInfo) => void`
- `signal` (AbortSignal, 可选): 用于取消请求的 AbortSignal

#### 方法

##### `start(): Promise<void>`

开始加载资源。首次调用时执行，会清空之前的结果。

##### `stop(): void`

停止加载。调用后会立即停止所有正在进行的请求。

##### `resume(): Promise<void>`

继续加载。从断点处继续加载未完成的资源。

#### 返回值

`CdnResource` 实例，实现了 `CdnLoadController` 接口。

## 类型定义

### `CdnLoadOptions`

加载配置选项。

```typescript
{
  metaUrl: string;
  concurrency?: number;
  retryCount?: number;
  retryDelay?: number;
  baseUrl?: string;
  resumeConfig?: ResumeConfig;
  fileFilter?: (fileInfo: CdnFileInfo) => boolean;
  onState?: (stateInfo: CdnStateInfo) => void;
  onTaskProgress?: (progress: TaskProgress) => void;
  onTaskEnd?: (resumeConfig: ResumeConfig) => void;
  callbacks?: ResourceCallbacks;
  signal?: AbortSignal;
}
```

### `CdnFileInfo`

文件信息。

```typescript
{
  path: string;        // 文件路径
  size: number;       // 文件大小
  type: string;       // 文件类型
  integrity?: string; // 完整性哈希（如果可用）
}
```

### `CdnStateInfo`

状态信息。

```typescript
{
  state: string;              // 当前状态：idle | running | stopped | completed
  progress?: TaskProgress;    // 任务进度信息（如果有）
  isRunning: boolean;          // 是否正在运行
  completedCount: number;      // 已完成文件数
  totalCount: number;          // 总文件数
}
```

### `TaskProgress`

任务进度信息。

```typescript
{
  completed: number; // 已完成数量
  total: number; // 总数量
  percentage: number; // 完成百分比
  success: number; // 成功数量
  failure: number; // 失败数量
}
```

### `ResourceProgress`

资源加载进度信息。

```typescript
{
  loaded: number; // 已加载字节数
  total: number; // 总字节数
  percentage: number; // 加载百分比
}
```

### `ResumeConfig`

断点续传配置。

```typescript
{
  completed: Map<string, CdnSourceResult>; // 已完成的资源结果
  metadata?: CdnMetaData;                   // 元数据信息
}
```

### `CdnSourceResult`

单个资源加载结果。

```typescript
{
  fileInfo: CdnFileInfo;  // 文件信息
  response?: Response;     // 响应对象（成功时）
  error?: Error;          // 错误信息（失败时）
  success: boolean;       // 是否成功
}
```

## 注意事项

1. 本库使用 Fetch API，需要现代浏览器支持
2. 进度跟踪会读取响应体，因此 `onSuccess` 和 `onEnd` 中接收的 Response 对象包含完整的数据
3. 如果不需要进度跟踪，响应体不会被预先读取，可以在回调中按需处理
4. 并发控制使用队列机制，确保同时进行的请求数量不超过设定值
5. 断点续传配置对象需要外部维护，建议持久化存储以便页面刷新后可以继续
6. 状态变化通过 `onState` 回调实时通知，可以用于更新 UI

## 开发

```bash
# 编译 TypeScript
npm run build

# 启动测试服务器（支持热更新）
npm run test
```

## 许可证

MIT
