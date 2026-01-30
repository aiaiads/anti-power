/**
 * Manager Panel 复制功能
 *
 * 本模块提供 Manager 窗口的复制按钮功能，完全独立于 cascade-panel。
 *
 * 主要功能：
 * - 内容区域复制按钮注入
 * - 反馈区域（Good/Bad 按钮旁）复制按钮注入
 * - 格式化内容提取（代码块、表格、Mermaid）
 * - 智能语言检测与 Markdown 转换
 */

import {
    CONTENT_SELECTOR,
    BOUND_ATTR,
    BUTTON_CLASS,
    BOTTOM_BUTTON_CLASS,
    COPY_BTN_CLASS,
    MERMAID_SOURCE_PROP,
    RAW_TEXT_PROP,
} from './constants.js';
import { createCopyButton, copyToClipboard, showCopySuccess } from './utils.js';

const SKIP_TAGS = new Set(['STYLE', 'SCRIPT', 'NOSCRIPT', 'TEMPLATE', 'SVG']);
const BLOCK_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI']);
const COMMON_LANGS = new Set([
    'xml',
    'html',
    'css',
    'javascript',
    'typescript',
    'python',
    'java',
    'json',
    'bash',
    'shell',
    'sql',
    'yaml',
    'markdown',
    'md',
    'go',
    'rust',
    'c',
    'cpp',
    'csharp',
    'php',
    'ruby',
    'swift',
    'kotlin',
]);

/**
 * 获取类名字符串（兼容 SVG）
 * @param {Element} el
 * @returns {string}
 */
const getClassString = (el) => {
    if (!el) return '';
    const className = el.className;
    if (typeof className === 'string') return className;
    if (className && typeof className.baseVal === 'string') return className.baseVal;
    return '';
};

/**
 * 提取表格为 Markdown
 * @param {HTMLTableElement} tableEl
 * @returns {string}
 */
const extractTable = (tableEl) => {
    let markdown = '';
    const rows = tableEl.querySelectorAll('tr');
    rows.forEach((row, rowIdx) => {
        const cells = row.querySelectorAll('th, td');
        const cellContents = [];
        cells.forEach((cell) => {
            let cellText = cell.textContent || '';
            cellText = cellText.trim().replace(/\n/g, ' ').replace(/\|/g, '\\|');
            cellContents.push(cellText);
        });
        markdown += `| ${cellContents.join(' | ')} |\n`;
        if (rowIdx === 0 && row.querySelector('th')) {
            markdown += `| ${cellContents.map(() => '---').join(' | ')} |\n`;
        }
    });
    return markdown;
};

/**
 * 提取代码块内容
 * @param {Element} root
 * @returns {string}
 */
const extractCodeBlock = (root) => {
    const codeRoot = root.classList?.contains('code-block')
        ? root
        : root.querySelector?.('.code-block');

    if (codeRoot) {
        const lines = codeRoot.querySelectorAll('.line-content');
        if (lines.length > 0) {
            return Array.from(lines)
                .map((line) => line.textContent || '')
                .join('\n');
        }
        return codeRoot.textContent || '';
    }

    return root.textContent || '';
};

/**
 * 判断元素是否可见
 * @param {Element} el
 * @returns {boolean}
 */
const isVisibleElement = (el) => {
    if (!el || !el.isConnected) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
};

const normalizeLang = (lang) => {
    if (!lang) return '';
    const lowered = String(lang).trim().toLowerCase();
    if (lowered === 'markdown') return 'md';
    return lowered;
};

const looksLikeMarkdown = (text) => {
    if (!text) return false;
    const lines = text.split(/\r?\n/).map((line) => line.trim());
    const hasTable = lines.some((line) => line.includes('|')) &&
        lines.some((line) => /^(\|?\s*:?-{3,}:?\s*)\|/.test(line));
    const hasHeading = lines.some((line) => /^#{1,6}\s+/.test(line));
    const hasList = lines.some((line) => /^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line));
    return hasTable || hasHeading || hasList;
};

const resolveCodeLanguage = (element, codeText) => {
    const candidates = [
        element,
        element.closest?.('pre') || null,
        element.parentElement,
    ].filter(Boolean);

    for (const target of candidates) {
        const raw =
            target.getAttribute?.('data-language') ||
            target.getAttribute?.('data-lang') ||
            target.getAttribute?.('data-mode') ||
            target.getAttribute?.('data-code-language');
        const normalized = normalizeLang(raw);
        if (normalized) return normalized;
    }

    const pre = element.closest?.('pre') || element;
    const prev = pre?.previousElementSibling;
    if (prev && prev.textContent) {
        const label = normalizeLang(prev.textContent);
        if (label && COMMON_LANGS.has(label)) return label;
    }

    const text = codeText || '';
    if (looksLikeMarkdown(text)) return 'md';

    return '';
};

/**
 * 递归提取节点格式化内容
 * @param {Element} element - 待提取的节点
 * @param {Object} context - 上下文信息
 * @returns {string}
 */
const extractNodeContent = (element, context = {}) => {
    if (!element) return '';

    const classString = getClassString(element);
    const tagName = element.tagName;

    // 跳过不需要处理的元素
    if (SKIP_TAGS.has(tagName)) {
        return '';
    }

    // 跳过复制按钮
    if (
        classString.includes('manager-copy-btn') ||
        classString.includes('manager-copy-button') ||
        classString.includes('manager-copy-bottom') ||
        classString.includes('manager-feedback-copy')
    ) {
        return '';
    }

    // Mermaid 容器：恢复源码
    if (classString.includes('manager-mermaid-container')) {
        const source = element[MERMAID_SOURCE_PROP];
        if (source) {
            return `\n\`\`\`mermaid\n${source}\n\`\`\`\n`;
        }
        return '';
    }

    // 表格处理
    if (tagName === 'TABLE') {
        const table = extractTable(element).trimEnd();
        if (table) {
            return `\n${table}\n`;
        }
        return '';
    }

    // 代码块处理
    if (tagName === 'PRE') {
        // pre.inline 视为内联代码
        if (classString.includes('inline')) {
            const code = element.querySelector('code');
            const text = code ? code.textContent : element.textContent;
            if (!text?.trim()) return '';
            return `\`${text}\``;
        }
        const codeContent = extractCodeBlock(element).trimEnd();
        if (codeContent) {
            const lang = resolveCodeLanguage(element, codeContent);
            const fence = lang ? `\`\`\`${lang}` : '```';
            return `\n${fence}\n${codeContent}\n\`\`\`\n`;
        }
        return '';
    }
    if (classString.includes('code-block')) {
        const code = extractCodeBlock(element).trimEnd();
        if (code) {
            const lang = resolveCodeLanguage(element, code);
            const fence = lang ? `\`\`\`${lang}` : '```';
            return `\n${fence}\n${code}\n\`\`\`\n`;
        }
        return '';
    }

    // 标题处理 (H1-H6)
    if (/^H[1-6]$/.test(tagName)) {
        const level = parseInt(tagName[1], 10);
        const prefix = '#'.repeat(level);
        const content = extractChildrenContent(element, context);
        return `\n${prefix} ${content.trim()}\n`;
    }

    // 加粗处理
    if (tagName === 'STRONG' || tagName === 'B') {
        const content = extractChildrenContent(element, context);
        const trimmed = content.trim();
        if (!trimmed) return '';
        return `**${trimmed}**`;
    }

    // 斜体处理
    if (tagName === 'EM' || tagName === 'I') {
        const content = extractChildrenContent(element, context);
        const trimmed = content.trim();
        if (!trimmed) return '';
        return `*${trimmed}*`;
    }

    // 删除线处理
    if (tagName === 'DEL' || tagName === 'S' || tagName === 'STRIKE') {
        const content = extractChildrenContent(element, context);
        const trimmed = content.trim();
        if (!trimmed) return '';
        return `~~${trimmed}~~`;
    }

    // 行内代码处理
    if (tagName === 'CODE' && !element.closest('pre')) {
        const text = element.textContent || '';
        if (!text.trim()) return '';
        return `\`${text}\``;
    }

    // 链接处理
    if (tagName === 'A') {
        const href = element.getAttribute('href') || '';
        const content = extractChildrenContent(element, context);
        const trimmed = content.trim();
        if (!trimmed) return '';
        if (href && href !== '#' && !href.startsWith('javascript:')) {
            return `[${trimmed}](${href})`;
        }
        return trimmed;
    }

    // 列表项处理
    if (tagName === 'LI') {
        const parent = element.parentElement;

        // 计算嵌套深度：统计祖先中有多少个 UL/OL
        let depth = 0;
        let ancestor = element.parentElement;
        while (ancestor) {
            if (ancestor.tagName === 'UL' || ancestor.tagName === 'OL') {
                depth++;
            }
            ancestor = ancestor.parentElement;
        }
        // depth 至少为 1（当前所在的列表），缩进层级 = depth - 1
        const indent = '  '.repeat(Math.max(0, depth - 1));

        // 分开处理：文本内容 vs 嵌套列表
        let textContent = '';
        let nestedListContent = '';

        for (const child of element.childNodes) {
            if (child.nodeType === Node.ELEMENT_NODE) {
                const childTag = child.tagName;
                if (childTag === 'UL' || childTag === 'OL') {
                    // 嵌套列表单独处理
                    nestedListContent += extractNodeContent(child, context);
                } else {
                    textContent += extractNodeContent(child, context);
                }
            } else if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent || '';
                // 跳过不需要的文本
                const parentEl = child.parentElement;
                if (parentEl?.closest('style, script, noscript, template')) {
                    continue;
                }
                if (parentEl?.closest('.manager-copy-btn, .manager-copy-button, .manager-feedback-copy')) {
                    continue;
                }
                if (parentEl?.closest('.code-block, pre')) {
                    continue;
                }
                textContent += text;
            }
        }

        const trimmedText = textContent.trim();
        if (!trimmedText && !nestedListContent) return '';

        // 构建列表项前缀
        let prefix;
        if (parent?.tagName === 'OL') {
            const items = Array.from(parent.children).filter(c => c.tagName === 'LI');
            const index = items.indexOf(element) + 1;
            prefix = `${indent}${index}. `;
        } else {
            prefix = `${indent}- `;
        }

        // 组合结果：文本 + 换行 + 嵌套列表
        if (nestedListContent) {
            return `${prefix}${trimmedText}\n${nestedListContent}`;
        } else {
            return `${prefix}${trimmedText}\n`;
        }
    }

    // 列表容器：嵌套列表不额外添加换行
    if (tagName === 'UL' || tagName === 'OL') {
        // 检查是否是顶级列表（父元素不是 LI）
        const isTopLevel = !element.parentElement?.closest('li');
        const content = extractChildrenContent(element, context);
        return isTopLevel ? `\n${content}` : content;
    }

    // 段落处理
    if (tagName === 'P') {
        const content = extractChildrenContent(element, context);
        const trimmed = content.trim();
        if (!trimmed) return '';
        return `\n${trimmed}\n`;
    }

    // 换行处理
    if (tagName === 'BR') {
        return '\n';
    }

    // 块引用处理
    if (tagName === 'BLOCKQUOTE') {
        const content = extractChildrenContent(element, context);
        const lines = content.trim().split('\n');
        const quoted = lines.map(line => `> ${line}`).join('\n');
        return `\n${quoted}\n`;
    }

    // 水平线
    if (tagName === 'HR') {
        return '\n---\n';
    }

    // DIV 和 其他块级元素
    if (tagName === 'DIV' || tagName === 'SECTION' || tagName === 'ARTICLE') {
        const content = extractChildrenContent(element, context);
        return content;
    }

    // 默认：递归处理子节点
    return extractChildrenContent(element, context);
};

/**
 * 提取元素所有子节点的内容
 * @param {Element} element
 * @param {Object} context
 * @returns {string}
 */
const extractChildrenContent = (element, context = {}) => {
    let result = '';

    for (const child of element.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
            const parent = child.parentElement;
            if (!parent) continue;

            const text = child.textContent || '';
            if (!text.trim()) {
                if (text.includes('\n')) {
                    continue;
                }
                if (result && !result.endsWith(' ') && !result.endsWith('\n')) {
                    result += ' ';
                }
                continue;
            }

            if (parent.closest('style, script, noscript, template')) {
                continue;
            }
            if (parent.closest('.manager-copy-btn, .manager-copy-button, .manager-feedback-copy')) {
                continue;
            }
            if (parent.closest('.code-block, pre')) {
                continue;
            }

            result += text;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
            result += extractNodeContent(child, context);
        }
    }

    return result;
};

/**
 * 提取内容区的格式化文本（支持 Markdown 格式元素）
 * @param {HTMLElement} el
 * @returns {string}
 */
const extractFormattedText = (el) => {
    if (!el) return '';

    const result = extractNodeContent(el, {});

    // 清理多余的空行，保持格式整洁
    return result
        .replace(/\n{3,}/g, '\n\n')  // 最多保留两个连续换行
        .trim();
};

/**
 * 为内容区添加复制按钮
 * @param {HTMLElement} contentEl
 */
export const ensureContentCopyButton = (contentEl) => {
    if (!contentEl || contentEl.getAttribute(BOUND_ATTR) === '1') return;

    if (contentEl[RAW_TEXT_PROP] === undefined) {
        const raw = contentEl.innerText !== undefined
            ? contentEl.innerText
            : contentEl.textContent || '';
        contentEl[RAW_TEXT_PROP] = raw;
    }

    contentEl.setAttribute(BOUND_ATTR, '1');

    // 确保容器有相对定位
    const style = window.getComputedStyle(contentEl);
    if (style.position === 'static') {
        contentEl.style.position = 'relative';
    }

    // 右上角按钮（悬停显示）
    const btn = createCopyButton(`${COPY_BTN_CLASS} ${BUTTON_CLASS}`);
    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const text = extractFormattedText(contentEl);
        const success = await copyToClipboard(text);
        if (success) showCopySuccess(btn);
    });
    contentEl.appendChild(btn);

    // 右下角按钮（常驻显示）
    const bottomBtn = createCopyButton(`${COPY_BTN_CLASS} ${BOTTOM_BUTTON_CLASS}`);
    bottomBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const text = extractFormattedText(contentEl);
        const success = await copyToClipboard(text);
        if (success) showCopySuccess(bottomBtn);
    });
    contentEl.appendChild(bottomBtn);
};

/**
 * 为反馈区域添加复制按钮（Good/Bad 按钮旁边）
 */
export const addFeedbackCopyButtons = () => {
    const feedbackContainers = document.querySelectorAll('[data-tooltip-id^="up-"]');

    feedbackContainers.forEach((goodBtn) => {
        const parent = goodBtn.parentElement;
        if (!parent || parent.querySelector('.manager-feedback-copy')) return;

        // 找到对应的内容区
        let contentEl = null;
        let node = parent;
        for (let i = 0; i < 20 && node; i++) {
            const candidates = node.querySelectorAll(CONTENT_SELECTOR);
            if (candidates.length > 0) {
                const visible = Array.from(candidates).filter((el) => isVisibleElement(el));
                contentEl = visible[visible.length - 1] || candidates[candidates.length - 1];
                break;
            }
            node = node.parentElement;
        }
        if (!contentEl) return;

        const btn = createCopyButton(`${COPY_BTN_CLASS} manager-feedback-copy`);
        btn.style.marginRight = '0.5rem';
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const text = extractFormattedText(contentEl);
            const success = await copyToClipboard(text);
            if (success) showCopySuccess(btn);
        });

        parent.insertBefore(btn, goodBtn);
    });
};
