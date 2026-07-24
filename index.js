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

// ★ ダミーデータをすべて消去！空の状態でスタートします
let playerRankings = {};

// データの更新・保存関数
function saveOrUpdatePlayer(userId, name, level, exp, label) {
  if (!userId) return;

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

// 5分ごとの定期送信API
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

  // 1. もし待機中のプレイヤーが自分自身（または同じID）なら、古い待機をリセット
  if (waitingPlayer && (waitingPlayer.userId === userId || waitingPlayer.username === username)) {
    waitingPlayer = null;
  }

  // 2. 他の待機プレイヤーがいる場合 ➔ マッチング成立！
  if (waitingPlayer) {
    const roomName = `room_${Date.now()}`;
    const themes = [
      { topic: "キノコの山 VS タケノコの里", sideA: "キノコの山", sideB: "タケノコの里" },
      { topic: "朝食は パン派 VS ごはん派", sideA: "パン派", sideB: "ごはん派" },
      { topic: "猫派 VS 犬派", sideA: "猫派", sideB: "犬派" },
      { topic: "夏 VS 冬", sideA: "夏", sideB: "冬" }
    ];
    const selectedTheme = themes[Math.floor(Math.random() * themes.length)];

    rooms[roomName] = {
      theme: selectedTheme.topic,
      messages: [],
      hpData: { [waitingPlayer.username]: 2000, [username]: 2000 }
    };

    const opponent = waitingPlayer;
    waitingPlayer = null; // 待機枠を空にする

    // 1人目（待っていた人）＝ 前者(sideA)
    opponent.res.send(`MATCHING_SUCCESS | Room: ${roomName} | ${selectedTheme.topic} | YOUR_SIDE: ${selectedTheme.sideA}`);
    
    // 2人目（今来た人）＝ 後者(sideB)
    res.send(`MATCHING_SUCCESS | Room: ${roomName} | ${selectedTheme.topic} | YOUR_SIDE: ${selectedTheme.sideB}`);

  } else {
    // 3. 誰も待っていない場合 ➔ 自分が待機プレイヤーになる
    waitingPlayer = { username, userId, res };

    // ★ 💡 【ここが重要！】
    // 待機中にブラウザを閉じたりリロードしたりしたら、即座に幽霊データを削除する！
    req.on('close', () => {
      if (waitingPlayer && waitingPlayer.res === res) {
        waitingPlayer = null;
      }
    });
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

// ランキング取得API
app.get('/ranking', (req, res) => {
  let sortedList = Object.keys(playerRankings).map(id => {
    return {
      id: id,
      ...playerRankings[id]
    };
  }).sort((a, b) => {
    if (b.level !== a.level) return b.level - a.level;
    return b.exp - a.exp;
  });

  if (sortedList.length === 0) {
    return res.send("【殿堂入り IDレベルランキング】\n\n現在ランキングデータはありません。");
  }

  let text = "【殿堂入り IDレベルランキング TOP3】\n\n";
  const top10 = sortedList.slice(0, 10);

  top10.forEach((player, index) => {
    let crown = "  ";
    if (index === 0) crown = "🥇 ";
    else if (index === 1) crown = "🥈 ";
    else if (index === 2) crown = "🥉 ";

    const displayId = player.id.length > 12 ? player.id.substring(0, 10) + "..." : player.id;

    text += `${crown}${index + 1}位 : ${player.name} (ID: ${displayId})\n`;
    text += `      └ Lv.${player.level} [${player.label}]\n\n`;
  });

  res.send(text);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
