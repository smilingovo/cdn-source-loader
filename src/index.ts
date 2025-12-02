import {
  CdnLoadOptions,
  CdnLoadResult,
  CdnFileInfo,
  CdnMetaData,
  CdnSourceResult,
  ResourceCallbacks,
  ResourceProgress,
  TaskProgress,
  ResumeConfig,
  CdnLoadController,
  CdnStateInfo,
} from "./types";
import { fetchMetadata, extractBaseUrl } from "./utils";
import { loadResource, ConcurrencyQueue } from "./loader";

/**
 * 批量加载状态枚举
 */
export enum LoadState {
  /** 空闲状态 */
  IDLE = "idle",
  /** 运行中 */
  RUNNING = "running",
  /** 已停止 */
  STOPPED = "stopped",
  /** 已完成 */
  COMPLETED = "completed",
}

/**
 * CDN 资源批量加载器
 */
export class CdnResource implements CdnLoadController {
  private options: CdnLoadOptions;
  private state: LoadState = LoadState.IDLE;
  private abortController: AbortController | null = null;
  private isRunning = false;
  private currentProgress: TaskProgress | null = null;

  constructor(options: CdnLoadOptions) {
    this.options = options;

    // 验证至少提供了 metaUrl 或 metaData 之一
    if (!this.options.metaUrl && !this.options.metaData) {
      throw new Error(
        "Either metaUrl or metaData must be provided in CdnLoadOptions"
      );
    }

    // 初始化断点续传配置（如果不存在则创建空对象）
    if (!this.options.resumeConfig) {
      this.options.resumeConfig = {};
    }

    // 根据 resumeConfig 判断初始状态
    // 如果有已完成的文件（值为 false），可能是停止状态
    const hasCompletedFiles = Object.values(this.options.resumeConfig).some(
      (value) => value === false
    );
    if (hasCompletedFiles) {
      // 有已完成的任务，可能是停止状态或完成状态
      this.state = LoadState.STOPPED;
    } else {
      // 没有已完成的任务，是空闲状态
      this.state = LoadState.IDLE;
    }

    // 初始化时触发状态回调
    if (this.options.onState) {
      const completedCount = Object.values(this.options.resumeConfig).filter(
        (value) => value === false
      ).length;
      const stateInfo: CdnStateInfo = {
        state: this.state,
        progress: undefined,
        isRunning: false,
        completedCount,
        totalCount: 0,
      };
      this.options.onState(stateInfo);
    }
  }

  /**
   * 获取当前状态
   */
  getState(): LoadState {
    return this.state;
  }

  /**
   * 更新状态并触发回调
   */
  private updateState(newState: LoadState, progress?: TaskProgress): void {
    this.state = newState;

    // 如果提供了进度信息，更新当前进度
    if (progress) {
      this.currentProgress = progress;
    }

    // 触发状态变化回调
    if (this.options.onState) {
      const stateInfo: CdnStateInfo = {
        state: this.state,
        progress: this.currentProgress || undefined,
        isRunning: this.isRunning,
        completedCount: this.currentProgress?.completed || 0,
        totalCount: this.currentProgress?.total || 0,
      };
      this.options.onState(stateInfo);
    }
  }

  /**
   * 判断是否可以开始
   * 允许从 IDLE、COMPLETED、STOPPED 状态开始
   * 会按照 resumeConfig 配置进行加载（跳过已完成的，加载未完成的）
   */
  canStart(): boolean {
    return (
      this.state === LoadState.IDLE ||
      this.state === LoadState.COMPLETED ||
      this.state === LoadState.STOPPED
    );
  }

  /**
   * 判断是否可以继续
   */
  canResume(): boolean {
    if (this.state !== LoadState.STOPPED || !this.options.resumeConfig) {
      return false;
    }
    // 检查是否有已完成的文件（值为 false）
    const hasCompletedFiles = Object.values(this.options.resumeConfig).some(
      (value) => value === false
    );
    return hasCompletedFiles;
  }

  /**
   * 判断是否可以停止
   */
  canStop(): boolean {
    return this.state === LoadState.RUNNING;
  }

  /**
   * 执行加载任务
   */
  private async executeLoad(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    // 更新状态为运行中，并触发 onState 回调
    this.updateState(LoadState.RUNNING);

    // 创建新的 AbortController
    this.abortController = new AbortController();
    const signal = this.options.signal || this.abortController.signal;

    try {
      // 获取元数据：如果提供了 metaData，直接使用；否则请求 metaUrl
      let metadata: CdnMetaData;
      if (this.options.metaData) {
        metadata = this.options.metaData;
      } else if (this.options.metaUrl) {
        metadata = await fetchMetadata(this.options.metaUrl);
      } else {
        throw new Error("Either metaUrl or metaData must be provided");
      }

      // 确定基础 URL
      let resolvedBaseUrl: string;
      if (this.options.baseUrl) {
        resolvedBaseUrl = this.options.baseUrl;
      } else if (this.options.metaUrl) {
        resolvedBaseUrl = extractBaseUrl(this.options.metaUrl);
      } else if (metadata.prefix) {
        resolvedBaseUrl = metadata.prefix;
      } else {
        throw new Error(
          "baseUrl must be provided when metaData is used without metaUrl"
        );
      }

      // 过滤文件列表
      let filesToLoad: CdnFileInfo[] = metadata.files;
      if (this.options.fileFilter) {
        filesToLoad = metadata.files.filter(this.options.fileFilter);
      }

      // 过滤出需要加载的文件（排除已完成的）
      const filesToLoadFiltered: CdnFileInfo[] = [];
      let completedCount = 0;
      let successCount = 0;
      let failureCount = 0;

      // 统计已完成的文件（resumeConfig 中值为 false 的）
      for (const fileInfo of filesToLoad) {
        const configValue = this.options.resumeConfig?.[fileInfo.path];
        if (configValue === false) {
          // 已成功，跳过
          completedCount++;
          successCount++;
        } else {
          // 需要请求（不存在或值为 true）
          filesToLoadFiltered.push(fileInfo);
        }
      }

      const totalFiles = filesToLoad.length;
      const remainingFiles = filesToLoadFiltered.length;

      // 任务进度更新函数
      const updateTaskProgress = (success: boolean) => {
        completedCount++;
        if (success) {
          successCount++;
        } else {
          failureCount++;
        }

        // 更新进度信息（无论是否有 onTaskProgress 回调）
        const progress: TaskProgress = {
          completed: completedCount,
          total: totalFiles,
          percentage:
            totalFiles > 0
              ? Math.round((completedCount / totalFiles) * 100)
              : 0,
          success: successCount,
          failure: failureCount,
        };
        this.currentProgress = progress;

        // 触发 onTaskProgress 回调（如果存在）
        if (this.options.onTaskProgress) {
          this.options.onTaskProgress(progress);
        }

        // 独立触发 onState 回调（无论是否有 onTaskProgress）
        this.updateState(this.state, progress);
      };

      // 如果有已完成的，先更新进度
      if (completedCount > 0) {
        const progress: TaskProgress = {
          completed: completedCount,
          total: totalFiles,
          percentage:
            totalFiles > 0
              ? Math.round((completedCount / totalFiles) * 100)
              : 0,
          success: successCount,
          failure: failureCount,
        };
        this.currentProgress = progress;

        // 触发 onTaskProgress 回调（如果存在）
        if (this.options.onTaskProgress) {
          this.options.onTaskProgress(progress);
        }

        // 独立触发 onState 回调（无论是否有 onTaskProgress）
        this.updateState(this.state, progress);
      }

      // 如果没有需要加载的文件，直接结束
      if (remainingFiles === 0) {
        this.isRunning = false;
        this.updateState(LoadState.COMPLETED);
        if (this.options.onTaskEnd && this.options.resumeConfig) {
          this.options.onTaskEnd(this.options.resumeConfig);
        }
        return;
      }

      // 创建并发控制队列
      const queue = new ConcurrencyQueue(this.options.concurrency || 5);

      // 创建加载任务
      const loadTasks: Promise<CdnSourceResult>[] = filesToLoadFiltered.map(
        (fileInfo) =>
          queue.add(async () => {
            // 检查是否已停止
            if (signal.aborted) {
              throw new Error("Request aborted");
            }

            const result = await loadResource(
              fileInfo,
              resolvedBaseUrl,
              this.options.retryCount || 3,
              this.options.retryDelay || 1000,
              this.options.callbacks,
              signal
            );

            // 回写到断点续传配置
            // 成功则标记为 false（已成功，下次跳过），失败则标记为 true（需要重新请求）
            if (this.options.resumeConfig) {
              this.options.resumeConfig[fileInfo.path] = !result.success;
            }

            // 任务完成后更新进度
            updateTaskProgress(result.success);
            return result;
          })
      );

      // 等待所有任务完成（如果被取消，会抛出错误）
      try {
        await Promise.all(loadTasks);
      } catch (error) {
        // 如果被停止，不抛出错误
        if (signal.aborted) {
          // 停止时，调用 onTaskEnd
          this.isRunning = false;
          this.updateState(LoadState.STOPPED);
          if (this.options.onTaskEnd && this.options.resumeConfig) {
            this.options.onTaskEnd(this.options.resumeConfig);
          }
          return;
        }
        throw error;
      }

      // 所有任务完成
      this.isRunning = false;
      this.updateState(LoadState.COMPLETED);
      if (this.options.onTaskEnd && this.options.resumeConfig) {
        this.options.onTaskEnd(this.options.resumeConfig);
      }
    } catch (error) {
      // 如果不是停止操作，抛出错误
      const isAborted = this.abortController?.signal.aborted;
      if (!isAborted) {
        throw error;
      }
      // 停止时，调用 onTaskEnd
      if (this.options.onTaskEnd && this.options.resumeConfig) {
        this.options.onTaskEnd(this.options.resumeConfig);
      }
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 开始加载（首次调用时执行）
   * 如果 resumeConfig 有值，会按照配置进行加载：
   * - 值为 false 的文件会跳过（已成功）
   * - 值为 true 或不存在的文件会进行加载
   */
  async start(): Promise<void> {
    if (!this.canStart()) {
      throw new Error(
        `Cannot start: current state is ${this.state}. Use resume() if you want to continue.`
      );
    }

    // 如果状态是 COMPLETED 或 STOPPED，重置为 IDLE
    // 这样会重新分析 resumeConfig，按照配置加载
    if (
      this.state === LoadState.COMPLETED ||
      this.state === LoadState.STOPPED
    ) {
      this.state = LoadState.IDLE;
    }

    // 不再清空 resumeConfig，按照配置进行加载
    // 如果用户需要重新开始，应该手动清空 resumeConfig

    await this.executeLoad();
  }

  /**
   * 停止加载
   */
  stop(): void {
    if (this.state !== LoadState.RUNNING) {
      return;
    }

    this.state = LoadState.STOPPED;
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * 继续加载（从断点处继续）
   */
  async resume(): Promise<void> {
    if (!this.canResume()) {
      throw new Error(
        `Cannot resume: current state is ${this.state}. Use start() if you want to start a new task.`
      );
    }

    await this.executeLoad();
  }
}

// 导出类型
export type {
  CdnFileInfo,
  CdnMetaData,
  ResourceProgress,
  ResourceCallbacks,
  TaskProgress,
  ResumeConfig,
  CdnLoadOptions,
  CdnSourceResult,
  CdnLoadResult,
  CdnLoadController,
  CdnStateInfo,
};

// 导出工具函数（如果需要）
export { extractBaseUrl, fetchMetadata, buildResourceUrl } from "./utils";
