const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

// お題データ＆NGワードデータの読み込み
const themes = require('./themes');
const ngWords = require('./ngwords');

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

// アクティブなルーム情報
const activeRooms = {};

// ★ プレイヤーのペナルティ管理データ
// userPenalties[userName] = { kickCount: 0, isBanned: false }
const userPenalties = {};

// ★ NGワード判定関数（誤検知対策版）
function containsNGWord(text) {
  if (!text) return false;

  // 全角英数やスペースを正規化して小文字化
  let cleanText = text.replace(/\s+/g, '').toLowerCase();

  // ①【誤検知対策】日常会話の「〜だしね」「〜私ね」「〜ですしね」などを一時的に除去して安全化
  cleanText = cleanText
    .replace(/(だ|です|私|た|し)しね([あ-んア-ンa-zA-Z]*)/g, '') // 「〜だしね」「私ね」等を無効化
    .replace(/かしね/g, '')                                     // 「〜かしね」等を無効化
    .replace(/らしね/g, '');                                     // 「〜らしね」等を無効化

  // ② 明確な暴言パターン（正規表現で判定）
  const explicitViolations = [
    /死ね/,                           // 漢字の「死ね」
    /しね([よゆやっぁ-ぉお!！?？]*)/,          // 「しね」「しねよ」「しねぇ」などのひらがな暴言
    /殺す/, /ころす/,
    /失せろ/, /うせろ/,
    /消えろ/, /きえろ/
  ];

  // パターン判定（正規表現チェック）
  const isExplicitMatch = explicitViolations.some(pattern => pattern.test(cleanText));
  
  // 単純なNGワードリスト判定（「バカ」「ゴミ」など）
  const isSimpleMatch = ngWords.some(word => cleanText.includes(word.toLowerCase()));

  return isExplicitMatch || isSimpleMatch;
}

io.on('connection', (socket) => {
  console.log(`🟢 プレイヤーが接続しました: ${socket.id}`);

  // ==========================================
  // 1. マッチング処理
  // ==========================================
  socket.on('join_match', (data) => {
    const userName = data.name ? data.name.trim() : "名無し";

    // ★ BAN済みチェック
    if (userPenalties[userName] && userPenalties[userName].isBanned) {
      console.log(`🚫 BAN中のユーザーの接続を拒否しました: ${userName}`);
      socket.emit('banned_notification', {
        reason: "暴言・不適切な発言が3回検知されたため、アカウントがBANされています。"
      });
      return;
    }

    console.log(`🔍 マッチング検索: ${userName} (Lv.${data.level})`);

    if (waitingPlayer && waitingPlayer.id !== socket.id) {
      console.log(`🎉 マッチング成立！: ${waitingPlayer.name} vs ${userName}`);

      const roomName = `room_${waitingPlayer.id}_${socket.id}`;
      const selectedTheme = themes[Math.floor(Math.random() * themes.length)];

      const isPlayer1Former = Math.random() < 0.5;
      const p1Role = isPlayer1Former 
        ? { side: selectedTheme.sideA, position: "former" } 
        : { side: selectedTheme.sideB, position: "latter" };
      const p2Role = isPlayer1Former 
        ? { side: selectedTheme.sideB, position: "latter" } 
        : { side: selectedTheme.sideA, position: "former" };

      const INITIAL_HP = 10000;

      activeRooms[roomName] = {
        theme: selectedTheme.title,
        sideA: selectedTheme.sideA,
        sideB: selectedTheme.sideB,
        timeLeft: 180,
        players: {
          [waitingPlayer.id]: {
            id: waitingPlayer.id,
            name: waitingPlayer.name,
            level: waitingPlayer.level,
            side: p1Role.side,
            position: p1Role.position,
            hp: INITIAL_HP,
            isTyping: false,
            socket: waitingPlayer.socket
          },
          [socket.id]: {
            id: socket.id,
            name: userName,
            level: data.level,
            side: p2Role.side,
            position: p2Role.position,
            hp: INITIAL_HP,
            isTyping: false,
            socket: socket
          }
        },
        intervalId: null
      };

      waitingPlayer.socket.join(roomName);
      socket.join(roomName);

      waitingPlayer.socket.emit('match_found', {
        opponentName: userName,
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

      const room = activeRooms[roomName];
      room.intervalId = setInterval(() => {
        if (!activeRooms[roomName]) return;

        room.timeLeft -= 1;

        // タイピング中ではないプレイヤーのHPを毎秒1削減
        Object.keys(room.players).forEach(pId => {
          if (!room.players[pId].isTyping) {
            room.players[pId].hp = Math.max(0, room.players[pId].hp - 1);
          }
        });

        const sanitizedPlayers = {};
        Object.keys(room.players).forEach(id => {
          const { socket, ...rest } = room.players[id];
          sanitizedPlayers[id] = rest;
        });

        io.to(roomName).emit('tick_status', {
          timeLeft: room.timeLeft,
          players: sanitizedPlayers
        });

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

          p1.socket.leave(roomName);
          p2.socket.leave(roomName);
          delete activeRooms[roomName];
        }
      }, 1000);

      waitingPlayer = null;

    } else {
      waitingPlayer = {
        id: socket.id,
        name: userName,
        level: data.level,
        socket: socket
      };
      console.log(`⏳ 待機登録: ${userName}`);
    }
  });

  // ==========================================
  // 2. タイピング状態更新
  // ==========================================
  socket.on('typing_status', (data) => {
    const { roomId, isTyping } = data;
    const room = activeRooms[roomId];
    if (room && room.players[socket.id]) {
      room.players[socket.id].isTyping = isTyping;
    }
  });

  // ==========================================
  // 3. メッセージ送信（NG判定・ダメージ100発生）
  // ==========================================
  socket.on('send_message', (data) => {
    const { roomId, message } = data;
    const room = activeRooms[roomId];

    if (room && room.players[socket.id]) {
      const sender = room.players[socket.id];
      const userName = sender.name;

      // ★ NGワードのチェック
      if (containsNGWord(message)) {
        console.log(`⚠️ NGワード検知！ 発言者: ${userName} ("${message}")`);

        if (!userPenalties[userName]) {
          userPenalties[userName] = { kickCount: 0, isBanned: false };
        }

        userPenalties[userName].kickCount += 1;
        const currentKicks = userPenalties[userName].kickCount;

        clearInterval(room.intervalId);

        const opponentId = Object.keys(room.players).find(id => id !== socket.id);
        const opponentName = opponentId ? room.players[opponentId].name : "相手";

        if (currentKicks >= 3) {
          // 3回目で BAN
          userPenalties[userName].isBanned = true;
          console.log(`🔨 ${userName} をBAN（アカウント停止）にしました。`);

          socket.emit('kicked_notification', {
            reason: `不適切な発言（NGワード）が検出されました。\n警告回数が3回に達したため、アカウントがBANされました。`,
            isBanned: true
          });

          if (opponentId && room.players[opponentId]) {
            room.players[opponentId].socket.emit('game_over', {
              winnerName: opponentName,
              reason: "OPPONENT_BANNED"
            });
          }
        } else {
          // 1〜2回目は キック 処理
          console.log(`⚠️ ${userName} をキックしました (${currentKicks}/3回)`);

          socket.emit('kicked_notification', {
            reason: `不適切な発言（NGワード）が検出されたため、部屋からキックされました。\n（累積警告: ${currentKicks}/3回。3回でBANになります）`,
            isBanned: false,
            kickCount: currentKicks
          });

          if (opponentId && room.players[opponentId]) {
            room.players[opponentId].socket.emit('game_over', {
              winnerName: opponentName,
              reason: "OPPONENT_KICKED"
            });
          }
        }

        Object.keys(room.players).forEach(pId => {
          if (room.players[pId].socket) {
            room.players[pId].socket.leave(roomId);
          }
        });
        delete activeRooms[roomId];

        return; // NG判定時はメッセージ送信処理をスキップ
      }

      // --- 通常メッセージ送信（相手に100ダメージ） ---
      sender.isTyping = false;

      const opponentId = Object.keys(room.players).find(id => id !== socket.id);
      if (opponentId && room.players[opponentId]) {
        room.players[opponentId].hp = Math.max(0, room.players[opponentId].hp - 100);
      }

      const sanitizedPlayers = {};
      Object.keys(room.players).forEach(id => {
        const { socket, ...rest } = room.players[id];
        sanitizedPlayers[id] = rest;
      });

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
