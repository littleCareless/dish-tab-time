/**
 * 时间统计服务
 * 提供处理和分析标签页使用时间数据的功能
 */

import { TabTimeRecord, DomainTimeStats, DailyTimeStats, type HourlyTimeStats } from '../types'

/**
 * 将毫秒转换为可读的时间格式
 * @param ms 毫秒数
 * @returns 格式化的时间字符串 (例如: "2小时30分钟")
 */
export function formatTimeSpent(ms: number): string {
  if (ms < 1000) return '不到1秒'

  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    const remainingMinutes = minutes % 60
    return `${hours}小时${remainingMinutes > 0 ? ` ${remainingMinutes}分钟` : ''}`
  } else if (minutes > 0) {
    const remainingSeconds = seconds % 60
    return `${minutes}分钟${remainingSeconds > 0 ? ` ${remainingSeconds}秒` : ''}`
  } else {
    return `${seconds}秒`
  }
}

/**
 * 获取指定日期的使用时间记录
 * @param date 日期字符串 (YYYY-MM-DD格式)
 * @returns 标签页使用时间记录数组
 */
export async function getTabTimeRecords(date: string): Promise<TabTimeRecord[]> {
  const storageKey = `tab_time_${date}`
  const result = await browser.storage.local.get(storageKey)
  return result[storageKey] || []
}

/**
 * 获取指定日期的域名使用时间统计
 * @param date 日期字符串 (YYYY-MM-DD格式)
 * @returns 域名使用时间统计数组
 */
export async function getDomainTimeStats(date: string): Promise<DomainTimeStats[]> {
  const records = await getTabTimeRecords(date)

  // 按域名分组并计算总时间
  const domainMap = new Map<string, DomainTimeStats>()

  records.forEach(record => {
    if (!record.domain) return

    if (domainMap.has(record.domain)) {
      const stats = domainMap.get(record.domain)!
      stats.totalTimeSpent += record.timeSpent
      stats.visitCount += 1
    } else {
      domainMap.set(record.domain, {
        domain: record.domain,
        totalTimeSpent: record.timeSpent,
        visitCount: 1
      })
    }
  })

  // 转换为数组并按总时间排序
  return Array.from(domainMap.values())
    .sort((a, b) => b.totalTimeSpent - a.totalTimeSpent)
}

/**
 * 获取指定日期的小时使用时间统计
 * @param date 日期字符串 (YYYY-MM-DD格式)
 * @returns 小时使用时间统计数组
 */
export async function getHourlyTimeStats(date: string): Promise<HourlyTimeStats[]> {
  const hourlyStatsKey = `hourly_stats_${date}`
  const result = await browser.storage.local.get(hourlyStatsKey)
  const hourlyStats = result[hourlyStatsKey] || []

  // 确保24小时都有数据，没有数据的小时设为0
  const completeHourlyStats: HourlyTimeStats[] = []
  for (let hour = 0; hour < 24; hour++) {
    const existingStat = hourlyStats.find((stat: any) => stat.hour === hour)
    if (existingStat) {
      completeHourlyStats.push(existingStat)
    } else {
      completeHourlyStats.push({ hour, timeSpent: 0 })
    }
  }

  return completeHourlyStats
}

/**
 * 获取指定日期的每日使用时间统计
 * @param date 日期字符串 (YYYY-MM-DD格式)
 * @returns 每日使用时间统计对象
 */
export async function getDailyTimeStats(date: string): Promise<DailyTimeStats> {
  const records = await getTabTimeRecords(date)
  const domainStats = await getDomainTimeStats(date)
  const hourlyStats = await getHourlyTimeStats(date)

  // 计算总使用时间
  const totalTimeSpent = records.reduce((total, record) => total + record.timeSpent, 0)

  return {
    date,
    totalTimeSpent,
    domainStats,
    hourlyStats
  }
}

/**
 * 获取最近几天的使用时间统计
 * @param days 天数
 * @returns 每日使用时间统计数组
 */
export async function getRecentDaysStats(days: number = 7): Promise<DailyTimeStats[]> {
  const result: DailyTimeStats[] = []
  const today = new Date()

  for (let i = 0; i < days; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    const dateString = date.toISOString().split('T')[0]

    const stats = await getDailyTimeStats(dateString)
    result.push(stats)
  }

  return result
}