// Bash の命令を実行する前の見張り（PreToolUse）。プロセスを「名前で探して一斉に止める」命令を止める。
// なぜ：macOS（BSD）の pkill / pgrep は、条件（-n や -P 1）をパターンの後ろに書くと「もう1つのパターン」として読む。
//   2026-10-22 08:49 と 2026-10-23 09:51、助手の「pkill -f "^node serve.mjs$" -n」「… -P 1」が、
//   「-n」や「1」を含むほぼすべての部品（VS Code の画面・裏方・作業場の見張り）を止め、会話が2回とも半日止まった。
//   同じ読み違いは「kill $(pgrep …)」「pgrep … | xargs kill」「ps … | grep … | xargs kill」でも起きる。
// 止めるのは自分が起こしたサーバーの番号だけ：kill <番号>、または自分のポートだけ kill $(lsof -nP -t -iTCP:<ポート> -sTCP:LISTEN)。
let raw = '';
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  let cmd = '';
  try { cmd = String(JSON.parse(raw)?.tool_input?.command || ''); } catch { process.exit(0); }
  // 命令の頭（行頭・; & | ( ` の直後・then / do / xargs などの直後）に来たときだけ止める。grep pkill のような検索は通す。
  const HEAD = String.raw`(^|[;&|(\x60]\s*|\n\s*|\b(?:then|do|else|xargs|sudo|exec|env|time|nohup|command)\s+)`;
  const P = 'p' + 'kill', K = 'kill' + 'all', G = 'p' + 'grep';
  const bad = [
    [new RegExp(HEAD + `(${P}|${K})(\\s|$)`), `${P} / ${K}`],
    [new RegExp(HEAD + String.raw`kill\s+(-[A-Za-z0-9]+\s+)*(--\s+)?-1(\s|$)`), 'kill -1（自分の全部のプロセスに送る）'],
    [new RegExp(HEAD + String.raw`kill\s+(-[A-Za-z0-9]+\s+)*0(\s|$)`), 'kill 0（同じ組の全部に送る）'],
    // 名前で探した番号を kill に渡す形（探し方を1文字間違えると全部が当たる）
    [new RegExp(String.raw`\bkill\b[^\n;]*(\$\(|\x60)\s*(${G}|ps)\b`), `kill $(${G} / ps …)`],
    [new RegExp(String.raw`\b(${G}|ps)\b[^\n;]*\|[^\n;]*\bxargs\s+(-\S+\s+)*kill\b`), `${G} / ps … | xargs kill`],
  ].find(([re]) => re.test(cmd));
  if (!bad) process.exit(0);
  process.stderr.write(`${bad[1]} は使えません（2026-10-23 の決まり・.claude/hooks/block-mass-kill.mjs）。` +
    '自分が起こしたサーバーは kill <起こしたときの番号> で止める（起こすときに & echo $! > pidfile）。' +
    '番号が分からなければ自分のポートだけ: kill $(lsof -nP -t -iTCP:<自分のポート> -sTCP:LISTEN)\n');
  process.exit(2);
});
