import { TabTimeRecord, DailyTimeStats, WebsiteLimitConfig, LimitStatus } from '../src/types'

/**
 * 获取当前日期字符串（YYYY-MM-DD格式）
 */
function getCurrentDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 从URL中提取域名
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch (e) {
    return ''
  }
}

export default defineBackground(() => {
  console.log('浏览时间追踪扩展已启动', { id: browser.runtime.id })

  // 存储被阻止的域名列表
  let blockedDomains: string[] = []

  // 声明式网络请求规则ID
  const BLOCK_RULE_ID = 1

  // 存储当前活跃标签的信息
  let activeTabInfo: {
    id: number | null
    url: string
    title: string
    lastActiveTime: number
    limitStatus?: LimitStatus
  } = {
    id: null,
    url: '',
    title: '',
    lastActiveTime: 0
  }

  // 网站限制配置的存储键
  const WEBSITE_LIMITS_KEY = 'website_limits'

  /**
   * 获取网站的使用限制配置
   */
  async function getWebsiteLimits(): Promise<WebsiteLimitConfig[]> {
    const result = await browser.storage.local.get(WEBSITE_LIMITS_KEY)
    return result[WEBSITE_LIMITS_KEY] || []
  }

  /**
   * 保存网站的使用限制配置
   */
  async function saveWebsiteLimits(limits: WebsiteLimitConfig[]): Promise<void> {
    await browser.storage.local.set({ [WEBSITE_LIMITS_KEY]: limits })
  }

  /**
   * 检查域名是否匹配指定的模式
   * 支持几种匹配模式：
   * 1. 精确匹配: "example.com"
   * 2. 子域名通配符: "*.example.com"
   * 3. 全通配符: "*example*"
   * 4. 正则表达式: "/^(www\.)?example\.com$/"
   */
  function isDomainMatched(domain: string, pattern: string): boolean {
    // 如果模式以/开头和结尾，视为正则表达式
    if (pattern.startsWith('/') && pattern.endsWith('/')) {
      try {
        const regex = new RegExp(pattern.substring(1, pattern.length - 1));
        return regex.test(domain);
      } catch (e) {
        console.error('无效的正则表达式:', pattern, e);
        return false;
      }
    }
    
    // 子域名通配符匹配
    if (pattern.startsWith('*.')) {
      const suffix = pattern.substring(2);
      return domain === suffix || domain.endsWith('.' + suffix);
    }
    
    // 全通配符匹配
    if (pattern.includes('*')) {
      const escapedPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
      return new RegExp(`^${escapedPattern}$`).test(domain);
    }
    
    // 精确匹配
    return domain === pattern;
  }

  /**
   * 获取指定域名的使用限制配置
   */
  async function getDomainLimit(domain: string): Promise<WebsiteLimitConfig | null> {
    const limits = await getWebsiteLimits();
    return limits.find(limit => {
      // 检查是否启用
      if (!limit.enabled) return false;
      
      // 如果有匹配模式字段，使用匹配模式进行匹配
      if (limit.matchPattern) {
        return isDomainMatched(domain, limit.matchPattern);
      }
      
      // 向后兼容：如果没有匹配模式，使用域名精确匹配
      return limit.domain === domain;
    }) || null;
  }

  /**
   * 临时解除网站限制
   * @param domain 域名
   * @param minutes 解除时间（分钟）
   */
  async function temporaryUnlockDomain(domain: string, minutes: number): Promise<void> {
    const limits = await getWebsiteLimits()
    const limitIndex = limits.findIndex(limit => limit.domain === domain)

    if (limitIndex >= 0) {
      limits[limitIndex].temporaryUnlockUntil = Date.now() + minutes * 60 * 1000
      await saveWebsiteLimits(limits)

      // 从阻止列表中移除域名
      await removeBlockedDomain(domain)
    }
  }

  /**
   * 检查域名是否超过使用限制
   * @returns 限制状态
   */
  async function checkDomainLimit(domain: string, todayTimeSpent: number): Promise<LimitStatus> {
    const limit = await getDomainLimit(domain)

    if (!limit) {
      return LimitStatus.NORMAL
    }

    // 检查是否处于临时解除限制状态
    if (limit.temporaryUnlockUntil && limit.temporaryUnlockUntil > Date.now()) {
      return LimitStatus.NORMAL
    }

    // 获取当前是工作日还是周末
    const now = new Date()
    const dayOfWeek = now.getDay() // 0是周日，6是周六
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    // 根据工作日/周末确定使用限制
    let dailyLimit = limit.dailyLimit
    if (isWeekend && limit.weekendLimit !== undefined) {
      dailyLimit = limit.weekendLimit
    } else if (!isWeekend && limit.workdayLimit !== undefined) {
      dailyLimit = limit.workdayLimit
    }

    // 检查是否超过限制
    // 如果限制时间为0，则始终阻止访问
    if (dailyLimit === 0) {
      return LimitStatus.BLOCKED
    } else if (todayTimeSpent >= dailyLimit) {
      return LimitStatus.BLOCKED
    } else if (todayTimeSpent >= dailyLimit * 0.8) {
      return LimitStatus.WARNING
    }

    return LimitStatus.NORMAL
  }

  /**
   * 更新声明式网络请求规则
   * 用于拦截被限制的网站并重定向到阻止页面
   */
  async function updateBlockRules(): Promise<void> {
    // 获取所有被阻止的域名
    const rules = blockedDomains.map(domain => ({
      id: BLOCK_RULE_ID,
      priority: 1,
      action: {
        type: browser.declarativeNetRequest.RuleActionType.REDIRECT,
        redirect: {
          // src/block/index.html?domain=${domain}
          url: browser.runtime.getURL(``)
        }
      },
      condition: {
        urlFilter: `*://${domain}/*`,
        resourceTypes: [browser.declarativeNetRequest.ResourceType.MAIN_FRAME]
      }
    }))

    // 更新规则
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [BLOCK_RULE_ID],
      addRules: rules.length > 0 ? [rules[0]] : []
    })
  }

  /**
   * 添加域名到阻止列表
   */
  async function addBlockedDomain(domain: string): Promise<void> {
    if (!blockedDomains.includes(domain)) {
      blockedDomains.push(domain)
      await updateBlockRules()
    }
  }

  /**
   * 从阻止列表中移除域名
   */
  async function removeBlockedDomain(domain: string): Promise<void> {
    blockedDomains = blockedDomains.filter(d => d !== domain)
    await updateBlockRules()
  }

  /**
   * 显示限制提醒或阻止页面
   */
  async function showLimitNotification(domain: string, status: LimitStatus): Promise<void> {
    const limits = await getWebsiteLimits()
    const limitIndex = limits.findIndex(limit => limit.domain === domain)

    if (limitIndex < 0) return

    const limit = limits[limitIndex]
    const currentTime = Date.now()

    // 避免频繁显示通知，设置最小间隔（5分钟）
    if (limit.lastNotificationTime && (currentTime - limit.lastNotificationTime < 5 * 60 * 1000)) {
      return
    }

    // 更新最后通知时间
    limits[limitIndex].lastNotificationTime = currentTime
    await saveWebsiteLimits(limits)

    if (status === LimitStatus.WARNING) {
      // 显示警告通知
      browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL(''),
        title: '网站使用时间提醒',
        message: `您已接近 ${domain} 的每日使用限制`
      })
    } else if (status === LimitStatus.BLOCKED) {
      // 显示已阻止通知
      browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL(''),
        title: '网站使用时间已达限制',
        message: `您已达到 ${domain} 的每日使用限制`
      })

      // 添加到阻止列表，使用声明式网络请求API拦截
      await addBlockedDomain(domain)

      // 如果当前标签页是该域名，则重定向到阻止页面
      if (activeTabInfo.id && extractDomain(activeTabInfo.url) === domain) {
        console.log('当前标签页已被阻止:', activeTabInfo.url)
        
        // const blockPageUrl = browser.runtime.getURL('src/block/index.html') + `?domain=${domain}`
        browser.tabs.update(activeTabInfo.id, { url: 'https://www.google.com' })
      }
    }
  }

  /**
   * 更新标签页使用时间记录
   */
  async function updateTabTimeRecord() {
    if (!activeTabInfo.id || !activeTabInfo.url || activeTabInfo.url.startsWith('chrome://') || activeTabInfo.url.startsWith('edge://') || activeTabInfo.url.startsWith('about:')) {
      return
    }

    const currentTime = Date.now()
    const timeSpent = currentTime - activeTabInfo.lastActiveTime

    // 只有当时间差大于0且小于一个合理值（例如1小时）时才记录
    // 这可以防止因为浏览器休眠等原因导致的不合理时间记录
    if (timeSpent <= 0 || timeSpent > 3600000) {
      activeTabInfo.lastActiveTime = currentTime
      return
    }

    const date = getCurrentDateString()
    const domain = extractDomain(activeTabInfo.url)
    const currentHour = new Date().getHours()

    // 从存储中获取当前日期的记录
    const storageKey = `tab_time_${date}`
    const hourlyStatsKey = `hourly_stats_${date}`
    const result = await browser.storage.local.get([storageKey, hourlyStatsKey])
    let dailyRecords: TabTimeRecord[] = result[storageKey] || []

    // 获取小时统计数据
    let hourlyStats: { hour: number, timeSpent: number }[] = result[hourlyStatsKey] || []

    // 查找是否已有该URL的记录
    const existingRecordIndex = dailyRecords.findIndex(record => record.url === activeTabInfo.url)

    if (existingRecordIndex >= 0) {
      // 更新现有记录
      dailyRecords[existingRecordIndex].timeSpent += timeSpent
      dailyRecords[existingRecordIndex].lastActiveTimestamp = currentTime
      if (activeTabInfo.title && dailyRecords[existingRecordIndex].title !== activeTabInfo.title) {
        dailyRecords[existingRecordIndex].title = activeTabInfo.title
      }
    } else {
      // 创建新记录
      dailyRecords.push({
        url: activeTabInfo.url,
        title: activeTabInfo.title,
        domain,
        timeSpent,
        date,
        lastActiveTimestamp: currentTime
      })
    }

    // 更新小时统计数据
    const hourIndex = hourlyStats.findIndex(stat => stat.hour === currentHour)
    if (hourIndex >= 0) {
      hourlyStats[hourIndex].timeSpent += timeSpent
    } else {
      hourlyStats.push({
        hour: currentHour,
        timeSpent: timeSpent
      })
    }

    // 保存更新后的记录
    await browser.storage.local.set({
      [storageKey]: dailyRecords,
      [hourlyStatsKey]: hourlyStats
    })

    // 检查网站使用限制
    if (domain) {
      // 计算今天该域名的总使用时间
      const domainRecords = dailyRecords.filter(record => record.domain === domain)
      const todayTimeSpent = domainRecords.reduce((total, record) => total + record.timeSpent, 0)

      // 检查是否超过限制
      const limitStatus = await checkDomainLimit(domain, todayTimeSpent)

      // 如果状态发生变化，显示相应通知
      if (limitStatus !== activeTabInfo.limitStatus) {
        activeTabInfo.limitStatus = limitStatus

        if (limitStatus !== LimitStatus.NORMAL) {
          await showLimitNotification(domain, limitStatus)
        }
      }
    }

    // 更新最后活跃时间
    activeTabInfo.lastActiveTime = currentTime
  }

  /**
   * 处理标签页激活事件
   */
  async function handleTabActivated(activeInfo: { tabId: number }) {
    // 先保存之前标签页的使用时间
    await updateTabTimeRecord()

    try {
      const tab = await browser.tabs.get(activeInfo.tabId)
      if (tab.url) {
        activeTabInfo = {
          id: tab.id ?? null,
          url: tab.url,
          title: tab.title || '',
          lastActiveTime: Date.now()
        }
      }
    } catch (error) {
      console.error('获取标签页信息失败:', error)
    }
  }

  /**
   * 处理标签页更新事件
   */
  async function handleTabUpdated(tabId: number, changeInfo: { url?: string, title?: string }, tab: Browser.tabs.Tab) {
    // 如果当前活跃标签就是被更新的标签
    if (activeTabInfo.id === tabId) {
      // 如果URL发生变化，先保存之前URL的使用时间
      if (changeInfo.url && changeInfo.url !== activeTabInfo.url) {
        await updateTabTimeRecord()
        activeTabInfo.url = changeInfo.url
        activeTabInfo.lastActiveTime = Date.now()
      }

      // 更新标题
      if (changeInfo.title) {
        activeTabInfo.title = changeInfo.title
      }
    }
  }

  // 定期保存活跃标签的使用时间（每30秒）
  setInterval(updateTabTimeRecord, 30000)

  // 监听标签页激活事件
  browser.tabs.onActivated.addListener(handleTabActivated)

  // 监听标签页更新事件
  browser.tabs.onUpdated.addListener(handleTabUpdated)

  // 监听窗口焦点变化事件
  browser.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === browser.windows.WINDOW_ID_NONE) {
      // 浏览器失去焦点，保存当前标签页的使用时间
      await updateTabTimeRecord()
    } else {
      // 浏览器获得焦点，更新当前活跃标签
      try {
        const tabs = await browser.tabs.query({ active: true, windowId })
        if (tabs.length > 0 && tabs[0].id && tabs[0].url) {
          activeTabInfo = {
            id: tabs[0].id ?? null,
            url: tabs[0].url,
            title: tabs[0].title || '',
            lastActiveTime: Date.now()
          }
        }
      } catch (error) {
        console.error('获取当前标签页信息失败:', error)
      }
    }
  })

  // 监听扩展图标点击事件
  browser.action.onClicked.addListener((tab) => {
    // 打开侧边栏
    browser.sidePanel.open({
      tabId: tab.id!,
      // path: 'src/sidebar/index.html'
    })
  })

  // 监听来自阻止页面的消息
  browser.runtime.onMessage.addListener(async (message, sender) => {
    if (message.type === 'temporaryUnlock') {
      const { domain, minutes } = message
      if (domain && minutes) {
        await temporaryUnlockDomain(domain, minutes)

        // 如果消息来自阻止页面，则重定向回原始网站
        if (sender.tab && sender.tab.id) {
          const url = `https://${domain}`
          browser.tabs.update(sender.tab.id, { url })
        }
      }
    }
  })

  // 初始化声明式网络请求权限
  browser.permissions.contains({ permissions: ['declarativeNetRequest'] })
    .then(hasPermission => {
      if (hasPermission) {
        console.log('已获得声明式网络请求权限')
      } else {
        console.warn('未获得声明式网络请求权限，网站限制功能可能无法正常工作')
      }
    })

  // 在扩展启动时清除所有阻止规则
  browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [BLOCK_RULE_ID],
    addRules: []
  }).catch(error => {
    console.error('清除阻止规则失败:', error)
  })
})
