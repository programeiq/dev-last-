const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

// データ保存用ファイルのパス
const DATA_FILE = path.join(__dirname, 'users.json');

// ファイルからユーザーデータを読み込む関数
function loadUserData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("データ読み込みエラー:", err);
  }
  return {};
}

// ファイルへユーザーデータを書き出す関数
function saveUserData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(dbUsers, null, 2), 'utf8');
  } catch (err) {
    console.error("データ保存エラー:", err);
  }
}

// 永続化用データベース（サーバー再起動しても保持される）
// 形式: { "user_xyz123": { name: "名無し", level: 1, wins: 5 } }
const dbUsers = loadUserData();

// メモリ用（アクティブなソケットIDとユーザーIDの紐付け）
const socketToUserId = {};
let waitingPlayer = null;
const rooms = {};

const ngWords = ["死ね", "殺す", "バカ", "アホ", "キチガイ"];
const themes = [
  "きのこの山 VS たけのこの里",
  "朝食はパン派 VS ごはん派",
  "犬派 VS 猫派",
  "夏 VS 冬"
];

io.on('connection', (socket) => {
  console.log(`ユーザー接続: ${socket.id}`);

  // ★ PC/スマホ固有のIDを受け取り、データを同期・保存
  socket.on('auth_user', (data) => {
    const userId = data.userId;
    if (!userId) return;

    socketToUserId[socket.id] = userId;

    // 初めてのPCなら初期化、登録済みならデータをロード
    if (!dbUsers[userId]) {
      dbUsers[userId] = {
        name: "名無し",
        level: 1,
        wins: 0
      };
      saveUserData();
    }

    // クライアントへ現在のステータス（レベルや勝数）を返送
    socket.emit('user_data_loaded', dbUsers[userId]);
  });

  // 名前変更イベント
  socket.on('update_name', (data) => {
    const userId = socketToUserId[socket.id];
    const newName = data.name || "名無し";
    socket.userName = newName;

    if (userId && dbUsers[userId]) {
      dbUsers[userId].name = newName;
      saveUserData(); // ファイルへ保存
    }
  });

  // 1. マッチング処理
  socket.on('join_match', (data) => {
    const userId = socketToUserId[socket.id];
    const userName = data.name || "名無し";
    socket.userName = userName;

    if (userId && dbUsers[userId]) {
      dbUsers[userId].name = userName;
      saveUserData();
    }

    if (waitingPlayer && waitingPlayer.id !== socket.id) {
      const roomId = `room_${Date.now()}`;
      const theme = themes[Math.floor(Math.random() * themes.length)];

      const player1 = waitingPlayer;
      const player2 = socket;

      player1.join(roomId);
      player2.join(roomId);

      rooms[roomId] = {
        id: roomId,
        theme: theme,
        timeLeft: 180,
        timer: null,
        players: {
          [player1.id]: { id: player1.id, name: player1.userName, side: "論者A", hp: 10000, isTyping: false },
          [player2.id]: { id: player2.id, name: player2.userName, side: "論者B", hp: 10000, isTyping: false }
        }
      };

      player1.emit('match_found', {
        roomId,
        theme,
        yourSide: "論者A",
        opponentName: player2.userName,
        opponentLevel: 1
      });

      player2.emit('match_found', {
        roomId,
        theme,
        yourSide: "論者B",
        opponentName: player1.userName,
        opponentLevel: 1
      });

      startRoomTimer(roomId);
      waitingPlayer = null;
    } else {
      waitingPlayer = socket;
    }
  });

  // 2. メッセージ送信 & NGワードチェック
  socket.on('send_message', (data) => {
    const room = rooms[data.roomId];
    if (!room) return;

    const msg = data.message;
    const player = room.players[socket.id];
    if (!player) return;

    const hasNgWord = ngWords.some(word => msg.includes(word));
    if (hasNgWord) {
      socket.emit('kicked_notification', {
        isBanned: false,
        reason: "不適切・暴言NGワードが検知されたためキックされました。"
      });

      const opponentId = Object.keys(room.players).find(id => id !== socket.id);
      recordWin(opponentId);
      const winnerName = room.players[opponentId] ? room.players[opponentId].name : "相手";
      endGame(data.roomId, winnerName, "OPPONENT_KICKED");
      return;
    }

    const opponentId = Object.keys(room.players).find(id => id !== socket.id);
    if (opponentId && room.players[opponentId]) {
      room.players[opponentId].hp = Math.max(0, room.players[opponentId].hp - 100);
    }

    io.to(data.roomId).emit('receive_message', {
      senderId: socket.id,
      senderName: player.name,
      senderSide: player.side,
      message: msg,
      players: room.players
    });

    if (opponentId && room.players[opponentId].hp <= 0) {
      recordWin(socket.id);
      endGame(data.roomId, player.name, "HP_ZERO");
    }
  });

  // 3. 降参処理
  socket.on('surrender', (data) => {
    const room = rooms[data.roomId];
    if (!room) return;

    const opponentId = Object.keys(room.players).find(id => id !== socket.id);
    const winnerName = room.players[opponentId] ? room.players[opponentId].name : "相手";

    if (opponentId) {
      recordWin(opponentId);
    }
    endGame(data.roomId, winnerName, "SURRENDER");
  });

  // 4. ランキングデータ取得
  socket.on('get_ranking', () => {
    const rankingList = Object.keys(dbUsers)
      .map(id => ({
        name: dbUsers[id].name,
        wins: dbUsers[id].wins,
        level: dbUsers[id].level
      }))
      .filter(item => item.wins > 0)
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 10);

    socket.emit('ranking_data', rankingList);
  });

  // 5. 切断イベント
  socket.on('disconnect', () => {
    console.log(`ユーザー切断: ${socket.id}`);

    if (waitingPlayer && waitingPlayer.id === socket.id) {
      waitingPlayer = null;
    }

    Object.keys(rooms).forEach(roomId => {
      const room = rooms[roomId];
      if (room.players[socket.id]) {
        const opponentId = Object.keys(room.players).find(id => id !== socket.id);
        const winnerName = room.players[opponentId] ? room.players[opponentId].name : "相手";

        if (opponentId) {
          recordWin(opponentId);
        }
        endGame(roomId, winnerName, "DISCONNECTED");
      }
    });

    delete socketToUserId[socket.id];
  });
});

function startRoomTimer(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  room.timer = setInterval(() => {
    room.timeLeft -= 1;

    Object.keys(room.players).forEach(pId => {
      const p = room.players[pId];
      if (!p.isTyping) {
        p.hp = Math.max(0, p.hp - 1);
      }
    });

    io.to(roomId).emit('tick_status', {
      timeLeft: room.timeLeft,
      players: room.players
    });

    const pIds = Object.keys(room.players);
    if (pIds.length === 2) {
      const p1 = room.players[pIds[0]];
      const p2 = room.players[pIds[1]];

      if (p1.hp <= 0 || p2.hp <= 0) {
        let winnerName = "DRAW";
        if (p1.hp > p2.hp) {
          winnerName = p1.name;
          recordWin(p1.id);
        } else if (p2.hp > p1.hp) {
          winnerName = p2.name;
          recordWin(p2.id);
        }
        endGame(roomId, winnerName, "HP_ZERO");
        return;
      }
    }

    if (room.timeLeft <= 0) {
      const p1 = room.players[pIds[0]];
      const p2 = room.players[pIds[1]];
      let winnerName = "DRAW";

      if (p1 && p2) {
        if (p1.hp > p2.hp) {
          winnerName = p1.name;
          recordWin(p1.id);
        } else if (p2.hp > p1.hp) {
          winnerName = p2.name;
          recordWin(p2.id);
        }
      }
      endGame(roomId, winnerName, "TIME_UP");
    }
  }, 1000);
}

// ★ 勝利数とレベルを記録してファイルに永続保存する関数
function recordWin(socketId) {
  const userId = socketToUserId[socketId];
  if (userId && dbUsers[userId]) {
    dbUsers[userId].wins += 1;
    // 3勝ごとにレベルアップする例（ロジックは自由に変更可能）
    dbUsers[userId].level = Math.floor(dbUsers[userId].wins / 3) + 1;
    saveUserData(); // ファイルへ保存！
  }
}

function endGame(roomId, winnerName, reason) {
  const room = rooms[roomId];
  if (!room) return;

  clearInterval(room.timer);
  io.to(roomId).emit('game_over', { winnerName, reason });
  delete rooms[roomId];
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
