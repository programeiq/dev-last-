const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// CORS設定（どこからでも接続できるように許可）
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 静的ファイル（index.html等）の配信設定
app.use(express.static(path.join(__dirname, './')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// テスト用ランキングデータ（仮）
app.get('/ranking', (req, res) => {
  res.json([
    { name: 'ひよこマスター', level: 99 },
    { name: '論破王', level: 50 },
    { name: '初心者', level: 1 }
  ]);
});

// ★ 待機中のプレイヤーを保持する配列
let waitingPlayer = null;

// お題リスト
const themes = [
  "きのこの山 vs たけのこの里",
  "犬 vs 猫",
  "朝型 vs 夜型",
  "夏 vs 冬",
  "持ち家 vs 賃貸"
];

// Socket.ioの通信処理
io.on('connection', (socket) => {
  console.log(`🟢 プレイヤーが接続しました: ${socket.id}`);

  // マッチングリクエスト（PLAYボタンが押された時）
  socket.on('join_match', (data) => {
    console.log(`🔍 マッチング検索開始: ${data.name} (Lv.${data.level}) - Socket ID: ${socket.id}`);

    // もしすでに待機中の人がいて、それが自分じゃない場合 -> マッチング成立！
    if (waitingPlayer && waitingPlayer.id !== socket.id) {
      console.log(`🎉 マッチング成立！: ${waitingPlayer.name} vs ${data.name}`);

      const roomName = `room_${waitingPlayer.id}_${socket.id}`;
      const randomTheme = themes[Math.floor(Math.random() * themes.length)];

      // 2人を同じルームに参加させる
      waitingPlayer.socket.join(roomName);
      socket.join(roomName);

      // 1人目（待機していた人）へ通知
      waitingPlayer.socket.emit('match_found', {
        opponentName: data.name,
        opponentLevel: data.level,
        theme: randomTheme,
        roomId: roomName
      });

      // 2人目（今入ってきた人）へ通知
      socket.emit('match_found', {
        opponentName: waitingPlayer.name,
        opponentLevel: waitingPlayer.level,
        theme: randomTheme,
        roomId: roomName
      });

      // 待機プレイヤーをリセット
      waitingPlayer = null;

    } else {
      // 誰も待っていない場合 -> 自分が待機プレイヤーになる
      waitingPlayer = {
        id: socket.id,
        name: data.name,
        level: data.level,
        socket: socket
      };
      console.log(`⏳ 待機プレイヤーとして登録されました: ${data.name}`);
    }
  });

  // チャットメッセージの送受信
  socket.on('send_message', (data) => {
    // 自分が参加しているルームにだけメッセージを転送
    socket.broadcast.emit('receive_message', data);
  });

  // 切断時の処理
  socket.on('disconnect', () => {
    console.log(`🔴 プレイヤーが切断しました: ${socket.id}`);
    if (waitingPlayer && waitingPlayer.id === socket.id) {
      waitingPlayer = null;
      console.log(`🧹 待機中のプレイヤーが離脱したためリストをクリアしました`);
    }
  });
});

// サーバー起動（PORTはRenderの環境変数に対応）
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Yururon Server running on port ${PORT}`);
});
