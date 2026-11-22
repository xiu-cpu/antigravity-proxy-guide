# Antigravity 代理接入 SKILL（完整版）

> 适用场景：Antigravity（Google 的 VSCode fork AI IDE）及其任何 VSCode 内核 fork 应用**无法连接 googleapis.com / Code Assist**，报 `dial tcp ... timeout`、`403 LOCATION_NOT_ELIGIBLE`、`400 User location is not supported` 等错误；或任何"系统代理开着但某应用还是连不上外网"的情况。
> 目标：系统代理 / Clash 配置**一行都不动**，让这一个应用自己走代理；并完成订阅额度闭环。

---

## 一、核心原理（先懂再动手，30 秒版）

1. **VSCode 内核（Electron/Node 网络栈）不理会系统代理**——部分网络组件直接 `dial tcp 目标IP:443` 裸连。系统代理开着也拦不住它，被墙域名照样 timeout。
2. **TUN 模式能救但别用**：TUN 在虚拟网卡层接管**一切**流量，应用无感——但运维坑多（见第四节），"昨天还好今天进不去"的元凶多半是它。
3. **正解 = 应用内代理**：VSCode 内核遵守 `http.proxy` 设置（含强制模式 `http.proxySupport: "on"`）。给这一个应用单独指路，谷歌流量精准走代理节点，国内流量零影响，代理软件一行配置不用改。

一句话记忆：**系统代理管不住 Electron，TUN 是大炮打蚊子还容易炸膛，应用内 http.proxy 才是手术刀。**

---

## 二、错误码速诊表（先对号入座）

| 错误 | 根因 | 修法 |
|---|---|---|
| `dial tcp ... timeout` | 域名被墙裸连（系统代理管不到） | → 第三节方案 A |
| `403 LOCATION_NOT_ELIGIBLE` | 某个 googleapis 子域名**掉进直连规则**，CN 出口被拒 | Clash 分流加该域名（见 4.5） |
| `400 User location is not supported` | 双层根因之一：①AI 扩展的 **Node 内置 fetch（undici）天生无视系统代理+环境变量**，直连 CN；②代理出口节点在受限区 | → settings.json 强制代理（4.1）+ 换节点（4.6） |

**判定技巧**：同一代理出口 IP 下，**网页 200 而 agent API 400** = 不是 IP 的问题，是请求没走代理（网络栈差异）。

---

## 三、探测流程（动手前 1 分钟，全部只读）

```bat
:: ① 确认代理软件的实际监听端口（Clash Verge 混合端口默认 7897，CFW/Mihomo 常见 7890）
netstat -ano | findstr "LISTENING" | findstr ":7897 :7890 :7891 :7892"

:: ② 定位应用用户配置目录（fork 应用都在 %APPDATA% 下以其名命名）
dir "%APPDATA%" | findstr /i "antigravity gravity"

:: ③ 验证代理端口真的能出网 + 出口国家
curl -x http://127.0.0.1:7897 -I https://www.google.com --max-time 8
curl -x http://127.0.0.1:7897 https://api.country.is/

:: ④ 测目标服务对该出口的态度（Gemini 网页对受限区会拒绝/重定向）
curl -s -x http://127.0.0.1:7897 -o NUL -w "HTTP %{http_code}" https://gemini.google.com/
```

- 端口实测为准：Clash Verge 混合端口可被改过，**别抄默认值**。
- 配置文件路径：`%APPDATA%\Antigravity\User\settings.json`（其他 fork 同理替换目录名）。
- 应用日志：`%APPDATA%\Antigravity\logs\language_server.log`（Go LS 的 googleapis 请求/错误全在这；`ERROR: logging before google.Init` 前缀是正常噪音）。

---

## 四、修复落地（按顺序做完即闭环）

### 4.1 settings.json 强制代理（最关键一步）
`%APPDATA%\Antigravity\User\settings.json`（不存在就新建）：

```json
{
  "http.proxy": "http://127.0.0.1:7897",
  "http.proxySupport": "on"
}
```

**为什么必须 `proxySupport: "on"`**：AI 扩展用的是 **Node 内置 fetch（undici）——它天生无视系统代理，也无视 HTTP_PROXY 环境变量**（undici 默认无 ProxyAgent）。只有 VSCode 的 proxySupport 强制模式能把它也按进代理。只设 `http.proxy` 而不开 "on" = 渲染端走代理但 AI 扩展仍直连。

### 4.2 应用内 UI 路径（备选）
`Ctrl + ,` 搜 proxy → **Http: Proxy** 填 `http://127.0.0.1:7897` → 重启。fork 裁剪了 UI 就直接改文件。

### 4.3 合并启动脚本（代理环境变量 + 汉化 + 启动 四合一）
语言服务器（Go LS）靠**环境变量**走代理；汉化包启动入口不带这些变量 → 换启动方式后 400 复发。标准启动脚本（示例放 `%LOCALAPPDATA%\AntigravityLauncher\start-cn-proxy.cmd`，**必须 CRLF + 无 BOM + 尽量纯 ASCII**，LF 或中文注释会让 cmd 拆错行）：

```bat
@echo off
set HTTP_PROXY=http://127.0.0.1:7897
set HTTPS_PROXY=http://127.0.0.1:7897
set ALL_PROXY=socks5://127.0.0.1:7897
set NO_PROXY=localhost,127.0.0.1,.xioui.icu
node "%LOCALAPPDATA%\AntigravityLauncher\ensure-proxy-setting.js"
node "<汉化包>\scripts\ensure_localized.js" --fix
set "EXE=%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe"
start "" "%EXE%"
```

配套 `ensure-proxy-setting.js`（启动前自动检测并恢复 settings.json 的代理配置——应用更新重置配置后自愈）：

```js
const fs = require('fs');
const p = process.env.APPDATA + '\\Antigravity\\User\\settings.json';
const PROXY = 'http://127.0.0.1:7897';
let j = {};
try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) {}
if (j['http.proxy'] !== PROXY || j['http.proxySupport'] !== 'on') {
  j['http.proxy'] = PROXY; j['http.proxySupport'] = 'on';
  fs.writeFileSync(p, JSON.stringify(j, null, 2));
  console.log('[fix] proxy config restored');
}
```

### 4.4 订阅额度闭环（Google AI Pro 学割）
- 日本区学生割：**JP¥720/月 ≈ 30 元人民币**（75% off，原价 ¥2,900），最长锁 **4 年**；**申请截止 2026-12-31**。
- 学生认证通过者直接锁价；订阅确认页出现后 → **重启应用**解锁新模型。
- 模型档位（谷歌化学元素命名）：**Carbon（顶配长项目）> Neon（甜点日常深度）> Hydrogen（快速执行）> Argon（旧款）**。
- 订阅后 Gemini 4 系列首显"不可用" → **重启应用即解锁**（plan 权限启动时拉取）。
- 若 agent 执行仍报 `400 location`（IP/账号都是对的）：新模型按**账号区域**风控更严——用 Claude 系模型（走 Anthropic 路由不受影响）顶上，或改 Google 账号区域（pay.google.com，一年一次，需外区卡）。

### 4.5 Clash 分流补漏（403 时用）
部分 googleapis 子域名不在订阅规则里，掉进 `GEOIP,CN,DIRECT` 兜底 → CN 出口被拒。修法：Clash Verge **Merge.yaml**（持久增强层，订阅更新不覆盖）prepend `DOMAIN-SUFFIX,<掉链域名>,<代理组>`；改完**须在 Verge 界面重新激活订阅才生效**。已知需要补的：`daily-cloudcode-pa.googleapis.com`、`aicode.googleapis.com`、`antigravity.google`。

### 4.6 节点选择
出口国家实测：`curl -x http://127.0.0.1:7897 https://api.country.is/`。SG/JP/US 均为支持区；**HK 不在**。高档模型（Gemini 4）对数据中心 IP 风控更严——换 JP 家宽节点可解。

---

## 五、坑清单（每个都真实咬过人）

| 坑 | 症状 | 规避 |
|---|---|---|
| **系统代理陷阱** | 系统代理开着，Electron 应用仍直连超时 | 不指望系统代理，应用内显式配置 |
| **undici fetch 陷阱** | 环境变量+系统代理全设了，AI 扩展的 fetch 仍直连 | 必须 `http.proxySupport: "on"` |
| **Go gRPC 陷阱** | 部分 gRPC 调用不读 HTTP_PROXY 环境变量 | 关键域名走 Clash 分流兜底（4.5） |
| **汉化/启动脚本无代理变量** | 换了第三方启动入口（汉化包 bat 等）后 400 复发 | 合并启动脚本统一注入（4.3） |
| **TUN 坑①②③** | 杀软拦驱动 / IPv6 绕过 / 自启失败 | 不用 TUN；真要用逐坑填 |
| **端口抄默认** | 教程 7890 实际 7897 | netstat 实测 |
| **proxy 缺协议头** | `127.0.0.1:7897` 不生效 | 必须带 `http://` |
| **JSON 改坏** | settings.json 语法错 → 设置全灭 | 改前备份，启动脚本带自愈 |
| **cmd 脚本编码** | LF/UTF-8/中文注释 → cmd 拆错行乱码 | CRLF + 无 BOM + 纯 ASCII |
| **中文路径进 cmd** | Git Bash 调中文 bat 报"不是内部或外部命令" | PowerShell `Start-Process -FilePath` |
| **应用更新重置** | 更新器重置快捷方式/可能重置配置 | 启动脚本自愈（4.3）+ 更新后点两次 |
| **汉化被更新冲掉** | 更新后界面回英文 | 启动脚本 ensure_localized --fix 自动重注入 |

---

## 六、更新存活表（应用自动更新后逐项核对）

| 项 | 更新后 | 依据 |
|---|---|---|
| settings.json | ✅ 存活 + 启动自愈 | 用户配置目录独立于安装目录 |
| 启动脚本/VBS/自愈 js | ✅ 存活 | 自建目录（AntigravityLauncher）更新器不认识 |
| 汉化 | ✅ 自动重注入 | ensure_localized --fix 每次启动跑 |
| 代理环境变量 | ✅ | 启动脚本每次注入 |
| 快捷方式 | ⚠️ 会被重置回裸 exe | **首次裸点中招一次 → 再点一次快捷方式自愈** |
| 订阅/云端模型 | ✅ | 账号级 |

---

## 七、一页速查

```
症状：VSCode 内核应用连不上被墙域名 / 400 location not supported
  → netstat 确认代理端口 → curl api.country.is 验出口国家
  → settings.json: {"http.proxy":"http://127.0.0.1:PORT","http.proxySupport":"on"}
  → 合并启动脚本(代理env+汉化+启动) → 重启 → 验证
  → 403=分流补域名(Merge.yaml) / 400=proxySupport on+换节点 / 订阅锁额度
  → 更新后失效 = 快捷方式重置(点两次自愈) + 配置自愈兜底
  → 不选 TUN(三坑)，不改系统代理(伤全局)
```
