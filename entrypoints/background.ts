import { TabTimeRecord, DailyTimeStats } from '../src/types'

/**
 * 获取当前日期字符串（YYYY-MM-DD格式）
 */
function getCurrentDateString(): string {
  const now = new Date()
  return now.toISOString().split('T')[0]
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

  // 存储当前活跃标签的信息
  let activeTabInfo: {
    id: number | null
    url: string
    title: string
    lastActiveTime: number
  } = {
    id: null,
    url: '',
    title: '',
    lastActiveTime: 0
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

    // 从存储中获取当前日期的记录
    const storageKey = `tab_time_${date}`
    const result = await browser.storage.local.get(storageKey)
    let dailyRecords: TabTimeRecord[] = result[storageKey] || []

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

    // 保存更新后的记录
    await browser.storage.local.set({ [storageKey]: dailyRecords })

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
  async function handleTabUpdated(tabId: number, changeInfo: { url?: string, title?: string }, tab: browser.tabs.Tab) {
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
})
