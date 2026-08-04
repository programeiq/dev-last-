const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

// ★ themes.js から300個のお題リストを読み込む
const themes = require('./themes');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname, './')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

let waitingPlayer = null;

io.on('connection', (socket) => {
  console.log(`🟢 プレイヤーが接続しました: ${socket.id}`);

  socket.on('join_match', (data) => {
    console.log(`🔍 マッチング検索: ${data.name} (Lv.${data.level})`);

    if (waitingPlayer && waitingPlayer.id !== socket.id) {
      console.log(`🎉 マッチング成立！: ${waitingPlayer.name} vs ${data.name}`);

      const roomName = `room_${waitingPlayer.id}_${socket.id}`;
      
      // ★ 300個の中から完全ランダムで1つ選択！
      const selectedTheme = themes[Math.floor(Math.random() * themes.length)];

      // 50%の確率で立場（sideA / sideB）を割り振り
      const isPlayer1SideA = Math.random() < 0.5;
      const p1Side = isPlayer1SideA ? selectedTheme.sideA : selectedTheme.sideB;
      const p2Side = isPlayer1SideA ? selectedTheme.sideB : selectedTheme.sideA;

      waitingPlayer.socket.join(roomName);
      socket.join(roomName);

      // プレイヤー1へ送信
      waitingPlayer.socket.emit('match_found', {
        opponentName: data.name,
        opponentLevel: data.level,
        theme: selectedTheme.title,
        yourSide: p1Side,
        opponentSide: p2Side,
        roomId: roomName
      });

      // プレイヤー2へ送信
      socket.emit('match_found', {
        opponentName: waitingPlayer.name,
        opponentLevel: waitingPlayer.level,
        theme: selectedTheme.title,
        yourSide: p2Side,
        opponentSide: p1Side,
        roomId: roomName
      });

      waitingPlayer = null;

    } else {
      waitingPlayer = {
        id: socket.id,
        name: data.name,
        level: data.level,
        socket: socket
      };
      console.log(`⏳ 待機登録: ${data.name}`);
    }
  });

  socket.on('send_message', (data) => {
    socket.broadcast.emit('receive_message', data);
  });

  socket.on('disconnect', () => {
    console.log(`🔴 切断: ${socket.id}`);
    if (waitingPlayer && waitingPlayer.id === socket.id) {
      waitingPlayer = null;
    }
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Yururon Server running on port ${PORT}`);
});
