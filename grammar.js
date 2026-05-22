/* UTILS */

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let topics = [];
let rules = [];
let examples = [];

/* STUDIED TOPICS */

function getStudied() {
  try { return new Set(JSON.parse(localStorage.getItem('grammar_studied') || '[]')); }
  catch { return new Set(); }
}

function markStudied(topicKey) {
  const set = getStudied();
  set.add(String(topicKey));
  localStorage.setItem('grammar_studied', JSON.stringify([...set]));
  localStorage.setItem('grammar_studied_count', set.size);
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
  const el = document.getElementById("topics");
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

/* LOAD ALL DATA */
async function load() {

  const cachedTopics   = getCache('grammar_topics');
  const cachedRules    = getCache('grammar_rules');
  const cachedExamples = getCache('grammar_examples');

  if (cachedTopics && cachedRules && cachedExamples) {
    topics   = cachedTopics;
    rules    = cachedRules;
    examples = cachedExamples;
    renderTopics();
    return;
  }

  try {

    const [
      { data: t, error: tError },
      { data: r, error: rError },
      { data: e, error: eError }
    ] = await withTimeout(Promise.all([
      supabaseClient.from("grammar_topics").select("*"),
      supabaseClient.from("grammar_rules").select("*"),
      supabaseClient.from("grammar_examples").select("*")
    ]));

    if (tError || rError || eError) { showLoadError(); return; }

    topics   = t || [];
    rules    = r || [];
    examples = e || [];

    setCache('grammar_topics',   topics);
    setCache('grammar_rules',    rules);
    setCache('grammar_examples', examples);

    renderTopics();

  } catch (e) {
    console.error(e);
    showLoadError();
  }
}

/* TOPICS */
function renderTopics() {

  const el = document.getElementById("topics");
  el.innerHTML = "";

  const studied = getStudied();
  const studiedCount = topics.filter(t => studied.has(String(t.topic_key))).length;

  const summary = document.getElementById("grammar-summary");
  if (summary) {
    summary.innerHTML = topics.length
      ? `<b>${studiedCount}</b> / ${topics.length} тем пройдено`
      : '';
  }

  localStorage.setItem('grammar_total', topics.length);
  localStorage.setItem('grammar_studied_count', studiedCount);

  topics.sort((a, b) => (a.order_num || 0) - (b.order_num || 0));

  topics.forEach(t => {

    const isDone = studied.has(String(t.topic_key));

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <div class="card-title">
        ${escHtml(t.topic_ru)}
        ${isDone ? '<span class="studied-badge">✓</span>' : ''}
      </div>
      <div class="card-desc">${escHtml(t.description_ru || "")}</div>
    `;

    card.onclick = () => openTopic(t);

    el.appendChild(card);
  });
}

/* OPEN TOPIC */
function openTopic(topic) {

  markStudied(topic.topic_key);
  renderTopics();

  document.getElementById("modal").classList.add("active");
  document.getElementById("modal-title").innerText = topic.topic_ru;

  const container = document.getElementById("rules");
  container.innerHTML = "";

  const topicRules = rules.filter(r =>
    String(r.topic_key).trim() === String(topic.topic_key).trim()
  );

  const topicExamples = examples.filter(e =>
    String(e.topic_key).trim() === String(topic.topic_key).trim()
  );

  if (topicRules.length === 0 && topicExamples.length === 0) {
    container.innerHTML = `<div class="rule">нет данных</div>`;
    return;
  }

  topicRules.forEach(r => {

    const div = document.createElement("div");
    div.className = "rule";

    div.innerHTML = `
      <div class="rule-title">${escHtml(r.title || "")}</div>
      <div class="rule-text">${escHtml(r.explanation_ru || "")}</div>
      ${r.formula ? `<div class="formula">${escHtml(r.formula)}</div>` : ""}
    `;

    container.appendChild(div);
  });

  if (topicExamples.length > 0) {
    const header = document.createElement("div");
    header.className = "section-title";
    header.innerText = "Примеры";
    container.appendChild(header);
  }

  topicExamples.forEach(e => {

    const div = document.createElement("div");
    div.className = "example";

    div.innerHTML = `
      <div class="example-es">
        <span class="lang-tag">ES</span>
        ${escHtml(e.spanish)}
      </div>

      <div class="example-ru">
        <span class="lang-tag">RU</span>
        ${escHtml(e.russian)}
      </div>
    `;

    container.appendChild(div);
  });
}

/* CLOSE */
function closeModal() {
  document.getElementById("modal").classList.remove("active");
}

/* BACKDROP CLOSE */
document.addEventListener("click", e => {
  if (e.target.id === "modal") {
    closeModal();
  }
});

load();
