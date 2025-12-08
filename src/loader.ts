import { CdnFileInfo, ResourceCallbacks, CdnSourceResult } from "./types";
import { buildResourceUrl } from "./utils";

/**
 * 加载单个资源
 * @param fileInfo 文件信息
 * @param baseUrl 基础 URL
 * @param retryCount 重试次数
 * @param retryDelay 重试延迟（毫秒）
 * @param callbacks 回调函数
 * @param signal AbortSignal，用于取消请求
 * @returns 加载结果
 */
export async function loadResource(
  fileInfo: CdnFileInfo,
  baseUrl: string,
  retryCount: number,
  retryDelay: number,
  callbacks?: ResourceCallbacks,
  signal?: AbortSignal
): Promise<CdnSourceResult> {
  const resourceUrl = buildResourceUrl(baseUrl, fileInfo.path);
  let lastError: Error | undefined;

  // 重试逻辑
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    // 检查是否已取消
    if (signal?.aborted) {
      throw new Error("Request aborted");
    }

    try {
      const response = await fetch(resourceUrl, { signal });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      await callbacks?.onSuccess?.(response, fileInfo);
      await callbacks?.onEnd?.(response, fileInfo);
      return {
        fileInfo,
        response,
        success: true,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 检查是否已取消
      if (signal?.aborted) {
        throw new Error("Request aborted");
      }

      // 如果不是最后一次尝试，等待后重试
      if (attempt < retryCount) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        continue;
      }

      // 最后一次尝试失败，调用错误回调
      await callbacks?.onError?.(lastError, fileInfo);

      return {
        fileInfo,
        error: lastError,
        success: false,
      };
    }
  }

  // 理论上不会到达这里，但为了类型安全
  return {
    fileInfo,
    error: lastError || new Error("Unknown error"),
    success: false,
  };
}

/**
 * 并发控制队列
 */
export class ConcurrencyQueue {
  private running = 0;
  private queue: Array<() => Promise<void>> = [];

  constructor(private maxConcurrency: number) {}

  /**
   * 添加任务到队列
   */
  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          this.processQueue();
        }
      });

      this.processQueue();
    });
  }

  /**
   * 处理队列
   */
  private processQueue(): void {
    while (this.running < this.maxConcurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        this.running++;
        task();
      }
    }
  }

  /**
   * 等待所有任务完成
   */
  async waitAll(): Promise<void> {
    while (this.running > 0 || this.queue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}
