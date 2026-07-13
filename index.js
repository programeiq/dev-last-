const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// ✨ 【新機能】ディベートのお題リスト（お好きなものに自由に変えられます！）
const themeList = [
    "きのこの山 vs たけのこの里",
    "一生旅行するなら：国内 vs 海外",
    "生まれ変わるなら：犬 vs 猫",
    "朝食は：ご飯派 vs パン派",
    "タイムマシンで行くなら：過去 vs 未来"
];

let waitingPlayer = null; 
let roomCount = 0;
let chatMessages = {};
let roomThemes = {}; // ✨ 部屋ごとのお題を保存する場所

app.get('/match', (req, res) => {
    console.log('📡 マッチング要求を受信しました！');

    if (waitingPlayer === null) {
        waitingPlayer = res; 
        console.log('👤 1人目が待機中...');
    } else {
        roomCount++;
        const roomName = `ROOM_${String(roomCount).padStart(3, '0')}`; 
        
        // ✨ ランダムにお題を1つ選択して保存
        const randomTheme = themeList[Math.floor(Math.random() * themeList.length)];
        roomThemes[roomName] = randomTheme;

        console.log(`🎉 マッチング成立！ 【${roomName}】 お題: ${randomTheme}`);

        chatMessages[roomName] = [];

        // 画面側でお題を読み取れるように、お返事の文字の形を変えます
        // 例: "MATCHING_SUCCESS: ROOM_001 | きのこの山 vs たけのこの里"
        const successMessage = `MATCHING_SUCCESS: ${roomName} | ${randomTheme}`;
        waitingPlayer.send(successMessage);
        res.send(successMessage);

        waitingPlayer = null;
    }
});

app.post('/send-message', (req, res) => {
    const { roomName, sender, text } = req.body;
    if (chatMessages[roomName]) {
        chatMessages[roomName].push({ sender, text });
    }
    res.send('OK');
});

app.get('/get-messages', (req, res) => {
    const roomName = req.query.roomName;
    if (chatMessages[roomName]) {
        res.json(chatMessages[roomName]);
    } else {
        res.json([]);
    }
});

app.get('/ranking', (req, res) => {
    res.send('1位: たろう 99勝\n2位: じろう 88勝\n3位: さぶろう 77勝');
});

app.listen(PORT, () => {
    console.log(`🚀 ゆるろんサーバーがポート ${PORT} で元気に起動したよ！`);
});
