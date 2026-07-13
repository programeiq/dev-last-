const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// 誰の通信でも受け付けるための設定（CORS対策）
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// ⏳ ここが「待合室」！待っている人の通信を一時的に保存する場所
let waitingPlayer = null; 
let roomCount = 0; // 作った部屋の数

// 🎮 MATCHボタンが押されたときの処理
app.get('/match', (req, res) => {
    console.log('マッチング要求を受信しました！');

    if (waitingPlayer === null) {
        // 👥 待合室が空っぽのとき（1人目のプレイヤー）
        waitingPlayer = res; // 1人目の通信を「キープ（保留）」して待たせる！
        console.log(' 1人目のプレイヤーが待合室に入りました。相手を待っています...');
        // ※ここではまだ res.send() をしないのがミソ！
    } else {
        // 🤝 すでに誰か待っていたとき（2人目のプレイヤーが到着！）
        roomCount++;
        const roomName = `ROOM_${String(roomCount).padStart(3, '0')}`; // ROOM_001 とかを作る
        
        console.log(`2人目が来ました！マッチング成立！ 【${roomName}】を作ります！`);

        // 1人目のプレイヤーに「マッチしたよ！」とお返事を返す
        waitingPlayer.send(`MATCHING_SUCCESS: ${roomName}`);
        
        // 2人目のプレイヤー（今来た人）にも同じお返事を返す
        res.send(`MATCHING_SUCCESS: ${roomName}`);

        // 待合室を空っぽに戻して、次の人たちに備える
        waitingPlayer = null;
    }
});

// 🏆 RANKINGボタンが押されたときの処理（今はとりあえずダミーデータ）
app.get('/ranking', (req, res) => {
    console.log(' ランキング要求を受信しました');
    res.send('1位: たろう 99勝\n2位: じろう 88勝\n3位: さぶろう 77勝');
});

// サーバーを起動するコード
app.listen(PORT, () => {
    console.log(`ゆるろんサーバーがポート ${PORT} で元気に起動したよ！`);
});
