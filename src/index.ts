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
enum LoadState {
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

    // 初始化断点续传配置
    if (this.options.resumeConfig && !this.options.resumeConfig.completed) {
      this.options.resumeConfig.completed = new Map();
    }

    // 根据 resumeConfig 判断初始状态
    if (
      this.options.resumeConfig?.completed &&
      this.options.resumeConfig.completed.size > 0
    ) {
      // 有已完成的任务，可能是停止状态或完成状态
      this.state = LoadState.STOPPED;
    } else {
      // 没有已完成的任务，是空闲状态
      this.state = LoadState.IDLE;
    }

    // 初始化时触发状态回调
    if (this.options.onState) {
      const stateInfo: CdnStateInfo = {
        state: this.state,
        progress: undefined,
        isRunning: false,
        completedCount: this.options.resumeConfig?.completed?.size || 0,
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
   */
  canStart(): boolean {
    return this.state === LoadState.IDLE || this.state === LoadState.COMPLETED;
  }

  /**
   * 判断是否可以继续
   */
  canResume(): boolean {
    return (
      this.state === LoadState.STOPPED &&
      !!this.options.resumeConfig?.completed &&
      this.options.resumeConfig.completed.size > 0
    );
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
    this.state = LoadState.RUNNING;

    // 创建新的 AbortController
    this.abortController = new AbortController();
    const signal = this.options.signal || this.abortController.signal;

    try {
      // 获取元数据
      const metadata = await fetchMetadata(this.options.metaUrl);

      // 确定基础 URL
      const resolvedBaseUrl =
        this.options.baseUrl || extractBaseUrl(this.options.metaUrl);

      // 过滤文件列表
      let filesToLoad: CdnFileInfo[] = metadata.files;
      if (this.options.fileFilter) {
        filesToLoad = metadata.files.filter(this.options.fileFilter);
      }

      // 设置元数据到 resumeConfig
      if (this.options.resumeConfig) {
        this.options.resumeConfig.metadata = metadata;
      }

      // 过滤出需要加载的文件（排除已完成的）
      const filesToLoadFiltered: CdnFileInfo[] = [];
      const existingResults: CdnSourceResult[] = [];

      if (this.options.resumeConfig?.completed) {
        for (const fileInfo of filesToLoad) {
          const existing = this.options.resumeConfig.completed.get(
            fileInfo.path
          );
          if (existing) {
            existingResults.push(existing);
          } else {
            filesToLoadFiltered.push(fileInfo);
          }
        }
      } else {
        filesToLoadFiltered.push(...filesToLoad);
      }

      const totalFiles = filesToLoad.length;
      const remainingFiles = filesToLoadFiltered.length;
      let completedCount = existingResults.length;
      let successCount = existingResults.filter((r) => r.success).length;
      let failureCount = existingResults.filter((r) => !r.success).length;

      // 任务进度更新函数
      const updateTaskProgress = (success: boolean) => {
        completedCount++;
        if (success) {
          successCount++;
        } else {
          failureCount++;
        }

        if (this.options.onTaskProgress) {
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
          this.options.onTaskProgress(progress);
          // 触发状态回调
          this.updateState(this.state, progress);
        }
      };

      // 如果有已完成的，先更新进度
      if (existingResults.length > 0 && this.options.onTaskProgress) {
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
        this.options.onTaskProgress(progress);
        // 触发状态回调
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

            // 保存到断点续传配置
            if (this.options.resumeConfig?.completed) {
              this.options.resumeConfig.completed.set(fileInfo.path, result);
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
   */
  async start(): Promise<void> {
    if (!this.canStart()) {
      throw new Error(
        `Cannot start: current state is ${this.state}. Use resume() if you want to continue.`
      );
    }

    // 如果状态是 COMPLETED，重置为 IDLE
    if (this.state === LoadState.COMPLETED) {
      this.state = LoadState.IDLE;
    }

    // 清空之前的结果（如果是新开始）
    if (this.options.resumeConfig) {
      this.options.resumeConfig.completed.clear();
    }

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
