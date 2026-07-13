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
let roomThemes = {}; 
let roomHP = {}; // ✨ 【新機能】部屋ごとのプレイヤーのHPを保存する場所

app.get('/match', (req, res) => {
    console.log('📡 マッチング要求を受信しました！');

    if (waitingPlayer === null) {
        waitingPlayer = res; 
        console.log('👤 1人目が待機中...');
    } else {
        roomCount++;
        const roomName = `ROOM_${String(roomCount).padStart(3, '0')}`; 
        
        const randomTheme = themeList[Math.floor(Math.random() * themeList.length)];
        roomThemes[roomName] = randomTheme;

        chatMessages[roomName] = [];
        
        // ✨ 【新機能】初期HPを100にセット（初期状態はプレイヤー名がまだ紐づかないので空オブジェクト）
        roomHP[roomName] = {
            players: {},
            isOver: false
        };

        console.log(`🎉 マッチング成立！ 【${roomName}】`);

        const successMessage = `MATCHING_SUCCESS: ${roomName} | ${randomTheme}`;
        waitingPlayer.send(successMessage);
        res.send(successMessage);

        waitingPlayer = null;
    }
});

// ✨ 【新機能】メッセージ送信と同時に、相手にダメージを与える処理
app.post('/send-message', (req, res) => {
    const { roomName, sender, text } = req.body;
    
    if (chatMessages[roomName] && !roomHP[roomName].isOver) {
        chatMessages[roomName].push({ sender, text });

        // 送信してきたプレイヤーのHP枠がまだ無ければ作成(100)
        if (!roomHP[roomName].players[sender]) {
            roomHP[roomName].players[sender] = 100;
        }

        // 1文字＝1ダメージとして計算（空白は除く）
        const damage = text.replace(/\s+/g, '').length;

        // 自分以外のプレイヤー（＝相手）のHPを削る
        Object.keys(roomHP[roomName].players).forEach(player => {
            if (player !== sender) {
                roomHP[roomName].players[player] -= damage;
                if (roomHP[roomName].players[player] < 0) {
                    roomHP[roomName].players[player] = 0;
                }
            }
        });
    }
    res.send('OK');
});

// ✨ 【新機能】チャットと一緒に、現在のHP状況もまとめて画面に返す
app.get('/get-messages', (req, res) => {
    const roomName = req.query.roomName;
    if (chatMessages[roomName]) {
        res.json({
            messages: chatMessages[roomName],
            hpData: roomHP[roomName].players,
            isOver: roomHP[roomName].isOver
        });
    } else {
        res.json({ messages: [], hpData: {}, isOver: false });
    }
});

// ✨ 【新機能】どちらかが倒れた、またはタイムアップした時にサーバー側で終了フラグを立てる
app.post('/game-over', (req, res) => {
    const { roomName } = req.body;
    if (roomHP[roomName]) {
        roomHP[roomName].isOver = true;
    }
    res.send('OK');
});

app.get('/ranking', (req, res) => {
    res.send('1位: たろう 99勝\n2位: じろう 88勝\n3位: さぶろう 77勝');
});

app.listen(PORT, () => {
    console.log(`🚀 ゆるろんサーバーが起動したよ！`);
});
