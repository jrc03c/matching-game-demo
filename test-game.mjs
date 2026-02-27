import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gameUrl = `file://${path.join(__dirname, 'index.html')}`;

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
let passed = 0;
let failed = 0;

const assert = (condition, name) => {
  if (condition) {
    console.log(`  ${PASS} ${name}`);
    passed++;
  } else {
    console.log(`  ${FAIL} ${name}`);
    failed++;
  }
};

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 800, height: 900 } });
  await page.goto(gameUrl);

  // ---- Test 1: Grid renders 16 cards with dark backs ----
  console.log('\n1. Card grid rendering');
  const cards = page.locator('.card');
  assert(await cards.count() === 16, '16 cards rendered');
  const backText = await page.locator('.card-back').first().textContent();
  assert(backText.trim() === '?', 'Card backs show "?"');

  // Verify no cards are flipped initially
  const flippedAtStart = await page.locator('.card.flipped').count();
  assert(flippedAtStart === 0, 'No cards flipped initially');

  // ---- Test 2: Timer does NOT start on page load ----
  console.log('\n2. Timer behavior');
  const timerBefore = await page.locator('#timer').textContent();
  assert(timerBefore === '0:00', 'Timer is 0:00 before any clicks');

  // ---- Test 3: Clicking a card flips it ----
  console.log('\n3. Card flipping');
  await cards.nth(0).click();
  const firstFlipped = await cards.nth(0).evaluate(el => el.classList.contains('flipped'));
  assert(firstFlipped, 'First card flips on click');

  // Timer should now have started (wait a tick for the interval to fire)
  await page.waitForTimeout(1100);
  const timerAfter = await page.locator('#timer').textContent();
  assert(timerAfter !== '0:00', 'Timer starts after first click');

  // ---- Test 4: Move counter increments per pair, not per flip ----
  console.log('\n4. Move counter');
  const movesAfterOne = await page.locator('#moves').textContent();
  assert(movesAfterOne === '0 Moves', 'Moves still 0 after first flip');

  await cards.nth(1).click();
  await page.waitForTimeout(100);
  const movesAfterTwo = await page.locator('#moves').textContent();
  assert(movesAfterTwo === '1 Move', 'Moves is 1 after flipping two cards');

  // ---- Test 5: Match / mismatch behavior ----
  // Reset the game to get a controlled state
  console.log('\n5. Match and mismatch behavior');
  await page.locator('#new-game-btn').click();
  await page.waitForTimeout(100);

  // Read all card symbols to find a matching pair and a mismatching pair
  const symbols = await page.$$eval('.card', cards =>
    cards.map(c => c.dataset.symbol)
  );

  // Find first pair of matching indices
  let matchA = -1, matchB = -1;
  for (let i = 0; i < symbols.length; i++) {
    for (let j = i + 1; j < symbols.length; j++) {
      if (symbols[i] === symbols[j]) {
        matchA = i;
        matchB = j;
        break;
      }
    }
    if (matchA >= 0) break;
  }

  // Find a mismatching pair
  let mismatchA = -1, mismatchB = -1;
  for (let i = 0; i < symbols.length; i++) {
    for (let j = i + 1; j < symbols.length; j++) {
      if (symbols[i] !== symbols[j]) {
        mismatchA = i;
        mismatchB = j;
        break;
      }
    }
    if (mismatchA >= 0) break;
  }

  // Test mismatch first
  await cards.nth(mismatchA).click();
  await cards.nth(mismatchB).click();
  await page.waitForTimeout(100);

  // Both should be flipped during the delay
  const bothFlipped = await cards.nth(mismatchA).evaluate(el => el.classList.contains('flipped'))
    && await cards.nth(mismatchB).evaluate(el => el.classList.contains('flipped'));
  assert(bothFlipped, 'Mismatched cards stay visible during delay');

  // ---- Test 6: Input locked during mismatch delay ----
  console.log('\n6. Input locking');
  // Try clicking a third card during the delay — it should be ignored
  const thirdCard = symbols.findIndex((_, i) => i !== mismatchA && i !== mismatchB);
  await cards.nth(thirdCard).click();
  const thirdFlipped = await cards.nth(thirdCard).evaluate(el => el.classList.contains('flipped'));
  assert(!thirdFlipped, 'Third card click ignored during mismatch delay');

  // Wait for mismatch to resolve
  await page.waitForTimeout(1100);
  const flippedBack = !(await cards.nth(mismatchA).evaluate(el => el.classList.contains('flipped')))
    && !(await cards.nth(mismatchB).evaluate(el => el.classList.contains('flipped')));
  assert(flippedBack, 'Mismatched cards flip back after ~1 second');

  // Test match
  await cards.nth(matchA).click();
  await cards.nth(matchB).click();
  await page.waitForTimeout(100);
  const matchedA = await cards.nth(matchA).evaluate(el => el.classList.contains('matched'));
  const matchedB = await cards.nth(matchB).evaluate(el => el.classList.contains('matched'));
  assert(matchedA && matchedB, 'Matching cards get .matched class');

  // ---- Test 7: Star rating ----
  console.log('\n7. Star rating');
  // After a new game, should be 3 stars
  await page.locator('#new-game-btn').click();
  await page.waitForTimeout(100);
  const emptyStars = await page.locator('.star.empty').count();
  assert(emptyStars === 0, 'Fresh game shows 3 stars');

  // ---- Test 8: Win condition — match all 8 pairs ----
  console.log('\n8. Win condition');
  await page.locator('#new-game-btn').click();
  await page.waitForTimeout(100);

  const allSymbols = await page.$$eval('.card', cards =>
    cards.map(c => c.dataset.symbol)
  );

  // Build map of symbol -> [indices]
  const symbolMap = {};
  allSymbols.forEach((s, i) => {
    (symbolMap[s] ??= []).push(i);
  });

  // Click all 8 pairs
  for (const [, indices] of Object.entries(symbolMap)) {
    await cards.nth(indices[0]).click();
    await page.waitForTimeout(50);
    await cards.nth(indices[1]).click();
    await page.waitForTimeout(200);
  }

  // Wait for modal to appear
  await page.waitForTimeout(600);
  const modalVisible = await page.locator('#modal-overlay').evaluate(
    el => el.classList.contains('visible')
  );
  assert(modalVisible, 'Win modal appears after matching all pairs');

  const modalMoves = await page.locator('#modal-moves').textContent();
  assert(modalMoves === '8', 'Modal shows correct move count (8)');

  const modalStars = await page.locator('#modal-stars').textContent();
  assert(modalStars === '★★★', 'Modal shows 3 stars for 8 moves');

  // ---- Test 9: Play Again resets ----
  console.log('\n9. Play Again / New Game reset');
  await page.locator('#play-again-btn').click();
  await page.waitForTimeout(100);

  const modalHidden = !(await page.locator('#modal-overlay').evaluate(
    el => el.classList.contains('visible')
  ));
  assert(modalHidden, 'Modal closes on Play Again');

  const resetMoves = await page.locator('#moves').textContent();
  assert(resetMoves === '0 Moves', 'Move counter resets');

  const resetTimer = await page.locator('#timer').textContent();
  assert(resetTimer === '0:00', 'Timer resets');

  const resetFlipped = await page.locator('.card.flipped').count();
  const resetMatched = await page.locator('.card.matched').count();
  assert(resetFlipped === 0 && resetMatched === 0, 'All cards reset to face-down');

  // ---- Summary ----
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'─'.repeat(40)}\n`);

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
