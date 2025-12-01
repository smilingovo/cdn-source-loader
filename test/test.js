import { batchLoadCDNResources } from '../src/index';
// 全局状态
let isLoading = false;
let currentAbortController = null;
// DOM 元素
const metaUrlInput = document.getElementById('metaUrl');
const concurrencyInput = document.getElementById('concurrency');
const retryCountInput = document.getElementById('retryCount');
const fileFilterSelect = document.getElementById('fileFilter');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const clearBtn = document.getElementById('clearBtn');
const logContainer = document.getElementById('logContainer');
const fileList = document.getElementById('fileList');
const totalFilesSpan = document.getElementById('totalFiles');
const successCountSpan = document.getElementById('successCount');
const failureCountSpan = document.getElementById('failureCount');
const progressPercentSpan = document.getElementById('progressPercent');
// 统计信息
let totalFiles = 0;
let successCount = 0;
let failureCount = 0;
const fileProgressMap = new Map();
// 使用 Set 跟踪已完成的文件，避免重复计数
const completedFiles = new Set();
// 日志函数
function log(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const time = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="time">[${time}]</span>${message}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
}
// 清空日志
window.clearLogs = function () {
    logContainer.innerHTML = '';
    fileList.innerHTML = '';
    fileProgressMap.clear();
    completedFiles.clear();
    totalFiles = 0;
    successCount = 0;
    failureCount = 0;
    updateStats();
};
// 更新统计信息
function updateStats() {
    totalFilesSpan.textContent = totalFiles.toString();
    successCountSpan.textContent = successCount.toString();
    failureCountSpan.textContent = failureCount.toString();
    if (totalFiles > 0) {
        const totalProgress = Array.from(fileProgressMap.values()).reduce((sum, p) => sum + p, 0);
        const avgProgress = Math.round(totalProgress / totalFiles);
        progressPercentSpan.textContent = `${avgProgress}%`;
    }
    else {
        progressPercentSpan.textContent = '0%';
    }
}
// 添加文件项到列表
function addFileItem(fileInfo, status = 'loading') {
    const item = document.createElement('div');
    item.className = `file-item ${status}`;
    item.id = `file-${fileInfo.path}`;
    const sizeText = fileInfo.size > 0
        ? `(${(fileInfo.size / 1024).toFixed(2)} KB)`
        : '';
    item.innerHTML = `
    <span class="file-name">${fileInfo.path}</span>
    <span class="file-size">${sizeText}</span>
    <span class="file-status status-${status}">${status === 'loading' ? '加载中...' : status === 'success' ? '成功' : '失败'}</span>
  `;
    fileList.appendChild(item);
}
// 更新文件项状态
function updateFileItem(path, status, progress) {
    const item = document.getElementById(`file-${path}`);
    if (item) {
        item.className = `file-item ${status}`;
        const statusSpan = item.querySelector('.file-status');
        if (statusSpan) {
            statusSpan.className = `file-status status-${status}`;
            statusSpan.textContent = status === 'success' ? '成功' : '失败';
        }
        if (progress !== undefined && status === 'success') {
            fileProgressMap.set(path, 100);
        }
    }
}
// 开始加载
async function startLoading() {
    if (isLoading)
        return;
    isLoading = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    // 清空之前的结果
    fileList.innerHTML = '';
    fileProgressMap.clear();
    completedFiles.clear();
    successCount = 0;
    failureCount = 0;
    const metaUrl = metaUrlInput.value.trim();
    if (!metaUrl) {
        log('请输入元数据 URL', 'error');
        isLoading = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
        return;
    }
    const concurrency = parseInt(concurrencyInput.value) || 5;
    const retryCount = parseInt(retryCountInput.value) || 3;
    const filterType = fileFilterSelect.value;
    // 文件过滤器
    const fileFilter = filterType === 'all'
        ? undefined
        : (fileInfo) => {
            switch (filterType) {
                case 'js':
                    return fileInfo.path.endsWith('.js');
                case 'css':
                    return fileInfo.path.endsWith('.css');
                case 'json':
                    return fileInfo.path.endsWith('.json');
                default:
                    return true;
            }
        };
    log(`开始加载资源: ${metaUrl}`, 'info');
    log(`并发数量: ${concurrency}, 重试次数: ${retryCount}`, 'info');
    try {
        const result = await batchLoadCDNResources({
            metaUrl,
            concurrency,
            retryCount,
            fileFilter,
            onTaskProgress: (progress) => {
                // 更新任务进度显示
                log(`📊 任务进度: ${progress.completed}/${progress.total} (${progress.percentage}%) - 成功: ${progress.success}, 失败: ${progress.failure}`, 'info');
                // 同步更新统计信息（使用回调中的准确数据）
                successCount = progress.success;
                failureCount = progress.failure;
                updateStats();
            },
            callbacks: {
                onProgress: (progress, fileInfo) => {
                    fileProgressMap.set(fileInfo.path, progress.percentage);
                    updateStats();
                    // 每 25% 记录一次进度
                    if (progress.percentage % 25 === 0 || progress.percentage === 100) {
                        log(`进度: ${fileInfo.path} - ${progress.percentage}% (${(progress.loaded / 1024).toFixed(2)} KB / ${(progress.total / 1024).toFixed(2)} KB)`, 'progress');
                    }
                },
                onSuccess: async (response, fileInfo) => {
                    // 避免重复处理
                    if (completedFiles.has(fileInfo.path)) {
                        return;
                    }
                    const contentType = response.headers.get('content-type') || 'unknown';
                    const size = fileInfo.size || 0;
                    log(`✅ 成功加载: ${fileInfo.path} (${contentType}, ${(size / 1024).toFixed(2)} KB)`, 'success');
                    updateFileItem(fileInfo.path, 'success', 100);
                    // 注意：统计信息由 onTaskProgress 回调统一管理，这里只更新 UI
                },
                onError: (error, fileInfo) => {
                    // 避免重复处理
                    if (completedFiles.has(fileInfo.path)) {
                        return;
                    }
                    log(`❌ 加载失败: ${fileInfo.path} - ${error.message}`, 'error');
                    updateFileItem(fileInfo.path, 'error');
                    // 注意：统计信息由 onTaskProgress 回调统一管理，这里只更新 UI
                },
                onEnd: async (response, fileInfo) => {
                    log(`✨ 完成: ${fileInfo.path}`, 'info');
                },
            },
        });
        totalFiles = result.results.length;
        updateStats();
        log(`\n📊 加载完成！`, 'info');
        log(`总文件数: ${result.results.length}`, 'info');
        log(`成功: ${result.successCount}`, 'success');
        log(`失败: ${result.failureCount}`, result.failureCount > 0 ? 'error' : 'info');
    }
    catch (error) {
        log(`❌ 加载过程中发生错误: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
    finally {
        isLoading = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
    }
}
// 停止加载
function stopLoading() {
    if (!isLoading)
        return;
    if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
    }
    log('⏹️ 已停止加载', 'info');
    isLoading = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
}
// 事件监听
startBtn.addEventListener('click', startLoading);
stopBtn.addEventListener('click', stopLoading);
clearBtn.addEventListener('click', () => {
    window.clearLogs();
});
// 初始化
log('🚀 测试页面已就绪，可以开始测试了！', 'info');
log('💡 提示：修改配置后点击"开始加载"按钮', 'info');
