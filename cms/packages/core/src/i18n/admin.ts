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
  'Copy Code': '复制代码',
  'Submit': '提交',
  'Select': '选择',
  'Add': '添加',
  'Add Field': '添加字段',
  'Remove': '移除',
  'Move up': '上移',
  'Move down': '下移',
  'Drag to reorder': '拖动排序',
  'Dismiss': '忽略',
  'Retry': '重试',
  'Refresh': '刷新',
  'Loading': '加载中',
  'Saving': '保存中',
  'Show more': '展开',
  'Show less': '收起',
  'Enable': '启用',
  'Disable': '停用',
  'Active': '启用',
  'Inactive': '停用',
  'Enabled': '已启用',
  'Disabled': '已停用',
  'Pending': '待处理',
  'Approved': '已通过',
  'Rejected': '已拒绝',
  'Archived': '已归档',
  'Under Review': '审核中',
  'All Status': '全部状态',
  'All Categories': '全部分类',
  'All Collections': '全部集合',
  'Yes': '是',
  'No': '否',
  'None': '无',
  'Unknown': '未知',
  'Per page:': '每页：',
  'Pagination': '分页',
  'Sort Order': '排序',
  'Order': '顺序',
  'Position': '位置',
  'Action': '操作',
  'Category': '分类',
  'Categories': '分类',
  'Tags': '标签',
  'Excerpt': '摘要',
  'Body': '正文',
  'Image': '图片',
  'File': '文件',
  'Files': '文件',
  'Timestamp': '时间',
  'Total': '总计',
  'Results': '结果',
  'No data': '暂无数据',
  'No items': '暂无条目',
  'No fields defined': '尚未定义字段',
  'User': '用户',
  'Role': '角色',
  'Username': '用户名',
  'Bio': '简介',
  'Account': '账号',
  'Go to Login': '前往登录',
  'Permission': '权限',
  'Permissions': '权限',
  'Session': '会话',
  'Security': '安全',
  'Storage': '存储',
  'Activity Logs': '活动日志',
  'Site': '站点',
  'Domain': '域名',
  'Domains': '域名',
  'Deploy mode': '部署方式',
  'Provider': '服务商',
  'Build': '构建',
  'Deploy': '部署',
  'Form': '表单',
  'Notifications': '通知',
  'Email notifications': '邮件通知',
  'Collection': '集合',
  'Collection Fields': '集合字段',
  'Field Label': '字段名称',
  'Field Type': '字段类型',
  'Form Schema (JSON)': '表单结构（JSON）',
  'API Tokens': '接口令牌',
  'Warning': '警告',
  'Error': '错误',
  'Success': '成功',
  'Info': '提示',
  'Error:': '错误：',
  'Invalid': '无效',
  'Required': '必填',
  'Optional': '可选',
  'Read more': '了解更多',
  'Learn more': '了解更多',
  'Getting Started': '快速开始',
  'Documentation': '文档',
  'Basic Information': '基本信息',
  'Basics': '基础',
  'Advanced': '高级',
  'Introduction': '简介',
  'Overview': '概览',
  'Details': '详情',
  'Summary': '摘要',
  'Metadata': '元数据',
  'Debug': '调试',
  'Validation': '校验',
  'Conditional Logic': '条件逻辑',
  'Tabs': '标签页',
  'Panel': '面板',
  'Cards': '卡片',
  'Badges': '徽章',
  'Alerts': '提示',
  'Tables': '表格',
  'Checkboxes': '复选框',
  'Buttons': '按钮',
  'Typography': '排版',
  'Primary': '主要',
  'Secondary': '次要',
  'New Content': '新建内容',
  'Edit Content': '编辑内容',
  'Delete Content': '删除内容',
  'Create Content': '新建内容',
  'Content Type': '内容类型',
  'Publish Date': '发布日期',
  'Meta Description': 'Meta 描述',
  'Meta Title': 'Meta 标题',
  'Featured Image': '特色图片',
  'Version History': '版本历史',
  'Error loading version history': '加载版本历史失败',
  'Save Draft': '保存草稿',
  'Publish Now': '立即发布',
  'Schedule Publish': '定时发布',
  'Are you sure': '确定吗',
  'Delete this item?': '删除这一项？',
  'Form not found': '未找到表单',
  'Invalid Invitation': '邀请链接无效',
  'Invalid Reset Link': '重置链接无效',
  'Survey': '问卷',
  'Contact': '联系',
  'Registration': '注册',
  'Feedback': '反馈',
  'Newsletter Preferences': '订阅偏好',
  'Weekly Digest': '每周摘要',
  'Privacy Settings': '隐私设置',
  'Discoverability': '可发现性',
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
  OpenAPI: 'OpenAPI',
  Database: '数据库',
  'Up to date': '已是最新',
  'Sync': '同步',
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
