/**
 * 国际化配置模块
 * 提供中英文双语支持，自动检测系统语言
 */

import { createI18n } from 'vue-i18n';
import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';

// 从 localStorage 读取保存的语言设置
const savedLocale = localStorage.getItem('anti-power-locale');
// 根据浏览器语言自动检测，中文环境使用中文，其他使用英文
const systemLocale = navigator.language.startsWith('zh') ? 'zh-CN' : 'en-US';

/**
 * Vue I18n 实例
 * 使用 Composition API 模式，支持中英文切换
 */
const i18n = createI18n({
  // 使用 Composition API 模式
  legacy: false,
  // 优先使用保存的语言，否则使用系统语言
  locale: savedLocale || systemLocale,
  // 回退语言为英文
  fallbackLocale: 'en-US',
  // 语言包
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS
  }
});

export default i18n;
