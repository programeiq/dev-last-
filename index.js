const express = require('express');
const app = express();

// CORS設定
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

const PORT = process.env.PORT || 3000;

let waitingPlayer = null;
let rooms = {};

// ★ IDをキーにしてプレイヤーデータを管理する
let playerRankings = {
  "user_1001": { name: "ディベート神", level: 99, exp: 50, label: "伝説", updatedAt: Date.now() },
  "user_1002": { name: "論理の鬼", level: 42, exp: 10, label: "ベテラン", updatedAt: Date.now() }
};

// データの更新・保存関数
function saveOrUpdatePlayer(userId, name, level, exp, label) {
  if (!userId) return;

  // プレイヤーが存在しない、またはレベル/EXPが上の場合に更新
  const current = playerRankings[userId];
  if (!current || level > current.level || (level === current.level && exp > current.exp)) {
    playerRankings[userId] = {
      name: name || '名無し',
      level: parseInt(level) || 1,
      exp: parseInt(exp) || 0,
      label: label || '一般人',
      updatedAt: Date.now()
    };
  }
}

// ★ 定期更新用API（フロントから5分ごとに叩かれる）
app.post('/update-score', (req, res) => {
  const { userId, name, level, exp, label } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  saveOrUpdatePlayer(userId, name, level, exp, label);
  res.json({ status: 'success', message: 'Ranking updated!' });
});

// マッチング処理
app.get('/match', (req, res) => {
  const username = req.query.username || '名無し';
  const userId = req.query.userId || `guest_${Date.now()}`;

  if (waitingPlayer && waitingPlayer.username !== username) {
    const roomName = `room_${Date.now()}`;
    const themes = ["キノコの山 VS タケノコの里", "朝食は パン派 VS ごはん派", "猫派 VS 犬派"];
    const selectedTheme = themes[Math.floor(Math.random() * themes.length)];

    rooms[roomName] = {
      theme: selectedTheme,
      messages: [],
      hpData: { [waitingPlayer.username]: 2000, [username]: 2000 }
    };

    const opponent = waitingPlayer;
    waitingPlayer = null;

    opponent.res.send(`MATCHING_SUCCESS | Room: ${roomName} | ${selectedTheme}`);
    res.send(`MATCHING_SUCCESS | Room: ${roomName} | ${selectedTheme}`);
  } else {
    waitingPlayer = { username, userId, res };
  }
});

// メッセージ送信
app.post('/send-message', (req, res) => {
  const { roomName, sender, text, hp } = req.body;
  if (rooms[roomName]) {
    rooms[roomName].messages.push({ sender, text });
    if (hp !== undefined) rooms[roomName].hpData[sender] = hp;
    res.json({ status: 'ok' });
  } else {
    res.status(404).json({ error: 'Room not found' });
  }
});

// メッセージ取得
app.get('/get-messages', (req, res) => {
  const { roomName } = req.query;
  if (rooms[roomName]) res.json(rooms[roomName]);
  else res.status(404).json({ error: 'Room not found' });
});

// ゲーム終了
app.post('/game-over', (req, res) => {
  const { roomName } = req.body;
  if (rooms[roomName]) delete rooms[roomName];
  res.json({ status: 'cleaned' });
});

// ★ ID付き・レベル順ランキング表示API
app.get('/ranking', (req, res) => {
  // 配列化してレベル（Lv）順 -> EXP順で並び替え
  let sortedList = Object.keys(playerRankings).map(id => {
    return {
      id: id,
      ...playerRankings[id]
    };
  }).sort((a, b) => {
    if (b.level !== a.level) return b.level - a.level;
    return b.exp - a.exp;
  });

  let text = "【殿堂入り IDレベルランキング TOP3】\n\n";
  const top10 = sortedList.slice(0, 10);

  top10.forEach((player, index) => {
    let crown = "  ";
    if (index === 0) crown = "🥇 ";
    else if (index === 1) crown = "🥈 ";
    else if (index === 2) crown = "🥉 ";

    // IDを一部伏字にする場合はここで加工も可能
    const displayId = player.id.length > 12 ? player.id.substring(0, 10) + "..." : player.id;

    text += `${crown}${index + 1}位 : ${player.name} (ID: ${displayId})\n`;
    text += `      └ Lv.${player.level} [${player.label}]\n\n`;
  });

  res.send(text);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
