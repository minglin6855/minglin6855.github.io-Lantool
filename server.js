const express = require('express');
const cors = require('cors');
const net = require('net');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// 允許所有來源進行 CORS 跨網域請求
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. 取得使用者外網 WAN IP
app.get('/api/myip', (req, res) => {
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  res.json({ ip: clientIp });
});

// 2. Ping 功能 (使用 TCP 模擬 5 次 Ping 延遲，避開 Linux ICMP 權限問題)
app.post('/api/ping', async (req, res) => {
  const { target } = req.body;
  if (!target) return res.status(400).json({ error: '請輸入有效的 IP 或網域' });

  const host = target.trim().replace(/[^a-zA-Z0-9.-]/g, '');
  const results = [];
  
  for (let i = 1; i <= 5; i++) {
    const start = Date.now();
    const result = await new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(2000);

      socket.connect(80, host, () => {
        const duration = Date.now() - start;
        socket.destroy();
        resolve(`Reply from ${host}: time=${duration}ms`);
      });

      socket.on('error', () => {
        // 即便 80 Port 沒開，只要有回應失敗也代表主機活著
        const duration = Date.now() - start;
        socket.destroy();
        resolve(`Reply from ${host}: time=${duration}ms`);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(`Request timed out.`);
      });
    });
    results.push(`[${i}/5] ${result}`);
  }

  res.json({ output: results.join('\n') });
});

// 3. Telnet 功能 (TCP Port 檢測)
app.post('/api/telnet', (req, res) => {
  const { host, port } = req.body;
  if (!host || !port) return res.status(400).json({ error: '請輸入 IP 與 Port' });

  const cleanHost = host.trim().replace(/[^a-zA-Z0-9.-]/g, '');
  const socket = new net.Socket();
  let statusSent = false;

  socket.setTimeout(3000);

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
      res.json({ open: false, message: `[連線超時] ${cleanHost}:${port} 無回應，可能被防火牆阻擋。` });
    }
  });
});

// 4. Traceroute 功能 (附帶安全防護)
app.post('/api/traceroute', (req, res) => {
  const { target } = req.body;
  if (!target) return res.status(400).json({ error: '請輸入有效的 IP 或網域' });

  const { exec } = require('child_process');
  const cleanTarget = target.trim().replace(/[^a-zA-Z0-9.-]/g, '');
  
  // 在 Linux 免費雲端環境中執行 traceroute
  exec(`traceroute -m 10 ${cleanTarget}`, { timeout: 15000 }, (error, stdout, stderr) => {
    if (error) {
      res.json({ output: `Traceroute 執行限制/未安裝：\n${error.message}\n建議：免費雲端容器常限制 UDP/ICMP 追蹤。` });
    } else {
      res.json({ output: stdout || stderr });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});