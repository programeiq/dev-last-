const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 部屋データとマッチング待ちキューの管理
let waitingPlayer = null;
let rooms = {};

// ランキング用データ（簡易保存）
let rankingList = [
  { name: "ディベートマスター", win: 15 },
  { name: "論破王", win: 10 },
  { name: "ひよこ", win: 3 }
];

// 1. マッチング処理
app.get('/match', (req, res) => {
  const username = req.query.username || '名無し';

  if (waitingPlayer && waitingPlayer.username !== username) {
    const roomName = `room_${Date.now()}`;
    const themes = ["キノコの山 VS タケノコの里", "朝食は パン派 VS ごはん派", "猫派 VS 犬派", "夏 VS 冬"];
    const selectedTheme = themes[Math.floor(Math.random() * themes.length)];

    rooms[roomName] = {
      theme: selectedTheme,
      messages: [],
      hpData: {
        [waitingPlayer.username]: 2000,
        [username]: 2000
      }
    };

    const opponent = waitingPlayer;
    waitingPlayer = null;

    opponent.res.send(`MATCHING_SUCCESS | Room: ${roomName} | ${selectedTheme}`);
    res.send(`MATCHING_SUCCESS | Room: ${roomName} | ${selectedTheme}`);
  } else {
    waitingPlayer = { username, res };
  }
});

// 2. メッセージ送信処理
app.post('/send-message', (req, res) => {
  const { roomName, sender, text, hp } = req.body;
  
  if (rooms[roomName]) {
    rooms[roomName].messages.push({ sender, text });
    if (hp !== undefined) {
      rooms[roomName].hpData[sender] = hp;
    }
    res.json({ status: 'ok' });
  } else {
    res.status(404).json({ error: 'Room not found' });
  }
});

// 3. チャットログ・HP取得処理
app.get('/get-messages', (req, res) => {
  const { roomName } = req.query;
  if (rooms[roomName]) {
    res.json(rooms[roomName]);
  } else {
    res.status(404).json({ error: 'Room not found' });
  }
});

// 4. ゲーム終了処理
app.post('/game-over', (req, res) => {
  const { roomName } = req.body;
  if (rooms[roomName]) {
    delete rooms[roomName];
  }
  res.json({ status: 'cleaned' });
});

// 5. ランキング取得API
app.get('/ranking', (req, res) => {
  let text = "【勝利数ランキング TOP3】\n";
  rankingList.forEach((r, i) => {
    text += `${i + 1}位: ${r.name} (${r.win}勝)\n`;
  });
  res.send(text);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
