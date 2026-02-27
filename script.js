const SYMBOLS = ['🐶', '🐱', '🐸', '🦊', '🐼', '🦁', '🐧', '🦋'];
const TOTAL_PAIRS = SYMBOLS.length;

// ---- Game state ----

const gameState = {
  cards: [],
  flippedCards: [],
  matchedPairs: 0,
  moves: 0,
  timerStarted: false,
  timerInterval: null,
  elapsedSeconds: 0,
  locked: false,
};

// ---- DOM references ----

const gridEl = document.getElementById('card-grid');
const movesEl = document.getElementById('moves');
const timerEl = document.getElementById('timer');
const starsEl = document.getElementById('stars');
const newGameBtn = document.getElementById('new-game-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const bgColorPicker = document.getElementById('bg-color-picker');
const cardBackColorPicker = document.getElementById('card-back-color-picker');
const modalOverlay = document.getElementById('modal-overlay');
const modalMoves = document.getElementById('modal-moves');
const modalTime = document.getElementById('modal-time');
const modalStars = document.getElementById('modal-stars');
const playAgainBtn = document.getElementById('play-again-btn');

// ---- Pure logic helpers ----

/** Fisher-Yates in-place shuffle */
const shuffle = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

/** Duplicate symbols and shuffle to create a deck */
const createDeck = () => shuffle([...SYMBOLS, ...SYMBOLS]);

/** Check if two card elements share the same symbol */
const isMatch = (card1, card2) =>
  card1.dataset.symbol === card2.dataset.symbol;

/** Star rating based on move count */
const getStarRating = (moves) => {
  if (moves < 10) return 3;
  if (moves < 16) return 2;
  return 1;
};

/** Format seconds as M:SS */
const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// ---- DOM rendering ----

/** Build 16 card elements from a shuffled deck */
const renderGrid = (deck) => {
  gridEl.innerHTML = '';
  deck.forEach((symbol) => {
    const card = document.createElement('div');
    card.classList.add('card');
    card.dataset.symbol = symbol;

    card.innerHTML = `
      <div class="card-inner">
        <div class="card-front">${symbol}</div>
        <div class="card-back">?</div>
      </div>
    `;
    gridEl.appendChild(card);
  });
};

/** Update move counter and star display */
const updateScorePanel = () => {
  movesEl.textContent = `${gameState.moves} Move${gameState.moves !== 1 ? 's' : ''}`;
  const rating = getStarRating(gameState.moves);
  const stars = starsEl.querySelectorAll('.star');
  stars.forEach((star, i) => {
    star.classList.toggle('empty', i >= rating);
  });
};

// ---- Timer ----

const startTimer = () => {
  gameState.timerStarted = true;
  gameState.timerInterval = setInterval(() => {
    gameState.elapsedSeconds++;
    timerEl.textContent = formatTime(gameState.elapsedSeconds);
  }, 1000);
};

const stopTimer = () => {
  clearInterval(gameState.timerInterval);
  gameState.timerInterval = null;
};

// ---- Modal ----

const showWinModal = () => {
  modalMoves.textContent = gameState.moves;
  modalTime.textContent = formatTime(gameState.elapsedSeconds);
  const rating = getStarRating(gameState.moves);
  modalStars.textContent = '★'.repeat(rating) + '☆'.repeat(3 - rating);
  modalOverlay.classList.add('visible');
};

const hideWinModal = () => {
  modalOverlay.classList.remove('visible');
};

// ---- Core game flow ----

const handleCardClick = (card) => {
  // Guard: ignore clicks when locked, on already-flipped, or matched cards
  if (gameState.locked) return;
  if (card.classList.contains('flipped') || card.classList.contains('matched')) return;

  // Flip the card
  card.classList.add('flipped');
  gameState.flippedCards.push(card);

  // Start timer on the very first click of the game
  if (!gameState.timerStarted) {
    startTimer();
  }

  // Wait for second card
  if (gameState.flippedCards.length === 1) return;

  // Two cards are now flipped — evaluate the pair
  gameState.moves++;
  updateScorePanel();

  const [first, second] = gameState.flippedCards;

  if (isMatch(first, second)) {
    first.classList.add('matched');
    second.classList.add('matched');
    gameState.matchedPairs++;
    gameState.flippedCards = [];

    // Win check
    if (gameState.matchedPairs === TOTAL_PAIRS) {
      stopTimer();
      // Brief delay so the last match animation is visible
      setTimeout(showWinModal, 400);
    }
  } else {
    // Mismatch — lock input, then flip back after delay
    gameState.locked = true;
    setTimeout(() => {
      first.classList.remove('flipped');
      second.classList.remove('flipped');
      gameState.flippedCards = [];
      gameState.locked = false;
    }, 1000);
  }
};

// ---- Initialization ----

const initGame = () => {
  // Reset state
  stopTimer();
  gameState.cards = [];
  gameState.flippedCards = [];
  gameState.matchedPairs = 0;
  gameState.moves = 0;
  gameState.timerStarted = false;
  gameState.elapsedSeconds = 0;
  gameState.locked = false;

  // Reset UI
  timerEl.textContent = '0:00';
  updateScorePanel();
  hideWinModal();

  // Build and render deck
  const deck = createDeck();
  renderGrid(deck);
};

// ---- Event listeners ----

// Single delegated listener on the grid
gridEl.addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (card) handleCardClick(card);
});

newGameBtn.addEventListener('click', initGame);
playAgainBtn.addEventListener('click', initGame);

settingsBtn.addEventListener('click', () => {
  settingsPanel.hidden = !settingsPanel.hidden;
});

bgColorPicker.addEventListener('input', (e) => {
  document.documentElement.style.setProperty('--color-bg', e.target.value);
});

cardBackColorPicker.addEventListener('input', (e) => {
  document.documentElement.style.setProperty('--color-card-back', e.target.value);
});

// Start first game
initGame();
