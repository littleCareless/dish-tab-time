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