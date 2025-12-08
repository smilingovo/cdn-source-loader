/**
 * CDN 元数据文件信息
 */
export interface CdnFileInfo {
  path: string;
  size: number;
  type: string;
  integrity?: string;
}

/**
 * CDN 元数据响应
 */
export interface CdnMetaData {
  package: string;
  version: string;
  prefix: string;
  files: CdnFileInfo[];
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
   * 加载成功回调
   * @param data 资源数据（Response 对象）
   * @param fileInfo 文件信息
   */
  onSuccess?: (data: Response, fileInfo: CdnFileInfo) => void;

  /**
   * 加载失败回调
   * @param error 错误信息
   * @param fileInfo 文件信息
   */
  onError?: (error: Error, fileInfo: CdnFileInfo) => void;

  /**
   * 资源加载完成后的回调（成功时调用）
   * @param data 资源数据（Response 对象）
   * @param fileInfo 文件信息
   */
  onEnd?: (data: Response, fileInfo: CdnFileInfo) => void;
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
   * 总任务数（总文件数）
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
 * 断点续传配置对象
 * 简单的配置对象，key 为文件路径，value 为是否需要重新请求
 * - false 或不存在：表示已成功，跳过请求
 * - true：表示需要重新请求
 */
export interface ResumeConfig {
  [filePath: string]: boolean | undefined;
}

/**
 * CDN 资源加载配置选项
 */
export interface CdnLoadOptions {
  /**
   * 元数据 URL 地址
   * 如果提供了 metaData，则不需要提供 metaUrl
   */
  metaUrl?: string;

  /**
   * 元数据对象
   * 如果提供了 metaData，则不需要请求 metaUrl
   * metaUrl 和 metaData 至少需要提供一个
   */
  metaData?: CdnMetaData;

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
   * 任务结束回调（成功完成或被停止时调用）
   * @param resumeConfig 断点续传配置信息
   */
  onTaskEnd?: (resumeConfig: ResumeConfig) => void;

  /**
   * 状态变化回调
   * 当控制器状态发生变化时调用，返回当前状态信息
   * @param stateInfo 状态信息
   */
  onState?: (stateInfo: CdnStateInfo) => void;

  /**
   * 文件过滤器，用于过滤需要加载的文件
   * @param fileInfo 文件信息
   * @returns 是否加载该文件
   */
  fileFilter?: (fileInfo: CdnFileInfo) => boolean;

  /**
   * 基础 URL，用于构建完整的资源 URL
   * 如果不提供，将从 metaUrl 中提取，或使用 metaData.prefix
   */
  baseUrl?: string;

  /**
   * 断点续传配置对象
   * 如果提供，会跳过已完成的资源，只加载未完成的
   * 加载完成后会更新此对象
   */
  resumeConfig?: ResumeConfig;

  /**
   * AbortSignal，用于取消请求
   */
  signal?: AbortSignal;
}

/**
 * CDN 资源加载结果
 */
export interface CdnSourceResult {
  /**
   * 文件信息
   */
  fileInfo: CdnFileInfo;

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
 * CDN 资源加载结果
 */
export interface CdnLoadResult {
  /**
   * 所有加载结果
   */
  results: CdnSourceResult[];

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
  metadata: CdnMetaData;
}

/**
 * 状态信息
 */
export interface CdnStateInfo {
  /**
   * 当前状态：idle | running | stopped | completed
   */
  state: string;

  /**
   * 任务进度信息（如果有）
   */
  progress?: TaskProgress;

  /**
   * 是否正在运行
   */
  isRunning: boolean;

  /**
   * 已完成文件数
   */
  completedCount: number;

  /**
   * 总文件数
   */
  totalCount: number;
}

/**
 * CDN 资源加载控制器
 * 提供开始、停止和继续加载的方法
 */
export interface CdnLoadController {
  /**
   * 开始加载（首次调用时执行）
   */
  start: () => Promise<void>;

  /**
   * 停止加载
   */
  stop: () => void;

  /**
   * 继续加载（从断点处继续）
   */
  resume: () => Promise<void>;
}
