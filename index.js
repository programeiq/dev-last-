const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

// お題300選データ（themes.js）を読み込み
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

// 待機中のプレイヤー
let waitingPlayer = null;

// アクティブなルーム情報（HP・時間・プレイヤー状態）を保持
const activeRooms = {};

io.on('connection', (socket) => {
  console.log(`🟢 プレイヤーが接続しました: ${socket.id}`);

  // ==========================================
  // 1. マッチング処理
  // ==========================================
  socket.on('join_match', (data) => {
    console.log(`🔍 マッチング検索: ${data.name} (Lv.${data.level})`);

    if (waitingPlayer && waitingPlayer.id !== socket.id) {
      console.log(`🎉 マッチング成立！: ${waitingPlayer.name} vs ${data.name}`);

      const roomName = `room_${waitingPlayer.id}_${socket.id}`;
      
      // 300個のお題からランダム選択
      const selectedTheme = themes[Math.floor(Math.random() * themes.length)];

      // 50%の確率で「前者（former/sideA）」と「後者（latter/sideB）」をシャッフル割り当て
      const isPlayer1Former = Math.random() < 0.5;
      const p1Role = isPlayer1Former 
        ? { side: selectedTheme.sideA, position: "former" } 
        : { side: selectedTheme.sideB, position: "latter" };
      const p2Role = isPlayer1Former 
        ? { side: selectedTheme.sideB, position: "latter" } 
        : { side: selectedTheme.sideA, position: "former" };

      const INITIAL_HP = 10000;

      // ルームの初期状態をセット
      activeRooms[roomName] = {
        theme: selectedTheme.title,
        sideA: selectedTheme.sideA,
        sideB: selectedTheme.sideB,
        timeLeft: 180, // 制限時間 3分 (180秒)
        players: {
          [waitingPlayer.id]: {
            id: waitingPlayer.id,
            name: waitingPlayer.name,
            level: waitingPlayer.level,
            side: p1Role.side,
            position: p1Role.position, // "former" または "latter"
            hp: INITIAL_HP,
            isTyping: false,
            socket: waitingPlayer.socket
          },
          [socket.id]: {
            id: socket.id,
            name: data.name,
            level: data.level,
            side: p2Role.side,
            position: p2Role.position, // "former" または "latter"
            hp: INITIAL_HP,
            isTyping: false,
            socket: socket
          }
        },
        intervalId: null
      };

      waitingPlayer.socket.join(roomName);
      socket.join(roomName);

      // ★ 1人目（待機していた人）へ送信
      waitingPlayer.socket.emit('match_found', {
        opponentName: data.name,
        opponentLevel: data.level,
        theme: selectedTheme.title,
        sideA: selectedTheme.sideA,
        sideB: selectedTheme.sideB,
        yourSide: p1Role.side,
        yourPosition: p1Role.position,
        opponentSide: p2Role.side,
        opponentPosition: p2Role.position,
        initialHp: INITIAL_HP,
        roomId: roomName
      });

      // ★ 2人目（今マッチングした人）へ送信
      socket.emit('match_found', {
        opponentName: waitingPlayer.name,
        opponentLevel: waitingPlayer.level,
        theme: selectedTheme.title,
        sideA: selectedTheme.sideA,
        sideB: selectedTheme.sideB,
        yourSide: p2Role.side,
        yourPosition: p2Role.position,
        opponentSide: p1Role.side,
        opponentPosition: p1Role.position,
        initialHp: INITIAL_HP,
        roomId: roomName
      });

      // ★ 1秒ごとのループ処理（放置HP減算＆タイマー進行）
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

        // 通信データ用（内部のsocketオブジェクトを除外して送信）
        const sanitizedPlayers = {};
        Object.keys(room.players).forEach(id => {
          const { socket, ...rest } = room.players[id];
          sanitizedPlayers[id] = rest;
        });

        // ルーム全体に毎秒のステータス（HP・残り時間）を更新通知
        io.to(roomName).emit('tick_status', {
          timeLeft: room.timeLeft,
          players: sanitizedPlayers
        });

        // タイムアップまたはHP0による自動決着判定
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
            finalPlayers: sanitizedPlayers
          });

          // Socket.ioのルーム解散・退室処理
          p1.socket.leave(roomName);
          p2.socket.leave(roomName);
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

  // ==========================================
  // 2. タイピング状態更新（打ってる間はHP減少停止）
  // ==========================================
  socket.on('typing_status', (data) => {
    const { roomId, isTyping } = data;
    const room = activeRooms[roomId];
    if (room && room.players[socket.id]) {
      room.players[socket.id].isTyping = isTyping;
    }
  });

  // ==========================================
  // 3. メッセージ送信（相手に 100 ダメージ発生！）
  // ==========================================
  socket.on('send_message', (data) => {
    const { roomId, message } = data;
    const room = activeRooms[roomId];

    if (room && room.players[socket.id]) {
      const sender = room.players[socket.id];
      sender.isTyping = false; // 送信後はタイピング停止状態に戻す

      // ★ 相手のIDを探して、相手のHPを100減らす（攻撃！）
      const opponentId = Object.keys(room.players).find(id => id !== socket.id);
      if (opponentId && room.players[opponentId]) {
        room.players[opponentId].hp = Math.max(0, room.players[opponentId].hp - 100);
      }

      const sanitizedPlayers = {};
      Object.keys(room.players).forEach(id => {
        const { socket, ...rest } = room.players[id];
        sanitizedPlayers[id] = rest;
      });

      // メッセージと最新HP状態をルーム全体にブロードキャスト
      io.to(roomId).emit('receive_message', {
        senderId: socket.id,
        senderName: sender.name,
        senderSide: sender.side,
        senderPosition: sender.position,
        message: message,
        players: sanitizedPlayers
      });
    }
  });

  // ==========================================
  // 4. 降参（サレンダー）処理
  // ==========================================
  socket.on('surrender', (data) => {
    const { roomId } = data;
    const room = activeRooms[roomId];

    if (room) {
      clearInterval(room.intervalId);

      const opponentId = Object.keys(room.players).find(id => id !== socket.id);
      const winnerName = opponentId ? room.players[opponentId].name : "相手";
      const loserName = room.players[socket.id] ? room.players[socket.id].name : "プレイヤー";

      console.log(`🏳️ ${loserName} が降参しました。勝者: ${winnerName}`);

      io.to(roomId).emit('game_over', {
        winnerName: winnerName,
        surrenderedName: loserName,
        reason: "SURRENDER"
      });

      Object.keys(room.players).forEach(pId => {
        if (room.players[pId].socket) {
          room.players[pId].socket.leave(roomId);
        }
      });

      delete activeRooms[roomId];
    }
  });

  // ==========================================
  // 5. 通信切断（Disconnect）保護
  // ==========================================
  socket.on('disconnect', () => {
    console.log(`🔴 切断: ${socket.id}`);
    
    if (waitingPlayer && waitingPlayer.id === socket.id) {
      waitingPlayer = null;
    }

    Object.keys(activeRooms).forEach(rName => {
      const room = activeRooms[rName];
      if (room.players[socket.id]) {
        clearInterval(room.intervalId);

        const opponentId = Object.keys(room.players).find(id => id !== socket.id);
        if (opponentId && room.players[opponentId]) {
          io.to(rName).emit('game_over', {
            winnerName: room.players[opponentId].name,
            reason: "DISCONNECT"
          });
          room.players[opponentId].socket.leave(rName);
        }

        delete activeRooms[rName];
      }
    });
  });
});

// ポート設定 & サーバー起動
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Yururon Server running on port ${PORT}`);
});
