<template>
  <div class="container">
    <div class="header">
      <h1>🚀 CDN 资源批量加载测试</h1>
      <p>测试批量加载 CDN 资源的功能，支持进度跟踪、并发控制和重试机制</p>
    </div>

    <div class="content">
      <div class="controls">
        <div class="control-group">
          <label for="metaUrl">元数据 URL</label>
          <input
            type="text"
            id="metaUrl"
            v-model="metaUrl"
            placeholder="输入元数据 URL"
          />
        </div>
        <div class="control-group">
          <label for="concurrency">并发数量</label>
          <input
            type="number"
            id="concurrency"
            v-model.number="concurrency"
            min="1"
            max="20"
          />
        </div>
        <div class="control-group">
          <label for="retryCount">重试次数</label>
          <input
            type="number"
            id="retryCount"
            v-model.number="retryCount"
            min="0"
            max="10"
          />
        </div>
        <div class="control-group">
          <label for="fileFilter">文件过滤</label>
          <select id="fileFilter" v-model="fileFilter">
            <option value="all">全部文件</option>
            <option value="js">仅 JavaScript (.js)</option>
            <option value="css">仅 CSS (.css)</option>
            <option value="json">仅 JSON (.json)</option>
          </select>
        </div>
      </div>

      <div class="buttons">
        <button
          class="btn btn-primary"
          :disabled="false"
          @click="handleMainButton"
        >
          {{ mainButtonText }}
        </button>
        <button class="btn btn-secondary" @click="handleClear">清空日志</button>
      </div>

      <div class="stats">
        <div class="stat-card">
          <div class="value">{{ totalFiles }}</div>
          <div class="label">总文件数</div>
        </div>
        <div class="stat-card">
          <div class="value">{{ successCount }}</div>
          <div class="label">成功</div>
        </div>
        <div class="stat-card">
          <div class="value">{{ failureCount }}</div>
          <div class="label">失败</div>
        </div>
        <div class="stat-card">
          <div class="value">{{ progressPercent }}%</div>
          <div class="label">总进度</div>
        </div>
      </div>

      <div class="log-container" ref="logContainerRef">
        <div
          v-for="(log, index) in logs"
          :key="index"
          :class="['log-entry', log.type]"
        >
          <span class="time">[{{ log.time }}]</span>{{ log.message }}
        </div>
      </div>
      <button class="clear-btn" @click="handleClear">清空日志</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from "vue";
import {
  CdnResource,
  type CdnFileInfo,
  type ResourceProgress,
  type ResumeConfig,
  type CdnLoadController,
  type CdnStateInfo,
  type CdnLoadOptions,
} from "../src/index";

// 响应式数据
const metaUrl = ref("https://unpkg.com/monaco-editor@0.54.0/min/?meta");
const concurrency = ref(5);
const retryCount = ref(3);
const fileFilter = ref("all");

let loadController: CdnLoadController | null = null;

// 断点续传配置对象（外部传入，初始为空）
const resumeConfig: ResumeConfig = {
  completed: new Map(),
};

// 状态信息（从 onState 回调中获取）
const stateInfo = ref<CdnStateInfo>({
  state: "idle",
  progress: undefined,
  isRunning: false,
  completedCount: 0,
  totalCount: 0,
});

// 统计信息（从 stateInfo 中计算）
const totalFiles = computed(() => stateInfo.value.totalCount);
const successCount = computed(() => stateInfo.value.progress?.success || 0);
const failureCount = computed(() => stateInfo.value.progress?.failure || 0);
const progressPercent = computed(
  () => stateInfo.value.progress?.percentage || 0
);

// 日志
interface LogEntry {
  message: string;
  type: "info" | "success" | "error" | "progress";
  time: string;
}

const logs = ref<LogEntry[]>([]);
const logContainerRef = ref<HTMLElement | null>(null);

// 计算属性：主按钮文案
const mainButtonText = computed(() => {
  const state = stateInfo.value.state;

  if (state === "running") {
    return "停止";
  } else if (state === "stopped") {
    return "继续";
  } else {
    // idle 或 completed 都显示"开始加载"
    return "开始加载";
  }
});

// 日志函数
function addLog(
  message: string,
  type: "info" | "success" | "error" | "progress" = "info"
) {
  logs.value.push({
    message,
    type,
    time: new Date().toLocaleTimeString(),
  });
  nextTick(() => {
    if (logContainerRef.value) {
      logContainerRef.value.scrollTop = logContainerRef.value.scrollHeight;
    }
  });
}

// 清空日志
function handleClear() {
  logs.value = [];
  resumeConfig.completed.clear();
  loadController = null;
  stateInfo.value = {
    state: "idle",
    progress: undefined,
    isRunning: false,
    completedCount: 0,
    totalCount: 0,
  };
}

// 创建或获取控制器
function getOrCreateController(): CdnLoadController {
  if (loadController) {
    return loadController;
  }

  const url = metaUrl.value.trim();
  if (!url) {
    throw new Error("请输入元数据 URL");
  }

  const concurrencyValue = concurrency.value || 5;
  const retryCountValue = retryCount.value || 3;
  const filterType = fileFilter.value;

  // 文件过滤器
  const fileFilterFn =
    filterType === "all"
      ? undefined
      : (fileInfo: CdnFileInfo) => {
          switch (filterType) {
            case "js":
              return fileInfo.path.endsWith(".js");
            case "css":
              return fileInfo.path.endsWith(".css");
            case "json":
              return fileInfo.path.endsWith(".json");
            default:
              return true;
          }
        };

  // 创建控制器实例
  loadController = new CdnResource({
    metaUrl: url,
    concurrency: concurrencyValue,
    retryCount: retryCountValue,
    fileFilter: fileFilterFn,
    resumeConfig,
    onState: (info) => {
      // 统一从 onState 回调中更新状态和统计信息
      stateInfo.value = info;
    },
    onTaskProgress: (progress) => {
      // 记录任务进度日志
      addLog(
        `📊 任务进度: ${progress.completed}/${progress.total} (${progress.percentage}%) - 成功: ${progress.success}, 失败: ${progress.failure}`,
        "info"
      );
    },
    onTaskEnd: (config) => {
      // 任务结束回调
      addLog(`📦 任务结束，断点续传配置已更新`, "info");
      addLog(`已完成文件数: ${config.completed.size}`, "info");
    },
    callbacks: {
      onProgress: (progress: ResourceProgress, fileInfo: CdnFileInfo) => {
        // 每 25% 记录一次进度
        if (progress.percentage % 25 === 0 || progress.percentage === 100) {
          addLog(
            `进度: ${fileInfo.path} - ${progress.percentage}% (${(
              progress.loaded / 1024
            ).toFixed(2)} KB / ${(progress.total / 1024).toFixed(2)} KB)`,
            "progress"
          );
        }
      },
      onSuccess: async (response, fileInfo) => {
        const contentType = response.headers.get("content-type") || "unknown";
        const size = fileInfo.size || 0;
        addLog(
          `✅ 成功加载: ${fileInfo.path} (${contentType}, ${(
            size / 1024
          ).toFixed(2)} KB)`,
          "success"
        );
      },
      onError: (error, fileInfo) => {
        addLog(`❌ 加载失败: ${fileInfo.path} - ${error.message}`, "error");
      },
      onEnd: async (response, fileInfo) => {
        addLog(`✨ 完成: ${fileInfo.path}`, "info");
      },
    },
  });

  return loadController;
}

// 主按钮点击处理（根据按钮文案执行不同操作）
async function handleMainButton() {
  const buttonText = mainButtonText.value;

  try {
    if (buttonText === "开始加载") {
      // 如果控制器存在且状态是 completed，需要重新创建
      if (loadController && stateInfo.value.state === "completed") {
        loadController = null;
      }

      // 清空之前的结果
      resumeConfig.completed.clear();

      const controller = getOrCreateController();

      addLog(`开始加载资源: ${metaUrl.value}`, "info");
      addLog(
        `并发数量: ${concurrency.value || 5}, 重试次数: ${
          retryCount.value || 3
        }`,
        "info"
      );

      await controller.start();
    } else if (buttonText === "停止") {
      if (loadController) {
        loadController.stop();
        addLog("⏹️ 正在停止加载...", "info");
      }
    } else if (buttonText === "继续") {
      const controller = getOrCreateController();

      addLog(
        `🔄 继续加载，已完成 ${resumeConfig.completed.size} 个文件`,
        "info"
      );

      await controller.resume();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    addLog(`❌ 操作失败: ${errorMessage}`, "error");
  }
}

// 监听状态变化，记录关键状态变化日志
watch(
  () => stateInfo.value.state,
  (newState, oldState) => {
    if (oldState && oldState !== newState) {
      if (newState === "running") {
        addLog(`▶️ 任务开始运行`, "info");
      } else if (newState === "stopped") {
        addLog(`⏹️ 任务已停止`, "info");
      } else if (newState === "completed") {
        addLog(`✅ 所有文件加载完成！`, "success");
      }
    }
  }
);

// 初始化
onMounted(() => {
  addLog("🚀 测试页面已就绪，可以开始测试了！", "info");
  addLog('💡 提示：修改配置后点击"开始加载"按钮', "info");
});
</script>

<style scoped>
@import "./styles/app.css";
</style>
