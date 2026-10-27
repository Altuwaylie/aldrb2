const STORAGE_KEY_SINGLE = 'multiplicationGame_single_final3';
const STORAGE_KEY_VERSUS = 'multiplicationGame_versus_final3';

let mode = null;

const MULT_MIN = 1;
const MULT_MAX = 9;

const SINGLE_TOTAL = 90;
const VERSUS_OTHER_TIMER = 5;

let allMultiplicationPairs = [];
let multiIndex = 0;

let singleState = {
  score: 0,
  errors: 0,
  questionIndex: 0,
  totalQuestions: SINGLE_TOTAL,
  elapsedTime: 0,
  currentQ: null,
  locked: false,
  finished: false
};

let versusState = {
  tugScore: 0,
  currentQ: null,
  p1Options: [],
  p2Options: [],
  p1Answered: false,
  p2Answered: false,
  p1Correct: null,
  p2Correct: null,
  roundLocked: false,
  roundWinner: null
};

let singleTimerInterval = null;
let versusTimerInterval = null;
let winConfettiInterval = null;
let pendingConfirmAction = null;

/* ================== أرقام هندية ================== */

function toArabicDigits(num) {
  const map = {
    '0': '٠','1': '١','2': '٢','3': '٣','4': '٤',
    '5': '٥','6': '٦','7': '٧','8': '٨','9': '٩'
  };

  return String(num).replace(/[0-9]/g, d => map[d]);
}

function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');

  return `${toArabicDigits(m)}:${toArabicDigits(s)}`;
}

/* ================== الأسئلة ================== */

function initMultiplicationPairs() {
  allMultiplicationPairs = [];

  for (let a = MULT_MIN; a <= MULT_MAX; a++) {
    for (let b = MULT_MIN; b <= MULT_MAX; b++) {
      allMultiplicationPairs.push({ a, b });
    }
  }

  for (let i = allMultiplicationPairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [allMultiplicationPairs[i], allMultiplicationPairs[j]] =
      [allMultiplicationPairs[j], allMultiplicationPairs[i]];
  }

  multiIndex = 0;
}

function shuffle(array) {
  const arr = [...array];

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

function generateMultiplicationQuestion() {
  if (multiIndex >= allMultiplicationPairs.length) {
    initMultiplicationPairs();
  }

  const { a, b } = allMultiplicationPairs[multiIndex];
  multiIndex++;

  const correct = a * b;

  const allProducts = [];

  for (let x = MULT_MIN; x <= MULT_MAX; x++) {
    for (let y = MULT_MIN; y <= MULT_MAX; y++) {
      const value = x * y;

      if (!allProducts.includes(value)) {
        allProducts.push(value);
      }
    }
  }

  const optionsSet = new Set([correct]);

  while (optionsSet.size < 4) {
    const value = allProducts[Math.floor(Math.random() * allProducts.length)];
    optionsSet.add(value);
  }

  return {
    a,
    b,
    correct,
    options: shuffle([...optionsSet])
  };
}

/* نفس الاختيارات للطرفين، لكن بترتيب مختلف */
function createVersusOptions(question) {
  const sameOptions = [...question.options];

  return {
    p1Options: shuffle(sameOptions),
    p2Options: shuffle(sameOptions)
  };
}

/* ================== الأصوات ================== */

let audioContext = null;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  return audioContext;
}

function playTone(freq, duration = .18, type = 'sine', volume = .25) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

function playClickSound() {
  playTone(520, .07, 'square', .12);
}

function playCorrectSound() {
  playTone(660, .12, 'triangle');
  setTimeout(() => playTone(880, .18, 'triangle'), 110);
}

function playWrongSound() {
  playTone(220, .28, 'sawtooth', .18);
}

function playWinSound() {
  [523, 659, 784, 1047].forEach((freq, i) => {
    setTimeout(() => playTone(freq, .22, 'triangle'), i * 130);
  });
}

/* ================== الحفظ والاسترجاع ================== */

function saveSingleToStorage() {
  localStorage.setItem(STORAGE_KEY_SINGLE, JSON.stringify(singleState));
}

function loadSingleFromStorage() {
  const saved = localStorage.getItem(STORAGE_KEY_SINGLE);

  if (saved) {
    try {
      singleState = JSON.parse(saved);
      return;
    } catch (e) {}
  }

  resetSingleState();
}

function resetSingleState() {
  singleState = {
    score: 0,
    errors: 0,
    questionIndex: 0,
    totalQuestions: SINGLE_TOTAL,
    elapsedTime: 0,
    currentQ: generateMultiplicationQuestion(),
    locked: false,
    finished: false
  };

  saveSingleToStorage();
}

function saveVersusToStorage() {
  localStorage.setItem(STORAGE_KEY_VERSUS, JSON.stringify(versusState));
}

function loadVersusFromStorage() {
  const saved = localStorage.getItem(STORAGE_KEY_VERSUS);

  if (saved) {
    try {
      versusState = JSON.parse(saved);
      return;
    } catch (e) {}
  }

  resetVersusState();
}

function resetVersusState() {
  const question = generateMultiplicationQuestion();
  const options = createVersusOptions(question);

  versusState = {
    tugScore: 0,
    currentQ: question,
    p1Options: options.p1Options,
    p2Options: options.p2Options,
    p1Answered: false,
    p2Answered: false,
    p1Correct: null,
    p2Correct: null,
    roundLocked: false,
    roundWinner: null
  };

  saveVersusToStorage();
}

/* ================== التأكيد ================== */

function showConfirm(title, text, action) {
  pendingConfirmAction = action;

  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-text').textContent = text;

  document.getElementById('confirm-overlay').classList.remove('hidden');
}

function hideConfirm() {
  pendingConfirmAction = null;
  document.getElementById('confirm-overlay').classList.add('hidden');
}

function confirmNewGame() {
  playClickSound();

  showConfirm(
    'بداية جديدة',
    'هل تريد بالتأكيد بدء لعبة جديدة؟ سيتم حذف التقدم الحالي.',
    () => {
      hideConfirm();
      hideResult();
      newGame();
    }
  );
}

function confirmGoHome() {
  playClickSound();

  showConfirm(
    'العودة للرئيسية',
    'هل تريد بالتأكيد العودة إلى الصفحة الرئيسية؟ سيتم حذف التقدم الحالي.',
    () => {
      hideConfirm();
      hideResult();
      goHome();
    }
  );
}

document.getElementById('confirm-yes').onclick = () => {
  playClickSound();

  if (pendingConfirmAction) {
    pendingConfirmAction();
  }
};

function hideResult() {
  document.getElementById('result-overlay').classList.add('hidden');
}

/* ================== التنقل ================== */

function selectMode(selectedMode) {
  playClickSound();

  mode = selectedMode;
  document.getElementById('main-menu').classList.add('hidden');

  if (mode === 'single') {
    resetSingleState();

    document.getElementById('single-play').classList.remove('hidden');
    document.getElementById('versus-play').classList.add('hidden');

    renderSingle();
    startSingleTimer();
  } else {
    showRotateMessage();
    resetVersusState();

    document.getElementById('versus-play').classList.remove('hidden');
    document.getElementById('single-play').classList.add('hidden');

    setTimeout(() => {
      renderVersus();
    }, 5000);
  }
}

function goHome() {
  playClickSound();
  stopWinConfetti();
  stopSingleTimer();
  stopVersusTimer();

  localStorage.removeItem(STORAGE_KEY_SINGLE);
  localStorage.removeItem(STORAGE_KEY_VERSUS);

  document.getElementById('single-play').classList.add('hidden');
  document.getElementById('versus-play').classList.add('hidden');
  document.getElementById('main-menu').classList.remove('hidden');
}

function newGame() {
  playClickSound();
  stopWinConfetti();
  stopSingleTimer();
  stopVersusTimer();

  if (mode === 'single') {
    resetSingleState();
    renderSingle();
    startSingleTimer();
  } else if (mode === 'versus') {
    resetVersusState();
    renderVersus();
  }
}

/* ================== مؤقت الفردي التصاعدي ================== */

function startSingleTimer() {
  stopSingleTimer();

  singleTimerInterval = setInterval(() => {
    if (singleState.finished) {
      stopSingleTimer();
      return;
    }

    singleState.elapsedTime++;

    document.getElementById('single-timer').textContent =
      formatTime(singleState.elapsedTime);

    saveSingleToStorage();
  }, 1000);
}

function stopSingleTimer() {
  if (singleTimerInterval) {
    clearInterval(singleTimerInterval);
    singleTimerInterval = null;
  }
}

/* ================== اللعب الفردي ================== */

function renderSingle() {
  loadSingleFromStorage();

  const q = singleState.currentQ || generateMultiplicationQuestion();
  singleState.currentQ = q;

  document.getElementById('single-q-index').textContent =
    `${toArabicDigits(singleState.questionIndex + 1)} من ${toArabicDigits(singleState.totalQuestions)}`;

  document.getElementById('single-score').textContent =
    toArabicDigits(singleState.score);

  document.getElementById('single-errors').textContent =
    toArabicDigits(singleState.errors);

  document.getElementById('single-timer').textContent =
    formatTime(singleState.elapsedTime);

  const questionEl = document.getElementById('single-question');
  questionEl.textContent =
    `${toArabicDigits(q.a)} × ${toArabicDigits(q.b)} = ؟`;

  const optionsContainer = document.getElementById('single-options');
  optionsContainer.innerHTML = '';

  q.options.forEach(value => {
    const btn = document.createElement('button');
    btn.className = 'btn option-btn';
    btn.textContent = toArabicDigits(value);
    btn.dataset.value = value;
    btn.onclick = () => handleSingleAnswer(value, btn);
    optionsContainer.appendChild(btn);
  });

  saveSingleToStorage();
}

function handleSingleAnswer(chosen, chosenBtn) {
  if (singleState.locked || singleState.finished) return;

  singleState.locked = true;

  const q = singleState.currentQ;
  const isCorrect = chosen === q.correct;

  const buttons = [...document.querySelectorAll('#single-options button')];

  buttons.forEach(button => {
    button.disabled = true;

    const value = Number(button.dataset.value);

    if (value === q.correct) {
      button.classList.add('correct', 'pulse');
    } else {
      button.classList.add('wrong');
    }
  });

  if (isCorrect) {
    singleState.score++;

    playCorrectSound();
    fireConfettiAt('center');
    showQuickWinOverlay('أحسنت!');
  } else {
    singleState.errors++;
    chosenBtn.classList.add('shake');

    playWrongSound();
    showErrorFlashSingle();
  }

  saveSingleToStorage();

  setTimeout(() => {
    singleState.questionIndex++;
    singleState.locked = false;

    if (singleState.questionIndex >= singleState.totalQuestions) {
      finishSingle('انتهت اللعبة 🎉');
      return;
    }

    singleState.currentQ = generateMultiplicationQuestion();
    saveSingleToStorage();
    renderSingle();
  }, 2500);
}

function requestEndSingle() {
  playClickSound();

  showConfirm(
    'إنهاء اللعبة',
    'هل تريد إنهاء اللعبة الآن وعرض النتيجة؟',
    () => {
      hideConfirm();
      stopSingleTimer();
      finishSingle('تم إنهاء اللعبة ✅');
    }
  );
}

function finishSingle(title) {
  if (singleState.finished) return;

  singleState.finished = true;
  saveSingleToStorage();

  const total = singleState.score + singleState.errors;
  const correct = singleState.score;
  const errors = singleState.errors;
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

  let message = 'ابدأ من جديد وستتحسن بالتدريب.';

  if (percent >= 90) {
    message = 'إتقان رائع لجدول الضرب!';
  } else if (percent >= 70) {
    message = 'أداء قوي، أنت قريب من الإتقان الكامل.';
  } else if (percent >= 50) {
    message = 'راجع الجداول التي أخطأت فيها وستتحسن سريعًا.';
  }

  document.getElementById('result-title').textContent = title;

  document.getElementById('result-details').innerHTML = `
    <div>✅ الإجابات الصحيحة: <strong>${toArabicDigits(correct)}</strong></div>
    <div>❌ الأخطاء: <strong>${toArabicDigits(errors)}</strong></div>
    <div>📊 النسبة: <strong>${toArabicDigits(percent)}%</strong></div>
    <div>⏱️ المدة المستغرقة: <strong>${formatTime(singleState.elapsedTime)}</strong></div>
    <div>${message}</div>
  `;

  document.getElementById('result-overlay').classList.remove('hidden');

  fireConfettiBig('center');
  playWinSound();
}

/* ================== اللعب التنافسي ================== */

function renderVersus() {
  loadVersusFromStorage();

  const q = versusState.currentQ || generateMultiplicationQuestion();
  versusState.currentQ = q;

  document.getElementById('center-question').textContent =
    `${toArabicDigits(q.a)} × ${toArabicDigits(q.b)} = ؟`;

  updateTugMarker();

  renderVersusSide(1);
  renderVersusSide(2);

  saveVersusToStorage();
}

function renderVersusSide(player) {
  const container = document.getElementById(
    player === 1 ? 'p1-options' : 'p2-options'
  );

  container.innerHTML = '';

  /* عند إجابة صحيحة:
     تختفي الاختيارات من الطرفين،
     وتظهر الإجابة الصحيحة عند الفائز فقط */
  if (versusState.roundLocked) {
    if (versusState.roundWinner === player) {
      const q = versusState.currentQ;

      container.innerHTML = `
        <div class="side-answer">
          ${toArabicDigits(q.a)} × ${toArabicDigits(q.b)} =
          ${toArabicDigits(q.correct)}
        </div>
      `;
    }

    return;
  }

  const answered = player === 1
    ? versusState.p1Answered
    : versusState.p2Answered;

  const isCorrect = player === 1
    ? versusState.p1Correct
    : versusState.p2Correct;

  if (!answered) {
    const options = player === 1
      ? versusState.p1Options
      : versusState.p2Options;

    options.forEach(value => {
      const btn = document.createElement('button');
      btn.className = 'btn option-btn';
      btn.textContent = toArabicDigits(value);
      btn.onclick = () => handleVersusAnswer(player, value, btn);
      container.appendChild(btn);
    });

    return;
  }

  if (isCorrect) {
    const q = versusState.currentQ;

    container.innerHTML = `
      <div class="side-answer">
        ${toArabicDigits(q.a)} × ${toArabicDigits(q.b)} =
        ${toArabicDigits(q.correct)}
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="side-waiting">
        إجابة خاطئة ❌<br>
        بانتظار السؤال التالي…
      </div>
    `;
  }
}

function handleVersusAnswer(player, chosen, chosenBtn) {
  if (versusState.roundLocked) return;

  const answered = player === 1
    ? versusState.p1Answered
    : versusState.p2Answered;

  if (answered) return;

  const q = versusState.currentQ;
  const isCorrect = chosen === q.correct;

  if (player === 1) {
    versusState.p1Answered = true;
    versusState.p1Correct = isCorrect;
  } else {
    versusState.p2Answered = true;
    versusState.p2Correct = isCorrect;
  }

  /* أول إجابة صحيحة تقفل الجولة فورًا */
  if (isCorrect) {
    stopVersusTimer();

    versusState.roundLocked = true;
    versusState.roundWinner = player;

    if (player === 1) versusState.tugScore++;
    else versusState.tugScore--;

    playCorrectSound();
    fireConfettiAt(player === 1 ? 'player1' : 'player2');

    renderVersusSide(1);
    renderVersusSide(2);
    updateTugMarker();
    saveVersusToStorage();

    checkVersusWinOrNext();
    return;
  }

  playWrongSound();
  showErrorFlash(player);

  renderVersusSide(player);
  saveVersusToStorage();

  startOtherPlayerTimer(player);
}

function startOtherPlayerTimer(wrongPlayer) {
  stopVersusTimer();

  const otherPlayer = wrongPlayer === 1 ? 2 : 1;

  const timerElement = document.getElementById(
    otherPlayer === 1 ? 'p1-big-timer' : 'p2-big-timer'
  );

  const optionsContainer = document.getElementById(
    otherPlayer === 1 ? 'p1-options' : 'p2-options'
  );

  let remaining = VERSUS_OTHER_TIMER;

  timerElement.textContent = toArabicDigits(remaining);
  timerElement.classList.remove('hidden');

  optionsContainer.classList.add('shake');

  versusTimerInterval = setInterval(() => {
    remaining--;

    if (remaining <= 0) {
      stopVersusTimer();

      if (otherPlayer === 1) {
        versusState.p1Answered = true;
        versusState.p1Correct = false;
      } else {
        versusState.p2Answered = true;
        versusState.p2Correct = false;
      }

      renderVersusSide(otherPlayer);
      saveVersusToStorage();

      goToNextVersusQuestion();
      return;
    }

    timerElement.textContent = toArabicDigits(remaining);
  }, 1000);
}

function stopVersusTimer() {
  if (versusTimerInterval) {
    clearInterval(versusTimerInterval);
    versusTimerInterval = null;
  }

  document.getElementById('p1-big-timer').classList.add('hidden');
  document.getElementById('p2-big-timer').classList.add('hidden');

  document.getElementById('p1-options').classList.remove('shake');
  document.getElementById('p2-options').classList.remove('shake');
}

function checkVersusWinOrNext() {
  if (versusState.tugScore >= 3) {
    versusState.tugScore = 0;
    saveVersusToStorage();
    startWinState('فوز اللاعب الأول 🎉', 'player1');
    return;
  }

  if (versusState.tugScore <= -3) {
    versusState.tugScore = 0;
    saveVersusToStorage();
    startWinState('فوز اللاعب الثاني 🎉', 'player2');
    return;
  }

  goToNextVersusQuestion();
}

function goToNextVersusQuestion() {
  setTimeout(() => {
    const newQuestion = generateMultiplicationQuestion();
    const options = createVersusOptions(newQuestion);

    versusState.currentQ = newQuestion;
    versusState.p1Options = options.p1Options;
    versusState.p2Options = options.p2Options;
    versusState.p1Answered = false;
    versusState.p2Answered = false;
    versusState.p1Correct = null;
    versusState.p2Correct = null;
    versusState.roundLocked = false;
    versusState.roundWinner = null;

    stopVersusTimer();
    saveVersusToStorage();
    renderVersus();
  }, 2000);
}

function updateTugMarker() {
  const marker = document.getElementById('tug-marker');
  const percent = ((versusState.tugScore + 3) / 6) * 100;

  marker.style.left = `calc(${percent}% - 11px)`;

  if (versusState.tugScore > 0) {
    marker.style.background = '#03a9f4';
  } else if (versusState.tugScore < 0) {
    marker.style.background = '#f44336';
  } else {
    marker.style.background = '#ffc107';
  }
}

/* ================== المفرقعات ================== */

(function setupConfetti() {
  if (window.confetti) return;

  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js';
  script.async = true;
  document.head.appendChild(script);
})();

function getOriginForElement(elem) {
  if (!elem) return { x: .5, y: .5 };

  const rect = elem.getBoundingClientRect();

  return {
    x: (rect.left + rect.width / 2) / window.innerWidth,
    y: (rect.top + rect.height / 2) / window.innerHeight
  };
}

function getConfettiOrigin(where) {
  if (where === 'player1') {
    return getOriginForElement(document.getElementById('side-left'));
  }

  if (where === 'player2') {
    return getOriginForElement(document.getElementById('side-right'));
  }

  if (where === 'center') {
    const target = mode === 'single'
      ? document.getElementById('single-question')
      : document.getElementById('center-question');

    return getOriginForElement(target);
  }

  return { x: .5, y: .4 };
}

function fireConfettiAt(where) {
  if (!window.confetti) return;

  confetti({
    particleCount: 80,
    spread: 70,
    origin: getConfettiOrigin(where)
  });
}

function fireConfettiBig(where) {
  if (!window.confetti) return;

  confetti({
    particleCount: 220,
    spread: 160,
    origin: getConfettiOrigin(where)
  });
}

function startWinState(text, who) {
  showWinOverlayWithButton(text);

  fireConfettiBig(who);
  playWinSound();

  stopWinConfetti();

  winConfettiInterval = setInterval(() => {
    fireConfettiAt(who);
  }, 700);
}

function stopWinConfetti() {
  if (winConfettiInterval) {
    clearInterval(winConfettiInterval);
    winConfettiInterval = null;
  }
}

/* ================== الرسائل والطبقات ================== */

function showRotateMessage() {
  let overlay = document.getElementById('rotate-overlay');
  let label;

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'rotate-overlay';
    overlay.style.cssText = `
      position:fixed;
      inset:0;
      display:flex;
      align-items:center;
      justify-content:center;
      background:rgba(0,0,0,.5);
      z-index:9996;
      pointer-events:none;
    `;

    label = document.createElement('div');
    label.id = 'rotate-overlay-label';
    label.style.cssText = `
      background:#fff;
      padding:12px 18px;
      border-radius:14px;
      font-size:1.1rem;
      white-space:pre-line;
    `;

    label.textContent =
      'من الأفضل تدوير الشاشة أفقياً\nووضع الجهاز بين اللاعبين 👦👦';

    overlay.appendChild(label);
    document.body.appendChild(overlay);
  } else {
    label = document.getElementById('rotate-overlay-label');
  }

  overlay.style.display = 'flex';

  setTimeout(() => {
    overlay.style.display = 'none';
  }, 5000);
}

function showQuickWinOverlay(text) {
  let overlay = document.getElementById('quick-win-overlay');
  let label;

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'quick-win-overlay';
    overlay.style.cssText = `
      position:fixed;
      inset:0;
      display:flex;
      align-items:center;
      justify-content:center;
      background:rgba(0,0,0,.35);
      z-index:9997;
      pointer-events:none;
      transition:opacity .2s;
    `;

    label = document.createElement('div');
    label.id = 'quick-win-label';
    label.style.cssText = `
      background:#fff;
      padding:12px 18px;
      border-radius:14px;
      font-size:1.1rem;
      white-space:pre-line;
    `;

    overlay.appendChild(label);
    document.body.appendChild(overlay);
  } else {
    label = document.getElementById('quick-win-label');
  }

  label.textContent = text;
  overlay.style.display = 'flex';
  overlay.style.opacity = '1';

  setTimeout(() => {
    overlay.style.opacity = '0';
    overlay.style.display = 'none';
  }, 900);
}

function showWinOverlayWithButton(text) {
  let overlay = document.getElementById('win-overlay');
  let label;

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'win-overlay';
    overlay.style.cssText = `
      position:fixed;
      inset:0;
      display:flex;
      align-items:center;
      justify-content:center;
      background:rgba(0,0,0,.45);
      z-index:9999;
      pointer-events:auto;
    `;

    const box = document.createElement('div');
    box.style.cssText = `
      background:#fff;
      padding:18px 24px;
      border-radius:18px;
      font-size:1.2rem;
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:12px;
      max-width:90vw;
    `;

    label = document.createElement('div');
    label.id = 'win-overlay-label';
    label.style.whiteSpace = 'pre-line';

    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = 'بداية جديدة';

    btn.onclick = () => {
      overlay.style.display = 'none';
      newGame();
    };

    box.appendChild(label);
    box.appendChild(btn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  } else {
    label = document.getElementById('win-overlay-label');
  }

  label.textContent = text;
  overlay.style.display = 'flex';
}

function showErrorFlashSingle() {
  addErrorKeyframesIfNeeded();

  document.body.style.animation = 'errorFlash .4s';

  setTimeout(() => {
    document.body.style.animation = '';
  }, 400);
}

function showErrorFlash(player) {
  const side = player === 1
    ? document.getElementById('side-left')
    : document.getElementById('side-right');

  if (!side) return;

  side.classList.add('shake');
  side.style.boxShadow = '0 0 0 4px rgba(244,67,54,.5)';

  setTimeout(() => {
    side.classList.remove('shake');
    side.style.boxShadow = '0 4px 12px rgba(0,0,0,.1)';
  }, 600);
}

function addErrorKeyframesIfNeeded() {
  if (document.getElementById('errorFlash-style')) return;

  const style = document.createElement('style');
  style.id = 'errorFlash-style';
  style.textContent = `
    @keyframes errorFlash {
      0% { background-color: rgba(244,67,54,.12); }
      100% { background-color: transparent; }
    }
  `;

  document.head.appendChild(style);
}

/* ================== منع فقدان التقدم ================== */

window.addEventListener('beforeunload', () => {
  if (mode === 'single') saveSingleToStorage();
  if (mode === 'versus') saveVersusToStorage();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'hidden') return;

  if (mode === 'single') saveSingleToStorage();
  if (mode === 'versus') saveVersusToStorage();
});

/* ================== التشغيل ================== */

window.onload = () => {
  initMultiplicationPairs();

  const savedSingle = localStorage.getItem(STORAGE_KEY_SINGLE);
  const savedVersus = localStorage.getItem(STORAGE_KEY_VERSUS);

  if (savedSingle) {
    mode = 'single';
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('single-play').classList.remove('hidden');
    renderSingle();
    startSingleTimer();
    return;
  }

  if (savedVersus) {
    mode = 'versus';
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('versus-play').classList.remove('hidden');

    setTimeout(() => {
      renderVersus();
    }, 5000);
  }
};
