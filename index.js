const express = require('express');
const app = express();

// CORS許可（ブラウザからの通信を許可）
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

const PORT = process.env.PORT || 3000;

let waitingPlayer = null;
let rooms = {};

// ★ プレイヤーのレベルデータを保存するオブジェクト（メモリ保存）
// 形式: { "ユーザー名": { level: 10, exp: 50, label: "口喧嘩 of ヒヨコ" } }
let playerRankings = {
  "ディベート神": { level: 100, exp: 0, label: "伝説 of ディベーター" },
  "論理モンスター": { level: 45, exp: 80, label: "論破 of ニワトリ" },
  "ビギナー君": { level: 5, exp: 20, label: "ゆるろん初心者" }
};

// プレイヤーのデータを更新・登録するヘルパー関数
function updatePlayerScore(rawUsername) {
  if (!rawUsername) return;

  // 例: "太郎 [Lv.15 (EXP: 40/100)]" や "太郎 [Lv.15 (称号)]" などの文字列から解析
  // または名前単体の場合に対応
  const nameMatch = rawUsername.match(/^([^\[]+)/);
  const cleanName = nameMatch ? nameMatch[1].trim() : rawUsername.trim();

  const lvMatch = rawUsername.match(/Lv\.(\d+|MAX)/);
  let level = 1;
  if (lvMatch) {
    level = lvMatch[1] === 'MAX' ? 100 : parseInt(lvMatch[1]);
  }

  const expMatch = rawUsername.match(/EXP:\s*(\d+)/);
  let exp = expMatch ? parseInt(expMatch[1]) : 0;

  const labelMatch = rawUsername.match(/\(([^)]+)\)/);
  let label = labelMatch ? labelMatch[1] : 'ゆるろんプレイヤー';

  // 既存の記録より高いレベルの場合（または未登録の場合）に更新
  if (!playerRankings[cleanName] || level > playerRankings[cleanName].level || (level === playerRankings[cleanName].level && exp > playerRankings[cleanName].exp)) {
    playerRankings[cleanName] = { level, exp, label };
  }
}

// 1. マッチング処理
app.get('/match', (req, res) => {
  const username = req.query.username || '名無し';

  // ★ プレイヤー情報をランキングデータに更新
  updatePlayerScore(username);

  if (waitingPlayer && waitingPlayer.username !== username) {
    const roomName = `room_${Date.now()}`;
    const themes = ["キノコの山 VS タケノコの里", "朝食は パン派 VS ごはん派", "猫派 VS 犬派", "夏 VS 冬", "持ち家 VS 賃貸"];
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

// ★ 5. 本格レベルランキングAPI
app.get('/ranking', (req, res) => {
  // 配列に変換してレベル（Lv）順 ➔ EXP順にソート
  let sortedList = Object.keys(playerRankings).map(name => {
    return {
      name: name,
      level: playerRankings[name].level,
      exp: playerRankings[name].exp,
      label: playerRankings[name].label
    };
  }).sort((a, b) => {
    if (b.level !== a.level) return b.level - a.level;
    return b.exp - a.exp;
  });

  // 上位10件を綺麗にフォーマット
  let text = "🏆【レベル最強ランキング TOP10】🏆\n\n";
  const top10 = sortedList.slice(0, 10);

  top10.forEach((player, index) => {
    let crown = "  ";
    if (index === 0) ;
    else if (index === 1)  ;
    else if (index === 2)  ";

    let lvDisplay = player.level >= 100 ? "Lv.MAX" : `Lv.${player.level}`;
    text += `${crown}${index + 1}位 : ${player.name}\n`;
    text += `      └ ${lvDisplay} [${player.label}]\n\n`;
  });

  res.send(text);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
