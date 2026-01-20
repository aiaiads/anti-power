/**
 * 测试完整替换流程（避免使用 innerHTML）
 */

const http = require('http');
const WebSocket = require('ws');

const CDP_HOST = '127.0.0.1';
const CDP_PORT = 9222;

async function getManagerPage() {
    return new Promise((resolve, reject) => {
        http.get(`http://${CDP_HOST}:${CDP_PORT}/json`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const pages = JSON.parse(data);
                const manager = pages.find(p => p.url.includes('jetski-agent'));
                resolve(manager || null);
            });
        }).on('error', reject);
    });
}

async function evaluateInPage(wsUrl, expression) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        let id = 1;

        ws.on('open', () => {
            ws.send(JSON.stringify({
                id: id++,
                method: 'Runtime.evaluate',
                params: {
                    expression,
                    returnByValue: true,
                    awaitPromise: true,
                }
            }));
        });

        ws.on('message', (msg) => {
            const response = JSON.parse(msg);
            if (response.id) {
                ws.close();
                if (response.result?.result?.value !== undefined) {
                    resolve(response.result.result.value);
                } else if (response.result?.exceptionDetails) {
                    reject(new Error(JSON.stringify(response.result.exceptionDetails, null, 2)));
                } else {
                    resolve(response.result?.result);
                }
            }
        });

        ws.on('error', reject);
    });
}

async function main() {
    console.log('[测试] 连接 Antigravity Manager...');

    const manager = await getManagerPage();
    if (!manager) {
        console.error('[错误] 未找到 Manager 页面');
        process.exit(1);
    }

    console.log('[测试] 已连接\n');

    // 测试完整的替换流程（不使用 innerHTML）
    const testCode = `
(async function() {
    const result = { tests: [] };
    
    // ==========================================
    // 模拟完整的公式替换流程
    // ==========================================
    
    try {
        // 1. 创建测试容器，包含公式文本
        const testDiv = document.createElement('div');
        testDiv.id = 'math-test-container';
        testDiv.style.cssText = 'position:fixed;top:10px;left:10px;background:#222;color:#fff;z-index:99999;padding:20px;border:2px solid lime;max-width:500px;';
        
        // 模拟真实的文本节点结构
        const p1 = document.createElement('p');
        p1.textContent = '欧拉恒等式: $$e^{i\\\\pi} + 1 = 0$$';
        testDiv.appendChild(p1);
        
        const p2 = document.createElement('p');
        p2.textContent = '勾股定理: $$a^2 + b^2 = c^2$$';
        testDiv.appendChild(p2);
        
        document.body.appendChild(testDiv);
        
        result.tests.push({ name: '1. 创建测试容器', ok: true });
        
        // 2. 遍历文本节点并替换
        const MATH_RE = /\\$\\$([^$]+)\\$\\$/g;
        const INLINE_RE = /\\$([^$\\n]+?)\\$/g;
        
        const processTextNode = (textNode) => {
            const text = textNode.textContent || '';
            if (!text.includes('$$') && !text.includes('$')) return false;
            
            const parent = textNode.parentElement;
            if (!parent) return false;
            
            // 解析公式
            const parts = [];
            let lastIndex = 0;
            let regex = /\\$\\$([^$]+)\\$\\$|\\$([^$\\n]+?)\\$/g;
            let match;
            
            while ((match = regex.exec(text)) !== null) {
                if (match.index > lastIndex) {
                    parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
                }
                if (match[1]) {
                    parts.push({ type: 'math', content: match[1], display: true });
                } else if (match[2]) {
                    parts.push({ type: 'math', content: match[2], display: false });
                }
                lastIndex = regex.lastIndex;
            }
            if (lastIndex < text.length) {
                parts.push({ type: 'text', content: text.slice(lastIndex) });
            }
            
            if (parts.length <= 1 && parts[0]?.type === 'text') return false;
            
            // 构建替换片段
            const fragment = document.createDocumentFragment();
            for (const part of parts) {
                if (part.type === 'text') {
                    fragment.appendChild(document.createTextNode(part.content));
                } else {
                    const mathSpan = document.createElement('span');
                    mathSpan.className = part.display ? 'katex-display-wrapper' : 'katex-inline-wrapper';
                    try {
                        window.katex.render(part.content, mathSpan, {
                            displayMode: part.display,
                            throwOnError: false,
                            trust: true,
                        });
                    } catch {
                        mathSpan.textContent = (part.display ? '$$' : '$') + part.content + (part.display ? '$$' : '$');
                    }
                    fragment.appendChild(mathSpan);
                }
            }
            
            // 使用 replaceWith 替换文本节点
            textNode.replaceWith(fragment);
            return true;
        };
        
        // 遍历所有文本节点
        const walker = document.createTreeWalker(testDiv, NodeFilter.SHOW_TEXT, null, false);
        const textNodes = [];
        let node;
        while ((node = walker.nextNode())) {
            textNodes.push(node);
        }
        
        let replacedCount = 0;
        for (const tn of textNodes) {
            if (processTextNode(tn)) {
                replacedCount++;
            }
        }
        
        result.tests.push({ 
            name: '2. 替换文本节点', 
            ok: replacedCount > 0,
            replacedCount,
        });
        
        // 3. 检查结果
        const katexNodes = testDiv.querySelectorAll('.katex');
        result.tests.push({
            name: '3. 检查渲染结果',
            ok: katexNodes.length > 0,
            katexNodeCount: katexNodes.length,
            htmlPreview: testDiv.innerHTML.slice(0, 300),
        });
        
        // 5秒后删除测试容器
        setTimeout(() => testDiv.remove(), 10000);
        
        result.success = katexNodes.length > 0;
        result.note = '测试容器已显示在页面左上角（绿色边框），10秒后自动删除';
        
    } catch (e) {
        result.tests.push({
            name: '完整流程',
            ok: false,
            error: e.message,
            stack: e.stack?.slice(0, 500),
        });
        result.success = false;
    }
    
    return result;
})()
`;

    try {
        const result = await evaluateInPage(manager.webSocketDebuggerUrl, testCode);

        console.log('='.repeat(60));
        console.log('完整替换流程测试报告');
        console.log('='.repeat(60));

        console.log('\n【测试步骤】');
        result.tests.forEach((test, i) => {
            const status = test.ok ? '✅' : '❌';
            console.log(`\n  ${status} ${test.name}`);
            if (test.error) console.log(`     错误: ${test.error}`);
            if (test.replacedCount !== undefined) console.log(`     替换节点数: ${test.replacedCount}`);
            if (test.katexNodeCount !== undefined) console.log(`     .katex 节点数: ${test.katexNodeCount}`);
            if (test.htmlPreview) console.log(`     HTML 预览: ${test.htmlPreview}...`);
        });

        console.log('\n' + '='.repeat(60));
        console.log('结论');
        console.log('='.repeat(60));

        if (result.success) {
            console.log('\n✅ 完整流程测试成功！');
            console.log('   可以使用此方案修改 math.js');
            console.log('\n修改要点：');
            console.log('   1. 使用 katex.render(latex, element) 而不是 renderToString()');
            console.log('   2. 不要使用 DOMParser，直接构建 DOM 节点');
            console.log('   3. 用 replaceWith(fragment) 替换文本节点');
        } else {
            console.log('\n❌ 测试失败');
        }

        if (result.note) {
            console.log(`\n📌 ${result.note}`);
        }

    } catch (err) {
        console.error('[错误]', err.message);
    }
}

main().catch(console.error);
