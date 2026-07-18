const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// ★ここがポイント！npm install不要でCORS（通信制限）を解除するコード
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// ゲームデータを保持するメモリ
let waitingPlayer = null;
let rooms = {};

// お題リスト
const THEMES = [
  "きのきの山 vs たけのこの里 どちらが優れているか？",
  "犬派 vs 猫派 ペットにするならどっち？",
  "朝型 vs 夜型 人生が豊かになるのはどっち？",
  "お金 vs 愛 人生で本当に大切なのはどっち？",
  "うどん vs そば 日本を代表する麺類はどっち？",
  "インドア vs アウトドア 休日の過ごし方はどっちが最高？",
  "ご飯派 vs パン派 最高の朝食はどっち？",
  "コーヒー派 vs 紅茶派 一日の始まりに飲むならどっち？",
  "夏 vs 冬 快適に過ごせる季節はどっち？",
  "海 vs 山 最高の休暇を過ごすならどっち？",
  "都会 vs 田舎 住んで幸せなのはどっち？",
  "電話 vs メール 連絡を取るならどっちが便利？",
  "紙の本 vs 電子書籍 読書をするならどっち？",
  "自炊 vs 外食 お金が貯まり、豊かなのはどっち？",
  "目覚まし時計 vs スマホの目覚まし 朝起きるならどっち？",
  "温泉 vs 遊園地 週末の旅行で行くならどっち？",
  "スニーカー vs 革靴 毎日履くならどっち？",
  "リュック vs ショルダーバッグ 普段使いならどっち？",
  "メガネ vs コンタクト 視力矯正するならどっち？",
  "腕時計 vs スマホ 時間を確認するならどっち？",
  "傘 vs 雨合羽 雨の日の移動はどっちが快適？",
  "目玉焼き vs 卵焼き 朝食の卵料理ならどっち？",
  "ショートケーキ vs チーズケーキ 好きなケーキはどっち？",
  "ハンバーガー vs ピザ ファストフードならどっち？",
  "ビール vs 日本酒 居酒屋で最初に頼むならどっち？",
  "焼肉 vs 寿司 ご褒美に食べるならどっち？",
  "カレー vs ラーメン 毎日でも食べたいのはどっち？",
  "餃子 vs 焼売 中華の定番ならどっち？",
  "ラーメン 醤油 vs 味噌 一番好きな味はどっち？",
  "ラーメン とんこつ vs 塩 スープが美味しいのはどっち？",
  "アイスクリーム vs かき氷 夏に食べたい冷たいスイーツはどっち？",
  "和菓子 vs 洋菓子 毎日のおやつならどっち？",
  "おにぎり vs サンドイッチ ピクニックに持っていくならどっち？",
  "唐揚げ vs フライドチキン 定番の揚げ物はどっち？",
  "納豆 vs 豆腐 朝食の健康食材ならどっち？",
  "マヨネーズ vs ケチャップ 何にでもかけたいのはどっち？",
  "醤油 vs ソース 食卓に欠かせない調味料はどっち？",
  "目玉焼きにかけるなら 醤油 vs ソース",
  "納豆に入れるなら 生卵 vs キムチ",
  "ポテトチップス うすしお vs コンソメ どっちが好き？",
  "たこ焼き vs お好み焼き 大阪名物ならどっち？",
  "焼きそば vs チャーハン 家で作りやすいランチはどっち？",
  "目覚ましは一回 vs スヌーズ機能を使う",
  "休日は予定を立てる vs 立てないで気ままに過ごす",
  "旅行は国内 vs 海外 楽しむならどっち？",
  "旅行は計画的に行く vs 行き当たりばったり",
  "荷物は多い派 vs 少ない派 安心して旅行できるのはどっち？",
  "テレビ vs YouTube 情報を得るならどっち？",
  "テレビ vs ネットフリックス 休日見るならどっち？",
  "映画館 vs 自宅のテレビ 映画を見るならどっち？",
  "スマホ Android vs iPhone 使うならどっち？",
  "パソコン Mac vs Windows 選ぶならどっち？",
  "SNS Instagram vs X（旧Twitter） 使うならどっち？",
  "ゲームはスマホ vs 据え置き型 楽しむならどっち？",
  "ゲーム RPG vs アクション プレイするならどっち？",
  "音楽を聴くなら ストリーミング vs CD",
  "電子マネー vs 現金 買い物するならどっち？",
  "クレジットカード vs デビットカード 使うならどっち？",
  "ネットショッピング vs 店舗での買い物 便利なのはどっち？",
  "日記は毎日つける vs つけない",
  "家計簿はアプリ vs ノート",
  "掃除機 vs ほうき 部屋の掃除をするならどっち？",
  "洗濯機は縦型 vs ドラム式 買うならどっち？",
  "エアコン vs 扇風機 夏を乗り切るならどっち？",
  "こたつ vs 電気カーペット 冬に欲しいのはどっち？",
  "掛け布団 羽根布団 vs 綿布団 暖かいのはどっち？",
  "枕は柔らかい vs 固い",
  "シャワー派 vs お風呂（湯船）派 一日の疲れが取れるのはどっち？",
  "歯磨き粉 ミント vs 塩味 使うならどっち？",
  "シャンプー リンスイン vs 別々 髪に良いのはどっち？",
  "ドライヤー 自然乾燥 vs ブロードライ",
  "髭剃り 電動シェーバー vs カミソリ",
  "石鹸派 vs ボディソープ派",
  "ハンドソープ 泡タイプ vs 液体タイプ",
  "化粧品 プチプラ vs デパコス 選ぶならどっち？",
  "香水 つける派 vs つけない派",
  "髪型 ロング vs ショート 似合うのはどっち？",
  "服装 パンツ派 vs スカート派",
  "財布 長財布 vs 二つ折り 財布ならどっち？",
  "傘 ビニール傘 vs 折りたたみ傘 持ち歩くならどっち？",
  "エコバッグ 布製 vs ナイロン製",
  "カレンダー アプリ vs 紙の手帳 スケジュール管理はどっち？",
  "ノートは方眼 vs 無地",
  "ボールペン 黒 vs 青",
  "消しゴム vs 修正テープ",
  "鉛筆 vs シャープペンシル 使うならどっち？",
  "ハサミ vs カッター 用途に合わせて使うならどっち？",
  "ゴミ箱 木製 vs プラスチック",
  "ハンガー 木製 vs プラスチック",
  "時計 アナログ vs デジタル",
  "靴ひもを結ぶ vs スリッポン",
  "ベルト 革 vs 布",
  "靴下 くるぶし丈 vs ロング丈",
  "マフラー vs ネックウォーマー 冬の防寒ならどっち？",
  "手袋 指あり vs 指なし",
  "サングラス かける派 vs かけない派",
  "コンタクト 1日使い捨て vs 2週間交換",
  "水はミネラルウォーター vs 水道水",
  "結婚するなら 恋愛結婚 vs お見合い結婚",
  "恋人に求めるのは 経済力 vs 性格の良さ",
  "恋人の条件 優先すべきは 外見 vs 内面",
  "恋人とは 毎日連絡を取りたい vs たまの連絡でいい",
  "デートの支払いは 割り勘 vs おごり",
  "記念日を祝うのは サプライズ vs 事前に相談して決定",
  "友達は 少数精鋭 vs 多人数でワイワイ",
  "友達に求めるのは 優しさ vs 面白さ",
  "親友とは 毎日話す vs たまに会うくらいが良い",
  "怒るなら 感情を爆発させる vs 冷静に理論的に話す",
  "ケンカした時 謝るのは 自分から vs 相手から",
  "恋人のスマホ 見る派 vs 見ない派",
  "結婚相手に求めるのは 思いやり vs 経済力",
  "結婚したら 共働き vs 専業主婦（夫）",
  "子育て 褒めて伸ばす vs 厳しくしつける",
  "子供には ペットを飼わせるべきか vs 飼わせないべきか",
  "習い事は スポーツ vs 芸術（音楽など）",
  "休日の家族サービス 子供と遊ぶ vs 家族でゆっくり過ごす",
  "夫婦の財布は 一緒 vs 別々",
  "義理の実家との付き合いは 頻繁に会う vs 距離を置く",
  "住むなら 持ち家 vs 賃貸",
  "親の介護は 自宅で看る vs 施設に預ける",
  "ペットの名前 人間っぽい vs ペットらしい",
  "休日の過ごし方 家族優先 vs 自分優先",
  "友達を作るなら 職場 vs 趣味のサークル",
  "恋愛において 追う側 vs 追われる側",
  "恋人へのプレゼント サプライズ vs 欲しいものを聞く",
  "プロポーズは 言葉 vs 手紙・贈り物",
  "浮気は 一回の過ちでも許せる vs 許せない",
  "元恋人とは 友達になれる vs なれない",
  "デートの行き先は 毎回決める vs 毎回新しい場所",
  "休日のランチは 家で食べる vs 外に食べに行く",
  "休日のディナーは 自炊 vs 外食",
  "同棲は 結婚前にすべきか vs すべきではないか",
  "遠距離恋愛は 成立する vs 成立しない",
  "結婚式は 派手に挙げる vs 地味に行う（または挙げない）",
  "子どものスマホ 制限する vs 自由に使う",
  "大学へ行くべきか vs 就職するべきか",
  "高校生のアルバイト 許可するべき vs 禁止するべき",
  "学生の宿題 必要 vs 不要",
  "制服 必要 vs 不要",
  "テストの順位 発表すべき vs 発表すべきではない",
  "部活動 全員参加 vs 自由参加",
  "教育において 才能 vs 努力 重要なのはどっち？",
  "勉強するなら 独学 vs 塾に通う",
  "電子黒板 vs 黒板 授業で使うならどっち？",
  "オンライン授業 vs 对面授業 学べるのはどっち？",
  "留年 vs 飛び級 才能を伸ばすならどっち？",
  "理系 vs 文系 学ぶならどっち？",
  "歴史を学ぶなら 人物中心 vs 事件中心",
  "読書感想文 必要 vs 不要",
  "修学旅行 国内 vs 海外",
  "修学旅行 行事としての意義がある vs ない",
  "給食 vs お弁当 どちらが良いか？",
  "学校の掃除 生徒がやる vs 業者がやる",
  "校則は 厳しいほうがいい vs 自由であるべき",
  "先生に求めるのは 指導力 vs 優しさ",
  "学歴社会は 今も存在する vs 存在しない",
  "就職するなら 大企業 vs 中小企業",
  "仕事に求めるのは やりがい vs 収入",
  "副業 推進するべき vs 禁止するべき",
  "リモートワーク vs 出社 働きやすいのはどっち？",
  "昇進するなら 年功序列 vs 成果主義",
  "フリーランス vs 会社員 幸せな働き方はどっち？",
  "定年制度は 廃止すべき vs 維持するべき",
  "週休3日制 賛成 vs 反対",
  "AIは人間の仕事を奪うか vs 共存できるか",
  "AIによる絵画や小説 芸術として認める vs 認めない",
  "キャッシュレス社会 賛成 vs 反対",
  "自動運転の普及 賛成 vs 反対",
  "仮想通貨（暗号資産）の未来 有望 vs バブル",
  "SNSの実名制 賛成 vs 反対",
  "ロボットの介護 賛成 vs 反対",
  "宇宙開発 優先すべき vs 地球環境保護を優先すべき",
  "環境問題 優先すべき vs 経済成長を優先すべき",
  "原子力発電 必要 vs 不要",
  "プラスチックの削減 賛成 vs 反対",
  "レジ袋有料化 賛成 vs 反対",
  "フードロス削減 個人の意識 vs 企業の責任",
  "リサイクル 義務化すべき vs 任意にするべき",
  "消費税 増税すべき vs 減税すべき",
  "ベーシックインカム 導入すべき vs 反対",
  "死刑制度 廃止すべき vs 維持すべき",
  "裁判員制度 賛成 vs 反対",
  "選挙の投票率向上 罰則を設けるべき vs 義務化すべきではない",
  "移民の受け入れ 賛成 vs 反対",
  "女性専用車両 必要 vs 不要",
  "夫婦別姓 導入すべき vs 反対",
  "安楽死 認めるべき vs 認めるべきではない",
  "同性婚 認めるべき vs 反対",
  "ボランティア 義務化するべき vs 任意であるべき",
  "タバコは全面禁止すべきか vs 分煙でよい",
  "選挙権の年齢 18歳 vs 20歳",
  "定年退職の年齢 引き上げるべき vs 引き下げるべき",
  "無人島に一つだけ持っていくなら ナイフ vs 本",
  "タイムマシンで行くなら 過去 vs 未来",
  "超能力を手に入れるなら タイムトラベル vs 瞬間移動",
  "魔法が一つだけ使えるなら 空を飛ぶ vs 病気を治す",
  "透明人間になれるなら 悪用する vs 善行に使う",
  "不老不死になりたいか vs 人生の長さに限りがあるべきか",
  "もし宝くじで3億円当たったら すぐ使う vs 貯金する",
  "自分の性格 変えられるなら 変えたい vs 変えたくない",
  "動物と話せるなら 虫と話す vs 哺乳類と話す",
  "生まれ変わるなら 男性 vs 女性",
  "生まれ変わるなら 日本人 vs 外国人",
  "宝くじ 買う派 vs 買わない派",
  "人生 お金 vs 経験",
  "人生 成功 vs 安定",
  "もし地球最後の日なら 美味しいものを食べる vs 家族と過ごす",
  "犬 vs 猫 あなたが飼うならどっち？",
  "一生どちらかしか食べられないなら 肉 vs 魚",
  "一生どちらかしか飲めないなら コーヒー vs お茶",
  "世界平和 vs 科学の発展 優先すべきはどっち？",
  "天才 vs 努力家 成功するのはどっち？"
];

// サーバー起動チェック用
app.get('/', (req, res) => {
  res.send('Yururon Game Server is Running!');
});

// ランキング（サンプル）
app.get('/ranking', (req, res) => {
  res.send("1位: 伝説の論客A\n2位: ゆる論破王B\n3位: ひよこディベーターC");
});

// マッチングAPI
app.get('/match', (req, res) => {
    const username = req.query.username || '名無しさん';

    // すでに自分が待ち状態なのに、連打などでまたリクエストが来たら古いのは無視
    if (waitingPlayer === username) {
        waitingRes = res;
        return;
    }

    if (waitingPlayer && waitingPlayer !== username) {
        // ★2人目が来た！マッチング成立！
        const roomName = 'room_' + Math.random().toString(36).substring(2, 9);
        const selectedTheme = THEMES[Math.floor(Math.random() * THEMES.length)];

        rooms[roomName] = {
            theme: selectedTheme,
            players: [waitingPlayer, username],
            messages: [],
            hp: { [waitingPlayer]: 100, [username]: 100 },
            isGameOver: false
        };

        // 1人目（待っていた人）に成功を返す
        waitingRes.send(`MATCHING_SUCCESS | Room: ${roomName} | ${selectedTheme}`);
        // 2人目（今来た人）に成功を返す
        res.send(`MATCHING_SUCCESS | Room: ${roomName} | ${selectedTheme}`);

        // 待ち状態をクリア
        waitingPlayer = null;
        waitingRes = null;
    } else {
        // ★誰もいないので、1人目として静かに待つ（AI部屋へは行かない！）
        waitingPlayer = username;
        waitingRes = res; // レンスポンスを返さずにキープして接続を待たせる
        
        // 注意：あまりに放置されるとタイムアウトするので、画面側から定期的に
        // 再送してもらうか、サーバー側で一定時間後に「まだだよ」と返す処理を入れると親切です
    }
});

// メッセージ送信API
app.post('/send-message', (req, res) => {
  const { roomName, sender, text, penaltyDamage } = req.body;
  const room = rooms[roomName];
  if (!room || room.isGameOver) {
    return res.status(400).send('Room not found or game over');
  }

  // 1. 初速のペナルティダメージがある場合
  if (penaltyDamage !== undefined) {
    const rawDamage = Math.ceil(penaltyDamage / 20);
    if (room.hp[sender] !== undefined) {
      room.hp[sender] = Math.max(0, room.hp[sender] - rawDamage);
    }
    return res.json({ success: true, hp: room.hp });
  }

  // 2. 通常メッセージの送信処理
  if (text && text.trim() !== "") {
    room.messages.push({ sender, text });
    
    // 通常送信時は相手に微小なランダムダメージ（5〜15）
    const opponent = room.players.find(p => p !== sender);
    if (opponent && room.hp[opponent] !== undefined) {
      const damage = Math.floor(Math.random() * 11) + 5; 
      room.hp[opponent] = Math.max(0, room.hp[opponent] - damage);
    }
  }

  res.json({ success: true, hp: room.hp, messages: room.messages });
});

// メッセージ＆HP取得API
app.get('/get-messages', (req, res) => {
  const { roomName } = req.query;
  const room = rooms[roomName];
  if (!room) {
    return res.json({ messages: [], hpData: {} });
  }
  res.json({ messages: room.messages, hpData: room.hp });
});

// ゲームオーバーAPI
app.post('/game-over', (req, res) => {
  const { roomName } = req.body;
  if (rooms[roomName]) {
    rooms[roomName].isGameOver = true;
  }
  res.send('Game Over Recorded');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
