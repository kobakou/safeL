import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const CURSOR_CLI_CMD = process.env.CURSOR_CLI_CMD || 'cursor-agent';

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const LANG_NAMES = { ja: '日本語', en: '英語' };

function buildTranslationPrompt(text, sourceLang, targetLang) {
  const src = LANG_NAMES[sourceLang] || sourceLang;
  const tgt = LANG_NAMES[targetLang] || targetLang;
  return `あなたは専門の翻訳者です。以下のテキストを${src}から${tgt}に翻訳してください。
原文がMarkdown（見出し、リスト、コードブロック、リンク、太字・斜体など）で書かれている場合は、同じMarkdownの書式・構造を維持したまま、自然言語の部分のみを翻訳してください。説明や余計な言い回しは加えず、翻訳結果のみを1つ返してください。

原文:
${text}`;
}

function translateWithCursorAgent(text, sourceLang, targetLang) {
  const prompt = buildTranslationPrompt(text, sourceLang, targetLang);
  const cmd = CURSOR_CLI_CMD.split(/\s+/);
  const prog = cmd[0];
  const args = cmd.slice(1);

  return new Promise((resolve, reject) => {
    const child = spawn(prog, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', (e) => reject(e));
    child.on('close', (code) => {
      if (code !== 0 && err) reject(new Error(err || `exit ${code}`));
      else resolve(out.trim());
    });
    child.stdin.write(prompt, 'utf8');
    child.stdin.end();
  });
}

app.post('/api/translate', async (req, res) => {
  try {
    const { text, sourceLang, targetLang } = req.body;
    if (!text || !sourceLang || !targetLang) {
      return res.status(400).json({ error: 'text, sourceLang, targetLang は必須です' });
    }
    if (!['ja', 'en'].includes(sourceLang) || !['ja', 'en'].includes(targetLang)) {
      return res.status(400).json({ error: '対応言語は ja と en のみです' });
    }
    if (sourceLang === targetLang) {
      return res.status(400).json({ error: '原文と訳文の言語を変えてください' });
    }

    const result = await translateWithCursorAgent(text, sourceLang, targetLang);
    res.json({ translatedText: result });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: '翻訳に失敗しました',
      detail: e.message || String(e),
    });
  }
});

app.get('/api/health', (_, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`safeL server: http://localhost:${PORT}`);
});
