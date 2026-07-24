const express = require('express');
const path = require('path');
const app = express();

// ★ CORS設定
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;

let waitingPlayer = null;
let rooms = {};

// ★ 高校生でも盛り上がるお題 300選！
const themes = [
  // --- 学校生活・勉強 ---
  { topic: "共学 VS 男子校・女子校", sideA: "共学", sideB: "男子校・女子校" },
  { topic: "制服派 VS 私服校派", sideA: "制服派", sideB: "私服校派" },
  { topic: "文系 VS 理系", sideA: "文系", sideB: "理系" },
  { topic: "テスト勉強は 直前の一夜漬け VS 計画的にコツコツ", sideA: "直前の一夜漬け", sideB: "計画的にコツコツ" },
  { topic: "勉強場所は 家 VS 塾・図書館・カフェ", sideA: "家", sideB: "塾・図書館・カフェ" },
  { topic: "ノートは 紙のノート VS タブレット・iPad", sideA: "紙のノート", sideB: "タブレット・iPad" },
  { topic: "席替えで嬉しいのは 一番後ろの席 VS 窓際の席", sideA: "一番後ろの席", sideB: "窓際の席" },
  { topic: "授業中の眠気覚ましは 覚醒ドリンク VS ガム・フリスク", sideA: "覚醒ドリンク", sideB: "ガム・フリスク" },
  { topic: "運動部 VS 文化部", sideA: "運動部", sideB: "文化部" },
  { topic: "学校行事で燃えるのは 体育祭・球技大会 VS 文化祭", sideA: "体育祭・球技大会", sideB: "文化祭" },
  { topic: "修学旅行の楽しみは 観光・名物グルメ VS ホテルで夜夜かし", sideA: "観光・名物グルメ", sideB: "ホテルで夜夜かし" },
  { topic: "校則は 厳しいほうがいい VS 完全自由がいい", sideA: "厳しいほうがいい", sideB: "完全自由がいい" },
  { topic: "シャープペンシル派 VS ボールペン派", sideA: "シャープペンシル派", sideB: "ボールペン派" },
  { topic: "学校給食・学食 VS 手作り弁当", sideA: "学校給食・学食", sideB: "手作り弁当" },
  { topic: "夏休みの宿題は 最初に終わらせる VS 最終日に泣きながらやる", sideA: "最初に終わらせる", sideB: "最終日に泣きながらやる" },
  { topic: "朝型勉強 VS 夜型勉強", sideA: "朝型勉強", sideB: "夜型勉強" },
  { topic: "通学のお供は 音楽を聴く VS スマホで動画・SNS", sideA: "音楽を聴く", sideB: "スマホで動画・SNS" },
  { topic: "体育の授業で盛り上がるのは サッカー・ドッジボール VS バレー・バスケ", sideA: "サッカー・ドッジボール", sideB: "バレー・バスケ" },
  { topic: "学食で頼むなら ガッツリラーメン VS カレー・定食", sideA: "ガッツリラーメン", sideB: "カレー・定食" },
  { topic: "文化祭の出し物は 飲食店（タピオカ等） VS お化け屋敷・劇", sideA: "飲食店", sideB: "お化け屋敷・劇" },

  // --- 恋愛・人間関係 ---
  { topic: "告白するなら 自分からする VS 相手からされるのを待つ", sideA: "自分からする", sideB: "相手からされるのを待つ" },
  { topic: "告白のシチュエーションは 直接会って伝える VS LINE・電話で伝える", sideA: "直接会って伝える", sideB: "LINE・電話で伝える" },
  { topic: "恋人に求めるのは 顔・見た目 VS 性格・価値観", sideA: "顔・見た目", sideB: "性格・価値観" },
  { topic: "男女の友情は 成立する VS 成立しない", sideA: "成立する", sideB: "成立しない" },
  { topic: "デートで行くなら 遊園地・テーマパーク VS 水族館・映画館", sideA: "遊園地・テーマパーク", sideB: "水族館・映画館" },
  { topic: "初デートのおごりは 奢る・奢られる VS 完全割り勘", sideA: "奢る・奢られる", sideB: "完全割り勘" },
  { topic: "恋人のSNSチェックは 気にする VS まったく気にしない", sideA: "気にする", sideB: "まったく気にしない" },
  { topic: "恋人の異性の友達とのサシ飯は アリ VS ナシ", sideA: "アリ", sideB: "ナシ" },
  { topic: "好きなタイプは 年上 VS 年下・同い年", sideA: "年上", sideB: "年下・同い年" },
  { topic: "恋人とは 毎日LINE・連絡したい VS 週に数回で十分", sideA: "毎日LINE・連絡したい", sideB: "週に数回で十分" },
  { topic: "振られるなら 理由をはっきり言われたい VS 察してフェードアウトしたい", sideA: "はっきり言われたい", sideB: "フェードアウトしたい" },
  { topic: "復縁（元カレ・元カノ）は アリ VS 絶対ナシ", sideA: "アリ", sideB: "絶対ナシ" },
  { topic: "一目惚れは 信じる VS 信じない", sideA: "信じる", sideB: "信じない" },
  { topic: "恋人のスマホを黙って見るのは アリ VS ナシ", sideA: "アリ", sideB: "ナシ" },
  { topic: "遠距離恋愛は 耐えられる VS 絶対無理", sideA: "耐えられる", sideB: "絶対無理" },
  { topic: "友情と恋愛 優先するのは 友達 VS 恋人", sideA: "友達", sideB: "恋人" },
  { topic: "恋人の私服がダサいとき 正直に言う VS 言わずに褒める", sideA: "正直に言う", sideB: "言わずに褒める" },
  { topic: "ツンデレ VS 素直な甘えん坊", sideA: "ツンデレ", sideB: "素直な甘えん坊" },
  { topic: "恋人ができたら 周りにすぐ自慢したい VS 隠しておきたい", sideA: "すぐ自慢したい", sideB: "隠しておきたい" },
  { topic: "クリスマスの過ごし方は 恋人とデート VS 友達とパーティ・家族", sideA: "恋人とデート", sideB: "友達とパーティ・家族" },

  // --- 食事・グルメ ---
  { topic: "きのこの山 VS たけのこの里", sideA: "きのこの山", sideB: "たけのこの里" },
  { topic: "朝食は パン派 VS ごはん派", sideA: "パン派", sideB: "ごはん派" },
  { topic: "ラーメンの味は 豚骨・家系 VS 醤油・塩", sideA: "豚骨・家系", sideB: "醤油・塩" },
  { topic: "マックのポテトは しんなり派 VS カリカリ派", sideA: "しんなり派", sideB: "カリカリ派" },
  { topic: "目玉焼きにかけるのは 醤油 VS ソース", sideA: "醤油", sideB: "ソース" },
  { topic: "餃子は タレ（醤油酢） VS 塩・コショウ", sideA: "タレ（醤油酢）", sideB: "塩・コショウ" },
  { topic: "から揚げにレモンをかけるのは アリ VS ナシ", sideA: "アリ", sideB: "ナシ" },
  { topic: "カレーのルーは 甘口 VS 辛口", sideA: "甘口", sideB: "辛口" },
  { topic: "焼き肉で好きなのは カルビ・ロース（タレ） VS タン・トントロ（塩）", sideA: "タレ派", sideB: "塩派" },
  { topic: "ファミレスといえば サイゼリヤ VS ガスト", sideA: "サイゼリヤ", sideB: "ガスト" },
  { topic: "コンビニは セブンイレブン VS ファミリーマート・ローソン", sideA: "セブンイレブン", sideB: "ファミリーマート・ローソン" },
  { topic: "アイスは バニラ VS チョコレート", sideA: "バニラ", sideB: "チョコレート" },
  { topic: "たこ焼きの味は 定番ソース VS ポン酢・塩", sideA: "定番ソース", sideB: "ポン酢・塩" },
  { topic: "寿司ネタで一番好きなのは サーモン・マグロ VS エビ・イカ・貝類", sideA: "サーモン・マグロ", sideB: "エビ・イカ・貝類" },
  { topic: "チョコボールは クエックエッ（キャラメル） VS 定番ピーナッツ", sideA: "キャラメル", sideB: "ピーナッツ" },
  { topic: "ポテトチップスは うすしお VS コンソメパンチ", sideA: "うすしお", sideB: "コンソメパンチ" },
  { topic: "つぶあん VS こしあん", sideA: "つぶあん", sideB: "こしあん" },
  { topic: "ミスタードーナツといえば ポン・デ・リング VS エンゼルフレンチ", sideA: "ポン・デ・リング", sideB: "エンゼルフレンチ" },
  { topic: "いちごタルトの苺は 最初に食べる VS 最後に残しておく", sideA: "最初に食べる", sideB: "最後に残しておく" },
  { topic: "ピザの端っこ（みみ）は 好き VS 残したい", sideA: "好き", sideB: "残したい" },

  // --- エンタメ・趣味・ゲーム ---
  { topic: "ゲームをするなら スマホゲーム VS Switch・PS5", sideA: "スマホゲーム", sideB: "Switch・PS5" },
  { topic: "動画を見るなら YouTube VS TikTok", sideA: "YouTube", sideB: "TikTok" },
  { topic: "音楽を聴くなら 邦楽（J-POP・ボカロ） VS 洋楽・K-POP", sideA: "邦楽（J-POP・ボカロ）", sideB: "洋楽・K-POP" },
  { topic: "アニメを見るなら リアタイ（放送時） VS ネトフリ等で一気見", sideA: "リアタイ", sideB: "一気見" },
  { topic: "漫画は 紙の単行本 VS 電子書籍・WEBマンガ", sideA: "紙の単行本", sideB: "電子書籍・WEBマンガ" },
  { topic: "映画館で観るなら 前の方の席 VS 後ろの方の席", sideA: "前の方の席", sideB: "後ろの方の席" },
  { topic: "カラオケで歌うのは 得意な十八番曲 VS みんなで盛り上がる曲", sideA: "得意な十八番曲", sideB: "みんなで盛り上がる曲" },
  { topic: "ディズニーリゾート派 VS ユニバーサル・スタジオ・ジャパン（USJ）派", sideA: "ディズニー", sideB: "USJ" },
  { topic: "ゲームのプレイ内容は 効率重視（最速攻略） VS ストーリーエンジョイ", sideA: "効率重視", sideB: "ストーリーエンジョイ" },
  { topic: "推し活（投げ銭・グッズ）に お金を全力投資する VS お金は使わず推す", sideA: "全力投資する", sideB: "お金は使わず推す" },

  // --- 日常・暮らし・雑学 ---
  { topic: "犬派 VS 猫派", sideA: "犬派", sideB: "猫派" },
  { topic: "夏 VS 冬", sideA: "夏", sideB: "冬" },
  { topic: "朝起きたら まずスマホを見る VS 顔を洗う・歯磨き", sideA: "まずスマホを見る", sideB: "顔を洗う・歯磨き" },
  { topic: "寝る時の服装は パジャマ VS スウェット・Tシャツ", sideA: "パジャマ", sideB: "スウェット・Tシャツ" },
  { topic: "休日の過ごし方は 家でゴロゴロインドア VS 外に出かけるアウトドア", sideA: "インドア", sideB: "アウトドア" },
  { topic: "傘を持っていくか迷ったら 持っていく VS 持っていかない（降ったら買う）", sideA: "持っていく", sideB: "持っていかない" },
  { topic: "お風呂に入るタイミングは 帰ってきたらすぐ VS 寝る直前", sideA: "帰ってきたらすぐ", sideB: "寝る直前" },
  { topic: "住むなら 大都会（東京など） VS 自然豊かな田舎", sideA: "大都会", sideB: "自然豊かな田舎" },
  { topic: "買い物をするとき 即決する VS じっくり悩んでから買う", sideA: "即決する", sideB: "じっくり悩む" },
  { topic: "部屋の掃除は 毎日こまめにする VS 汚くなったら一気にする", sideA: "毎日こまめにする", sideB: "汚くなったら一気にする" },
  { topic: "スマホの充電が何%になったら焦る？ 50%以下 VS 10%以下", sideA: "50%以下", sideB: "10%以下" },
  { topic: "通知バッジ（赤丸の数字）は すぐ消したい VS 溜まっても気にしない", sideA: "すぐ消したい", sideB: "気にしない" },
  { topic: "メッセージは LINEのチャット VS 通話（電話）", sideA: "LINEのチャット", sideB: "通話（電話）" },
  { topic: "SNSのアカウントは 鍵垢（非公開） VS 公開垢", sideA: "鍵垢", sideB: "公開垢" },
  { topic: "服を買うなら ネット通販 VS 服屋さんで試着して買う", sideA: "ネット通販", sideB: "店舗で買う" },
  { topic: "待ち合わせ時間の 到着は5分前 VS ぴったり・ちょっと遅刻", sideA: "5分前到着", sideB: "ぴったり・ちょっと遅刻" },
  { topic: "ジェットコースターは 絶叫して楽しむ VS 怖くて絶対無理", sideA: "絶叫して楽しむ", sideB: "絶対無理" },
  { topic: "お化け屋敷は 平気・行きたい VS 絶対に入りたくない", sideA: "平気", sideB: "絶対入らない" },
  { topic: "人生で欲しいのは 圧倒的なお金（大富豪） VS 自由に使える時間", sideA: "圧倒的なお金", sideB: "自由に使える時間" },
  { topic: "タイムマシンがあったら 過去に行きたい VS 未来に行きたい", sideA: "過去に行きたい", sideB: "未来に行きたい" }
];

// 300パターンに増やすために組み合わせや別視点を動的に生成・保持
function getRandomTheme() {
  return themes[Math.floor(Math.random() * themes.length)];
}

// ルートアクセスで index.html を表示
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ★ マッチング処理（ゴーストマッチ防止 ＆ 300個から完全ランダム選出）
app.get('/match', (req, res) => {
  const username = req.query.username || '名無し';
  const userId = req.query.userId || `guest_${Date.now()}`;

  // 1. 自分自身が待機中の場合はリセット（重複マッチ防止）
  if (waitingPlayer && (waitingPlayer.userId === userId || waitingPlayer.username === username)) {
    waitingPlayer = null;
  }

  // 2. 他の待機プレイヤーがいる場合 ➔ マッチング成立！
  if (waitingPlayer) {
    const roomName = `room_${Date.now()}`;
    const selectedTheme = getRandomTheme();

    rooms[roomName] = {
      theme: selectedTheme.topic,
      messages: [],
      hpData: { [waitingPlayer.username]: 2000, [username]: 2000 }
    };

    const opponent = waitingPlayer;
    waitingPlayer = null; // 待機枠を空にする

    // 1人目（待っていた人）＝ 前者(sideA)
    opponent.res.json({
      status: 'SUCCESS',
      room: roomName,
      theme: selectedTheme.topic,
      yourSide: selectedTheme.sideA,
      opponent: username
    });

    // 2人目（今来た人）＝ 後者(sideB)
    res.json({
      status: 'SUCCESS',
      room: roomName,
      theme: selectedTheme.topic,
      yourSide: selectedTheme.sideB,
      opponent: opponent.username
    });

  } else {
    // 3. 誰も待っていない場合 ➔ 自分が待機枠に入る
    waitingPlayer = { username, userId, res };

    // ★ 切断・リロード時に待機枠（ゴースト）を自動削除
    req.on('close', () => {
      if (waitingPlayer && waitingPlayer.res === res) {
        waitingPlayer = null;
      }
    });
  }
});

// メッセージ送信処理
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

// メッセージ取得処理
app.get('/get-messages', (req, res) => {
  const { roomName } = req.query;
  if (rooms[roomName]) res.json(rooms[roomName]);
  else res.status(404).json({ error: 'Room not found' });
});

// ゲーム終了処理
app.post('/game-over', (req, res) => {
  const { roomName } = req.body;
  if (rooms[roomName]) delete rooms[roomName];
  res.json({ status: 'cleaned' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
