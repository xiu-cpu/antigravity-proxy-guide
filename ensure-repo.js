const fs = require('fs');
const https = require('https');
const { spawnSync } = require('child_process');
const user = 'xiu-cpu';
const name = 'antigravity-proxy-guide';

// 从 Windows 凭据管理器提取 token（内存中使用，不落盘不回显）
const fill = spawnSync('git', ['credential', 'fill'], {
  input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8'
});
const token = (fill.stdout.match(/^password=(.+)$/m) || [])[1];
if (!token) { console.error('FATAL: 未取到 GitHub 凭证'); process.exit(1); }
console.log('凭证 OK（长度 ' + token.length + '，不回显）');

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com', path, method,
      headers: {
        'Authorization': 'token ' + token,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'upload-script',
        'Content-Length': data ? Buffer.byteLength(data) : 0
      }
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  const chk = await api('GET', `/repos/${user}/${name}`);
  if (chk.status === 200) {
    console.log('仓库已存在（先前中断的请求其实已建成），直接 push');
  } else if (chk.status === 404) {
    const cr = await api('POST', '/user/repos', {
      name,
      description: 'Antigravity/VSCode 内核应用代理接入完全指南——系统代理无效根因、http.proxy 手术刀方案、Google AI Pro 额度闭环、坑清单与 SKILL.md',
      has_wiki: false,
      private: false
    });
    console.log('建仓:', cr.status);
    if (cr.status !== 201) { console.log('建仓失败:', cr.body.slice(0, 300)); process.exit(1); }
  } else {
    console.log('检查异常:', chk.status, chk.body.slice(0, 200));
    process.exit(1);
  }
  console.log('OK repo ready: ' + user + '/' + name);
})().catch(e => { console.error('FATAL', String(e).slice(0, 150)); process.exit(1); });
