const SERVER_URL = 'https://dev-last-production.up.railway.app';
  
  let myRoomName = '';
  let lastMessageCount = 0; 
  let chatIntervalId = null;
  let timerIntervalId = null; 
  let matchPollIntervalId = null; 
  let countdownIntervalId = null;
  let typingTimeoutId = null;

  let remainingTime = 180; 
  let isGameOverFlag = false;
  let hasTriggeredCountdown = false;
  let isTyping = false; 
  let isMatchEstablished = false; 

  let myHP = 2000;
  let enemyHP = 2000; 

  let kickCount = parseInt(localStorage.getItem('yururon_kick_count')) || 0;
  let isBanned = localStorage.getItem('yururon_is_banned') === 'true';
  let lastActionTime = Date.now(); 
  let lastInputValue = "";
  let sameInputKeepCount = 0; 

  let myUsername = localStorage.getItem('yururon_username') || '';
  let myLevel = parseInt(localStorage.getItem('yururon_level')) || 1;
  let myExp = parseInt(localStorage.getItem('yururon_exp')) || 0;
  let currentLabel = localStorage.getItem('yururon_label') || 'ゆるろん初心者';
  let myChosenSide = '';

  const itemsList = [
    { lv: 1, label: 'ゆるろん初心者' },
    { lv: 10, label: '口喧嘩 of ヒヨコ' },
    { lv: 30, label: '論破 of ニワトリ' },
    { lv: 50, label: '弁論大会 of 覇者' },
    { lv: 80, label: '論理 of 絶対神' },
    { lv: 100, label: '伝説 of ディベーター' }
  ];

  if (!myUsername) {
    myUsername = prompt('ユーザーネームを入力してください！') || '名無しさん';
    localStorage.setItem('yururon_username', myUsername);
  }

  const messageInputElem = document.getElementById('message-input');
  
  messageInputElem.addEventListener('input', () => {
    lastActionTime = Date.now();
    
    if (messageInputElem.value.trim().length > 0) {
      isTyping = true;
      document.getElementById('response-timer-box').innerText = "タイピング中：HP減少ストップ！";
      document.getElementById('response-timer-box').style.backgroundColor = "#FF7675";

      if (typingTimeoutId) clearTimeout(typingTimeoutId);
      typingTimeoutId = setTimeout(() => {
        isTyping = false;
        document.getElementById('response-timer-box').innerText = "毎秒 -1 HP";
        document.getElementById('response-timer-box').style.backgroundColor = "#1DD1A1";
      }, 3000);
    } else {
      isTyping = false;
      document.getElementById('response-timer-box').innerText = "毎秒 -1 HP";
      document.getElementById('response-timer-box').style.backgroundColor = "#1DD1A1";
    }
  });

  function triggerImageUpload() { document.getElementById('icon-file-input').click(); }

  function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("画像サイズが大きすぎます！2MB以下の写真を選んでね。"); return; }
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        localStorage.setItem('yururon_user_icon', e.target.result);
        loadUserIcon();
        document.getElementById('display-box').innerText = "お気に入りの写真をアイコンに設定したよ！📸";
      } catch (error) { alert("画像データが大きすぎます。別の写真で試してね！"); }
    };
    reader.readAsDataURL(file);
  }

  function loadUserIcon() {
    const savedIcon = localStorage.getItem('yururon_user_icon');
    const imgTag = document.getElementById('custom-icon-img');
    const fallbackText = document.getElementById('fallback-text');
    if (savedIcon) { imgTag.src = savedIcon; imgTag.style.display = 'block'; fallbackText.style.display = 'none'; } 
    else { imgTag.style.display = 'none'; fallbackText.style.display = 'block'; }
  }

  function updateUserDataDisplay() {
    let lvText = myLevel >= 100 ? "MAX" : `Lv.${myLevel}`;
    let expText = myLevel >= 100 ? "MAX" : `EXP: ${myExp}/100`;
    document.getElementById('user-badge').innerText = `${myUsername} [${lvText} (${expText})]`;
    document.getElementById('icon-item-label').innerText = currentLabel;
    loadUserIcon();
  }
  updateUserDataDisplay();

  function changeName() {
    let newName = prompt('新しいユーザーネームを入力してください：', myUsername);
    if (newName && newName.trim() !== '') {
      myUsername = newName.trim();
      localStorage.setItem('yururon_username', myUsername);
      updateUserDataDisplay();
    }
  }

  function openItemBox() {
    let message = "称号変更\n番号を入力してね！\n\n";
    itemsList.forEach((item, index) => {
      const isUnlocked = myLevel >= item.lv;
      message += `${index + 1}: [${isUnlocked ? '解放済' : 'Lv.' + item.lv + 'で解放'}] ${item.label}\n`;
    });
    let choice = prompt(message);
    let idx = parseInt(choice) - 1;
    if (idx >= 0 && idx < itemsList.length) {
      if (myLevel >= itemsList[idx].lv) {
        currentLabel = itemsList[idx].label;
        localStorage.setItem('yururon_label', currentLabel);
        updateUserDataDisplay();
      } else { alert("レベルが足りません！"); }
    }
  }

  function addExperience(amount) {
    if (myLevel >= 100) return;
    myExp += amount;
    while (myExp >= 100 && myLevel < 100) { myExp -= 100; myLevel++; }
    localStorage.setItem('yururon_level', myLevel);
    localStorage.setItem('yururon_exp', myExp);
    updateUserDataDisplay();
  }

  function showRule() {
    document.getElementById('display-box').innerHTML = `【ルール】\n1秒ごとにHPが1ずつ自然減少！（文字入力中のみストップ！）\n※1分間（60秒）の無入力放置や、入力状態キープによる放置は警告対象！3回警告でBAN！`;
  }

  function clearAllTimers() {
    if (chatIntervalId) { clearInterval(chatIntervalId); chatIntervalId = null; }
    if (timerIntervalId) { clearInterval(timerIntervalId); timerIntervalId = null; }
    if (matchPollIntervalId) { clearInterval(matchPollIntervalId); matchPollIntervalId = null; }
    if (countdownIntervalId) { clearInterval(countdownIntervalId); countdownIntervalId = null; }
    if (typingTimeoutId) { clearTimeout(typingTimeoutId); typingTimeoutId = null; }
  }

  function startMatching() {
    if (isBanned) {
      alert("❌ あなたは不正行為（放置・連打など）によりBANされています。プレイできません。");
      return;
    }

    clearAllTimers();
    hasTriggeredCountdown = false;
    isMatchEstablished = false;
    isGameOverFlag = false;

    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('vs-match-screen').style.display = 'flex';

    const mySavedIcon = localStorage.getItem('yururon_user_icon');
    const myIconSlot = document.getElementById('match-my-icon-slot');
    if (mySavedIcon) { myIconSlot.innerHTML = `<img src="${mySavedIcon}">`; } 
    else { myIconSlot.innerHTML = `<span class="match-icon-fallback">NO IMAGE</span>`; }
    let myLvText = myLevel >= 100 ? "MAX" : `Lv.${myLevel}`;
    document.getElementById('match-my-info-bar').innerText = `${myLvText} ${myUsername}`;

    document.getElementById('match-countdown-banner').innerText = `相手を探しています...`;
    document.getElementById('match-enemy-icon-slot').innerHTML = `<span class="match-icon-fallback">WAITING...</span>`;
    document.getElementById('match-enemy-info-bar').innerText = `相手を待っています`;

    pollMatch();
    matchPollIntervalId = setInterval(pollMatch, 1500);
  }

  function pollMatch() {
    let lvText = myLevel >= 100 ? "MAX" : `Lv.${myLevel}`;
    let fullProfileName = `${myUsername} [${lvText} (${currentLabel})]`;

    fetch(`${SERVER_URL}/match?username=${encodeURIComponent(fullProfileName)}`)
      .then(response => response.text())
      .then(data => {
        if (data.startsWith('MATCHING_SUCCESS')) {
          const parts = data.split(' | ');
          myRoomName = parts[1].split(': ')[1]; 
          const currentTheme = parts[2];

          fetch(`${SERVER_URL}/get-messages?roomName=${myRoomName}`)
            .then(res => res.json())
            .then(roomData => {
              const hpKeys = Object.keys(roomData.hpData || {});
              const hasEnemy = hpKeys.some(player => !player.includes(myUsername));

              if (hasEnemy && !hasTriggeredCountdown) {
                if (matchPollIntervalId) clearInterval(matchPollIntervalId); 
                hasTriggeredCountdown = true;
                
                const enemyName = hpKeys.find(player => !player.includes(myUsername)) || "対戦相手";
                document.getElementById('match-enemy-info-bar').innerText = enemyName;
                
                myChosenSide = Math.random() < 0.5 ? '前者派' : '後者派';
                
                runVSMatchCountdown(currentTheme);
              }
            });
        }
      })
      .catch(err => console.error("通信エラー:", err));
  }

  function runVSMatchCountdown(currentThemeText) {
    document.getElementById('match-enemy-icon-slot').innerHTML = `<span class="match-icon-fallback">READY!</span>`;

    let countdownValue = 3;
    document.getElementById('match-countdown-banner').innerText = `対戦開始まで あと ${countdownValue} 秒...`;

    countdownIntervalId = setInterval(() => {
      fetch(`${SERVER_URL}/get-messages?roomName=${myRoomName}`)
        .then(res => res.json())
        .then(roomData => {
          const hpKeys = Object.keys(roomData.hpData || {});
          if (!roomData || hpKeys.length < 2 || roomData.error) {
            clearInterval(countdownIntervalId);
            goBackToMenu(false);
            return;
          }
        }).catch(() => {
          clearInterval(countdownIntervalId);
          goBackToMenu(false);
        });

      countdownValue--;
      if (countdownValue <= 0) {
        clearInterval(countdownIntervalId);
        
        isMatchEstablished = true;

        document.getElementById('vs-match-screen').style.display = 'none';
        document.getElementById('debate-screen').style.display = 'flex';

        document.getElementById('chat-box').innerHTML = '';
        lastMessageCount = 0;
        document.getElementById('message-input').disabled = false;
        document.getElementById('send-btn').disabled = false;
        document.getElementById('message-input').value = '';

        document.getElementById('room-title').innerText = `対戦部屋: ${myRoomName}`;
        document.getElementById('current-theme').innerText = `お題: ${currentThemeText} （あなたの立場: ${myChosenSide}）`;
        
        myHP = 2000;
        enemyHP = 2000;
        isTyping = false;
        lastActionTime = Date.now();
        sameInputKeepCount = 0;
        lastInputValue = "";

        document.getElementById('response-timer-box').innerText = "毎秒 -1 HP";
        document.getElementById('response-timer-box').style.backgroundColor = "#1DD1A1";

        document.getElementById('my-hp-label').innerText = `${myUsername} (${myChosenSide}): 2000`;
        document.getElementById('enemy-hp-label').innerText = `相手: 2000`;
        document.getElementById('my-hp-bar').style.width = '100%';
        document.getElementById('enemy-hp-bar').style.width = '100%';

        chatIntervalId = setInterval(updateChatLog, 1000);
        startTimer(); 
      } else {
        document.getElementById('match-countdown-banner').innerText = `対戦開始まで あと ${countdownValue} 秒...`;
      }
    }, 1000);
  }

  function startTimer() {
    remainingTime = 180; 
    document.getElementById('game-timer-box').innerText = `試合残り: ${remainingTime}秒`;

    timerIntervalId = setInterval(() => {
      if (isGameOverFlag) return;
      
      remainingTime--;
      const currentInputValue = messageInputElem.value;

      if (isTyping && currentInputValue.length > 0) {
        if (currentInputValue === lastInputValue) {
          sameInputKeepCount++;
          if (sameInputKeepCount >= 10) { 
            triggerPenalty("⚠️「長押し・入力キープ放置」が検知されました！");
            isTyping = false; 
          }
        } else {
          sameInputKeepCount = 0;
        }
      } else {
        sameInputKeepCount = 0;
      }
      lastInputValue = currentInputValue;

      if (Date.now() - lastActionTime > 60000) {
        triggerPenalty("⚠️「1分間の完全放置」が検知されました！");
        endGame("⚠️ 1分間操作がなかったため、放置ペナルティで敗北しました。", 0);
        return;
      }

      if (!isTyping) {
        myHP = Math.max(0, myHP - 1);
      }
      
      let myHPPercent = (myHP / 2000) * 100;
      document.getElementById('my-hp-label').innerText = `${myUsername} (${myChosenSide}): ${myHP}/2000`;
      document.getElementById('my-hp-bar').style.width = `${myHPPercent}%`;

      if (myHP <= 0) {
        endGame(`敗北しました...（HPが尽き果てた）`, 20);
        return;
      }

      if (remainingTime <= 0) {
        if (myHP > enemyHP) {
          endGame(`タイムアップ！判定勝ち！（あなた:${myHP} VS 相手:${enemyHP}）`, 50);
        } else if (myHP < enemyHP) {
          endGame(`タイムアップ！判定負け...（あなた:${myHP} VS 相手:${enemyHP}）`, 20);
        } else {
          endGame(`タイムアップ！引き分け！（同点:${myHP}）`, 20);
        }
      } else {
        document.getElementById('game-timer-box').innerText = `試合残り: ${remainingTime}秒`;
      }
    }, 1000);
  }

  function triggerPenalty(reasonMessage) {
    kickCount++;
    localStorage.setItem('yururon_kick_count', kickCount);

    if (kickCount >= 3) {
      localStorage.setItem('yururon_is_banned', 'true');
      isBanned = true;
      alert(`🚨【BAN処罰】不正・放置行為が3回検知されました。あなたのアカウントをBANします。`);
      goBackToMenu(true);
    } else {
      alert(`${reasonMessage}\n（警告 ${kickCount}/3 回）※3回でBANになります！`);
    }
  }

  function isSpamMessage(text) {
    const cleanText = text.toLowerCase().trim();
    if (/abcdef|bcdefg|cdefgh|defghi|efghij|fghijk|ghijkl|asdfgh|zxcvbn/.test(cleanText)) return true;
    if (/(.)\1{4,}/.test(cleanText)) return true;
    if (/^[a-z0-9]{8,}$/.test(cleanText) && !/^(ok|hello|google|yahoo|yururon)$/.test(cleanText)) return true;
    return false;
  }

  function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text || !myRoomName || remainingTime <= 0 || isGameOverFlag) return; 

    lastActionTime = Date.now(); 

    if (isSpamMessage(text)) {
      triggerPenalty("⚠️「意味のない文字連打」は禁止です！");
      input.value = '';
      return;
    }

    // ★発言すると相手に100ダメージを与える計算を追加
    enemyHP = Math.max(0, enemyHP - 100);

    let fullProfileName = `${myUsername} [${myChosenSide}]`;

    fetch(`${SERVER_URL}/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        roomName: myRoomName, 
        sender: fullProfileName, 
        text: text,
        hp: myHP // 自分の現在HPを送る
      })
    });

    input.value = '';
    isTyping = false; 
    document.getElementById('response-timer-box').innerText = "毎秒 -1 HP";
    document.getElementById('response-timer-box').style.backgroundColor = "#1DD1A1";
    input.blur();

    // 相手のHPが0になったら勝利
    if (enemyHP <= 0) {
      endGame("勝利！相手のHPを削りきりました！🎉", 50);
    }
  }

  function updateChatLog() {
    if (!myRoomName || isGameOverFlag) return;

    fetch(`${SERVER_URL}/get-messages?roomName=${myRoomName}`)
      .then(response => response.json())
      .then(data => {
        if (data.error || !data.hpData) {
          if (isMatchEstablished) {
            alert("相手が退出またはキックされたため、部屋を出ます。");
            goBackToMenu(false);
          }
          return;
        }

        const messages = data.messages || [];
        const hpData = data.hpData || {};
        const hpKeys = Object.keys(hpData);

        const cleanMyName = myUsername.trim();
        const hasEnemy = hpKeys.some(player => !player.includes(cleanMyName));

        if (isMatchEstablished && !hasEnemy) {
          alert("相手が退出またはキックされたため、部屋を出ます。");
          goBackToMenu(false);
          return;
        }

        let enemyFullNameDisplay = "相手";
        hpKeys.forEach(player => {
          if (!player.includes(cleanMyName)) { 
            enemyFullNameDisplay = player; 
            // ★サーバー側から相手の最新HPを取得して反映
            if (hpData[player] !== undefined) {
              enemyHP = hpData[player];
            }
          }
        });

        // ★画面上の相手HP表示とバーをリアルタイム更新
        let enemyHPPercent = Math.max(0, (enemyHP / 2000) * 100);
        document.getElementById('enemy-hp-label').innerText = `${enemyFullNameDisplay}: ${enemyHP}/2000`;
        document.getElementById('enemy-hp-bar').style.width = `${enemyHPPercent}%`;

        if (enemyHP <= 0) {
          endGame("勝利！相手のHPが0になりました！🎉", 50);
          return;
        }

        if (messages.length === lastMessageCount) return;
        const chatBox = document.getElementById('chat-box');
        chatBox.innerHTML = ''; 

        messages.forEach(msg => {
          if (!msg.text || msg.text === "") return; 
          const rowElement = document.createElement('div');
          rowElement.classList.add('message-row');
          
          if (msg.sender.includes(cleanMyName)) { 
            rowElement.classList.add('my-message'); 
          } else { 
            rowElement.classList.add('other-message'); 
          }

          const nameElement = document.createElement('div');
          nameElement.classList.add('sender-name');
          nameElement.innerText = msg.sender;

          const bubbleElement = document.createElement('div');
          bubbleElement.classList.add('bubble');
          bubbleElement.innerText = msg.text;

          rowElement.appendChild(nameElement);
          rowElement.appendChild(bubbleElement);
          chatBox.appendChild(rowElement);
        });
        chatBox.scrollTop = chatBox.scrollHeight; 
        lastMessageCount = messages.length; 
      })
      .catch(err => {
        if (isMatchEstablished) {
          alert("通信エラーまたは相手の切断を検知したため、部屋を出ます。");
          goBackToMenu(false);
        }
      });
  }

  function endGame(resultMessage, expReward) {
    if (isGameOverFlag) return;
    isGameOverFlag = true;
    clearAllTimers();

    document.getElementById('message-input').disabled = true;
    document.getElementById('send-btn').disabled = true;

    if (myRoomName) {
      fetch(`${SERVER_URL}/game-over`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: myRoomName })
      }).catch(err => console.error(err));
    }

    localStorage.setItem('yururon_pending_exp', expReward);
    alert(resultMessage);
    goBackToMenu(false);
  }

  function goBackToMenu(isSelfQuit = false) {
    clearAllTimers();

    if (isSelfQuit && myRoomName) {
      fetch(`${SERVER_URL}/game-over`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: myRoomName })
      }).catch(err => console.error(err));
    }

    myRoomName = '';
    lastMessageCount = 0;
    isTyping = false;
    isMatchEstablished = false;
    document.getElementById('chat-box').innerHTML = '';
    document.getElementById('debate-screen').style.display = 'none';
    document.getElementById('vs-match-screen').style.display = 'none';
    document.getElementById('menu-screen').style.display = 'flex';
    document.getElementById('display-box').innerHTML = 'STATUS : READY';

    let pendingExp = localStorage.getItem('yururon_pending_exp');
    if (pendingExp) {
      addExperience(parseInt(pendingExp));
      localStorage.removeItem('yururon_pending_exp');
    }
  }

  function sendRequest(type) {
    const displayBox = document.getElementById('display-box');
    fetch(`${SERVER_URL}/${type}`)
      .then(response => response.text())
      .then(data => {
        if (type === 'ranking') displayBox.innerHTML = `ランキング\n\n${data}`;
      });
  }
