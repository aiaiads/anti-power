/**
 * Vite 配置文件
 *
 * 配置 Tauri 开发环境，包括:
 * - Vue 插件
 * - 开发服务器设置
 * - HMR 热更新配置
 */

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// @ts-expect-error process 是 Node.js 全局变量
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [vue()],

  // Tauri 开发/构建专用选项
  // 1. 防止 Vite 覆盖 Rust 错误信息
  clearScreen: false,

  // 2. 开发服务器配置
  server: {
    // 固定端口
    port: 5173,
    strictPort: false,
    // Tauri 远程开发主机
    host: host || false,
    // HMR 配置
    hmr: host
      ? {
        protocol: "ws",
        host,
        port: 1421,
      }
      : undefined,
    watch: {
      // 3. 忽略 src-tauri 目录的变更
      ignored: ["**/src-tauri/**"],
    },
  },
}));
