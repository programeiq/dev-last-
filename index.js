const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// 通信のJSONデータを読み込むための設定
app.use(express.json());

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// トップページの表示
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// ⏳ マッチング待合室のデータ
let waitingPlayer = null; 
let roomCount = 0;

// 💬 ディベートのメッセージを一時保存する場所
// 部屋名(ROOM_001など)ごとに、未読メッセージのリストを管理します
let chatMessages = {};

// マッチング要求
app.get('/match', (req, res) => {
    console.log('📡 マッチング要求を受信しました！');

    if (waitingPlayer === null) {
        waitingPlayer = res; 
        console.log('👤 1人目が待機中...');
    } else {
        roomCount++;
        const roomName = `ROOM_${String(roomCount).padStart(3, '0')}`; 
        
        console.log(`🎉 マッチング成立！ 【${roomName}】`);

        // 部屋専用のメッセージ置き場を作る
        chatMessages[roomName] = [];

        waitingPlayer.send(`MATCHING_SUCCESS: ${roomName}`);
        res.send(`MATCHING_SUCCESS: ${roomName}`);

        waitingPlayer = null;
    }
});

// ✉️ メッセージを「送信」するルート
app.post('/send-message', (req, res) => {
    const { roomName, sender, text } = req.body;
    console.log(`📩 メッセージ受信 [${roomName}] ${sender}: ${text}`);

    if (chatMessages[roomName]) {
        // メッセージを部屋の箱に保存する
        chatMessages[roomName].push({ sender, text });
    }
    res.send('OK');
});

// 🔄 相手からのメッセージが届いているか「確認（取得）」するルート
app.get('/get-messages', (req, res) => {
    const roomName = req.query.roomName;
    
    if (chatMessages[roomName]) {
        // 部屋に溜まっているメッセージを全部まとめて送り返す
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
