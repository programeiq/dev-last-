const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 1. ミドルウェア & CORS設定
// ==========================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.static('public'));

// ==========================================
// 2. 本格ディベートお題データ（300個）
// ==========================================
const TOPICS = [
  "きのこの山 VS たけのこの里", "朝食はパン派 VS ご飯派", "うどん VS そば",
  "目玉焼きにかけるなら 醤油 VS ソース", "唐揚げにレモンは かける派 VS かけない派",
  "カレーは 甘口 VS 辛口", "ラーメンは とんこつ VS 醤油", "コーヒー派 VS 紅茶派",
  "一生片方しか食べられないなら 肉 VS 魚", "ポテトチップスは コンソメ VS うすしお",
  "目玉焼きの黄身は 固め VS 半熟", "たこ焼きは ソース派 VS ポン酢派",
  "洋食派 VS 和食派", "甘党 VS 辛党", "アイスは 年中食べる派 VS 夏しか食べない派",
  "あんこは 粒あん派 VS こしあん派", "たい焼きは 頭から食べる派 VS 尻尾から食べる派",
  "ポテトは 細切り派 VS 太切り派", "焼き肉は タレ派 VS 塩派", "鍋のシメは 雑炊 VS ラーメン",
  "お好み焼き VS もんじゃ焼き", "シチューをご飯に かける派 VS かけない派",
  "卵焼きは 甘い派 VS しょっぱい派", "冷やし中華にマヨネーズは かける派 VS かけない派",
  "焼き芋は ねっとり派 VS ほくほく派", "りんごは 丸かじり派 VS 切って食べる派",
  "自炊派 VS 外食派", "居酒屋で最初の一杯は ビール VS ハイボール",
  "クッキー VS ケーキ", "和菓子 VS 洋菓子",
  "布団派 VS ベッド派", "バスタオルは 毎日洗う派 VS 数日使う派",
  "傘は 折りたたみ派 VS 長傘派", "買い物は 実店舗派 VS ネット通販派",
  "インドア派 VS アウトドア派", "休日は 早起き派 VS 遅くまで寝る派",
  "LINEの返信は 早い方 VS 遅い方", "服を買う時 直感で決める VS じっくり悩む",
  "勉強や作業は 家派 VS カフェ派", "シャワー派 VS 湯船派",
  "部屋の掃除は こまめにする VS まとめてする", "テレビ派 VS YouTube・動画配信派",
  "通知は すぐ消す派 VS 溜める派", "スマホの保護フィルムは ガラス派 VS シート派",
  "イヤホンは ワイヤレス派 VS 有線派", "夏派 VS 冬派", "夜景 VS 朝日",
  "映画は 吹き替え派 VS 字幕派", "スケジュール管理は アプリ派 VS 手帳・紙派",
  "タスクは すぐ片付ける VS ギリギリまで溜める", "夏休みの宿題は 最初に終わらせる VS 最後に焦る",
  "テスト勉強は 計画的にやる VS 一夜漬け", "一人行動（ソロ活）は 得意・好き VS 苦手・寂しい",
  "待ち合わせ時間の 前に着く派 VS ギリギリに着く派", "連絡は 電話派 VS メッセージ（チャット）派",
  "ダークモード派 VS ライトモード派", "作業BGMは 無音派 VS 音楽派",
  "決断力はある方 VS 優柔不断な方", "人と話す時は 聞き手派 VS 話し手派",
  "大人数のグループ VS 少人数のグループ", "タイムトラベルするなら 過去 VS 未来",
  "生まれ変わるなら 男 VS 女", "超能力が手に入るなら 透明化 VS 飛行能力",
  "幽霊と宇宙人 会うなら 幽霊 VS 宇宙人", "無人島に持っていくなら ナイフ VS 万能の薬",
  "ドラえもんの道具なら どこでもドア VS タケコプター", "過去に戻ってやり直したいこと ある VS ない",
  "お金と時間 重要なのは お金 VS 時間", "愛すること VS 愛されること",
  "結果と過程 重視するのは 結果 VS 過程", "親友は 数より質 VS 質の高さより人数",
  "外見重視 VS 内面重視", "安定した低い収入 VS 不安定な高い収入",
  "都会暮らし VS 田舎暮らし", "一人が好き VS 寂しがり屋",
  "直感重視 VS 感情・論理重視", "過去にこだわる派 VS 未来志向派",
  "理想のリーダーは 厳格な指導者 VS 優しく寄り添う指導者",
  "仕事は 好きなことを仕事にする VS 稼げることを仕事にする", "才能 VS 努力",
  "運は 自分で引き寄せるもの VS 生まれ持ったもの", "嘘は どんな理由でもダメ VS 思いやりの嘘ならアリ",
  "失敗は 成功の母（ポジティブ） VS 単なる損失（ネガティブ）", "結婚は 好きだけでできる VS 経済力がすべて",
  "第一印象は 当たる VS 外れる", "夢は 人に語るべき VS 秘密にして叶えるべき",
  "ライバルは 必要な存在 VS 不要な存在", "ルールは 厳格に守るべき VS 状況に応じて柔軟に変えるべき",
  "人生は 計画通りに進めるべき VS 行き当たりバタリを楽しむべき", "許すことは 強さ VS 弱さ",
  "猫派 VS 犬派", "本は 紙派 VS 電子書籍派",
  "遊園地で最初に乗るのは ジェットコースター VS 観覧車", "映画館で座るなら 前方 VS 後方",
  "旅行に行くなら 温泉 VS テーマパーク", "海 VS 山", "動物園 VS 水族館",
  "新幹線・飛行機の席は 窓側 VS 通路側", "旅先でのスケジュールは きっちり決める VS ノープラン",
  "写真や動画は たくさん撮る派 VS 目に焼き付ける派", "音楽を聴く時は 歌詞重視 VS メロディ重視",
  "ゲームは オンライン対戦派 VS ソロプレイ派", "人狼ゲームは 好き・得意 VS 嫌い・苦手",
  "スポーツは 見る派 VS する派", "AI（人工知能）の進化は 人類にメリット VS 人類に脅威",
  "自動運転車は 今すぐ普及すべき VS まだ危険すぎる", "ベーシックインカム（全全員給付）は 導入すべき VS 反対",
  "レジの無人化・キャッシュレス化は 推進すべき VS 現現金構造を残すべき", "SNSは 人生を豊かにする VS 人生を狂わせる",
  "紙の教科書 VS タブレット端末での授業", "リモートワーク（在宅勤務） VS 出社して働く",
  "週休3日制は 導入すべき VS 現状の週休2日で良い", "残業は 悪（即刻ゼロにすべき） VS 必要悪（状況による）",
  "制服は 必要（服に悩まない） VS 不要（個性を尊重）", "英語の早期教育は 必要 VS 日本語の習得が先",
  "宿題は 廃止すべき VS 継続すべき", "飛び級制度は 日本にも導入すべき VS 不要",
  "給食は 残さず食べるべき VS 無理して食べなくて良い", "学校の部活は 義務化・推奨すべき VS 完全に自由・クラブ化すべき",
  "スマホの使用制限は 親が厳しく行うべき VS 子供の自主性に任せるべき", "救急車を有料化すべきか 賛成 VS 反対",
  "レジ袋の有料化は 効果がある VS 逆効果・不便なだけ", "救命救急の現場でAIが優先度を決めるのは アリ VS ナシ",
  "動物園の存在は 動物保護になる VS 動物虐待になる", "死刑制度は 維持すべき VS 廃止すべき",
  "選挙の棄権に罰則を設けるべき 賛成 VS 反対", "消費税は 下げるべき VS 現状維持・上げるべき",
  "プラスチック製品の全廃は 実現すべき VS 現実的ではない", "歴史的建造物の復元は 昔のままにすべき VS 現代風に補元すべき",
  "宇宙開発に巨額の予算を使うのは 賛成 VS 地球の問題解決が先", "遺伝子組み換え食品は 積極的に使うべき VS 規制すべき",
  "人間の寿命は 延ばせるだけ延ばすべき VS 自然の摂理に任せるべき", "クローン技術の人間への応用は 賛成 VS 反対",
  "原子力発電は 継続・推進すべき VS 早期にゼロにすべき", "電子通貨への完全移行（現金廃止）は 賛成 VS 反対",
  "定年制は 廃止すべき VS 維持すべき", "年功序列 VS 成果主義",
  "大企業で安定して働く VS 企業・ベンチャーで挑戦する", "副業は 全企業で全面解禁すべき VS 制限すべき",
  "大学進学は 全員行くべき VS 早く社会に出るべき", "ネットの匿名性は 守るべき VS 実名制にすべき",
  "監視カメラの増設は 治安維持に必要 VS プライバシーの侵害", "安楽死の合法化は 認めるべき VS 認めるべきではない",
  "救急車の適正利用に罰金を設定すべき 賛成 VS 反対", "ペットショップでの生体販売は 規制すべき VS 継続すべき",
  "花火大会や祭りの騒音問題は 伝統優先 VS 近隣住民優先", "公共交通機関でのベビーカー利用は 優先すべき VS 配慮が必要",
  "歩きスマホに罰則を設けるべき 賛成 VS 反対", "喫煙所の全廃（タバコ販売停止）は 賛成 VS 反対",
  "飲酒の年齢制限は 18歳に下げるべき VS 20歳のままが良い", "矛と盾 最後に勝つのは 最強の矛 VS 最強の盾",
  "正義の反対は 悪 VS 別の正義", "人間は 本質的に善（性善説） VS 本質的に悪（性悪説）",
  "完璧な人間は 魅力的 VS つまらない", "歴史は 繰り返す VS 常に新しい",
  "自由は 幸福をもたらす VS 不安をもたらす", "平和は 武力で作られる VS 対話で作られる",
  "知識と経験 重要なのは 知識 VS 経験", "過去の過ちは 忘れ去るべき VS 語り継ぐべき",
  "一心の愛 VS 多彩な愛", "競争は 人を成長させる VS 人を破壊する",
  "秩序を守るルール VS 変化を起こす破天荒", "真実は 常に暴かれるべき VS 知らぬが仏（隠すのも優しさ）",
  "運命は 決まっている VS 自分で変えられる", "成功の条件は 幸運 VS 努力",
  "恐怖を克服するには 立ち向かう VS 逃げる", "怒りは 活力の源 VS 破壊の要因",
  "嫉妬は 成長の糧 VS 毒", "孤独は 自由の証 VS 寂しさの象徴", "死は 恐怖 VS 救い",
  "マリオ VS ルイージ", "ドラクエ VS ファイナルファンタジー", "ポケットモンスター 赤 VS 緑",
  "ジャンプマンガ VS サンデーマンガ", "アニメは リアルタイムで見る VS 録画・配信で一気見",
  "フェスやライブは 前方で暴れる VS 後方でゆったり見る", "遊戯王 VS デュエル・マスターズ",
  "スマブラで選ぶなら 軽量級（素早い） VS 重量級（一撃重視）", "FPSゲームで使うなら スナイパー VS アサルトライフル",
  "格闘ゲームは 攻め重視 VS 守り・カウンター重視", "ポーカー VS 麻雀",
  "人狼ゲームで面白いのは 人狼側 VS 市民側", "ゲームの難易度は 超激辛（イージー禁止） VS エンジョイ（サクサク）",
  "ネタバレは 絶対NG VS 最初に知ってから見たい", "小説は ハッピーエンド必須 VS バッドエンド・メリバもアリ",
  "映画の続編は 作るべき VS 1作目で綺麗に終わるべき", "声優の顔出し・アイドル化は アリ VS ナシ",
  "推しは 一人に絞る派 VS 複数推す（DD）派", "ライブのチケット代 1万円は 安い VS 高い",
  "ファンアート（二次創作）は 公式が公式認可すべき VS アングラであるべき",
  "寿司は シャリ小さめ派 VS ネタ大ぶり派", "焼肉の網は こまめに変える VS あまり変えない",
  "ピザのパイ生地は サクサククリスピー VS モチモチハンドトス", "カレーのじゃがいもは 必要 VS 不要",
  "食パンの厚さは 8枚切り（薄め） VS 4枚切り（厚切り）", "メロンパンの皮は サクサク派 VS しっとり派",
  "味噌汁の具で最強なのは 豆腐とわかめ VS なめこと油揚げ", "納豆は 混ぜまくる派 VS 数回しか混ぜない派",
  "そうめんの薬味は ネギ・生姜 VS 茗荷・大葉", "おでんの具で一番は 大根 VS 卵",
  "かき氷は シロップたっぷり派 VS 氷の質重視派", "屋台の焼きそばは 買い VS 自宅で作るほうが旨い",
  "初詣のおみくじは 結ぶ派 VS 持ち帰る派", "大掃除は 年末にやる VS 年始・春にやる",
  "クリスマスプレゼントは サプライズ派 VS 欲しいものを聞く派", "ハロウィンの仮装は 参加したい VS 見ているだけで良い",
  "誕生日祝いは 盛大にやる VS 静かに祝う", "日記は つけるべき VS 不要",
  "手紙は 手書きが良い VS デジタルで十分", "昔の思い出の品は 残す派 VS 断捨離して捨てる派",
  "マイホームは 持ち家派 VS 賃貸派", "一戸建て VS マンション",
  "景色の良い高層階 VS 庭付き・移動がラクな1階", "引っ越しは 何度もしたい VS 同じ場所に長く住みたい",
  "近所づきあいは 積極的にする VS 最小限にする", "車は 所有する派 VS カーシェア・カーリース派",
  "移動手段は 電車・バス VS 車・バイク", "ドライブの助手席は ナビ・会話担当 VS 寝てもOK派",
  "自転車は 電動アシスト派 VS 普通の自転車（クロスバイク等）派", "旅行のパッキングは 前日派 VS 当日の朝派",
  "お土産は ご当地限定のお菓子 VS ずっと残る形のあるモノ", "アルバムは 紙の写真集にする VS スマホのデータで保持",
  "スマホの壁紙は 初期設定・シンプル VS 好きな画像・思い出", "キーボードの打鍵音は 鳴らす派 VS 消す派",
  "イヤホンの音量は 大きめ派 VS 小さめ派", "リピート再生で 同じ曲をずっと聴ける VS いろんな曲をシャッフル",
  "集中力が続くのは 短時間集中・休憩多め VS 長時間ぶっ通し", "マルチタスクは 得意派 VS 苦手・シングルタスク派",
  "感情は 顔に出やすい VS ポーカーフェイスが得意", "嘘は すぐバレる派 VS 絶対にバレない派",
  "一生旅を続ける人生 VS 一箇所にとどまり平穏に暮らす人生", "全てが見える目 VS 全てが聞こえる耳",
  "暑さゼロの世界 VS 寒さゼロの世界", "過去を変えられる能力 VS 未来を予知できる能力",
  "自分が喋るだけで全員納得する能力 VS 他人の思考が読める能力", "不老不死（一生死なない） VS 決まった寿命（平穏な死）",
  "地球上の全言語を話せる能力 VS 全ての動物と会話できる能力", "一度読んだ本を忘れない記憶力 VS 嫌な記憶を即座に消せる記憶力",
  "空を飛ぶ能力 VS 水中で息ができる能力", "世界一の天才（だけど孤独） VS 普通の人（温かい仲間に囲まれる）"
];

// ==========================================
// 3. サーバーデータ（部屋・通報・ランキング管理）
// ==========================================
let waitingPlayers = []; // [{ username, res }]
let activeRooms = {};    // { roomName: { players, hpData, messages, theme } }

// 通報・BAN管理
let reportLogs = [];
let userReportCounts = {};
let bannedUsers = new Set();

// ランキング・プレイヤー戦績管理データ
// 構造: { "ユーザー名": { wins: 0, losses: 0, exp: 0, level: 1 } }
let userStats = {};

function normalizeName(name) {
  if (!name) return "";
  return name.split('(')[0].split('（')[0].trim();
}

// プレイヤーデータを初期化または取得
function getOrCreateUserStat(username) {
  const cleanName = normalizeName(username);
  if (!userStats[cleanName]) {
    userStats[cleanName] = {
      username: cleanName,
      wins: 0,
      losses: 0,
      exp: 0,
      level: 1
    };
  }
  return userStats[cleanName];
}

// ==========================================
// 4. API エンドポイント
// ==========================================

// --- BANチェック API ---
app.get('/check-ban', (req, res) => {
  const username = normalizeName(req.query.username);
  if (bannedUsers.has(username)) {
    return res.json({ banned: true, reason: '通報が多数寄せられたためBANされています。' });
  }
  res.json({ banned: false });
});

// --- マッチングAPI ---
app.get('/match', (req, res) => {
  const username = req.query.username ? req.query.username.trim() : "";
  const cleanUsername = normalizeName(username);

  if (!cleanUsername) {
    return res.status(400).send('ERR: No username');
  }

  if (bannedUsers.has(cleanUsername)) {
    return res.status(403).send('BANNED: あなたのアカウントは停止されています');
  }

  // プレイヤー登録初期化
  getOrCreateUserStat(cleanUsername);

  // 1. アクティブ部屋所属チェック
  for (const [roomName, room] of Object.entries(activeRooms)) {
    if (room.players.map(p => normalizeName(p)).includes(cleanUsername)) {
      return res.send(`MATCHING_SUCCESS | Room: ${roomName} | Theme: ${room.theme}`);
    }
  }

  // 2. 重複待機削除
  const existingIndex = waitingPlayers.findIndex(p => normalizeName(p.username) === cleanUsername);
  if (existingIndex !== -1) {
    waitingPlayers[existingIndex].res.end();
    waitingPlayers.splice(existingIndex, 1);
  }

  // 3. マッチング成立！
  if (waitingPlayers.length > 0) {
    const opponent = waitingPlayers.shift();
    const roomName = `room_${Date.now()}`;
    const randomTheme = TOPICS[Math.floor(Math.random() * TOPICS.length)];

    const player1Name = normalizeName(opponent.username);
    const player2Name = cleanUsername;

    activeRooms[roomName] = {
      players: [player1Name, player2Name],
      hpData: {
        [player1Name]: 2000,
        [player2Name]: 2000
      },
      messages: [],
      theme: randomTheme
    };

    const successMsg = `MATCHING_SUCCESS | Room: ${roomName} | Theme: ${randomTheme}`;
    opponent.res.send(successMsg);
    return res.send(successMsg);

  } else {
    // 4. 待機追加
    waitingPlayers.push({ username: cleanUsername, res });
    req.on('close', () => {
      waitingPlayers = waitingPlayers.filter(p => normalizeName(p.username) !== cleanUsername);
    });
  }
});

// --- メッセージ取得 API ---
app.get('/get-messages', (req, res) => {
  const roomName = req.query.roomName;
  if (!roomName || !activeRooms[roomName]) {
    return res.json({ error: 'Room not found' });
  }
  res.json(activeRooms[roomName]);
});

// --- メッセージ送信 API ---
app.post('/send-message', (req, res) => {
  const { roomName, sender, text } = req.body;
  if (!roomName || !activeRooms[roomName]) {
    return res.json({ success: false, error: 'Room not found' });
  }

  const room = activeRooms[roomName];
  const senderName = normalizeName(sender);

  if (bannedUsers.has(senderName)) {
    return res.json({ success: false, error: 'Banned user' });
  }

  room.messages.push({ sender, text });

  // 相手のHPを100減らす
  const enemyName = room.players.find(p => normalizeName(p) !== senderName);
  if (enemyName && room.hpData[enemyName] !== undefined) {
    room.hpData[enemyName] = Math.max(0, room.hpData[enemyName] - 100);
  }

  res.json({ success: true, hpData: room.hpData });
});

// --- 勝敗結果記録 API (ランキング更新用) ---
app.post('/record-result', (req, res) => {
  const { winner, loser } = req.body;

  if (winner) {
    const winnerStat = getOrCreateUserStat(winner);
    winnerStat.wins += 1;
    winnerStat.exp += 100; // 勝利で100EXP
    winnerStat.level = Math.floor(winnerStat.exp / 200) + 1; // 200EXPごとにLv1アップ
  }

  if (loser) {
    const loserStat = getOrCreateUserStat(loser);
    loserStat.losses += 1;
    loserStat.exp += 30; // 敗北でも30EXP獲得
    loserStat.level = Math.floor(loserStat.exp / 200) + 1;
  }

  res.json({ success: true, userStats });
});

// --- 本格ランキング API（JSONデータ＆テキスト形式両対応） ---
app.get('/ranking', (req, res) => {
  // 勝利数 ＞ レベル ＞ EXP 順でソート
  const sortedList = Object.values(userStats).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.level !== a.level) return b.level - a.level;
    return b.exp - a.exp;
  });

  // リクエストがJSONを求めている場合はJSON返却
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({
      ranking: sortedList.slice(0, 50) // TOP 50
    });
  }

  // テキスト形式での整形表示（旧来のクライアント互換）
  if (sortedList.length === 0) {
    return res.send("まだ対戦記録がありません。最初の勝利者になろう！");
  }

  let resultText = "【🏆 ディベート対戦ランキング TOP10 🏆】\n\n";
  sortedList.slice(0, 10).forEach((user, index) => {
    const rank = index + 1;
    const winRate = (user.wins + user.losses) > 0 
      ? Math.round((user.wins / (user.wins + user.losses)) * 100) 
      : 0;
    
    resultText += `${rank}位: ${user.username} (Lv.${user.level})\n`;
    resultText += `   勝利: ${user.wins}勝 ${user.losses}敗 (勝率: ${winRate}%)\n\n`;
  });

  res.send(resultText);
});

// --- 通報 API ---
app.post('/report', (req, res) => {
  const { reporter, target, reason, roomName } = req.body;
  const cleanReporter = normalizeName(reporter);
  const cleanTarget = normalizeName(target);

  if (!cleanTarget) {
    return res.json({ success: false, message: '通報対象が見つかりません' });
  }

  const reportEntry = {
    reporter: cleanReporter,
    target: cleanTarget,
    reason: reason || '不適切な発言',
    roomName: roomName || '不明',
    timestamp: new Date().toISOString(),
    chatHistory: activeRooms[roomName] ? [...activeRooms[roomName].messages] : []
  };
  reportLogs.push(reportEntry);

  userReportCounts[cleanTarget] = (userReportCounts[cleanTarget] || 0) + 1;

  if (userReportCounts[cleanTarget] >= 3) {
    bannedUsers.add(cleanTarget);
  }

  res.json({ success: true, message: '通報を受け付けました。調査を実施します。' });
});

// --- 管理者画面 ---
app.get('/admin/reports', (req, res) => {
  res.json({
    totalReports: reportLogs.length,
    bannedUsers: Array.from(bannedUsers),
    reportCounts: userReportCounts,
    logs: reportLogs
  });
});

// --- 試合終了 API ---
app.post('/game-over', (req, res) => {
  const { roomName } = req.body;
  if (roomName && activeRooms[roomName]) {
    delete activeRooms[roomName];
  }
  res.json({ success: true });
});

// --- お題取得 API ---
app.get('/api/topic', (req, res) => {
  const randomIndex = Math.floor(Math.random() * TOPICS.length);
  res.json({
    id: randomIndex + 1,
    topic: TOPICS[randomIndex],
    total: TOPICS.length
  });
});

app.get('/api/topics', (req, res) => {
  res.json(TOPICS);
});

// ==========================================
// 5. サーバー起動
// ==========================================
app.listen(PORT, () => {
  console.log(`Index.js server running on http://localhost:${PORT}`);
});
