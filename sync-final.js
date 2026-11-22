const fs = require('fs');
// ① README 在第七节末尾追加终极方案段(不加章节号,细节在 SKILL.md)
let r = fs.readFileSync('README.md', 'utf8');
const ra = '固定后连刷五次检测必须恒定 SGP/JP——之后 agent 执行的 400 彻底消失。';
if (r.split(ra).length - 1 !== 1) { console.log('MISS readme anchor'); process.exit(1); }
r = r.replace(ra, ra + `

**压不住时的终极方案（实战终局）**：订阅自带的 DNS 段是劣质配置（国内 DNS 池 114/阿里/腾讯 + 畸形 fake-ip 段 28.0.0.1/8 + ipv6:true），且部分组件直连不遵守任何代理设置——此时两开关治到底：**DNS 覆写开启**（弹窗选"仍然开启"，覆盖劣质 DNS）+ **TUN 虚拟网卡模式开启**（网卡层接管一切流量，含 Go LS/undici/gRPC 等不守规矩的直连）。系统代理保持开。详见 SKILL.md 4.8 节（含 TUN 开关位置截图与诊断注意）。`);
fs.writeFileSync('README.md', r);
console.log('README 终极方案段已加');

// ② 同步合集目录
fs.copyFileSync('SKILL.md', 'D:/000-核心数据/SKILL+提示词合集/Antigravity规则代理/SKILL.md');
console.log('合集 SKILL.md 已同步:', fs.statSync('D:/000-核心数据/SKILL+提示词合集/Antigravity规则代理/SKILL.md').size, 'B');
