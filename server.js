const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const net = require('net');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. 取得使用者外網 WAN IP
app.get('/api/myip', (req, me) => {
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  me.json({ ip: clientIp });
});

// 2. Ping 功能 (發送 5 個封包)
app.post('/api/ping', (req, res) => {
  const { target } = req.body;
  if (!target) return res.status(400).json({ error: '請輸入有效的 IP 或網域' });

  // 驗證輸入內容避免指令注入
  const cleanTarget = target.trim().replace(/[^a-zA-Z0-9.-]/g, '');
  const isWin = process.platform === 'win32';
  const cmd = isWin ? `ping -n 5 ${cleanTarget}` : `ping -c 5 ${cleanTarget}`;

  exec(cmd, { timeout: 15000 }, (error, stdout, stderr) => {
    res.json({ output: stdout || stderr || error?.message });
  });
});

// 3. Telnet 功能 (測試 TCP 埠號是否開啟)
app.post('/api/telnet', (req, res) => {
  const { host, port } = req.body;
  if (!host || !port) return res.status(400).json({ error: '請輸入 IP 與 Port' });

  const cleanHost = host.trim().replace(/[^a-zA-Z0-9.-]/g, '');
  const socket = new net.Socket();
  let statusSent = false;

  socket.setTimeout(3000); // 3 秒超時

  socket.connect(parseInt(port), cleanHost, () => {
    if (!statusSent) {
      statusSent = true;
      socket.destroy();
      res.json({ open: true, message: `[成功] ${cleanHost}:${port} 連線成功！Port 已開啟。` });
    }
  });

  socket.on('error', (err) => {
    if (!statusSent) {
      statusSent = true;
      socket.destroy();
      res.json({ open: false, message: `[失敗] ${cleanHost}:${port} 連線失敗或拒絕連線 (${err.message})。` });
    }
  });

  socket.on('timeout', () => {
    if (!statusSent) {
      statusSent = true;
      socket.destroy();
      res.json({ open: false, message: `[連線超時] ${cleanHost}:${port} 無回應，可能被防火牆阻擋。` });
    }
  });
});

// 4. Traceroute 功能 (追蹤路由)
app.post('/api/traceroute', (req, res) => {
  const { target } = req.body;
  if (!target) return res.status(400).json({ error: '請輸入有效的 IP 或網域' });

  const cleanTarget = target.trim().replace(/[^a-zA-Z0-9.-]/g, '');
  const isWin = process.platform === 'win32';
  // Linux/Render 環境設定最大 15 hops 避免執行過久
  const cmd = isWin ? `tracert -h 15 ${cleanTarget}` : `traceroute -m 15 ${cleanTarget}`;

  exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
    res.json({ output: stdout || stderr || error?.message });
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});