const fs = require('fs');
let s = fs.readFileSync('SKILL.md', 'utf8');
let n = 0;
function rep(a, b, desc) {
  const k = s.split(a).length - 1;
  if (k !== 1) { console.log('MISS(' + k + '): ' + desc); process.exit(1); }
  s = s.replace(a, b); n++;
  console.log('ok', desc);
}

/* ① 新增 4.8 终极方案章节 */
rep(`---

## 五、坑清单（每个都真实咬过人）`,
`### 4.8 终极方案：DNS 覆写 + TUN 模式（当所有"温和"手段都压不住时）

**实战终局**：settings.json 代理、proxySupport:"on"、环境变量、节点固定全部到位后，Gemini 检测仍在 CHN 与 SGP 之间乱跳——抓到两大实锤：

**实锤 A：订阅自带的 DNS 段是劣质配置**（grep 运行配置 dns 段即见）：
\`\`\`yaml
default-nameserver: [114.114.114.114, 223.5.5.5, 119.29.29.29]   # 全是国内 DNS
ipv6: true                                                        # 双栈分裂
fake-ip-range: 28.0.0.1/8                                         # 畸形段(28.x 是公网 IP)
\`\`\`
国内 DNS 解析 googleapis → CN 邻近/污染结果 → 不遵守代理的组件直连 → 检测 CHN。

**实锤 B：IPv4/IPv6 双栈出口分裂**——节点双栈出口（v6=SG、v4=CN 或节点切换），同一会话 200/400 乱跳。检测连刷验证：跳 CHN 即实锤。

**终极修法（Clash Verge 两开关）**：
1. **DNS 覆写开启**：Verge 弹窗警告"可能覆盖订阅自定义 DNS"→ 选「仍然开启」（覆盖的正是劣质配置）
2. **TUN 模式开启**（虚拟网卡开关，设置页网络设置区）：网卡层接管**一切**流量，不遵守代理规则的组件（Go LS / undici / gRPC）也强制进 mihomo 分流

TUN 三坑现状评估：火绒拦驱动→弹窗允许一次即可；IPv6 绕过→IPv6 已关不存在；自启失败→clash-verge-service 是 Windows 服务本来自启。**风险远低于 400 反复发作**。系统代理保持开（双保险）。

**TUN 位置**：设置页 → 系统设置区「虚拟网卡模式」开关（点后 Verge 自动重启内核加载，等 5-10 秒）：

![TUN 开关位置](images/tun-switch.png)

**验证**：地区检测连刷五次恒定 SGP/JP + agent 执行零 400。

**诊断注意**：Verge Rev 的运行配置是 **clash-verge.yaml（201KB）**，不是 config.yaml（701B 小文件）——验证规则是否生效必须 grep 对的文件；mihomo external-controller 默认未开，诊断走 Clash 日志文件（logs/service/sidecar_latest.log）。

---

## 五、坑清单（每个都真实咬过人）`, '4.8 终极方案章节');

/* ② 坑清单追加三条 */
rep(`| **应用更新重置** | 更新器重置快捷方式/可能重置配置 | 启动脚本自愈（4.3）+ 更新后点两次 |`,
`| **应用更新重置** | 更新器重置快捷方式/可能重置配置 | 启动脚本自愈（4.3）+ 更新后点两次 |
| **订阅自带劣质 DNS** | 国内 DNS 池 + 畸形 fake-ip 段，解析污染 | DNS 覆写开启覆盖之 |
| **双栈出口分裂** | IPv4=CN、IPv6=SG 乱跳 | 关 IPv6 或 TUN 统一接管 |
| **诊断查错文件** | grep config.yaml(701B) 找不到规则误判 | Verge Rev 运行配置是 clash-verge.yaml |`, '坑清单追加');

/* ③ 速查表补 TUN(全角括号锚点) */
rep(`  → 不选 TUN（三坑），不改系统代理（伤全局）`,
`  → 反复复发 = DNS 覆写开启 + TUN 模式(终极方案 4.8)，系统代理保持双保险`, '速查表补 TUN');

fs.writeFileSync('SKILL.md', s);
console.log('共', n, '处已写入');
