const sourceEl = document.getElementById('source');
const resultEl = document.getElementById('result');
const resultDiffEl = document.getElementById('result-diff');
const originalSourceEl = document.getElementById('original-source');
const statusEl = document.getElementById('status');
const sourceBackBtn = document.getElementById('source-back');
const sourceForwardBtn = document.getElementById('source-forward');

const SOURCE_HISTORY_MAX = 10;
let sourceHistory = [];
let sourceHistoryIndex = 0;

function pushSourceToHistory(text) {
  const t = text.trim();
  if (!t) return;
  if (sourceHistory.includes(t)) return;
  sourceHistory = [t, ...sourceHistory].slice(0, SOURCE_HISTORY_MAX);
  sourceHistoryIndex = 0;
  updateSourceHistoryButtons();
}

function updateSourceHistoryButtons() {
  sourceBackBtn.disabled = sourceHistoryIndex >= sourceHistory.length - 1;
  sourceForwardBtn.disabled = sourceHistoryIndex <= 0;
}

function sourceHistoryBack() {
  if (sourceHistory.length === 0 || sourceHistoryIndex >= sourceHistory.length - 1) return;
  if (sourceHistoryIndex === 0) {
    const current = sourceEl.value.trim();
    if (current && current !== sourceHistory[0])
      sourceHistory = [current, ...sourceHistory].slice(0, SOURCE_HISTORY_MAX);
    sourceHistoryIndex = 1;
    sourceEl.value = sourceHistory[1] || '';
  } else {
    sourceHistoryIndex++;
    sourceEl.value = sourceHistory[sourceHistoryIndex] || '';
  }
  updateSourceHistoryButtons();
}

function sourceHistoryForward() {
  if (sourceHistoryIndex <= 0) return;
  sourceHistoryIndex--;
  sourceEl.value = sourceHistory[sourceHistoryIndex] || '';
  updateSourceHistoryButtons();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function updateResultDiffView() {
  const orig = originalSourceEl.value;
  const trans = resultEl.value;
  if (!trans) {
    resultDiffEl.textContent = '';
    resultDiffEl.classList.remove('has-diff');
    return;
  }
  if (!orig.trim()) {
    resultDiffEl.textContent = trans;
    resultDiffEl.classList.remove('has-diff');
    return;
  }
  resultDiffEl.classList.add('has-diff');
  if (typeof Diff === 'undefined') {
    resultDiffEl.textContent = trans;
    return;
  }
  const changes = Diff.diffWords(orig, trans);
  let html = '';
  for (const c of changes) {
    const esc = escapeHtml(c.value);
    if (c.added) html += '<span class="diff-add">' + esc + '</span>';
    else if (!c.removed) html += esc;
  }
  resultDiffEl.innerHTML = html;
}

let lastRequestId = 0;

function detectSourceLanguage(text) {
  const t = text.trim();
  if (!t) return null;
  const sample = t.slice(0, 1500);
  let jaCount = 0;
  let total = 0;
  for (const c of sample) {
    if (/\s/.test(c)) continue;
    total++;
    const code = c.codePointAt(0) || 0;
    if ((code >= 0x3040 && code <= 0x309F) || (code >= 0x30A0 && code <= 0x30FF) || (code >= 0x4E00 && code <= 0x9FFF)) {
      jaCount++;
    }
  }
  if (total === 0) return null;
  return jaCount / total > 0.1 ? 'ja' : 'en';
}

function getDirection() {
  const v = document.querySelector('input[name="direction"]:checked')?.value || 'auto';
  if (v === 'auto') {
    const detected = detectSourceLanguage(sourceEl.value);
    if (detected === 'ja') return { sourceLang: 'ja', targetLang: 'en' };
    if (detected === 'en') return { sourceLang: 'en', targetLang: 'ja' };
    return { sourceLang: 'ja', targetLang: 'en' };
  }
  return v === 'ja-en' ? { sourceLang: 'ja', targetLang: 'en' } : { sourceLang: 'en', targetLang: 'ja' };
}

const resultPanelEl = resultEl.closest('.panel');

function setStatus(msg, type = '') {
  statusEl.className = 'status ' + type;
  if (type === 'loading') {
    statusEl.innerHTML = '<span class="status-spinner" aria-hidden="true"></span> 翻訳中…';
    resultPanelEl?.classList.add('is-loading');
  } else {
    statusEl.textContent = msg || '';
    resultPanelEl?.classList.remove('is-loading');
  }
}

async function runTranslate() {
  const text = sourceEl.value.trim();
  if (!text) {
    resultEl.value = '';
    updateResultDiffView();
    setStatus('');
    return;
  }

  pushSourceToHistory(text);

  const requestId = ++lastRequestId;
  const { sourceLang, targetLang } = getDirection();
  setStatus('', 'loading');

  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, sourceLang, targetLang }),
    });
    const data = await res.json();

    if (requestId !== lastRequestId) return;

    if (!res.ok) {
      setStatus(data.detail || data.error || 'エラー', 'error');
      return;
    }
    resultEl.value = data.translatedText || '';
    updateResultDiffView();
    setStatus('完了');
  } catch (e) {
    if (requestId !== lastRequestId) return;
    setStatus('通信エラー: ' + e.message, 'error');
  }
}

sourceBackBtn.addEventListener('click', sourceHistoryBack);
sourceForwardBtn.addEventListener('click', sourceHistoryForward);

document.getElementById('translate-btn').addEventListener('click', () => runTranslate());

document.getElementById('swap').addEventListener('click', () => {
  const src = sourceEl.value;
  const res = resultEl.value;
  originalSourceEl.value = src;
  sourceEl.value = res;
  resultEl.value = src;
  updateResultDiffView();
  const dir = document.querySelector('input[name="direction"]:checked');
  if (dir?.value !== 'auto') {
    const next = dir?.value === 'ja-en' ? 'en-ja' : 'ja-en';
    const nextRadio = document.querySelector(`input[name="direction"][value="${next}"]`);
    if (nextRadio) nextRadio.checked = true;
  }
});

originalSourceEl.addEventListener('input', updateResultDiffView);

document.querySelectorAll('.copy-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const id = btn.getAttribute('data-copy-from');
    const el = document.getElementById(id);
    const text = el?.value ?? '';
    try {
      await navigator.clipboard.writeText(text);
      const label = btn.getAttribute('aria-label') || 'コピー';
      btn.textContent = 'OK';
      btn.setAttribute('title', 'コピーしました');
      setTimeout(() => {
        btn.textContent = '📋';
        btn.setAttribute('title', 'クリップボードにコピー');
      }, 600);
    } catch (_) {
      btn.setAttribute('title', 'コピーに失敗しました');
    }
  });
});
