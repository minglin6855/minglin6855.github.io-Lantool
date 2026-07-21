const express = require('express');
const ping = require('ping');
const traceroute = require('traceroute-promise');
const net = require('net');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // 靜態網頁檔案放置目錄

// 1. 取得執行電腦的對外 WAN IP
app.get('/api/wan-ip', async (req, res) => {
  try {
    const response = await axios.get('https://api.ipify.org?format=json');
    res.json({ ip: response.data.ip });
  } catch (error) {
    res.status(500).json({ error: '無法取得 WAN IP' });
  }
});

// 2. Ping 功能 (發送 5 個封包)
app.post('/api/ping', async (req, res) => {
  const { host } = req.body;
  if (!host) return res.status(400).json({ error: '請輸入有效的 IP 或網域名稱' });

  try {
    // 依作業系統執行 ping 命令，發送 5 個封包
    const cfg = {
      timeout: 10,
      extra: process.platform === 'win32' ? ['-n', '5'] : ['-c', '5']
    };
    
    const result = await ping.promise.probe(host, cfg);
    res.json({
      host: result.host,
      numeric_host: result.numeric_host,
      alive: result.alive,
      output: result.output,
      time: result.time,
      min: result.min,
      max: result.max,
      avg: result.avg
    });
  } catch (error) {
    res.status(500).json({ error: 'Ping 執行失敗' });
  }
});

// 3. Telnet 功能 (檢查 TCP Port 是否開啟)
app.post('/api/telnet', (req, res) => {
  const { host, port } = req.body;
  if (!host || !port) return res.status(400).json({ error: '請提供完整的 IP 與 Port' });

  const socket = new net.Socket();
  let status = 'closed';

  socket.setTimeout(3000); // 3 秒逾時

  socket.on('connect', () => {
    status = 'open';
    socket.destroy();
  });

  socket.on('timeout', () => {
    socket.destroy();
  });

  socket.on('error', () => {
    socket.destroy();
  });

  socket.on('close', () => {
    res.json({
      host,
      port,
      status: status === 'open' ? '開啟 (Open)' : '關閉或無法連線 (Closed/Filtered)'
    });
  });

  socket.connect(port, host);
});

// 4. Tracert (路由追蹤) 功能
app.post('/api/traceroute', async (req, res) => {
  const { host } = req.body;
  if (!host) return res.status(400).json({ error: '請輸入有效的 IP 或網域名稱' });

  try {
    const hops = await traceroute.trace(host);
    res.json({ host, hops });
  } catch (error) {
    res.status(500).json({ error: 'Tracert 執行失敗：' + error.message });
  }
});

app.listen(PORT, () => {
  console.log(`網路工具伺服器已啟動：http://localhost:${PORT}`);
});