const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const net = require('net');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. 取得使用者外網 WAN IP
app.get('/api/myip', (req, res) => {
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  res.json({ ip: clientIp });
});

// 2. Ping 功能 (使用原生 ICMP ping，發送 5 個封包)
app.post('/api/ping', (req, res) => {
  const { target } = req.body;
  if (!target) return res.status(400).json({ error: '請輸入有效的 IP 或網域' });

  // 過濾非法字元，防止指令注入
  const cleanTarget = target.trim().replace(/[^a-zA-Z0-9.-]/g, '');
  const isWin = process.platform === 'win32';
  
  // -c 5 (Linux/Mac) 或 -n 5 (Windows)，-w 5 避免無限等待
  const cmd = isWin 
    ? `ping -n 5 ${cleanTarget}` 
    : `ping -c 5 -w 10 ${cleanTarget}`;

  exec(cmd, { timeout: 12000 }, (error, stdout, stderr) => {
    // 即使 Ping 的過程中有一兩個封包遺失，stdout 依然會有詳細資訊
    if (stdout) {
      res.json({ output: stdout });
    } else {
      res.json({ output: stderr || error?.message || 'Ping 執行失敗或連線超時' });
    }
  });
});

// 3. Telnet 功能 (TCP Port 測試)
app.post('/api/telnet', (req, res) => {
  const { host, port } = req.body;
  if (!host || !port) return res.status(400).json({ error: '請輸入 IP 與 Port' });

  const cleanHost = host.trim().replace(/[^a-zA-Z0-9.-]/g, '');
  const socket = new net.Socket();
  let statusSent = false;

  socket.setTimeout(4000); // 4秒超時

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
      res.json({ open: false, message: `[失敗] ${cleanHost}:${port} 連線失敗 (${err.message})。` });
    }
  });

  socket.on('timeout', () => {
    if (!statusSent) {
      statusSent = true;
      socket.destroy();
      res.json({ open: false, message: `[連線超時] ${cleanHost}:${port} 無回應，Port 可能關閉或被防火牆阻擋。` });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});