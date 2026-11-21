# Antigravity 代理接入 SKILL

> 适用场景：Antigravity（Google 的 VSCode fork AI IDE）及其任何 VSCode 内核 fork 应用**无法连接 googleapis.com / Code Assist**，报 `dial tcp 172.217.114.4:443 timeout` 类错误；或任何"系统代理开着但某应用还是连不上外网"的情况。
> 目标：系统代理 / Clash 配置**一行都不动**，让这一个应用自己走代理。

---

## 一、核心原理（先懂再动手，30 秒版）

1. **VSCode 内核（Electron/Node 网络栈）不理会系统代理**——部分网络组件直接 `dial tcp 目标IP:443` 裸连。系统代理开着也拦不住它，被墙域名照样 timeout。
2. **TUN 模式能救但别用**：TUN 在虚拟网卡层接管**一切**流量，应用无感——但运维坑多（见第四节），"昨天还好今天进不去"的元凶多半是它。
3. **正解 = 应用内代理**：VSCode 内核遵守 `http.proxy` 设置。给这一个应用单独指路，谷歌流量精准走代理节点，国内流量零影响，代理软件一行配置不用改。

一句话记忆：**系统代理管不住 Electron，TUN 是大炮打蚊子还容易炸膛，应用内 http.proxy 才是手术刀。**

---

## 二、探测流程（动手前 1 分钟，全部只读）

```bat
:: ① 确认代理软件的实际监听端口（Clash Verge 混合端口默认 7897，CFW/Mihomo 常见 7890）
netstat -ano | findstr "LISTENING" | findstr ":7897 :7890 :7891 :7892"

:: ② 定位应用用户配置目录（fork 应用都在 %APPDATA% 下以其名命名）
dir "%APPDATA%" | findstr /i "antigravity gravity"

:: ③ 验证代理端口真的能出网（用代理 curl 一个外站）
curl -x http://127.0.0.1:7897 -I https://www.google.com --max-time 8
```

- 端口实测为准：Clash Verge 的混合端口可在「设置 → 端口设置」里被改过，**别抄默认值，以 netstat 结果为准**。
- 配置文件路径：`%APPDATA%\Antigravity\User\settings.json`（其他 fork 同理替换目录名）。

---

## 三、修复步骤（方案 A，两分钟）

### 路径 1：应用内图形设置
1. Antigravity 按 `Ctrl + ,` 打开设置
2. 搜索 `proxy`
3. **Http: Proxy** 填 `http://127.0.0.1:7897`（协议前缀必须带）
4. 重启应用

### 路径 2：直接改配置文件（fork 裁剪了设置 UI 时用）
在 `%APPDATA%\Antigravity\User\settings.json` 顶层对象里加一行：

```json
"http.proxy": "http://127.0.0.1:7897",
```

注意 JSON 语法：上一行结尾补逗号、双引号不能少。改完重启应用。

### 验证
重启后进 Antigravity 触发任意联网操作（登录 / Code Assist 对话）——不再报 `dial tcp ... timeout` 即成功。仍失败则回查：端口对不对（netstat）→ 代理节点本身通不通（curl ③）→ settings.json JSON 语法有没有坏。

---

## 四、坑清单（每个都真实咬过人）

| 坑 | 症状 | 规避 |
|---|---|---|
| **系统代理陷阱** | 系统代理开着，Electron 应用仍直连超时 | 不指望系统代理，应用内显式配置 |
| **TUN 坑①** | 火绒/杀软拦 TUN 虚拟网卡驱动，TUN 静默失效 | 加白名单，或干脆不用 TUN |
| **TUN 坑②** | IPv6 流量绕过 TUN 直连（AAAA 解析），时好时坏 | 关 IPv6 或 TUN 开 IPv6 接管 |
| **TUN 坑③** | TUN 服务/驱动自启失败，重启电脑后全部失效 | 服务设自启并重启验证，别信"昨天能用" |
| **端口抄默认** | 教程说 7890，实际 Clash Verge 是 7897 或自定义 | netstat 实测 |
| **proxy 缺协议头** | 填 `127.0.0.1:7897` 不生效 | 必须写 `http://` 前缀 |
| **JSON 改坏** | settings.json 多/少逗号 → 应用设置全灭 | 改前备份一份，改后用 JSON 校验器过一遍 |

---

## 五、配套经验（额度与启动）

1. **额度配套**：Code Assist 免费额度抠搜。Google AI Pro 订阅（日本区学生割：JP¥720/月 ≈ 30 元人民币，75% off 最长 4 年，**申请截止 2026-12-31**，学生认证通过者直接锁价）可解锁高额度模型配额——代理通了之后第二件事就是把额度接上。
2. **启动自愈**：Antigravity 自动更新后 exe 路径会变导致快捷方式失效——用"exe 动态定位 + 快捷方式自动修复 + 从 vbs 启动一次即自愈"的三件套方案（详见工作档案 antigravity-proxy-launch.md）。
3. **版本升级后失效**：应用大版本更新可能重置 settings.json——代理失效时**先查这行配置还在不在**，再查别的。

---

## 六、一页速查

```
症状：VSCode 内核应用连不上被墙域名，系统代理无效
  → netstat 确认代理端口 → %APPDATA%\应用名\User\settings.json
  → 加 "http.proxy": "http://127.0.0.1:端口" → 重启 → 验证
  → 失败则查：端口 / 节点 / JSON 语法 / 应用更新重置配置
  → 不选 TUN（三坑），不改系统代理（伤全局）
```
