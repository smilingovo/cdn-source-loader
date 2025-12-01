/**
 * CDN 元数据文件信息
 */
export interface CDNFileInfo {
  path: string;
  size: number;
  type: string;
  integrity?: string;
}

/**
 * CDN 元数据响应
 */
export interface CDNMetadata {
  package: string;
  version: string;
  prefix: string;
  files: CDNFileInfo[];
}

/**
 * 资源加载进度信息
 */
export interface ResourceProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * 单个资源加载回调
 */
export interface ResourceCallbacks {
  /**
   * 加载进度回调
   * @param progress 进度信息
   * @param fileInfo 文件信息
   */
  onProgress?: (progress: ResourceProgress, fileInfo: CDNFileInfo) => void;

  /**
   * 加载成功回调
   * @param data 资源数据（Response 对象）
   * @param fileInfo 文件信息
   */
  onSuccess?: (data: Response, fileInfo: CDNFileInfo) => void;

  /**
   * 加载失败回调
   * @param error 错误信息
   * @param fileInfo 文件信息
   */
  onError?: (error: Error, fileInfo: CDNFileInfo) => void;

  /**
   * 资源加载完成后的回调（成功时调用）
   * @param data 资源数据（Response 对象）
   * @param fileInfo 文件信息
   */
  onEnd?: (data: Response, fileInfo: CDNFileInfo) => void;
}

/**
 * 任务进度信息
 */
export interface TaskProgress {
  /**
   * 已完成的任务数
   */
  completed: number;

  /**
   * 总任务数
   */
  total: number;

  /**
   * 完成百分比
   */
  percentage: number;

  /**
   * 成功的任务数
   */
  success: number;

  /**
   * 失败的任务数
   */
  failure: number;
}

/**
 * 批量加载配置选项
 */
export interface BatchLoadOptions {
  /**
   * 元数据 URL 地址
   */
  metaUrl: string;

  /**
   * 并发数量控制，默认 5
   */
  concurrency?: number;

  /**
   * 重试次数，默认 3
   */
  retryCount?: number;

  /**
   * 重试延迟（毫秒），默认 1000
   */
  retryDelay?: number;

  /**
   * 每个资源的回调函数
   */
  callbacks?: ResourceCallbacks;

  /**
   * 任务进度回调，每当一个任务完成时调用
   * @param progress 任务进度信息
   */
  onTaskProgress?: (progress: TaskProgress) => void;

  /**
   * 文件过滤器，用于过滤需要加载的文件
   * @param fileInfo 文件信息
   * @returns 是否加载该文件
   */
  fileFilter?: (fileInfo: CDNFileInfo) => boolean;

  /**
   * 基础 URL，用于构建完整的资源 URL
   * 如果不提供，将从 metaUrl 中提取
   */
  baseUrl?: string;
}

/**
 * 加载结果
 */
export interface LoadResult {
  /**
   * 文件信息
   */
  fileInfo: CDNFileInfo;

  /**
   * 响应对象（成功时）
   */
  response?: Response;

  /**
   * 错误信息（失败时）
   */
  error?: Error;

  /**
   * 是否成功
   */
  success: boolean;
}

/**
 * 批量加载结果
 */
export interface BatchLoadResult {
  /**
   * 所有加载结果
   */
  results: LoadResult[];

  /**
   * 成功的数量
   */
  successCount: number;

  /**
   * 失败的数量
   */
  failureCount: number;

  /**
   * 元数据信息
   */
  metadata: CDNMetadata;
}
