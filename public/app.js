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
  if (sourceHistory.includes(t)) {
    // 既存エントリの場合はその位置を現在位置として扱う
    sourceHistoryIndex = sourceHistory.indexOf(t);
    updateSourceHistoryButtons();
    return;
  }
  sourceHistory = [t, ...sourceHistory].slice(0, SOURCE_HISTORY_MAX);
  sourceHistoryIndex = 0;
  updateSourceHistoryButtons();
}

function updateSourceHistoryButtons() {
  let canGoBack = false;
  if (sourceHistory.length > 0) {
    if (sourceHistoryIndex === 0) {
      // 先頭（最新）にいる → 1件でも「戻る」で空に戻せる
      canGoBack = true;
    } else if (sourceHistoryIndex < sourceHistory.length) {
      // 過去のエントリにいる → さらに古いものがあれば戻れる
      canGoBack = sourceHistoryIndex < sourceHistory.length - 1;
    }
  }
  sourceBackBtn.disabled = !canGoBack;
  sourceForwardBtn.disabled = sourceHistoryIndex <= 0;
}

function sourceHistoryBack() {
  if (sourceHistory.length === 0) return;
  // 空状態（index が length と同値）ではこれ以上戻れない
  if (sourceHistoryIndex >= sourceHistory.length) return;
  const current = sourceEl.value.trim();

  // テキストが空で index=0 のときは、最新の履歴エントリを表示する
  // （ユーザーが手動でクリアしたあと「戻る」を押した場合の直感的な挙動）
  if (!current && sourceHistoryIndex === 0) {
    sourceEl.value = sourceHistory[0] ?? '';
    updateSourceHistoryButtons();
    return;
  }

  if (sourceHistoryIndex === 0) {
    if (current && !sourceHistory.includes(current)) {
      sourceHistory = [current, ...sourceHistory].slice(0, SOURCE_HISTORY_MAX);
    }
    sourceHistoryIndex = 1;
    sourceEl.value = sourceHistory[1] ?? ''; // 1件のみのときは空（前の状態）
  } else {
    sourceHistoryIndex++;
    sourceEl.value = sourceHistory[sourceHistoryIndex] ?? '';
  }
  updateSourceHistoryButtons();
}

function sourceHistoryForward() {
  if (sourceHistoryIndex <= 0) return;
  sourceHistoryIndex--;
  sourceEl.value = sourceHistory[sourceHistoryIndex] ?? '';
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

  // 翻訳開始時にヒストリーへ保存
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
      updateSourceHistoryButtons();
      return;
    }
    resultEl.value = data.translatedText || '';
    updateResultDiffView();
    setStatus('完了');
  } catch (e) {
    if (requestId !== lastRequestId) return;
    setStatus('通信エラー: ' + e.message, 'error');
  }
  updateSourceHistoryButtons();
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

// 左右カラム幅リサイズ（1:1でスナップ）
const SPLIT_STORAGE_KEY = 'safeL-split-pct';
const SNAP_CENTER = 50;
const SNAP_THRESHOLD = 4;

const splitEl = document.getElementById('panels-split');
const resizeHandle = document.getElementById('resize-handle');

function getStoredSplitPct() {
  const v = localStorage.getItem(SPLIT_STORAGE_KEY);
  const n = Number(v);
  return Number.isFinite(n) && n >= 20 && n <= 80 ? n : SNAP_CENTER;
}

function setSplitPct(pct) {
  const clamped = Math.max(20, Math.min(80, pct));
  splitEl.style.setProperty('--split-pct', clamped + '%');
  resizeHandle?.setAttribute('aria-valuenow', Math.round(clamped));
  return clamped;
}

function applySnap(pct) {
  if (Math.abs(pct - SNAP_CENTER) <= SNAP_THRESHOLD) {
    resizeHandle?.classList.add('snap-zone');
    return SNAP_CENTER;
  }
  resizeHandle?.classList.remove('snap-zone');
  return pct;
}

splitEl.style.setProperty('--split-pct', getStoredSplitPct() + '%');
resizeHandle?.setAttribute('aria-valuenow', Math.round(getStoredSplitPct()));

if (resizeHandle) {
  let startX = 0;
  let startPct = 50;

  function onMove(e) {
    if (!splitEl.classList.contains('resizing')) return;
    const rect = splitEl.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    const snapped = applySnap(pct);
    setSplitPct(snapped);
  }

  function onUp() {
    if (!splitEl.classList.contains('resizing')) return;
    splitEl.classList.remove('resizing');
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    const pct = parseFloat(splitEl.style.getPropertyValue('--split-pct') || '50');
    localStorage.setItem(SPLIT_STORAGE_KEY, String(pct));
  }

  resizeHandle.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    startX = e.clientX;
    startPct = parseFloat(splitEl.style.getPropertyValue('--split-pct') || '50');
    splitEl.classList.add('resizing');
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}
