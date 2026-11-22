const fs = require('fs');
let s = fs.readFileSync('README.md', 'utf8');
const anchor = '## 七、坑清单（每个都咬过人）';
const sec = `## 七、出口固定：url-test 自动组是隐形杀手（实战案例）

一切配置正确（settings.json 代理、账号 JP、订阅生效），Gemini 检测却在 **CHN(不支持) 与 SGP(支持) 之间乱跳**，agent 执行随机报 400。

**根因**：订阅组结构 \`Gemini → 节点选择 → 自动选择(url-test)\`——每 600 秒测速自动切换，节点池含香港×9（Gemini 不支持区，显示 CHN）。

**修法**：「节点选择」手动固定为支持区最优节点（实测 SG-HY2 延迟 85ms 全场最低），Gemini 组跟随固定，IPv6 关闭双保险：

![两层固定后的正确状态](images/proxy-group-fixed.png)

固定后连刷五次检测必须恒定 SGP/JP——之后 agent 执行的 400 彻底消失。

`;
if (s.split(anchor).length - 1 !== 1) { console.log('MISS anchor'); process.exit(1); }
s = s.replace(anchor, sec + anchor);
// 后续章节序号顺延：七→八、八→九、九→十、十→十一
s = s.replace('## 七、坑清单', '## 八、坑清单');
s = s.replace('## 八、更新存活表', '## 九、更新存活表');
s = s.replace('## 九、汉化包启动', '## 十、汉化包启动');
s = s.replace('## 十、一页速查', '## 十一、一页速查');
fs.writeFileSync('README.md', s);
console.log('README 已加出口固定小节+章节顺延');
