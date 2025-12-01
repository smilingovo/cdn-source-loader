import {
  BatchLoadOptions,
  BatchLoadResult,
  CDNFileInfo,
  CDNMetadata,
  LoadResult,
  ResourceCallbacks,
  ResourceProgress,
  TaskProgress,
} from "./types";
import { fetchMetadata, extractBaseUrl } from "./utils";
import { loadResource, ConcurrencyQueue } from "./loader";

/**
 * 批量加载 CDN 资源
 * @param options 配置选项
 * @returns 批量加载结果
 */
export async function batchLoadCDNResources(
  options: BatchLoadOptions
): Promise<BatchLoadResult> {
  const {
    metaUrl,
    concurrency = 5,
    retryCount = 3,
    retryDelay = 1000,
    callbacks,
    onTaskProgress,
    fileFilter,
    baseUrl,
  } = options;

  // 获取元数据
  const metadata = await fetchMetadata(metaUrl);

  // 确定基础 URL
  const resolvedBaseUrl = baseUrl || extractBaseUrl(metaUrl);

  // 过滤文件列表
  let filesToLoad: CDNFileInfo[] = metadata.files;
  if (fileFilter) {
    filesToLoad = metadata.files.filter(fileFilter);
  }

  const totalFiles = filesToLoad.length;
  let completedCount = 0;
  let successCount = 0;
  let failureCount = 0;

  // 任务进度更新函数
  const updateTaskProgress = (success: boolean) => {
    completedCount++;
    if (success) {
      successCount++;
    } else {
      failureCount++;
    }

    if (onTaskProgress) {
      const progress: TaskProgress = {
        completed: completedCount,
        total: totalFiles,
        percentage:
          totalFiles > 0 ? Math.round((completedCount / totalFiles) * 100) : 0,
        success: successCount,
        failure: failureCount,
      };
      onTaskProgress(progress);
    }
  };

  // 创建并发控制队列
  const queue = new ConcurrencyQueue(concurrency);

  // 创建加载任务
  const loadTasks: Promise<LoadResult>[] = filesToLoad.map((fileInfo) =>
    queue.add(async () => {
      const result = await loadResource(
        fileInfo,
        resolvedBaseUrl,
        retryCount,
        retryDelay,
        callbacks
      );
      // 任务完成后更新进度
      updateTaskProgress(result.success);
      return result;
    })
  );

  // 等待所有任务完成
  const results = await Promise.all(loadTasks);

  return {
    results,
    successCount,
    failureCount,
    metadata,
  };
}

// 导出类型
export type {
  CDNFileInfo,
  CDNMetadata,
  ResourceProgress,
  ResourceCallbacks,
  TaskProgress,
  BatchLoadOptions,
  LoadResult,
  BatchLoadResult,
};

// 导出工具函数（如果需要）
export { extractBaseUrl, fetchMetadata, buildResourceUrl } from "./utils";
