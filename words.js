/* =========================
   UTILS
========================= */

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* =========================
   TOAST
========================= */

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

/* =========================
   GLOBAL
========================= */

let allWords = [];

let currentWords = [];

let currentIndex = 0;

let isFlipped = false;

let currentCategorySlug = '';
let currentCategoryName = '';
let hardWords = new Set();

/* =========================
   CACHE
========================= */

const CACHE_TTL = 30 * 60 * 1000;

function getCache(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { sessionStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
}

function setCache(key, data) {
  try { sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

/* =========================
   LOAD WORDS
========================= */

function showLoadError(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `
    <div style="grid-column:1/-1;padding:60px 20px;text-align:center;color:var(--muted);font-size:1rem;line-height:1.8">
      Нет соединения с сервером.<br>Проверь интернет и обнови страницу.
    </div>`;
}

async function withTimeout(promise, ms = 10000) {
  const timer = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), ms)
  );
  return Promise.race([promise, timer]);
}

function saveWordsStats(data) {
  localStorage.setItem('words_total', data.length);
  localStorage.setItem('words_known', data.filter(w => w.know).length);
}

async function loadWords() {

  const cached = getCache('words');
  if (cached) {
    allWords = cached;
    saveWordsStats(cached);
    renderCategories(cached);
    return;
  }

  try {

    const { data, error } = await withTimeout(
      window.supabaseClient
        .from("words")
        .select("id, categories, word, know, categories_ru, word_ru")
    );

    if (error) { showLoadError('words-list'); return; }

    allWords = data;
    setCache('words', data);
    saveWordsStats(data);
    renderCategories(data);

  } catch (e) {

    console.error(e);
    showLoadError('words-list');

  }

}

/* =========================
   RENDER CATEGORIES
========================= */

function renderCategories(data) {

  const container = document.getElementById("words-list");

  container.innerHTML = "";

  const uniqueCategories = [
    ...new Map(
      data.map(item => [
        item.categories,
        {
          slug: item.categories,
          name: item.categories_ru
        }
      ])
    ).values()
  ];

  uniqueCategories.forEach(category => {

    const total = data.filter(w => w.categories === category.slug).length;
    const known = data.filter(w => w.categories === category.slug && w.know).length;
    const pct   = total > 0 ? Math.round(known / total * 100) : 0;

    const card = document.createElement("div");

    card.className = "card";

    card.innerHTML = `

      <div class="category">
        категория
      </div>

      <div class="word">
        ${escHtml(category.name)}
      </div>

      <div class="translation">
        ${known < total ? 'начать →' : 'повторить →'}
      </div>

      <div class="progress-bar-wrap">
        <div class="progress-bar-fill" style="width:${pct}%"></div>
      </div>
      <div class="progress-label">${known} / ${total} изучено</div>

    `;

    card.addEventListener("click", () => {
      openModal(category.slug, category.name);
    });

    container.appendChild(card);

  });

}

/* =========================
   SHUFFLE
========================= */

function shuffleArray(array) {

  const newArray = [...array];

  for (let i = newArray.length - 1; i > 0; i--) {

    const j = Math.floor(Math.random() * (i + 1));

    [newArray[i], newArray[j]] =
    [newArray[j], newArray[i]];
  }

  return newArray;
}

/* =========================
   OPEN MODAL
========================= */

function openModal(categorySlug, categoryName) {

  currentCategorySlug = categorySlug;
  currentCategoryName = categoryName;
  hardWords = new Set();

  const modal = document.getElementById("modal");

  const modalTitle =
    document.getElementById("modal-title");

  modalTitle.innerText = categoryName;

  currentWords = allWords.filter(
    item => item.categories === categorySlug && !item.know
  );

  currentWords = shuffleArray(currentWords);

  currentIndex = 0;

  renderCurrentCard();

  modal.classList.add("active");
}

function repeatAll() {
  currentWords = allWords.filter(
    item => item.categories === currentCategorySlug
  );
  currentWords = shuffleArray(currentWords);
  currentIndex = 0;
  renderCurrentCard();
}

/* =========================
   RENDER CARD
========================= */

function renderCurrentCard() {

  const container =
    document.getElementById("modal-words");

  container.innerHTML = "";

  if (currentWords.length === 0) {

    const allInCategory = allWords.filter(w => w.categories === currentCategorySlug);
    const allDone = allInCategory.length > 0 && allInCategory.every(w => w.know);

    container.innerHTML = `
      <div class="finished">
        <div>${allDone ? 'Все слова изучены! 🎉' : 'слов пока нет ✨'}</div>
        ${allDone ? '<button class="btn-repeat" onclick="repeatAll()">Повторить заново</button>' : ''}
      </div>
    `;

    return;
  }

  isFlipped = false;

  const item = currentWords[currentIndex];

  const card = document.createElement("div");

  card.className = "single-card";

  card.innerHTML = `

    <div class="flip-card" id="flip-card" onclick="flipCard()">
      <div class="flip-card-inner" id="flip-inner">

        <div class="flip-card-front">
          <div class="single-word">${escHtml(item.word)}</div>
          <div class="flip-hint">нажми чтобы узнать перевод</div>
        </div>

        <div class="flip-card-back">
          <div class="single-word">${escHtml(item.word)}</div>
          <div class="single-translation">${escHtml(item.word_ru)}</div>
          <div class="single-buttons" onclick="event.stopPropagation()">
            <button class="btn-know" onclick="knowWord(${item.id})">знаю</button>
            <button class="btn-dontknow" onclick="nextWord()">не знаю</button>
          </div>
        </div>

      </div>
    </div>

  `;

  // свайп на мобильном
  let touchStartX = 0;
  let touchStartY = 0;

  card.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  card.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;

    if (Math.abs(dy) > Math.abs(dx)) return;
    if (Math.abs(dx) < 60) return;

    if (!isFlipped) { flipCard(); return; }

    if (dx > 0) knowWord(currentWords[currentIndex].id);
    else nextWord();
  }, { passive: true });

  container.appendChild(card);
}

/* =========================
   FLIP CARD
========================= */

function flipCard() {
  isFlipped = !isFlipped;
  const inner = document.getElementById('flip-inner');
  if (inner) inner.classList.toggle('flipped');
}

/* =========================
   KNOW WORD
========================= */

async function knowWord(id) {

  // Оптимистично: обновляем UI сразу, не ждём сеть
  const word = allWords.find(w => w.id === id);
  if (word) word.know = true;
  setCache('words', allWords);
  saveWordsStats(allWords);
  renderCategories(allWords);
  nextWord();

  // Запрос в БД фоном
  try {

    const { error } = await window.supabaseClient
      .from("words")
      .update({ know: true })
      .eq("id", id);

    if (error) {
      // Откатываем при ошибке
      if (word) word.know = false;
      setCache('words', allWords);
      saveWordsStats(allWords);
      console.error(error);
      showToast('Не удалось сохранить — попробуй ещё раз');
    }

  } catch (e) {

    if (word) word.know = false;
    setCache('words', allWords);
    saveWordsStats(allWords);
    console.error(e);
    showToast('Не удалось сохранить — попробуй ещё раз');

  }

}

/* =========================
   NEXT WORD
========================= */

function nextWord() {

  const item = currentWords[currentIndex];
  if (item) hardWords.add(item.id);

  currentIndex++;

  if (currentIndex >= currentWords.length) {
    const hard   = shuffleArray(currentWords.filter(w => hardWords.has(w.id)));
    const normal = shuffleArray(currentWords.filter(w => !hardWords.has(w.id)));
    currentWords = [...hard, ...normal];
    currentIndex = 0;
  }

  renderCurrentCard();
}

/* =========================
   CLOSE MODAL
========================= */

function closeModal() {

  document
    .getElementById("modal")
    .classList
    .remove("active");
}

/* =========================
   CLOSE ON BACKGROUND
========================= */

document.addEventListener("click", (e) => {

  const modal = document.getElementById("modal");

  if (e.target === modal) {
    closeModal();
  }

});

/* =========================
   START
========================= */

loadWords();

/* =========================
   OPEN KNOWN MODAL
========================= */

function openKnownModal() {

  const modal =
    document.getElementById("known-modal");

  const select =
    document.getElementById("known-category-select");

  select.innerHTML = "";

  const uniqueCategories = [
    ...new Map(
      allWords.map(item => [
        item.categories,
        {
          slug: item.categories,
          name: item.categories_ru
        }
      ])
    ).values()
  ];

  uniqueCategories.forEach(category => {

    const option =
      document.createElement("option");

    option.value = category.slug;

    option.innerText = category.name;

    select.appendChild(option);

  });

  renderKnownWords();

  modal.classList.add("active");
}

/* =========================
   CLOSE KNOWN MODAL
========================= */

function closeKnownModal() {

  document
    .getElementById("known-modal")
    .classList
    .remove("active");
}

/* =========================
   REPEAT KNOWN WORDS
========================= */

function openRepeatKnown() {

  const select = document.getElementById("known-category-select");
  const category = select.value;
  const categoryName = select.selectedOptions[0].text;

  closeKnownModal();

  currentCategorySlug = category;
  currentCategoryName = categoryName;
  hardWords = new Set();

  currentWords = shuffleArray(
    allWords.filter(w => w.categories === category && w.know)
  );
  currentIndex = 0;

  document.getElementById("modal-title").innerText = categoryName;
  renderCurrentCard();
  document.getElementById("modal").classList.add("active");
}

/* =========================
   FORGET WORD
========================= */

async function forgetWord(id) {

  try {

    const { error } = await window.supabaseClient
      .from("words")
      .update({ know: false })
      .eq("id", id);

    if (error) { showToast("Не удалось сбросить"); return; }

    const word = allWords.find(w => w.id === id);
    if (word) word.know = false;

    setCache('words', allWords);
    renderKnownWords();
    renderCategories(allWords);

  } catch (e) {
    console.error(e);
    showToast("Не удалось сбросить");
  }
}

/* =========================
   RESET CATEGORY
========================= */

async function resetCategory() {

  const category = document.getElementById("known-category-select").value;
  const ids = allWords
    .filter(w => w.categories === category && w.know)
    .map(w => w.id);

  if (!ids.length) return;

  try {

    const { error } = await window.supabaseClient
      .from("words")
      .update({ know: false })
      .in("id", ids);

    if (error) { showToast("Не удалось сбросить"); return; }

    allWords.forEach(w => { if (ids.includes(w.id)) w.know = false; });
    setCache('words', allWords);
    saveWordsStats(allWords);
    renderKnownWords();
    renderCategories(allWords);

  } catch (e) {
    console.error(e);
    showToast("Не удалось сбросить");
  }
}

/* =========================
   RENDER KNOWN WORDS
========================= */

function renderKnownWords() {

  const category =
    document.getElementById(
      "known-category-select"
    ).value;

  const container =
    document.getElementById("known-words-list");

  container.innerHTML = "";

  const knownWords = allWords.filter(item =>
    item.categories === category &&
    item.know === true
  );

  if (knownWords.length === 0) {

    container.innerHTML = `

      <div class="no-words">
        ты лохушка и ничего не знаешь из этой категории 😭
      </div>

    `;

    return;
  }

  knownWords.forEach(item => {

    const word = document.createElement("div");

    word.className = "known-word";

    word.innerHTML = `

      <div class="known-word-row">
        <div>
          <div class="known-es">${escHtml(item.word)}</div>
          <div class="known-ru">${escHtml(item.word_ru)}</div>
        </div>
        <button class="btn-forget" onclick="forgetWord(${item.id})">✕</button>
      </div>

    `;

    container.appendChild(word);

  });

}

/* =========================
   CLOSE KNOWN ON BG
========================= */

document.addEventListener("click", (e) => {

  const modal =
    document.getElementById("known-modal");

  if (e.target === modal) {
    closeKnownModal();
  }

});
