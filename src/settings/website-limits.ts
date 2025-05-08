/**
 * 网站使用限制设置组件
 */

import { WebsiteLimitConfig, LimitStatus } from '../types'

// 网站限制配置的存储键
const WEBSITE_LIMITS_KEY = 'website_limits'

/**
 * 获取所有网站限制配置
 */
export async function getWebsiteLimits(): Promise<WebsiteLimitConfig[]> {
  const result = await browser.storage.local.get(WEBSITE_LIMITS_KEY)
  const limits = result[WEBSITE_LIMITS_KEY] || []

  // 确保所有配置都有matchPattern字段（向后兼容）
  return limits.map((limit: any) => ({
    ...limit,
    matchPattern: limit.matchPattern || ''
  }))
}

/**
 * 保存网站限制配置
 */
export async function saveWebsiteLimits(limits: WebsiteLimitConfig[]): Promise<void> {
  await browser.storage.local.set({ [WEBSITE_LIMITS_KEY]: limits })
}

/**
 * 添加或更新网站限制配置
 */
export async function addOrUpdateWebsiteLimit(limit: WebsiteLimitConfig): Promise<void> {
  const limits = await getWebsiteLimits()
  const existingIndex = limits.findIndex(item => item.domain === limit.domain)

  if (existingIndex >= 0) {
    limits[existingIndex] = { ...limits[existingIndex], ...limit }
  } else {
    limits.push(limit)
  }

  await saveWebsiteLimits(limits)
}

/**
 * 删除网站限制配置
 */
export async function deleteWebsiteLimit(domain: string): Promise<void> {
  const limits = await getWebsiteLimits()
  const newLimits = limits.filter(item => item.domain !== domain)
  await saveWebsiteLimits(newLimits)
}

/**
 * 启用或禁用网站限制
 */
export async function toggleWebsiteLimit(domain: string, enabled: boolean): Promise<void> {
  const limits = await getWebsiteLimits()
  const existingIndex = limits.findIndex(item => item.domain === domain)

  if (existingIndex >= 0) {
    limits[existingIndex].enabled = enabled
    await saveWebsiteLimits(limits)
  }
}

/**
 * 将毫秒转换为可读的时间格式（小时和分钟）
 */
export function formatTimeLimit(milliseconds: number): string {
  if (milliseconds === 0) {
    return '已禁止访问'
  }

  const hours = Math.floor(milliseconds / (1000 * 60 * 60))
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return `${hours}小时${minutes > 0 ? ` ${minutes}分钟` : ''}`
  }
  return `${minutes}分钟`
}

/**
 * 将小时和分钟转换为毫秒
 */
export function timeToMilliseconds(hours: number, minutes: number): number {
  return (hours * 60 * 60 + minutes * 60) * 1000
}

/**
 * 获取限制状态的显示文本
 */
export function getLimitStatusText(status: LimitStatus): string {
  switch (status) {
    case LimitStatus.NORMAL:
      return '正常'
    case LimitStatus.WARNING:
      return '接近限制'
    case LimitStatus.BLOCKED:
      return '已达限制'
    default:
      return '未知'
  }
}