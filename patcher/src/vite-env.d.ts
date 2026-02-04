/**
 * Vite 环境类型声明
 *
 * 为 Vue 单文件组件 (.vue) 提供 TypeScript 类型支持
 */

/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  /** Vue 单文件组件类型定义 */
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
