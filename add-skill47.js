const fs = require('fs');
let s = fs.readFileSync('SKILL.md', 'utf8');
let n = 0;
function rep(a, b, desc) {
  const k = s.split(a).length - 1;
  if (k !== 1) { console.log('MISS(' + k + '): ' + desc); process.exit(1); }
  s = s.replace(a, b); n++;
  console.log('ok', desc);
}
const anchor = '### 4.6 节点选择';
const newSection = anchor + `

### 4.7 出口乱跳实战（url-test 自动组是隐形杀手）
**现象**：一切配置正确（settings.json 代理、账号 JP、订阅生效），但 Gemini 检测在 **CHN(不支持) 与 SGP(支持) 之间乱跳**，agent 执行随机报 400 location not supported。

**根因**：订阅组典型结构 \`Gemini → 节点选择 → 自动选择(url-test)\`——url-test 每 600 秒按测速自动切换节点，节点池含**香港×9**（Gemini 不支持区，检测面板显示 CHN）。轮到 HK 出口的时间窗内，所有 agent 请求 400。**url-test 的目标是"最快"，完全不管"地区支持"**——写码业务无感、Gemini API 敏感。

**修法（两层手动固定，零配置文件改动）**：
1. 代理页 → 「节点选择」组 → 从「自动选择」改为**手动点选固定节点**（选测速最优的支持区节点，如 SG-HY2 延迟 85ms）
2. 「Gemini」组 → 指向「节点选择」跟随固定
3. 双保险：Clash Verge 设置里**关闭 IPv6**（杜绝双栈双出口分裂）

**验证**：地区检测连刷五次必须恒定 SGP/JP（一次 CHN 都不能有）。

![两层固定后的正确状态](images/proxy-group-fixed.png)`;
rep(anchor, newSection, '4.7 出口乱跳章节');
fs.writeFileSync('SKILL.md', s);
console.log('共', n, '处');
