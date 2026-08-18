const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

// データベース代わりのメモリ格納用
const usersDB = {};
let waitingQueue = [];
const activeRooms = {};

// お題リスト
const themes = [
  "きのこの山 vs たけのこの里",
  "朝食はパン派 vs ごはん派",
  "生まれ変わるなら犬 vs 猫",
  "夏 vs 冬"
];

// NGワードリスト（サンプル）
const ngWords = ["死ね", "バカ", "キモい", "ゴミ"];

io.on('connection', (socket) => {
  let currentUserId = null;

  // ユーザー認証処理
  socket.on('auth_user', (data) => {
    currentUserId = data.userId;
    if (!usersDB[currentUserId]) {
      usersDB[currentUserId] = {
        name: "名無し",
        level: 1,
        wins: 0
      };
    }
    socket.userId = currentUserId;
    socket.emit('user_data_loaded', usersDB[currentUserId]);
  });

  // 名前変更
  socket.on('update_name', (data) => {
    if (socket.userId && usersDB[socket.userId]) {
      usersDB[socket.userId].name = data.name;
    }
  });

  // マッチングキュー参加
  socket.on('join_match', (data) => {
    // 重複除去（既存の同じソケットIDを排除）
    waitingQueue = waitingQueue.filter(p => p.socketId !== socket.id);

    waitingQueue.push({
      socketId: socket.id,
      userId: socket.userId,
      name: data.name || (usersDB[socket.userId] ? usersDB[socket.userId].name : "名無し")
    });

    processMatching();
  });

  // マッチングのキャンセル
  socket.on('cancel_match', () => {
    waitingQueue = waitingQueue.filter(p => p.socketId !== socket.id);
  });

  // メッセージ送信
  socket.on('send_message', (data) => {
    const room = activeRooms[data.roomId];
    if (!room) return;

    const msg = data.message;
    const player = room.players[socket.id];
    if (!player) return;

    // NGワードチェック
    const containsNG = ngWords.some(word => msg.includes(word));
    if (containsNG) {
      socket.emit('kicked_notification', { reason: "不適切な言語が検知されたためキックされました。" });
      endGame(data.roomId, getOpponentId(room, socket.id), "相手が規約違反により失格");
      return;
    }

    // ダメージ適用（発言すると相手に100ダメージ）
    const oppId = getOpponentId(room, socket.id);
    if (oppId && room.players[oppId]) {
      room.players[oppId].hp = Math.max(0, room.players[oppId].hp - 100);
    }

    io.to(data.roomId).emit('receive_message', {
      senderId: socket.id,
      senderName: player.name,
      senderSide: player.side,
      message: msg
    });

    // HP判定
    if (room.players[oppId] && room.players[oppId].hp <= 0) {
      endGame(data.roomId, socket.id, "相手のHPが0になりました！");
    }
  });

  // タイピング状態（タイピング中はHP現象防止）
  socket.on('typing_status', (data) => {
    const room = activeRooms[data.roomId];
    if (room && room.players[socket.id]) {
      room.players[socket.id].isTyping = data.isTyping;
    }
  });

  // 降参
  socket.on('surrender', (data) => {
    const room = activeRooms[data.roomId];
    if (room) {
      const winnerId = getOpponentId(room, socket.id);
      endGame(data.roomId, winnerId, "相手が降参しました。");
    }
  });

  // ランキングデータ取得
  socket.on('get_ranking', () => {
    const rankingList = Object.values(usersDB)
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 10);
    socket.emit('ranking_data', rankingList);
  });

  // 切断時のゴースト防止処理
  socket.on('disconnect', () => {
    waitingQueue = waitingQueue.filter(p => p.socketId !== socket.id);

    // プレイ中の部屋の離脱処理
    for (const roomId in activeRooms) {
      const room = activeRooms[roomId];
      if (room.players[socket.id]) {
        const winnerId = getOpponentId(room, socket.id);
        endGame(roomId, winnerId, "相手の接続が切断されました。");
        break;
      }
    }
  });
});

// マッチング実行（ゴースト完全防止アルゴリズム）
function processMatching() {
  while (waitingQueue.length >= 2) {
    const player1 = waitingQueue.shift();
    const player2 = waitingQueue.shift();

    // 生存確認（現在も有効に繋がっているソケットか）
    const socket1 = io.sockets.sockets.get(player1.socketId);
    const socket2 = io.sockets.sockets.get(player2.socketId);

    // ゴーストソケットを除外してやり直し
    if (!socket1 || !socket1.connected) {
      if (socket2 && socket2.connected) waitingQueue.unshift(player2);
      continue;
    }
    if (!socket2 || !socket2.connected) {
      if (socket1 && socket1.connected) waitingQueue.unshift(player1);
      continue;
    }

    // 正常な2名で部屋を生成
    const roomId = 'room_' + Math.random().toString(36).substring(2, 9);
    const selectedTheme = themes[Math.floor(Math.random() * themes.length)];

    socket1.join(roomId);
    socket2.join(roomId);

    const level1 = usersDB[player1.userId] ? usersDB[player1.userId].level : 1;
    const level2 = usersDB[player2.userId] ? usersDB[player2.userId].level : 1;

    activeRooms[roomId] = {
      timeLeft: 180,
      theme: selectedTheme,
      players: {
        [player1.socketId]: { userId: player1.userId, name: player1.name, hp: 10000, side: '立場A', isTyping: false },
        [player2.socketId]: { userId: player2.userId, name: player2.name, hp: 10000, side: '立場B', isTyping: false }
      }
    };

    socket1.emit('match_found', {
      roomId: roomId,
      opponentName: player2.name,
      opponentLevel: level2,
      yourSide: '立場A',
      theme: selectedTheme
    });

    socket2.emit('match_found', {
      roomId: roomId,
      opponentName: player1.name,
      opponentLevel: level1,
      yourSide: '立場B',
      theme: selectedTheme
    });

    // 1秒ごとのTickタイマー制御
    activeRooms[roomId].timer = setInterval(() => {
      const room = activeRooms[roomId];
      if (!room) return;

      room.timeLeft -= 1;

      // 毎秒毎にタイピング中でないプレイヤーのHPを1ずつ削る
      Object.keys(room.players).forEach(sId => {
        const p = room.players[sId];
        if (!p.isTyping) {
          p.hp = Math.max(0, p.hp - 1);
        }
      });

      io.to(roomId).emit('tick_status', {
        timeLeft: room.timeLeft,
        players: room.players
      });

      // 試合時間の終了判定
      if (room.timeLeft <= 0) {
        const pIds = Object.keys(room.players);
        let winnerId = null;
        if (room.players[pIds[0]].hp > room.players[pIds[1]].hp) winnerId = pIds[0];
        else if (room.players[pIds[1]].hp > room.players[pIds[0]].hp) winnerId = pIds[1];

        endGame(roomId, winnerId, "制限時間終了！HPの多い方の勝利です。");
      }
    }, 1000);

    break;
  }
}

function getOpponentId(room, mySocketId) {
  return Object.keys(room.players).find(id => id !== mySocketId);
}

function endGame(roomId, winnerSocketId, reason) {
  const room = activeRooms[roomId];
  if (!room) return;

  clearInterval(room.timer);

  let winnerName = "引き分け";
  if (winnerSocketId && room.players[winnerSocketId]) {
    winnerName = room.players[winnerSocketId].name;
    const winnerUserId = room.players[winnerSocketId].userId;
    if (winnerUserId && usersDB[winnerUserId]) {
      usersDB[winnerUserId].wins += 1;
      usersDB[winnerUserId].level = Math.floor(usersDB[winnerUserId].wins / 3) + 1;
    }
  }

  io.to(roomId).emit('game_over', {
    winnerName: winnerName,
    reason: reason
  });

  delete activeRooms[roomId];
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
