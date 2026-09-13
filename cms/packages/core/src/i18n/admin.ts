/**
 * Admin translations.
 *
 * The admin templates are written in English, so English is the source language and
 * the string itself is the key: `t('Dashboard')`. A locale that has no entry for a
 * key keeps the English one, which means a page can be translated a line at a time
 * and never renders a missing-string placeholder.
 *
 * The locale for a request is resolved once, by `adminMenuMiddleware`, from the
 * `admin_lang` cookie (what the switcher in the header sets) and then from the
 * `language` setting. It is stored module-side because the middleware sets it and
 * the templates read it in the same synchronous pass — the same arrangement the
 * dynamic sidebar menu already uses.
 */

export type AdminLocale = 'en' | 'zh-CN'

export const ADMIN_LANGUAGE_COOKIE = 'admin_lang'

export const ADMIN_LOCALES: Array<{ value: AdminLocale; label: string; short: string }> = [
  { value: 'en', label: 'English', short: 'EN' },
  { value: 'zh-CN', label: '简体中文', short: '中文' }
]

/** Anything Chinese resolves to Simplified Chinese; everything else stays English. */
export const resolveAdminLocale = (value: string | null | undefined): AdminLocale => {
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized === 'zh' || normalized.startsWith('zh-') || normalized.startsWith('zh_')
    ? 'zh-CN'
    : 'en'
}

/** Used when a language lookup cannot find a counterpart (single-locale builds). */
export const ADMIN_LOCALE_FALLBACK: { value: AdminLocale; label: string; short: string } = {
  value: 'en',
  label: 'English',
  short: 'EN'
}

/** The next language in the switcher's cycle. */
export const otherAdminLocale = (locale: AdminLocale): { value: AdminLocale; label: string; short: string } =>
  ADMIN_LOCALES.find((entry) => entry.value !== locale) ?? ADMIN_LOCALE_FALLBACK

let currentLocale: AdminLocale = 'en'

export const setAdminLocale = (locale: AdminLocale): void => {
  currentLocale = locale
}

export const getAdminLocale = (): AdminLocale => currentLocale

const zhCN: Record<string, string> = {
  // Navigation — sections
  Dashboard: '仪表盘',
  Content: '内容',
  Media: '媒体',
  Trash: '回收站',
  Analytics: '分析',
  Workflow: '工作流',
  Users: '用户',
  Collections: '集合',
  Forms: '表单',
  FAQs: '常见问题',
  'Audit Log': '审计日志',
  Sites: '站点',
  Plugins: '插件',
  Cache: '缓存',
  Migrations: '数据库迁移',
  Settings: '设置',
  General: '常规',
  System: '系统',
  Development: '开发',
  'All {name}': '全部{name}',
  'Add New': '新增',
  'Select Collection': '选择集合',
  'Back to Content List': '返回内容列表',
  'No description': '暂无描述',

  // Header and shell
  Search: '搜索',
  'Search…': '搜索…',
  'Search content…': '搜索内容…',
  Profile: '个人资料',
  Logout: '退出登录',
  'Sign out': '退出登录',
  'Toggle dark mode': '切换深色模式',
  'Open navigation': '打开导航',
  'Close navigation': '关闭导航',
  'Developer Docs': '开发文档',
  'API Docs': '接口文档',
  'View all': '查看全部',
  'New content': '新建内容',

  'Sci-Fi CMS Admin': 'Sci-Fi CMS 管理后台',
  'My Profile': '我的资料',
  'Dark Mode': '深色模式',
  'Light Mode': '浅色模式',
  'Sign Out': '退出登录',

  // Dashboard
  'Welcome to your Sci-Fi CMS admin dashboard': '欢迎使用 Sci-Fi CMS 管理后台',
  'Total Collections': '集合总数',
  'Content Items': '内容条目',
  'Media Files': '媒体文件',
  'Active Users': '活跃用户',
  'Last 30 days': '最近 30 天',
  'Recent Activity': '最近动态',
  'No recent activity': '暂无动态',
  'Real-Time Analytics': '实时分析',
  'Requests per second (live)': '每秒请求数（实时）',
  Live: '实时',
  'Manage your content and site settings': '管理内容与站点设置',
  'Quick Actions': '快捷操作',
  'System Status': '系统状态',
  'Storage Usage': '存储用量',

  // Common actions
  New: '新建',
  Create: '创建',
  Edit: '编辑',
  Delete: '删除',
  Save: '保存',
  'Save Changes': '保存更改',
  Cancel: '取消',
  Back: '返回',
  Next: '下一页',
  Previous: '上一页',
  Update: '更新',
  View: '查看',
  Preview: '预览',
  Publish: '发布',
  'Publish immediately': '立即发布',
  Unpublish: '取消发布',
  Duplicate: '复制',
  Restore: '恢复',
  'Delete Forever': '永久删除',
  'Permanently Delete': '永久删除',
  Upload: '上传',
  Download: '下载',
  Copy: '复制',
  'Copied!': '已复制！',
  Apply: '应用',
  Reset: '重置',
  Filter: '筛选',
  Filters: '筛选条件',
  Clear: '清空',
  Close: '关闭',
  Confirm: '确认',
  'Are you sure?': '确定要继续吗？',
  'This action cannot be undone.': '此操作无法撤销。',
  Status: '状态',
  published: '已发布',
  draft: '草稿',
  scheduled: '定时发布',
  deleted: '已删除',
  Published: '已发布',
  Draft: '草稿',
  Scheduled: '定时发布',
  Deleted: '已删除',
  All: '全部',

  // Tables and lists
  Title: '标题',
  Slug: '别名',
  Author: '作者',
  Created: '创建时间',
  'Created At': '创建时间',
  Updated: '更新时间',
  'Updated At': '更新时间',
  Actions: '操作',
  Type: '类型',
  Name: '名称',
  Description: '描述',
  Date: '日期',
  Size: '大小',
  ID: '标识',
  'No results': '没有结果',
  'No content yet': '暂无内容',
  'No items found': '没有找到条目',
  'Showing {from} to {to} of {total}': '显示第 {from} 至 {to} 条，共 {total} 条',
  'of {total}': '共 {total} 条',

  // Authentication
  'Email Address': '邮箱地址',
  'Enter your email': '请输入邮箱',
  'Enter your password': '请输入密码',
  'Create account': '创建账号',
  'Create one here': '立即注册',
  'Sign in instead': '改为登录',
  "Don't have an account?": '还没有账号？',
  'Welcome Back': '欢迎回来',
  'Sign in to your account to continue': '登录后继续',
  'Sign in': '登录',
  'Sign In': '登录',
  Email: '邮箱',
  Password: '密码',
  'Remember me': '记住我',
  'Forgot password?': '忘记密码？',
  'Create Your Account': '创建账号',
  'Already have an account?': '已有账号？',
  Register: '注册',
  'Full name': '姓名',
  'Confirm password': '确认密码',
  'Get started with Sci-Fi CMS': '开始使用 Sci-Fi CMS',

  // Settings
  Language: '语言',
  'Site Name': '站点名称',
  'Site Description': '站点描述',
  Timezone: '时区',
  'Maintenance Mode': '维护模式',
  'Save Settings': '保存设置'
}

/**
 * Translate an admin string. `{name}` placeholders in the translated text are
 * replaced from `vars`, so a sentence can be reordered by the translation.
 */
export const t = (key: string, vars?: Record<string, string | number>): string => {
  const template = currentLocale === 'en' ? key : (zhCN[key] ?? key)
  if (!vars) {
    return template
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    vars[name] === undefined ? match : String(vars[name])
  )
}
