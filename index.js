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

      // 50%の確率で「前者（A派）」と「後者（B派）」をランダム割り当て
      const isPlayer1Former = Math.random() < 0.5;

      const p1Role = isPlayer1Former ? { side: selectedTheme.sideA, position: "former" } : { side: selectedTheme.sideB, position: "latter" };
      const p2Role = isPlayer1Former ? { side: selectedTheme.sideB, position: "latter" } : { side: selectedTheme.sideA, position: "former" };

      const INITIAL_HP = 10000;

      // ★ ルーム状態の初期設定
      activeRooms[roomName] = {
        theme: selectedTheme.title,
        sideA: selectedTheme.sideA, // 前者テーマ
        sideB: selectedTheme.sideB, // 後者テーマ
        timeLeft: 180, // 3分 (180秒)
        players: {
          [waitingPlayer.id]: {
            name: waitingPlayer.name,
            side: p1Role.side,
            position: p1Role.position, // "former"（前者） または "latter"（後者）
            hp: INITIAL_HP,
            isTyping: false
          },
          [socket.id]: {
            name: data.name,
            side: p2Role.side,
            position: p2Role.position, // "former"（前者） または "latter"（後者）
            hp: INITIAL_HP,
            isTyping: false
          }
        },
        intervalId: null
      };

      waitingPlayer.socket.join(roomName);
      socket.join(roomName);

      // ★ 1人目（待機していた人）へ通知
      waitingPlayer.socket.emit('match_found', {
        opponentName: data.name,
        opponentLevel: data.level,
        theme: selectedTheme.title,
        sideA: selectedTheme.sideA,      // 前者テーマ（例: きのこの山）
        sideB: selectedTheme.sideB,      // 後者テーマ（例: たけのこの里）
        yourSide: p1Role.side,           // 自分の担当（例: きのこの山派）
        yourPosition: p1Role.position,   // "former" (前者) or "latter" (後者)
        opponentSide: p2Role.side,       // 相手の担当
        opponentPosition: p2Role.position,
        initialHp: INITIAL_HP,
        roomId: roomName
      });

      // ★ 2人目（挑戦者）へ通知
      socket.emit('match_found', {
        opponentName: waitingPlayer.name,
        opponentLevel: waitingPlayer.level,
        theme: selectedTheme.title,
        sideA: selectedTheme.sideA,      // 前者テーマ
        sideB: selectedTheme.sideB,      // 後者テーマ
        yourSide: p2Role.side,           // 自分の担当
        yourPosition: p2Role.position,   // "former" (前者) or "latter" (後者)
        opponentSide: p1Role.side,       // 相手の担当
        opponentPosition: p1Role.position,
        initialHp: INITIAL_HP,
        roomId: roomName
      });

      // ★ 1秒ごとのループ処理（放置HP減少 & 制限時間カウント）
      const room = activeRooms[roomName];
      room.intervalId = setInterval(() => {
        if (!activeRooms[roomName]) return;

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

        // 勝敗判定
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
      const sender = room.players[socket.id];
      sender.hp = Math.max(0, sender.hp - 100);
      sender.isTyping = false;

      io.to(roomId).emit('receive_message', {
        senderId: socket.id,
        senderName: sender.name,
        senderSide: sender.side,           // どちらの派閥か
        senderPosition: sender.position,   // "former" (前者) か "latter" (後者) か
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
