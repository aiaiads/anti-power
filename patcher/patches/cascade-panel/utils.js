/**
 * Cascade Panel 工具函数模块
 *
 * 本模块提供补丁使用的通用工具函数，包括：
 * - 动态资源加载（脚本、样式）
 * - 剪贴板操作
 * - DOM 辅助函数
 *
 * 资源加载采用 Promise 缓存机制，避免重复请求同一资源。
 */

import { MATH_ATTR, RAW_TEXT_PROP } from './constants.js';

const stylePromises = new Map();
const scriptPromises = new Map();

const waitForResource = (el, url, cache, label) =>
    new Promise((resolve, reject) => {
        const onLoad = () => {
            el.dataset.cascadeLoaded = '1';
            delete el.dataset.cascadeLoading;
            resolve();
        };
        const onError = () => {
            cache.delete(url);
            reject(new Error(`Failed to load ${label}: ${url}`));
        };
        el.addEventListener('load', onLoad, { once: true });
        el.addEventListener('error', onError, { once: true });
    });

/**
 * 动态加载样式表
 *
 * 重复 URL 会复用已有 link，避免重复请求（性能优化）。
 *
 * @param {string} href - 样式表 URL
 * @returns {Promise<void>} 加载完成后 resolve
 */
export const loadStyle = (href) => {
    if (!href) return Promise.reject(new Error('Missing stylesheet URL'));
    if (stylePromises.has(href)) return stylePromises.get(href);

    const existing = document.querySelector(`link[rel="stylesheet"][href="${href}"]`);
    if (existing) {
        if (existing.dataset.cascadeLoaded === '1') return Promise.resolve();
        if (existing.dataset.cascadeLoading === '1') {
            const promise = waitForResource(existing, href, stylePromises, 'stylesheet');
            stylePromises.set(href, promise);
            return promise;
        }
        return Promise.resolve();
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.crossOrigin = 'anonymous';
    link.referrerPolicy = 'no-referrer';
    link.dataset.cascadeLoading = '1';

    const promise = waitForResource(link, href, stylePromises, 'stylesheet');
    stylePromises.set(href, promise);
    document.head.appendChild(link);
    return promise;
};

/**
 * 动态加载脚本
 *
 * 重复 URL 会复用已有 script，避免重复请求（性能优化）。
 *
 * @param {string} src - 脚本 URL
 * @returns {Promise<void>} 加载完成后 resolve
 */
export const loadScript = (src) => {
    if (!src) return Promise.reject(new Error('Missing script URL'));
    if (scriptPromises.has(src)) return scriptPromises.get(src);

    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
        if (existing.dataset.cascadeLoaded === '1') return Promise.resolve();
        if (existing.dataset.cascadeLoading === '1') {
            const promise = waitForResource(existing, src, scriptPromises, 'script');
            scriptPromises.set(src, promise);
            return promise;
        }
        return Promise.resolve();
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.referrerPolicy = 'no-referrer';
    script.dataset.cascadeLoading = '1';

    const promise = waitForResource(script, src, scriptPromises, 'script');
    scriptPromises.set(src, promise);
    document.head.appendChild(script);
    return promise;
};

/**
 * 判断元素是否位于可编辑上下文中
 *
 * 仅检查最近的可编辑祖先，避免误伤输入区域。
 *
 * @param {Element} el - 目标元素
 * @returns {boolean} true 表示应跳过处理
 */
export const isEditable = (el) =>
    !!el.closest('[contenteditable="true"], textarea, input');

/**
 * 安全读取 className
 *
 * 兼容 SVGAnimatedString 类型。
 *
 * @param {Element} el - 目标元素
 * @returns {string} 类名字符串
 */
export const getClassString = (el) => {
    const className = el?.className || '';
    if (typeof className === 'string') return className;
    if (className && typeof className.baseVal === 'string') return className.baseVal;
    return '';
};

/**
 * 写入剪贴板
 *
 * 优先使用 Clipboard API，失败则降级到 execCommand。
 * 无文本直接返回 false；部分浏览器可能要求用户手势。
 *
 * @param {string} text - 待写入的文本
 * @returns {Promise<boolean>} true 表示成功写入
 */
export const writeClipboard = async (text) => {
    if (!text) return false;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // 降级到 execCommand
        }
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textArea);
    return ok;
};

/**
 * 捕获原始文本
 *
 * 避免数学渲染后丢失原始内容。
 * 已标记为数学渲染时不重复写入，避免覆盖原始文本。
 *
 * @param {Element} contentEl - 内容元素
 * @returns {void}
 */
export const captureRawText = (contentEl) => {
    if (!contentEl) return;
    if (contentEl.getAttribute(MATH_ATTR) === '1') return;
    const raw = contentEl.innerText !== undefined
        ? contentEl.innerText
        : contentEl.textContent ?? '';
    contentEl[RAW_TEXT_PROP] = raw;
};
