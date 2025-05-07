import { defineConfig } from 'wxt'

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: '浏览时间统计',
    description: '记录并统计浏览器标签页的使用时间，类似于iOS的屏幕使用时间',
    version: '1.0.0',
    permissions: [
      'tabs',
      'storage',
      'activeTab'
    ],
    host_permissions: [
      '<all_urls>'
    ],
    "action": {
      "default_icon": {
        "16": "icon/16.png",
        "32": "icon/32.png",
        "48": "icon/48.png",
        "96": "icon/96.png",
        "128": "icon/128.png"
      },
      "default_title": "浏览时间统计"
    },
  },
  modules: ['@wxt-dev/module-react'],
})
