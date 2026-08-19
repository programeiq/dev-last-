const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

// データベース代わりのメモリ格納用
const usersDB = {};
let waitingQueue = [];
const activeRooms = {};

// お題リスト
const themes = [
    // --- 1. 日常・生活 (1〜60) ---
    "朝型 vs 夜型",
    "朝食はパン派 vs ごはん派",
    "バスタオルは毎日洗う vs 数日使ってから洗う",
    "部屋の掃除は毎日少しずつ vs 休日にまとめて",
    "服を買うなら実店舗 vs ネット通販",
    "休日は家でゴロゴロ vs 外出してお出かけ",
    "目覚まし時計は1個 vs 複数個セッティング",
    "シャワー派 vs 湯船に浸かる派",
    "傘はビニール傘 vs 折りたたみ傘を常備",
    "引っ越すなら徒歩5分の狭い部屋 vs 徒歩20分の広い部屋",
    "電車では座りたい vs 立っていても平気",
    "買い物の支払いは現金派 vs キャッシュレス派",
    "日記をつけるなら手書き vs スマホアプリ",
    "通知音は鳴らす vs 常にマナーモード",
    "スマホの保護フィルムはガラス vs サラサラ系",
    "写真はスマホで十分 vs 高性能カメラが欲しい",
    "LINEの返信はすぐ返す vs 後でまとめて返す",
    "新しいお店はすぐ試す vs 評価を見てから行く",
    "ポイントカードは作る vs 作らない",
    "旅行の計画はきっちり立てる vs 適当",
    "新幹線に乗るなら通路側 vs 窓側",
    "飛行機に乗るなら窓側 vs 通路側",
    "ホテルは素泊まり vs 朝食付き",
    "荷物は最小限 vs 念のため多め",
    "自炊派 vs 外食・惣菜派",
    "お風呂で洗う順番は頭から vs 体から",
    "歯磨き粉は辛口 vs マイルド",
    "シャンプーは香り重視 vs 効能重視",
    "寝る時の服装はパジャマ vs スウェット・ジャージ",
    "布団派 vs ベッド派",
    "枕は硬め vs 柔らかめ",
    "夏はクーラーガンガン vs 扇風機で粘る",
    "冬の暖房はエアコン vs ストーブ・コタツ",
    "ゴミ箱は各部屋に配置 vs 1箇所にまとめる",
    "靴は履き潰すまで1足 vs 毎日ローテーション",
    "冷蔵庫の中身はすっきり派 vs 常に満タン派",
    "文房具は機能性重視 vs デザイン重視",
    "腕時計はスマートウォッチ vs 伝統的なアナログ時計",
    "イヤホンはワイヤレス vs 有線",
    "作業中は無音 vs BGMを流す",
    "本を読むなら紙の本 vs 電子書籍",
    "新聞を読むなら紙 vs ネットニュース",
    "テレビを見るならリアルタイム vs 録画・配信",
    "仕事・勉強はカフェでする vs 自宅でする",
    "ノートをとるなら手帳 vs タブレット",
    "集中したい時は耳栓 vs 音楽",
    "休みの前日に夜更かし vs 休み当日に早起き",
    "髪型は長年同じ vs こまめに変える",
    "美容室・理容室では喋りたい vs 静かに過ごしたい",
    "服の色は１色 vs カラフル派",
    "スニーカー派 vs 革靴・パンプス派",
    "リュック派 vs ショルダーバッグ派",
    "定期券・ICカードはスマホ派 vs 物理カード派",
    "スーパーの買い物はカゴ1個分 vs カート押し",
    "エレベーターを待つなら階段を使う vs じっと待つ",

    // --- 2. 食べ物・グルメ (61〜120) ---
    "きのきの山 vs たけのこの里",
    "つぶあん vs こしあん",
    "玉子焼きは甘い派 vs しょっぱい派",
    "ラーメンのスープは飲み干す vs 残す",
    "目玉焼きにかけるのは醤油 vs ソース",
    "カレーは甘口 vs 辛口",
    "カレーのルーとご飯は混ぜて食べる vs 別々に食べる",
    "から揚げにレモンをかける vs かけない",
    "酢豚のパイナップルはアリ vs ナシ",
    "ピザのパイナップル（トッピング）はアリ vs ナシ",
    "納豆はよく混ぜる vs あまり混ぜない",
    "納豆にカラシを入れる vs 入れない",
    "うどん vs そば",
    "ラーメンは細麺 vs 太麺",
    "餃子はタレ派 vs 酢コショウ派",
    "寿司はわさび抜き vs わさび入り",
    "寿司ネタならマグロ vs サーモン",
    "焼肉ならカルビ vs タン塩",
    "焼肉のタレは甘口 vs 辛口",
    "焼肉はタレ派 vs 塩派",
    "フライドポテトは細切りカリカリ vs 太切りホクホク",
    "ポテトチップスはうすしお vs コンソメ",
    "きのこ料理ならしいたけ vs まいたけ",
    "たこ焼き vs お好み焼き",
    "たい焼きは頭から食べる vs 尾から食べる",
    "ショートケーキのイチゴは最初に食べる vs 最後に食べる",
    "チョコレートはミルク vs ハイカカオ",
    "アイスはバニラ vs チョコ",
    "アイスはカップ vs コーン",
    "夏に食べるならかき氷 vs アイスクリーム",
    "中華まん食べるなら肉まん vs あんまん",
    "ハンバーガーチェーンはマック vs モス",
    "コーヒーはブラック vs 砂糖・ミルク入り",
    "紅茶はストレート vs ミルクティー",
    "お茶なら緑茶 vs 烏龍茶",
    "炭酸飲料ならコーラ vs サイダー",
    "お酒ならビール vs ハイボール",
    "パンに塗るならジャム vs バター",
    "トーストは厚切り vs 薄切り",
    "目玉焼きは半熟 vs かため",
    "天ぷらにつけるのは天つゆ vs 塩",
    "とんかつにかけるのはソース vs おろしポン酢",
    "ハンバーグはデミグラス vs 和風おろし",
    "パスタならトマトソース vs クリームソース",
    "冷やし中華にマヨネーズはアリ vs ナシ",
    "おにぎりの具なら鮭 vs 梅干し",
    "おにぎりの海苔はパリパリ派 vs しっとり派",
    "洋食 vs 和食",
    "バイキング（ビュッフェ）は少しずつ全種類 vs 好きなものを集中",
    "辛い食べ物は好き vs 苦手",
    "パクチーは好き vs 苦手",
    "メロンパンは外のカリカリが好き vs 中のふわふわが好き",
    "クッキーはしっとり派 vs サクサク派",
    "タピオカドリンクは飲む vs 飲まない",
    "エナジードリンクは飲む vs 飲まない",
    "カップ麺はお湯を入れて規定時間待つ vs 早めに食べる",
    "スープカレー vs ルーカレー",

    // --- 3. エンタメ・趣味 (121〜180) ---
    "映画を見るなら映画館 vs 自宅の配信サービス",
    "アニメはリアルタイム放送 vs 一気見",
    "ドラマは毎週追う vs 完結してから一気に見る",
    "洋画は字幕派 vs 吹き替え派",
    "映画館でポップコーンを買う vs 買わない",
    "音楽フェスに行くなら野外フェス vs 室内フェス",
    "カラオケでは自分の得意曲 vs みんなが知ってる曲",
    "ゲームをするならPC vs 専用ハード",
    "ゲームはソロプレイ vs マルチプレイ",
    "ゲームの難易度はイージー vs ハード",
    "ゲームのストーリーはスキップする vs じっくり読む",
    "ゲームのレベル上げは苦にならない vs 面倒くさい",
    "ボードゲームが好き vs カードゲームが好き",
    "遊園地で乗るなら絶叫マシン vs 観覧車・メルヘン系",
    "水族館 vs 動物園",
    "美術館・博物館に行くなら解説を熟読 vs 雰囲気を楽しむ",
    "スポーツ観戦は現地 vs テレビ・配信",
    "自分でスポーツをするなら個人競技 vs 団体競技",
    "ランニング vs ウォーキング",
    "筋トレはジムに通う vs 自宅で自重トレ",
    "キャンプをするなら本格ガチキャンプ vs グランピング",
    "旅行に行くなら海 vs 山",
    "旅行先で観光スポット巡り vs ホテルでまったり",
    "国内旅行 vs 海外旅行",
    "テーマパークに行くならディズニー vs USJ",
    "漫画は単行本を買う vs Webアプリで読む",
    "漫画は完結してから読む vs 連載を追う",
    "小説を読むならミステリー vs ファンタジー",
    "ラジオを聞く習慣がある vs ない",
    "フェス・ライブは前列で暴れる vs 後方でじっくり見守る",
    "推し活にお金を使う vs 見守るだけで満足",
    "プラモデル・模型作りは好き vs 興味なし",
    "イラスト・絵を描くのが好き vs 見るのが専門",
    "写真撮影は景色重視 vs 人物重視",
    "Vlog動画を見るのが好き vs ゲーム実況が好き",
    "YouTubeの倍速再生は使う vs 使わない",
    "サブスク動画サービスは1つに絞る vs 複数契約",
    "脱出ゲーム・謎解きイベントが好き vs 苦手",
    "サウナで整うのが好き vs 長風呂派",
    "ドライブするなら高速道路 vs 下道（一般道）",
    "バイクに乗ってみたい vs 車で十分",
    "登山・ハイキングは好き vs 疲れるから嫌",
    "釣りをやってみたい（やったことがある） vs 興味がない",
    "ゴルフに興味がある vs 興味がない",
    "ダンスが得意・好き vs 踊るのは恥ずかしい",
    "マジック・手品を見るのは好き vs 興味がない",
    "パズルゲームが好き vs アクションゲームが好き",
    "格闘ゲーム vs FPS・TPS",
    "ガチャポン（カプセルトイ）を見たら回したくなる vs スルーする",
    "フィギュアを集める趣味がある vs ない",
    "御朱印集め・神社巡りが好き vs 興味なし",
    "道の駅に行くのが好き vs 行かない",
    "温泉旅行なら露天風呂付き客室 vs 広い大浴場",
    "喫茶店・カフェ巡りが好き vs チェーン店で十分",
    "古着を買うのが好き vs 新品しか買わない",
    "スニーカー集めが好き vs 履ければOK",

    // --- 4. 学問・仕事・技術 (181〜240) ---
    "文系 vs 理系",
    "数学は得意だった vs 苦手だった",
    "歴史を学ぶなら日本史 vs 世界史",
    "英語を学ぶなら英会話 vs 英文読解",
    "プログラミング学習は必須にすべき vs 選択で良い",
    "AI（人工知能）の進化は期待の方が大きい vs 不安の方が大きい",
    "自動運転車が普及したら自分で運転したい vs 全て任せたい",
    "宇宙旅行に行けるとしたら行きたい vs 地球で十分",
    "空飛ぶクルマは普及する vs 普及しない",
    "完全なVR世界に入り込めるなら暮らしたい vs 現実世界がいい",
    "ロボットが家事をしてくれる未来 vs 自分で家事をする",
    "電子マネー化で現金が完全廃止されるのは賛成 vs 反対",
    "紙の書類は完全に無くすべき vs 一部残すべき",
    "学校の授業はオンライン化すべき vs 対面であるべき",
    "宿題は出すべき vs 無くすべき",
    "夏休みの宿題は最初に終わらせる vs 最後にまとめてやる",
    "勉強するなら図書館 vs 自分の部屋",
    "暗記ものは夜寝る前 vs 朝起きてすぐ",
    "スマホはiPhone vs Android",
    "ブラウザはGoogle Chrome vs Safari",
    "生成AIで記事や文章を作るのはアリ vs ナシ",
    "AIが創ったアート作品は芸術と言える vs 言えない",
    "教科書はすべてタブレット化すべき vs 紙の教科書を残すべき",
    "外国語の学習はAI翻訳で不要になる vs 自力で学ぶべき",
    "クラウドストレージ派 vs 外付けHDD・SSD派",
    "Web会議でカメラはONにする vs OFFにする",
    "リモートワーク（在宅勤務） vs 出社（オフィス勤務）",
    "残業して稼ぐ vs 定時退社してプライベート重視",
    "会社の飲み会は参加したい vs 参加したくない",
    "転職を繰り返してキャリアアップ vs 1つの会社で長く働く",
    "副業・複業は推進すべき vs 本業に集中すべき",
    "打ち合わせは対面 vs オンライン",
    "定例会議は必要 vs チャット報告で十分",
    "鉛筆はHB vs B",
    "メモを取るなら付箋 vs メモ帳",
    "外食の注文はすぐ決まる vs 悩んでなかなか決まらない",

    // --- 5. IF・空想・性格・選択 (241〜300) ---
    "タイムマシンがあるなら過去に行きたい vs 未来に行きたい",
    "不老不死の薬があったら飲む vs 飲まない",
    "火星に移住できるなら住んでみたい vs 絶対嫌だ",
    "超能力が手に入るなら「透明化」 vs 「空を飛ぶ」",
    "過去のやり直しができるなら乳幼児 vs 幼稚園生",
    "一生旅し続ける生活 vs 1箇所に永住する生活",
    "自分の未来を知ることができるなら知りたい vs 知りたくない",
    "動物と喋れる能力 vs 世界中の言語が喋れる能力",
    "1億円もらえるがスマホ一生禁止 vs 貰わずにスマホ使い続ける",
    "どこでもドア vs タケコプター",
    "超能力「時間を止める」 vs 「一瞬でワープする」",
    "歌がめちゃくちゃ上手くなる vs 踊りがめちゃくちゃ上手くなる",
    "一生暑い国で暮らす vs 一生寒い国で暮らす",
    "無人島に持っていくならナイフ vs 火つけ道具",
    "生まれ変わるなら人間 vs 鳥",
    "過去の歴史上の人物に会えるなら織田信長 vs 坂本龍馬",
    "世界一周旅行 vs 宇宙旅行",
    "視力が超良くなる vs 聴力が超良くなる",
    "読心術（人の心が読める）は欲しい vs 欲しくない",
    "一生カレーしか食べられない vs 一生ラーメンしか食べられない",
    "一生甘いもの禁止 vs 一生しょっぱいもの禁止",
    "映画の主人公になれるならヒーロー vs 悪役",
    "タイムスリップするなら恐竜時代 vs 江戸時代",
    "一生本が読み放題 vs 一生映画が見放題",
    "声優になれるならアニメの主人公 vs ナレーション",
    "無人島で生き残るなら体力自慢 vs 知識自慢",
    "魔法が1つ使えるなら「回復魔法」 vs 「攻撃魔法」",
    "幽霊は存在する vs 存在しない",
    "宇宙人はすでに地球に来ている vs 来ていない",
    "一生車を運転できない vs 一生電車に乗れない",
    "家を建てるなら平屋 vs 3階建て",
    "住むなら都会のタワマン vs 郊外の一戸建て",
    "1日が30時間になったら仕事・勉強する vs 睡眠にあてる",
    "睡眠時間は4時間で十分な体が欲しい vs 10時間ぐっすり寝たい",
    "宝くじで10億円当たったらすぐ会社を辞める vs 働き続ける",
    "無人島に1人で行く vs 嫌いな人と2人で行く",
    "人生をやり直せるなら同じ人生 vs 全く違う人生",
    "寿命があと10年伸びる vs 10歳の若返り",
    "10分前に行けるボタン vs 10分後の未来が見えるボタン",
    "どこでも行けるドア vs 好きなものを出せるポケット",
    "自分の心の声が周りに漏れる vs 周りの心の声が全部聞こえる",
    "一生テレビが見られない vs 一生SNSが使えない",
    "一生洋服が同じデザイン vs 一生髪型が同じ",
    "言葉が通じない世界 vs 音が存在しない世界",
    "暑さに超強い体 vs 寒さに超強い体",
    "寝なくても疲れない体 vs 食べても太らない体",
    "目立つ主役タイプ vs 陰で支える名脇役タイプ",
    "即断即決タイプ vs じっくり熟考タイプ",
    "ポジティブ思考 vs ネガティブ警戒思考",
    "人見知りする vs 誰とでもすぐ仲良くなれる",
    "人の名前を覚えるのが得意 vs 顔を覚えるのが得意",
    "サプライズされるのが好き vs 苦手",
    "怒ると黙る派 vs 怒ると喋る派",
    "喧嘩したら自分から謝る vs 相手が謝るまで待つ",
    "相談は乗る派 vs 相談する派",
    "悩みはすぐ人に話す vs 自分の中に溜め込む",
    "バイキングで元を取ろうと張り切る vs 食べたい分だけ食べる",
    "旅行のお土産は配る用に大量買い vs 自分の分だけ最小限"
];
// NGワードリスト（サンプル）
const ngWords = ["死ね", "バカ", "キモい", "ゴミ"];

io.on('connection', (socket) => {
  let currentUserId = null;

  // ユーザー認証処理
  socket.on('auth_user', (data) => {
    currentUserId = data.userId;
    if (!usersDB[currentUserId]) {
      usersDB[currentUserId] = {
        name: data.name || "名無し",
        level: 1,
        wins: 0
      };
    } else if (data.name) {
      usersDB[currentUserId].name = data.name;
    }
    socket.userId = currentUserId;
    socket.emit('user_data_loaded', usersDB[currentUserId]);
  });

  // 名前変更
  socket.on('update_name', (data) => {
    if (socket.userId && usersDB[socket.userId]) {
      usersDB[socket.userId].name = data.name;
    }
  });

  // マッチングキュー参加
  socket.on('join_match', (data) => {
    // 重複除去（既存の同じソケットIDを排除）
    waitingQueue = waitingQueue.filter(p => p.socketId !== socket.id);

    waitingQueue.push({
      socketId: socket.id,
      userId: socket.userId,
      name: data.name || (usersDB[socket.userId] ? usersDB[socket.userId].name : "名無し")
    });

    processMatching();
  });

  // マッチングのキャンセル
  socket.on('cancel_match', () => {
    waitingQueue = waitingQueue.filter(p => p.socketId !== socket.id);
  });

  // メッセージ送信
  socket.on('send_message', (data) => {
    const room = activeRooms[data.roomId];
    if (!room) return;

    const msg = data.message;
    const player = room.players[socket.id];
    if (!player) return;

    // NGワードチェック
    const containsNG = ngWords.some(word => msg.includes(word));
    if (containsNG) {
      socket.emit('kicked_notification', { reason: "不適切な言語が検知されたためキックされました。" });
      endGame(data.roomId, getOpponentId(room, socket.id), "相手が規約違反により失格");
      return;
    }

    // ダメージ適用（発言すると相手に100ダメージ）
    const oppId = getOpponentId(room, socket.id);
    if (oppId && room.players[oppId]) {
      room.players[oppId].hp = Math.max(0, room.players[oppId].hp - 100);
    }

    io.to(data.roomId).emit('receive_message', {
      senderId: socket.id,
      senderName: player.name,
      senderSide: player.side,
      message: msg
    });

    // HP判定
    if (room.players[oppId] && room.players[oppId].hp <= 0) {
      endGame(data.roomId, socket.id, "相手のHPが0になりました！");
    }
  });

  // タイピング状態（タイピング中はHP減少防止）
  socket.on('typing_status', (data) => {
    const room = activeRooms[data.roomId];
    if (room && room.players[socket.id]) {
      room.players[socket.id].isTyping = data.isTyping;
    }
  });

  // 降参
  socket.on('surrender', (data) => {
    const room = activeRooms[data.roomId];
    if (room) {
      const winnerId = getOpponentId(room, socket.id);
      endGame(data.roomId, winnerId, "相手が降参しました。");
    }
  });

  // ランキングデータ取得（★0勝ユーザーを除外するよう修正★）
  socket.on('get_ranking', () => {
    const rankingList = Object.values(usersDB)
      .filter(u => u.wins > 0)          // 0勝（未勝利）のユーザーを除外
      .sort((a, b) => b.wins - a.wins)  // 勝利数が多い順にソート
      .slice(0, 10);                    // TOP10を取得
    socket.emit('ranking_data', rankingList);
  });

  // 切断時のゴースト防止処理
  socket.on('disconnect', () => {
    waitingQueue = waitingQueue.filter(p => p.socketId !== socket.id);

    // プレイ中の部屋の離脱処理
    for (const roomId in activeRooms) {
      const room = activeRooms[roomId];
      if (room.players[socket.id]) {
        const winnerId = getOpponentId(room, socket.id);
        endGame(roomId, winnerId, "相手の接続が切断されました。");
        break;
      }
    }
  });
});

// マッチング実行（ゴースト完全防止アルゴリズム）
function processMatching() {
  while (waitingQueue.length >= 2) {
    const player1 = waitingQueue.shift();
    const player2 = waitingQueue.shift();

    // 生存確認（現在も有効に繋がっているソケットか）
    const socket1 = io.sockets.sockets.get(player1.socketId);
    const socket2 = io.sockets.sockets.get(player2.socketId);

    // ゴーストソケットを除外してやり直し
    if (!socket1 || !socket1.connected) {
      if (socket2 && socket2.connected) waitingQueue.unshift(player2);
      continue;
    }
    if (!socket2 || !socket2.connected) {
      if (socket1 && socket1.connected) waitingQueue.unshift(player1);
      continue;
    }

    // 正常な2名で部屋を生成
    const roomId = 'room_' + Math.random().toString(36).substring(2, 9);
    const selectedTheme = themes[Math.floor(Math.random() * themes.length)];

    socket1.join(roomId);
    socket2.join(roomId);

    const level1 = usersDB[player1.userId] ? usersDB[player1.userId].level : 1;
    const level2 = usersDB[player2.userId] ? usersDB[player2.userId].level : 1;

    activeRooms[roomId] = {
      timeLeft: 180,
      theme: selectedTheme,
      players: {
        [player1.socketId]: { userId: player1.userId, name: player1.name, hp: 10000, side: '立場A', isTyping: false },
        [player2.socketId]: { userId: player2.userId, name: player2.name, hp: 10000, side: '立場B', isTyping: false }
      }
    };

    socket1.emit('match_found', {
      roomId: roomId,
      opponentName: player2.name,
      opponentLevel: level2,
      yourSide: '前者',
      theme: selectedTheme
    });

    socket2.emit('match_found', {
      roomId: roomId,
      opponentName: player1.name,
      opponentLevel: level1,
      yourSide: '後者',
      theme: selectedTheme
    });

    // 1秒ごとのTickタイマー制御
    activeRooms[roomId].timer = setInterval(() => {
      const room = activeRooms[roomId];
      if (!room) return;

      room.timeLeft -= 1;

      // 毎秒毎にタイピング中でないプレイヤーのHPを1ずつ削る
      Object.keys(room.players).forEach(sId => {
        const p = room.players[sId];
        if (!p.isTyping) {
          p.hp = Math.max(0, p.hp - 1);
        }
      });

      io.to(roomId).emit('tick_status', {
        timeLeft: room.timeLeft,
        players: room.players
      });

      // 試合時間の終了判定
      if (room.timeLeft <= 0) {
        const pIds = Object.keys(room.players);
        let winnerId = null;
        if (room.players[pIds[0]].hp > room.players[pIds[1]].hp) winnerId = pIds[0];
        else if (room.players[pIds[1]].hp > room.players[pIds[0]].hp) winnerId = pIds[1];

        endGame(roomId, winnerId, "制限時間終了！HPの多い方の勝利です。");
      }
    }, 1000);

    break;
  }
}

function getOpponentId(room, mySocketId) {
  return Object.keys(room.players).find(id => id !== mySocketId);
}

function endGame(roomId, winnerSocketId, reason) {
  const room = activeRooms[roomId];
  if (!room) return;

  clearInterval(room.timer);

  let winnerName = "引き分け";
  if (winnerSocketId && room.players[winnerSocketId]) {
    winnerName = room.players[winnerSocketId].name;
    const winnerUserId = room.players[winnerSocketId].userId;
    if (winnerUserId && usersDB[winnerUserId]) {
      usersDB[winnerUserId].wins += 1;
      usersDB[winnerUserId].level = Math.floor(usersDB[winnerUserId].wins / 3) + 1;
    }
  }

  io.to(roomId).emit('game_over', {
    winnerName: winnerName,
    reason: reason
  });

  delete activeRooms[roomId];
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
