const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

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
const activeRooms = {};

io.on('connection', (socket) => {
  console.log(`🟢 プレイヤーが接続しました: ${socket.id}`);

  // --- マッチング処理 ---
  socket.on('join_match', (data) => {
    console.log(`🔍 マッチング検索: ${data.name} (Lv.${data.level})`);

    if (waitingPlayer && waitingPlayer.id !== socket.id) {
      console.log(`🎉 マッチング成立！: ${waitingPlayer.name} vs ${data.name}`);

      const roomName = `room_${waitingPlayer.id}_${socket.id}`;
      const selectedTheme = themes[Math.floor(Math.random() * themes.length)];
      const isPlayer1SideA = Math.random() < 0.5;
      const p1Side = isPlayer1SideA ? selectedTheme.sideA : selectedTheme.sideB;
      const p2Side = isPlayer1SideA ? selectedTheme.sideB : selectedTheme.sideA;

      const INITIAL_HP = 10000;

      // ★ ルーム状態の初期設定
      activeRooms[roomName] = {
        theme: selectedTheme.title,
        timeLeft: 180, // 制限時間 3分 (180秒)
        players: {
          [waitingPlayer.id]: { name: waitingPlayer.name, side: p1Side, hp: INITIAL_HP, isTyping: false },
          [socket.id]: { name: data.name, side: p2Side, hp: INITIAL_HP, isTyping: false }
        },
        intervalId: null
      };

      waitingPlayer.socket.join(roomName);
      socket.join(roomName);

      // マッチング成功通知
      waitingPlayer.socket.emit('match_found', {
        opponentName: data.name,
        opponentLevel: data.level,
        theme: selectedTheme.title,
        yourSide: p1Side,
        opponentSide: p2Side,
        initialHp: INITIAL_HP,
        roomId: roomName
      });

      socket.emit('match_found', {
        opponentName: waitingPlayer.name,
        opponentLevel: waitingPlayer.level,
        theme: selectedTheme.title,
        yourSide: p2Side,
        opponentSide: p1Side,
        initialHp: INITIAL_HP,
        roomId: roomName
      });

      // ★ 1秒ごとのループ処理（放置HP減少 & 制限時間カウント）
      const room = activeRooms[roomName];
      room.intervalId = setInterval(() => {
        if (!activeRooms[roomName]) return;

        // 制限時間カウントダウン
        room.timeLeft -= 1;

        // 打っていない（isTyping === false）プレイヤーのHPを1減らす
        Object.keys(room.players).forEach(pId => {
          if (!room.players[pId].isTyping) {
            room.players[pId].hp = Math.max(0, room.players[pId].hp - 1);
          }
        });

        // 定期ステータス更新を全プレイヤーに送信
        io.to(roomName).emit('tick_status', {
          timeLeft: room.timeLeft,
          players: room.players
        });

        // HP判定またはタイムアップ判定
        const pIds = Object.keys(room.players);
        const p1 = room.players[pIds[0]];
        const p2 = room.players[pIds[1]];

        if (p1.hp <= 0 || p2.hp <= 0 || room.timeLeft <= 0) {
          clearInterval(room.intervalId);

          let winner = "DRAW";
          if (p1.hp > p2.hp) winner = p1.name;
          else if (p2.hp > p1.hp) winner = p2.name;

          io.to(roomName).emit('game_over', {
            winnerName: winner,
            reason: room.timeLeft <= 0 ? "TIME_UP" : "HP_ZERO",
            finalPlayers: room.players
          });

          delete activeRooms[roomName];
        }
      }, 1000);

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

  // ★ タイピング開始 / 停止状態の受け取り
  socket.on('typing_status', (data) => {
    const { roomId, isTyping } = data;
    const room = activeRooms[roomId];
    if (room && room.players[socket.id]) {
      room.players[socket.id].isTyping = isTyping;
    }
  });

  // ★ メッセージ送信（HPが100減る処理）
  socket.on('send_message', (data) => {
    const { roomId, message } = data;
    const room = activeRooms[roomId];

    if (room && room.players[socket.id]) {
      // 送信したら自傷 100 ダメージ
      room.players[socket.id].hp = Math.max(0, room.players[socket.id].hp - 100);
      room.players[socket.id].isTyping = false; // 送信した瞬間はタイピング停止扱い

      io.to(roomId).emit('receive_message', {
        senderId: socket.id,
        senderName: room.players[socket.id].name,
        message: message,
        players: room.players
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔴 切断: ${socket.id}`);
    if (waitingPlayer && waitingPlayer.id === socket.id) {
      waitingPlayer = null;
    }
    // 切断時にタイマーのクリーンアップ処理
    Object.keys(activeRooms).forEach(rName => {
      if (activeRooms[rName].players[socket.id]) {
        clearInterval(activeRooms[rName].intervalId);
        delete activeRooms[rName];
      }
    });
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Yururon Server running on port ${PORT}`);
});
