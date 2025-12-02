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

const resumeConfig: ResumeConfig = {};

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
    const completedCount = Object.values(config).filter(
      (value) => value === false
    ).length;
    console.log(`完成，共加载 ${completedCount} 个文件`);
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
const resumeConfig: ResumeConfig = {};

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

#### 方式 1：使用 metaUrl（推荐）

```typescript
const resumeConfig: ResumeConfig = {};

const loader = new CdnResource({
  // 元数据 URL（会自动请求获取文件列表）
  metaUrl: "https://unpkg.com/monaco-editor@0.54.0/min/?meta",

  // 自定义基础 URL（可选，如果不提供会从 metaUrl 中提取）
  baseUrl: "https://unpkg.com/monaco-editor@0.54.0",

  // 并发控制
  concurrency: 10, // 同时进行的请求数量，默认 5

  // 重试配置
  retryCount: 5, // 失败重试次数，默认 3
  retryDelay: 2000, // 重试延迟（毫秒），默认 1000

  // 断点续传配置
  resumeConfig,

  // 文件过滤器（可选，只加载特定类型的文件）
  fileFilter: (fileInfo) => {
    // 只加载 JavaScript 和 CSS 文件
    return fileInfo.path.endsWith(".js") || fileInfo.path.endsWith(".css");
  },

  // 状态监听
  onState: (stateInfo) => {
    console.log(`当前状态: ${stateInfo.state}`);
    if (stateInfo.progress) {
      console.log(
        `进度: ${stateInfo.progress.completed}/${stateInfo.progress.total} (${stateInfo.progress.percentage}%)`
      );
    }
  },

  // 任务进度回调
  onTaskProgress: (progress) => {
    console.log(
      `任务进度: ${progress.completed}/${progress.total} - 成功: ${progress.success}, 失败: ${progress.failure}`
    );
  },

  // 任务结束回调
  onTaskEnd: (config) => {
    const completedCount = Object.values(config).filter(
      (value) => value === false
    ).length;
    console.log(`任务完成，共加载 ${completedCount} 个文件`);
  },

  // 资源加载回调
  callbacks: {
    onProgress: (progress, fileInfo) => {
      // 每 25% 记录一次进度
      if (progress.percentage % 25 === 0) {
        console.log(
          `${fileInfo.path}: ${progress.percentage}% (${(
            progress.loaded / 1024
          ).toFixed(2)} KB / ${(progress.total / 1024).toFixed(2)} KB)`
        );
      }
    },
    onSuccess: async (response, fileInfo) => {
      const contentType = response.headers.get("content-type");
      console.log(`✅ 成功加载: ${fileInfo.path} (${contentType})`);
    },
    onError: (error, fileInfo) => {
      console.error(`❌ 加载失败: ${fileInfo.path}`, error);
    },
    onEnd: async (response, fileInfo) => {
      // 资源加载完成后的处理
      const blob = await response.blob();
      console.log(
        `✨ 完成: ${fileInfo.path} (${(blob.size / 1024).toFixed(2)} KB)`
      );
    },
  },
});

await loader.start();
```

#### 方式 2：使用 metaData（直接传入元数据）

如果已经获取了元数据，可以直接传入，避免额外的网络请求：

```typescript
const resumeConfig: ResumeConfig = {};

// 预先获取的元数据
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
    {
      path: "/min/vs/editor/editor.main.css",
      size: 5678,
      type: "text/css",
    },
    // ... 更多文件
  ],
};

const loader = new CdnResource({
  // 直接使用元数据，不需要 metaUrl
  metaData,

  // 基础 URL（可选）
  // 如果不提供，会使用 metaData.prefix
  // 如果 metaData.prefix 不存在，则必须提供 baseUrl
  baseUrl: "https://unpkg.com/monaco-editor@0.54.0",

  // 其他配置与方式 1 相同
  concurrency: 10,
  retryCount: 5,
  retryDelay: 2000,
  resumeConfig,
  fileFilter: (fileInfo) => fileInfo.path.endsWith(".js"),
  onState: (stateInfo) => {
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
```

**使用场景：**

- **方式 1（metaUrl）**：适用于首次加载，让库自动获取元数据
- **方式 2（metaData）**：适用于已经获取了元数据的场景，可以避免重复请求，提高性能

## API 文档

### `CdnResource`

CDN 资源批量加载器类。

#### 构造函数

```typescript
new CdnResource(options: CdnLoadOptions): CdnResource
```

#### 参数

| 参数             | 类型                                   | 必需 | 默认值 | 说明                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------- | -------------------------------------- | ---- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `metaUrl`        | `string`                               | 否\* | -      | 元数据 URL 地址，例如 `https://unpkg.com/monaco-editor@0.54.0/min/?meta`<br>如果提供了 `metaData`，则不需要提供 `metaUrl`<br>`metaUrl` 和 `metaData` 至少需要提供一个                                                                                                                                                                                                                 |
| `metaData`       | `CdnMetaData`                          | 否\* | -      | 元数据对象<br>如果提供了 `metaData`，则不需要请求 `metaUrl`<br>`metaUrl` 和 `metaData` 至少需要提供一个                                                                                                                                                                                                                                                                               |
| `concurrency`    | `number`                               | 否   | `5`    | 并发数量，控制同时进行的请求数量                                                                                                                                                                                                                                                                                                                                                      |
| `retryCount`     | `number`                               | 否   | `3`    | 重试次数，请求失败时的重试次数                                                                                                                                                                                                                                                                                                                                                        |
| `retryDelay`     | `number`                               | 否   | `1000` | 重试延迟（毫秒），每次重试之间的等待时间                                                                                                                                                                                                                                                                                                                                              |
| `baseUrl`        | `string`                               | 否   | -      | 基础 URL，用于构建完整的资源 URL<br>如果不提供，将从 `metaUrl` 中提取，或使用 `metaData.prefix`<br>如果提供了 `metaData` 但没有 `metaUrl`，且 `metaData.prefix` 不存在，则必须提供 `baseUrl`                                                                                                                                                                                          |
| `resumeConfig`   | `ResumeConfig`                         | 否   | `{}`   | 断点续传配置对象，用于存储已完成的资源状态                                                                                                                                                                                                                                                                                                                                            |
| `fileFilter`     | `(fileInfo: CdnFileInfo) => boolean`   | 否   | -      | 文件过滤器，用于过滤需要加载的文件<br>返回 `true` 表示加载该文件，`false` 表示跳过                                                                                                                                                                                                                                                                                                    |
| `onState`        | `(stateInfo: CdnStateInfo) => void`    | 否   | -      | 状态变化回调，当控制器状态发生变化时调用                                                                                                                                                                                                                                                                                                                                              |
| `onTaskProgress` | `(progress: TaskProgress) => void`     | 否   | -      | 任务进度回调，每当一个任务完成时调用                                                                                                                                                                                                                                                                                                                                                  |
| `onTaskEnd`      | `(resumeConfig: ResumeConfig) => void` | 否   | -      | 任务结束回调，任务完成或被停止时调用                                                                                                                                                                                                                                                                                                                                                  |
| `callbacks`      | `ResourceCallbacks`                    | 否   | -      | 资源加载回调函数对象，包含以下回调：<br>- `onProgress`: 加载进度回调 `(progress: ResourceProgress, fileInfo: CdnFileInfo) => void`<br>- `onSuccess`: 加载成功回调 `(response: Response, fileInfo: CdnFileInfo) => void`<br>- `onError`: 加载失败回调 `(error: Error, fileInfo: CdnFileInfo) => void`<br>- `onEnd`: 加载完成回调 `(response: Response, fileInfo: CdnFileInfo) => void` |
| `signal`         | `AbortSignal`                          | 否   | -      | 用于取消请求的 AbortSignal                                                                                                                                                                                                                                                                                                                                                            |

\* `metaUrl` 和 `metaData` 至少需要提供一个

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

断点续传配置。简单的配置对象，key 为文件路径，value 为是否需要重新请求。

```typescript
{
  [filePath: string]: boolean | undefined;
}
```

- `false` 或不存在：表示已成功，跳过请求
- `true`：表示需要重新请求

**示例：**

```typescript
const resumeConfig: ResumeConfig = {
  "/path/to/file1.js": false, // 已成功，跳过
  "/path/to/file2.js": true, // 需要重新请求
  // 其他文件不存在，表示需要请求
};
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
6. `resumeConfig` 是一个简单的对象，key 为文件路径，value 为 `boolean`：
   - `false` 表示已成功，下次跳过请求
   - `true` 表示需要重新请求
   - 不存在表示需要请求
7. 状态变化通过 `onState` 回调实时通知，可以用于更新 UI

## 开发

```bash
# 编译 TypeScript
npm run build

# 启动测试服务器（支持热更新）
npm run test
```

## 许可证

MIT
