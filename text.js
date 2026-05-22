let allTexts = [];

/* READ TEXTS */

function getReadTexts() {
  try { return new Set(JSON.parse(localStorage.getItem('texts_read') || '[]')); }
  catch { return new Set(); }
}

function markTextRead(id) {
  const set = getReadTexts();
  if (set.has(String(id))) return;
  set.add(String(id));
  localStorage.setItem('texts_read', JSON.stringify([...set]));
  localStorage.setItem('texts_read_count', set.size);
}

/* UTILS */

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* CACHE */

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

function showLoadError() {
  const el = document.getElementById("texts-list");
  if (el) el.innerHTML = `
    <div style="grid-column:1/-1;padding:60px 20px;text-align:center;color:#B9B4AD;font-size:1rem;line-height:1.8">
      Нет соединения с сервером.<br>Проверь интернет и обнови страницу.
    </div>`;
}

async function withTimeout(promise, ms = 10000) {
  const timer = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), ms)
  );
  return Promise.race([promise, timer]);
}

async function loadTexts() {

  const cached = getCache('texts');
  if (cached) {
    allTexts = cached;
    renderTexts(cached);
    return;
  }

  try {

    const { data, error } = await withTimeout(
      window.supabaseClient
        .from("text_table")
        .select("id, title, texting, translation")
    );

    if (error) {
      console.error(error);
      showLoadError();
      return;
    }

    allTexts = data;
    setCache('texts', data);
    renderTexts(data);

  } catch (e) {

    console.error(e);
    showLoadError();

  }

}

  /* RENDER */

  function renderTexts(data) {

    const container =
      document.getElementById("texts-list");

    container.innerHTML = "";

    const readTexts = getReadTexts();
    localStorage.setItem('texts_total', data.length);

    data.forEach(item => {

      const isRead = readTexts.has(String(item.id));

      const card =
        document.createElement("div");

      card.className = "card";

      card.innerHTML = `

        <div class="category">
          texto
        </div>

        <div class="word">
          ${escHtml(item.title)}
          ${isRead ? '<span class="read-badge">✓</span>' : ''}
        </div>

        <div class="translation">
          ${isRead ? 'перечитать →' : 'читать →'}
        </div>

      `;

      card.addEventListener("click", () => {
        openTextModal(item);
      });

      container.appendChild(card);

    });

  }

  /* OPEN */

  function openTextModal(item) {

    markTextRead(item.id);
    renderTexts(allTexts);

    document.getElementById(
      "text-modal-title"
    ).innerText = item.title;

    document.getElementById(
      "spanish-text"
    ).innerText = item.texting;

    document.getElementById(
      "translation-text"
    ).innerText = item.translation;

    document
      .getElementById("text-modal")
      .classList
      .add("active");
  }

  /* CLOSE */

  function closeTextModal() {

    document
      .getElementById("text-modal")
      .classList
      .remove("active");
  }

  /* BG CLOSE */

  document.addEventListener("click", (e) => {

    const modal =
      document.getElementById("text-modal");

    if (e.target === modal) {
      closeTextModal();
    }

  });

  /* START */

  loadTexts();