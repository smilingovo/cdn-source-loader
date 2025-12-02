import { CdnMetaData } from "./types";

/**
 * 从 URL 中提取基础 URL
 * @param url 完整 URL
 * @returns 基础 URL
 */
export function extractBaseUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // 移除 ?meta 查询参数
    urlObj.search = "";
    // 移除末尾的文件路径，保留到包名和版本
    const pathParts = urlObj.pathname.split("/");
    // 找到包含 @ 的部分（包名@版本）
    const packageIndex = pathParts.findIndex((part) => part.includes("@"));
    if (packageIndex !== -1) {
      urlObj.pathname = pathParts.slice(0, packageIndex + 1).join("/");
    }
    return urlObj.toString();
  } catch (error) {
    throw new Error(`Invalid URL: ${url}`);
  }
}

/**
 * 获取元数据
 * @param metaUrl 元数据 URL
 * @returns 元数据对象
 */
export async function fetchMetadata(metaUrl: string): Promise<CdnMetaData> {
  const response = await fetch(metaUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch metadata: ${response.status} ${response.statusText}`
    );
  }
  return await response.json();
}

/**
 * 构建完整的资源 URL
 * @param baseUrl 基础 URL
 * @param filePath 文件路径
 * @returns 完整的资源 URL
 */
export function buildResourceUrl(baseUrl: string, filePath: string): string {
  // 确保 baseUrl 以 / 结尾
  const normalizedBaseUrl = baseUrl.endsWith("/")
    ? baseUrl.slice(0, -1)
    : baseUrl;
  // 确保 filePath 以 / 开头
  const normalizedFilePath = filePath.startsWith("/")
    ? filePath
    : `/${filePath}`;
  return `${normalizedBaseUrl}${normalizedFilePath}`;
}
