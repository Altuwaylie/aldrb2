const STORAGE_KEY_SINGLE = 'multiplicationGame_single';
const STORAGE_KEY_VERSUS = 'multiplicationGame_versus';

let mode = null;

const MULT_MIN = 1;
const MULT_MAX = 9;

let allMultiplicationPairs = [];
let multiIndex = 0;

let singleState = {
  score: 0,
  questionIndex: 0,
  totalQuestions: 90,
  currentQ: null
};

let versusState = {
  tugScore: 0,
  currentQ: null,
  canAnswerP1: true,
  canAnswerP2: true
};

let activeCountdown = null;
let winConfettiInterval = null;

/* أرقام هندية */
function toArabicDigits(num) {
  const map = {
    '0': '٠','1': '١','2': '٢','3': '٣','4': '٤',
    '5': '٥','6': '٦','7': '٧','8': '٨','9': '٩'
  };
  return String(num).replace(/[0-9]/g, d => map[d]);
}

/* أزواج الضرب 1–9 مع خلط */
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
  } // [web:117][web:146]
  multiIndex = 0;
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
      const p = x * y;
      if (!allProducts.includes(p)) allProducts.push(p);
    }
  } // [web:144]

  const optionsSet = new Set([correct]);
  while (optionsSet.size < 3) {
    const randIndex = Math.floor(Math.random() * allProducts.length);
    optionsSet.add(allProducts[randIndex]);
  }
  const options = Array.from(optionsSet);

  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  } // [web:117][web:119]

  return { a, b, correct, options };
}

/* بداية جديدة للحالة (مع حفظ في localStorage) */
function resetSingleState() {
  singleState = {
    score: 0,
    questionIndex: 0,
    totalQuestions: 90,
    currentQ: generateMultiplicationQuestion()
  };
  saveSingleToStorage();
}

function resetVersusState() {
  versusState = {
    tugScore: 0,
    currentQ: generateMultiplicationQuestion(),
    canAnswerP1: true,
    canAnswerP2: true
  };
  saveVersusToStorage();
}

/* تنقل بين الشاشات */
function selectMode(selectedMode) {
  mode = selectedMode;
  document.getElementById('main-menu').classList.add('hidden');

  if (mode === 'single') {
    // بداية جديدة دائمًا
    resetSingleState();
    startGame();
  } else {
    // رسالة تدوير الشاشة + بداية جديدة للمواجهة
    showRotateMessage();
    resetVersusState();
    startGame();
  }
}

function goHome() {
  stopWinConfetti();
  document.getElementById('single-play').classList.add('hidden');
  document.getElementById('versus-play').classList.add('hidden');
  document.getElementById('main-menu').classList.remove('hidden');
}

function startGame() {
  if (mode === 'single') {
    loadSingleFromStorage();
    document.getElementById('single-play').classList.remove('hidden');
    renderSingle();
  } else {
    loadVersusFromStorage();
    document.getElementById('versus-play').classList.remove('hidden');
    renderVersus();
  }
}

/* فردي */
function loadSingleFromStorage() {
  const saved = localStorage.getItem(STORAGE_KEY_SINGLE);
  if (saved) {
    singleState = JSON.parse(saved);
  } else {
    resetSingleState();
  }
}

function saveSingleToStorage() {
  localStorage.setItem(STORAGE_KEY_SINGLE, JSON.stringify(singleState));
}

function renderSingle() {
  const qLabel = document.getElementById('single-q-index');
  const scoreLabel = document.getElementById('single-score');
  const questionEl = document.getElementById('single-question');
  const optionsContainer = document.getElementById('single-options');

  qLabel.textContent = `${toArabicDigits(singleState.questionIndex + 1)} من ${toArabicDigits(singleState.totalQuestions)}`;
  scoreLabel.textContent = toArabicDigits(singleState.score);

  if (!singleState.currentQ) {
    singleState.currentQ = generateMultiplicationQuestion();
  }

  const { a, b, correct, options } = singleState.currentQ;
  questionEl.textContent = `${toArabicDigits(a)} × ${toArabicDigits(b)} = ؟`;

  optionsContainer.innerHTML = '';
  options.forEach(val => {
    const btn = document.createElement('button');
    btn.className = 'btn option-btn';
    btn.textContent = toArabicDigits(val);
    btn.onclick = () => handleSingleAnswer(val, correct, btn);
    optionsContainer.appendChild(btn);
  });
}

/* فردي: إيقاف 3 ثواني وإظهار الإجابة الصحيحة */
function handleSingleAnswer(chosen, correct, btnEl) {
  const buttons = document.querySelectorAll('#single-options button');
  buttons.forEach(b => b.disabled = true);

  const questionEl = document.getElementById('single-question');
  const originalText = questionEl.textContent;

  if (chosen === correct) {
    singleState.score++;
    btnEl.classList.add('correct', 'pulse');
    fireConfettiAt('center');
    showQuickWinOverlay('أحسنت!');
  } else {
    btnEl.classList.add('wrong', 'shake');
    showErrorFlashSingle();

    let errorBox = document.getElementById('single-error-box');
    if (!errorBox) {
      errorBox = document.createElement('div');
      errorBox.id = 'single-error-box';
      errorBox.style.position = 'fixed';
      errorBox.style.left = '50%';
      errorBox.style.top = '15%';
      errorBox.style.transform = 'translateX(-50%)';
      errorBox.style.background = '#ffebee';
      errorBox.style.border = '2px solid #f44336';
      errorBox.style.borderRadius = '16px';
      errorBox.style.padding = '10px 16px';
      errorBox.style.fontSize = '1rem';
      errorBox.style.zIndex = '9995';
      errorBox.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
      errorBox.style.whiteSpace = 'pre-line';
      document.body.appendChild(errorBox);

      const style = document.createElement('style');
      style.textContent = `
        @keyframes errorBoxAnim {
          0% { transform: translate(-50%, 0) scale(0.9); }
          25% { transform: translate(-50%, -4px) scale(1.03); }
          50% { transform: translate(-50%, 0) scale(1); }
          75% { transform: translate(-50%, 3px) scale(1.03); }
          100% { transform: translate(-50%, 0) scale(1); }
        }
      `;
      document.head.appendChild(style);
    }

    errorBox.textContent = `${originalText}  =  ${toArabicDigits(correct)}`;
    errorBox.style.display = 'block';
    errorBox.style.animation = 'errorBoxAnim 0.7s ease-out';

    setTimeout(() => {
      errorBox.style.display = 'none';
    }, 3000);
  }

  saveSingleToStorage();

  setTimeout(() => {
    singleState.questionIndex++;
    if (singleState.questionIndex >= singleState.totalQuestions) {
      fireConfettiBig('center');
      showWinOverlayWithButton(`انتهت اللعبة!\nنقاطك: ${toArabicDigits(singleState.score)}`);
    } else {
      singleState.currentQ = generateMultiplicationQuestion();
      saveSingleToStorage();
      renderSingle();
    }
  }, 3000);
}

/* جماعي */
function loadVersusFromStorage() {
  const saved = localStorage.getItem(STORAGE_KEY_VERSUS);
  if (saved) {
    versusState = JSON.parse(saved);
  } else {
    resetVersusState();
  }
}

function saveVersusToStorage() {
  localStorage.setItem(STORAGE_KEY_VERSUS, JSON.stringify(versusState));
}

function renderVersus() {
  if (!versusState.currentQ) {
    versusState.currentQ = generateMultiplicationQuestion();
  }

  const { a, b, correct, options } = versusState.currentQ;
  const qText = `${toArabicDigits(a)} × ${toArabicDigits(b)} = ؟`;
  document.getElementById('center-question').textContent = qText;

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

  const p1Container = document.getElementById('p1-options');
  const p2Container = document.getElementById('p2-options');
  p1Container.innerHTML = '';
  p2Container.innerHTML = '';

  options.forEach(val => {
    const btn1 = document.createElement('button');
    btn1.className = 'btn option-btn';
    btn1.textContent = toArabicDigits(val);
    btn1.onclick = () => handleVersusAnswer(1, val, correct, btn1);
    p1Container.appendChild(btn1);

    const btn2 = document.createElement('button');
    btn2.className = 'btn option-btn';
    btn2.textContent = toArabicDigits(val);
    btn2.onclick = () => handleVersusAnswer(2, val, correct, btn2);
    p2Container.appendChild(btn2);
  });
}

function handleVersusAnswer(player, chosen, correct, btnEl) {
  if (player === 1 && !versusState.canAnswerP1) return;
  if (player === 2 && !versusState.canAnswerP2) return;

  const isCorrect = (chosen === correct);

  if (isCorrect) {
    btnEl.classList.add('correct', 'pulse');
    versusState.canAnswerP1 = false;
    versusState.canAnswerP2 = false;

    if (player === 1) versusState.tugScore++;
    else versusState.tugScore--;

    saveVersusToStorage();
    renderVersus();

    const who = (player === 1) ? 'player1' : 'player2';
    fireConfettiAt(who);

    if (versusState.tugScore >= 3) {
      versusState.tugScore = 0;
      saveVersusToStorage();
      startWinState('فوز اللاعب الأول 🎉', 'player1');
    } else if (versusState.tugScore <= -3) {
      versusState.tugScore = 0;
      saveVersusToStorage();
      startWinState('فوز اللاعب الثاني 🎉', 'player2');
    } else {
      stopAllCountdownsAndNextQuestion();
    }

  } else {
    btnEl.classList.add('wrong', 'shake');
    showErrorFlash(player);
    if (player === 1) {
      versusState.canAnswerP1 = false;
      startPlayerCountdown(1);
    } else {
      versusState.canAnswerP2 = false;
      startPlayerCountdown(2);
    }
  }
}

function startPlayerCountdown(player) {
  if (activeCountdown) return;

  let countdown = 3;
  const p1Overlay = document.getElementById('p1-countdown');
  const p2Overlay = document.getElementById('p2-countdown');
  const p1Number = document.getElementById('p1-countdown-number');
  const p2Number = document.getElementById('p2-countdown-number');

  if (player === 1) {
    p1Overlay.style.display = 'flex';
    p1Number.textContent = toArabicDigits(countdown);
  } else {
    p2Overlay.style.display = 'flex';
    p2Number.textContent = toArabicDigits(countdown);
  }

  activeCountdown = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      if (player === 1) p1Number.textContent = toArabicDigits(countdown);
      else p2Number.textContent = toArabicDigits(countdown);
    } else {
      clearInterval(activeCountdown);
      activeCountdown = null;
      p1Overlay.style.display = 'none';
      p2Overlay.style.display = 'none';
      stopAllCountdownsAndNextQuestion();
    }
  }, 1000);
}

function stopAllCountdownsAndNextQuestion() {
  const p1Overlay = document.getElementById('p1-countdown');
  const p2Overlay = document.getElementById('p2-countdown');

  if (activeCountdown) {
    clearInterval(activeCountdown);
    activeCountdown = null;
  }

  p1Overlay.style.display = 'none';
  p2Overlay.style.display = 'none';

  setTimeout(() => {
    versusState.currentQ = generateMultiplicationQuestion();
    versusState.canAnswerP1 = true;
    versusState.canAnswerP2 = true;
    saveVersusToStorage();
    renderVersus();
  }, 2000);
}

/* بداية جديدة من الأزرار */
function newGame() {
  stopWinConfetti();
  if (mode === 'single') {
    resetSingleState();
    renderSingle();
  } else if (mode === 'versus') {
    if (activeCountdown) {
      clearInterval(activeCountdown);
      activeCountdown = null;
    }
    resetVersusState();
    renderVersus();
  }
}

/* رسالة تدوير الشاشة */
function showRotateMessage() {
  let overlay = document.getElementById('rotate-overlay');
  let label;
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'rotate-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.background = 'rgba(0,0,0,0.5)';
    overlay.style.zIndex = '9996';
    overlay.style.pointerEvents = 'none';

    label = document.createElement('div');
    label.id = 'rotate-overlay-label';
    label.style.background = '#ffffff';
    label.style.padding = '12px 18px';
    label.style.borderRadius = '14px';
    label.style.fontSize = '1.1rem';
    label.style.whiteSpace = 'pre-line';
    label.textContent = 'من الأفضل تدوير الشاشة أفقياً\nووضع الجهاز بين اللاعبين 👦👦';

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

/* إعداد canvas-confetti */
(function setupConfetti(){
  if (window.confetti) return;
  const script = document.createElement('script');
  script.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js";
  script.async = true;
  document.head.appendChild(script);
})(); // [web:98]

function getOriginForElement(elem) {
  if (!elem) return { x: 0.5, y: 0.5 };
  const rect = elem.getBoundingClientRect();
  const x = (rect.left + rect.width / 2) / window.innerWidth;
  const y = (rect.top + rect.height / 2) / window.innerHeight;
  return { x, y };
} // [web:127][web:113]

function fireConfettiAt(where) {
  if (!window.confetti) return;

  let origin;
  if (where === 'player1') {
    origin = getOriginForElement(document.getElementById('side-left'));
  } else if (where === 'player2') {
    origin = getOriginForElement(document.getElementById('side-right'));
  } else if (where === 'center') {
    // فردي: من single-question، جماعي: من center-question [web:116]
    if (mode === 'single') {
      origin = getOriginForElement(document.getElementById('single-question'));
    } else {
      origin = getOriginForElement(document.getElementById('center-question'));
    }
  } else {
    origin = { x: 0.5, y: 0.3 };
  }

  confetti({
    particleCount: 80,
    spread: 70,
    origin
  });
}

function fireConfettiBig(where) {
  if (!window.confetti) return;

  let origin;
  if (where === 'player1') {
    origin = getOriginForElement(document.getElementById('side-left'));
  } else if (where === 'player2') {
    origin = getOriginForElement(document.getElementById('side-right'));
  } else if (where === 'center') {
    if (mode === 'single') {
      origin = getOriginForElement(document.getElementById('single-question'));
    } else {
      origin = getOriginForElement(document.getElementById('center-question'));
    }
  } else {
    origin = { x: 0.5, y: 0.4 };
  }

  confetti({
    particleCount: 220,
    spread: 160,
    origin
  });
}

/* حالة الفوز المستمرة */
function startWinState(text, who) {
  showWinOverlayWithButton(text);
  fireConfettiBig(who);

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

/* طبقة فوز مع زر بداية جديدة */
function showWinOverlayWithButton(text) {
  let overlay = document.getElementById('win-overlay');
  let label, btn;

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'win-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.background = 'rgba(0,0,0,0.45)';
    overlay.style.zIndex = '9998';
    overlay.style.pointerEvents = 'auto';

    const box = document.createElement('div');
    box.style.background = '#ffffff';
    box.style.padding = '18px 24px';
    box.style.borderRadius = '18px';
    box.style.fontSize = '1.3rem';
    box.style.display = 'flex';
    box.style.flexDirection = 'column';
    box.style.alignItems = 'center';
    box.style.gap = '10px';

    label = document.createElement('div');
    label.id = 'win-overlay-label';
    label.style.whiteSpace = 'pre-line';

    btn = document.createElement('button');
    btn.id = 'win-overlay-btn';
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

/* طبقة فوز سريعة بلا زر */
function showQuickWinOverlay(text) {
  let overlay = document.getElementById('quick-win-overlay');
  let label;
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'quick-win-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.background = 'rgba(0,0,0,0.35)';
    overlay.style.zIndex = '9997';
    overlay.style.pointerEvents = 'none';

    label = document.createElement('div');
    label.id = 'quick-win-label';
    label.style.background = '#ffffff';
    label.style.padding = '12px 18px';
    label.style.borderRadius = '14px';
    label.style.fontSize = '1.1rem';
    label.style.whiteSpace = 'pre-line';
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

/* نبض أحمر للفردي */
function showErrorFlashSingle() {
  document.body.style.animation = 'errorFlash 0.4s';
  addErrorKeyframesIfNeeded();
  setTimeout(() => {
    document.body.style.animation = '';
  }, 400);
}

/* نبض أحمر لنصف اللاعب المخطئ */
function showErrorFlash(player) {
  const side = (player === 1) ? document.getElementById('side-left') : document.getElementById('side-right');
  if (!side) return;
  side.classList.add('shake');
  side.style.boxShadow = '0 0 0 4px rgba(244,67,54,0.5)';
  addErrorKeyframesIfNeeded();
  setTimeout(() => {
    side.classList.remove('shake');
    side.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
  }, 600);
}

function addErrorKeyframesIfNeeded() {
  if (document.getElementById('errorFlash-style')) return;
  const style = document.createElement('style');
  style.id = 'errorFlash-style';
  style.textContent = `
    @keyframes errorFlash {
      0% { background-color: rgba(244,67,54,0.12); }
      100% { background-color: transparent; }
    }
  `;
  document.head.appendChild(style);
}

/* تحميل أولي */
window.onload = () => {
  initMultiplicationPairs();
};
