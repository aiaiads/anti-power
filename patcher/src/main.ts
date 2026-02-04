/**
 * Anti-Power Patcher 应用入口
 *
 * 初始化 Vue 应用，配置国际化支持并挂载根组件
 */

import { createApp } from "vue";
import App from "./App.vue";
import i18n from "./i18n";
import "./style.css";

// 创建 Vue 应用实例
const app = createApp(App);

// 配置国际化插件
app.use(i18n);

// 挂载到 DOM
app.mount("#app");
