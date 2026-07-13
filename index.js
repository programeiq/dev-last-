
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// ダミーデータ（仕様書のランキング機能用の土台）
let rankingList = [
    { name: "PLAYER_ALPHA", level: 980 },
    { name: "PLAYER_BETA", level: 850 },
    { name: "PLAYER_GAMMA", level: 520 }
];

// 💡 1. URL（/）にアクセスされたら、上の index.html をブラウザに送り出す設定
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// 2. マッチングボタンが押されたときのエンドポイント
app.get('/match', (req, res) => {
    console.log('📡 マッチング要求を受信しました');
    // 今は通信テスト用として即座に成功を返します（あとでレベル帯±50の判定を入れます）
    res.send('MATCHING_SUCCESS: ROOM_001');
});

// 3. ランキングボタンが押されたときのエンドポイント
app.get('/ranking', (req, res) => {
    console.log('📡 ランキング要求を受信しました');
    // データを整形してブラウザに送り返す
    const rankString = rankingList
        .map((p, i) => `${i + 1}st: ${p.name} (Lv.${p.level})`)
        .join(' / ');
    res.send(rankString);
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});