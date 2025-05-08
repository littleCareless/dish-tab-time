/**
 * 标签页使用时间记录的数据结构
 */
export interface TabTimeRecord {
  /** 标签页的URL */
  url: string
  /** 标签页的标题 */
  title: string
  /** 域名 */
  domain: string
  /** 使用时间（毫秒） */
  timeSpent: number
  /** 访问日期（YYYY-MM-DD格式） */
  date: string
  /** 最后活跃时间戳 */
  lastActiveTimestamp: number
}

/**
 * 按域名分组的使用时间统计
 */
export interface DomainTimeStats {
  /** 域名 */
  domain: string
  /** 总使用时间（毫秒） */
  totalTimeSpent: number
  /** 访问次数 */
  visitCount: number
}

/**
 * 小时使用时间统计
 */
export interface HourlyTimeStats {
  /** 小时（0-23） */
  hour: number
  /** 该小时的使用时间（毫秒） */
  timeSpent: number
}

/**
 * 每日使用时间统计
 */
export interface DailyTimeStats {
  /** 日期（YYYY-MM-DD格式） */
  date: string
  /** 总使用时间（毫秒） */
  totalTimeSpent: number
  /** 按域名分组的统计 */
  domainStats: DomainTimeStats[]
  /** 按小时分组的统计 */
  hourlyStats?: HourlyTimeStats[]
}

/**
 * 网站使用限制配置
 */
export interface WebsiteLimitConfig {
  /** 域名 */
  domain: string
  /** 每日使用时间限制（毫秒） */
  dailyLimit: number
  /** 工作日限制（周一至周五）*/
  workdayLimit?: number
  /** 周末限制（周六和周日）*/
  weekendLimit?: number
  /** 是否启用限制 */
  enabled: boolean
  /** 最后一次提醒时间戳 */
  lastNotificationTime?: number
  /** 临时解除限制的结束时间戳 */
  temporaryUnlockUntil?: number
  /** 是否 */
  matchPattern?: string
}

/**
 * 限制状态类型
 */
export enum LimitStatus {
  /** 正常使用 */
  NORMAL = 'normal',
  /** 接近限制 */
  WARNING = 'warning',
  /** 已达到限制 */
  BLOCKED = 'blocked'
}