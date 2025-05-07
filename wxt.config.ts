import { defineConfig } from 'wxt'

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'TabTime: Tab Usage Analytics',
    description: 'Track and analyze your browser tab usage time, just like iOS Screen Time.',
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
      "default_title": "TabTime"
    },
  },
  modules: ['@wxt-dev/module-react'],
})
