import { useState, useCallback, useMemo, useEffect, useRef } from "react";

/* ── Storage ── */
let canLS = false;
try { const k = "__t"; localStorage.setItem(k, k); localStorage.removeItem(k); canLS = true; } catch {}
function load(k, fb) { if (!canLS) return fb; try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } }
function save(k, v) { if (!canLS) return; try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
const SK = { SETS: "ctp_sets2", STATS: "ctp_stats2", THEME: "ctp_theme" };

/* ── Utilities ── */
function gid() { return Math.random().toString(36).slice(2, 10); }

const TONE_MAP = { ā:"a",á:"a",ǎ:"a",à:"a",ē:"e",é:"e",ě:"e",è:"e",ī:"i",í:"i",ǐ:"i",ì:"i",ō:"o",ó:"o",ǒ:"o",ò:"o",ū:"u",ú:"u",ǔ:"u",ù:"u",ǖ:"v",ǘ:"v",ǚ:"v",ǜ:"v",ü:"v" };
function normP(p) { return p.toLowerCase().split("").map(c => TONE_MAP[c] || c).join("").replace(/\s+/g, "").trim(); }

function pipeSplit(line) {
  return line.split("|").map(s => s.trim());
}

/*
 * Unified Parser - pipe (|) delimited, auto-detects word vs sentence per row
 * Word row (3 cols):      繁体字/簡体字 | ピンイン | 英語
 * Sentence row (4+ cols): 英文 | 簡体字中文(___=空欄) | 答え | 繁体字中文(___) | ピンイン
 *   col[3] = 繁体字中文(任意), col[4] = ピンイン(任意)
 * Detection: if col[1] contains "___" → sentence, otherwise → word
 */
function parseUnifiedCSV(text) {
  const lines = text.split("\n").filter(l => l.trim());
  const words = [];
  const sentences = [];

  for (const line of lines) {
    if (/^(traditional|pinyin|english|chinese)/i.test(line.trim())) continue;
    const p = pipeSplit(line);
    if (p.length < 3) continue;

    if (p[1].includes("___")) {
      const en = p[0];
      const ch = p[1];
      const ansRaw = p[2];
      // Answer can be "簡体字/繁体字" format
      let ans, ansTrad;
      if (ansRaw.includes("/")) {
        const ax = ansRaw.split("/").map(s => s.trim());
        ans = ax[0]; ansTrad = ax[1] || "";
      } else { ans = ansRaw; ansTrad = ""; }
      // col[3]: if it contains "___" → traditional Chinese sentence; otherwise → pinyin
      let chTrad = "";
      let ap = "";
      if (p[3]) {
        if (p[3].includes("___")) {
          chTrad = p[3];
          ap = p[4] || "";
        } else {
          ap = p[3];
        }
      }
      if (en && ch && ans) {
        sentences.push({
          id: gid(), type: "sentence",
          english: en, chineseWithBlank: ch, chineseTraditional: chTrad,
          answer: ans, answerTraditional: ansTrad,
          answerPinyin: ap, answerPinyinPlain: ap ? normP(ap) : ""
        });
      }
    } else {
      const cp = p[0];
      const py = p[1];
      const en = p.slice(2).join(", ").replace(/^["']|["']$/g, "");
      let tr, si;
      if (cp.includes("/")) { const x = cp.split("/").map(s => s.trim()); tr = x[0]; si = x[1] || x[0]; }
      else { tr = cp; si = cp; }
      if (tr && py && en) {
        words.push({
          id: gid(), type: "word",
          traditional: tr, simplified: si,
          pinyin: py.replace(/\s+/g, " ").trim(), pinyinPlain: normP(py),
          english: en
        });
      }
    }
  }
  return { words, sentences };
}

/* ── TTS - Simple Chinese speech ── */
function speak(text) {
  if (!text || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "zh-CN";
  u.rate = 0.85;
  const voices = window.speechSynthesis.getVoices();
  const zh = voices.find(v => v.lang === "zh-CN")
    || voices.find(v => v.lang === "zh-TW")
    || voices.find(v => v.lang.startsWith("zh"));
  if (zh) u.voice = zh;
  window.speechSynthesis.speak(u);
}

function Svg({ children, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap');
:root {
  --bg:#faf9f7; --bgc:#fff; --bgm:#f3f1ee; --fg:#1a1a1a; --fgm:#8a8680; --fgs:#b5b0a8;
  --pr:#2d7a6f; --prf:#fff; --prl:#e8f5f2; --ac:#c9a456; --acl:#faf3e0;
  --dn:#c44545; --dnl:#fde8e8; --ok:#2d8a4e; --okl:#e8f8ee;
  --bd:#e8e5e0; --r:12px; --rs:8px;
  --fb:'Noto Sans JP',sans-serif; --fc:'Noto Sans SC','Noto Sans JP',sans-serif; --fm:'JetBrains Mono',monospace;
}
[data-theme="dark"] {
  --bg:#141413; --bgc:#1e1e1c; --bgm:#2a2a27; --fg:#e8e5e0; --fgm:#8a8680; --fgs:#5a5750;
  --pr:#4ecdc4; --prf:#141413; --prl:#1a3330; --ac:#d4a843; --acl:#2d2816;
  --dn:#e06060; --dnl:#2d1616; --ok:#4ecc70; --okl:#162d1c; --bd:#333330;
}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:var(--fb);background:var(--bg);color:var(--fg);line-height:1.6;-webkit-font-smoothing:antialiased}
.ct{max-width:1100px;margin:0 auto;padding:0 20px}
@keyframes fu{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes fi{from{opacity:0}to{opacity:1}}
@keyframes si{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
@keyframes po{from{transform:scale(0)}to{transform:scale(1)}}
@keyframes sli{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}
@keyframes pul{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
.afu{animation:fu .35s ease-out both}.afi{animation:fi .3s ease-out both}
.asi{animation:si .3s ease-out both}.apo{animation:po .35s cubic-bezier(.34,1.56,.64,1) both}
.asl{animation:sli .3s ease-out both}

.hd{position:sticky;top:0;z-index:50;border-bottom:1px solid var(--bd);backdrop-filter:blur(12px);background:rgba(250,249,247,.85)}
[data-theme="dark"] .hd{background:rgba(30,30,28,.85)}
.hi{display:flex;align-items:center;justify-content:space-between;height:56px}
.lo{display:flex;align-items:center;gap:10px}
.li{width:34px;height:34px;border-radius:10px;background:var(--pr);display:flex;align-items:center;justify-content:center;color:var(--prf)}
.lt h1{font-size:15px;font-weight:600;line-height:1.2}.lt p{font-size:10px;color:var(--fgm);line-height:1.2}
.ha{display:flex;align-items:center;gap:8px}

.b{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 16px;border-radius:var(--rs);font-size:13px;font-weight:500;font-family:var(--fb);cursor:pointer;border:none;transition:all .2s;white-space:nowrap}
.b:active{transform:scale(.97)}.b:disabled{opacity:.4;cursor:not-allowed}
.bp{background:var(--pr);color:var(--prf)}.bp:hover{filter:brightness(1.1)}
.bo{background:transparent;color:var(--fg);border:1.5px solid var(--bd)}.bo:hover{border-color:var(--pr);color:var(--pr);background:var(--prl)}
.bg{background:transparent;color:var(--fgm)}.bg:hover{background:var(--bgm);color:var(--fg)}
.bs{padding:4px 10px;font-size:12px}.bl{padding:12px 24px;font-size:15px;font-weight:600}

.cd{background:var(--bgc);border:1px solid var(--bd);border-radius:var(--r);box-shadow:0 1px 3px rgba(0,0,0,.06)}
.ip{width:100%;padding:10px 14px;border-radius:var(--rs);border:1.5px solid var(--bd);background:var(--bg);font-size:14px;font-family:var(--fb);color:var(--fg);outline:none;transition:border-color .2s,box-shadow .2s}
.ip:focus{border-color:var(--pr);box-shadow:0 0 0 3px rgba(45,122,111,.12)}.ip::placeholder{color:var(--fgs)}
.ipm{font-family:var(--fm);text-align:center;font-size:18px;padding:14px}

.ts{display:flex;gap:4px;padding:4px;background:var(--bgm);border-radius:10px}
.t{flex:1;padding:8px 12px;border-radius:8px;font-size:13px;font-weight:500;text-align:center;cursor:pointer;transition:all .2s;border:none;background:transparent;color:var(--fgm);display:flex;align-items:center;justify-content:center;gap:6px;font-family:var(--fb)}
.t.a{background:var(--bgc);color:var(--fg);box-shadow:0 1px 3px rgba(0,0,0,.08)}

.ml{display:flex;flex-direction:column;gap:24px;padding:24px 0}
@media(min-width:900px){.ml{flex-direction:row}.sb{width:360px;flex-shrink:0}.mc{flex:1;min-width:0}}

.dz{border:2px dashed var(--bd);border-radius:var(--r);padding:28px;text-align:center;cursor:pointer;transition:all .3s}
.dz:hover,.dz.dr{border-color:var(--pr);background:var(--prl);transform:scale(1.01)}
.dzi{width:48px;height:48px;border-radius:12px;background:var(--prl);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;color:var(--pr);transition:transform .3s}
.dz:hover .dzi{transform:scale(1.1) translateY(-4px)}

.pb{height:6px;background:var(--bgm);border-radius:3px;overflow:hidden}
.pf{height:100%;background:var(--pr);border-radius:3px;transition:width .4s ease-out}

.sg{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
@media(min-width:600px){.sg{grid-template-columns:repeat(4,1fr)}}
.sc{border-radius:var(--r);padding:12px;text-align:center}
.sv2{font-size:20px;font-weight:700;font-family:var(--fm);display:flex;align-items:center;justify-content:center;gap:6px}
.sl2{font-size:11px;color:var(--fgm);font-weight:500;margin-top:2px}

.qc{max-width:560px;margin:0 auto;border:2px solid var(--bd);border-radius:16px;overflow:hidden;background:var(--bgc);transition:border-color .3s}
.qc.ok{border-color:var(--pr);background:var(--prl)}.qc.ng{border-color:var(--dn);background:var(--dnl)}
.qh{height:80px;background:linear-gradient(135deg,var(--prl),var(--acl));position:relative;overflow:hidden}
.qh::after{content:"";position:absolute;inset:0;background:linear-gradient(to bottom,transparent 30%,var(--bgc))}
[data-theme="dark"] .qh{background:linear-gradient(135deg,var(--prl),var(--bgm))}
.qb{padding:24px;margin-top:-16px;position:relative}
.qe{text-align:center;margin-bottom:24px}
.qe label{font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:var(--fgm);font-weight:500}
.qe h2{font-size:22px;font-weight:600;margin-top:6px;line-height:1.5}

.ri{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px}
.ri.ok{background:var(--pr);color:var(--prf)}.ri.ng{background:var(--dn);color:#fff}
.rd{background:var(--bgm);border-radius:var(--r);padding:16px;text-align:center}
.rh{font-size:30px;font-weight:700;font-family:var(--fc)}
.rp{font-size:18px;font-family:var(--fm);color:var(--pr);margin-top:4px}
.re{font-size:13px;color:var(--fgm);margin-top:4px}
.ua{font-size:13px;color:var(--fgm);margin-bottom:12px;text-align:center}
.ua span{font-family:var(--fm);color:var(--dn);font-weight:500}

.si{border:1.5px solid var(--bd);border-radius:var(--rs);transition:all .2s;margin-bottom:6px}
.si.sel{border-color:rgba(45,122,111,.3);background:var(--prl)}
.sr{display:flex;align-items:center;gap:8px;padding:10px 12px}
.sn{flex:1;min-width:0;display:flex;align-items:center;gap:6px;cursor:pointer;background:none;border:none;font-family:var(--fb);color:var(--fg);font-size:13px;font-weight:500;text-align:left}
.sn:hover{color:var(--pr)}
.bd2{font-size:11px;padding:2px 8px;border-radius:6px;font-weight:500;white-space:nowrap}
.bm{background:var(--bgm);color:var(--fgm)}.bgd{background:var(--prl);color:var(--pr)}.bbd{background:var(--dnl);color:var(--dn)}
.ib{padding:4px;border-radius:6px;cursor:pointer;border:none;background:none;color:var(--fgm);transition:all .15s;display:flex;align-items:center;justify-content:center}
.ib:hover{background:var(--bgm);color:var(--fg)}.ib.dg:hover{background:var(--dnl);color:var(--dn)}
.wl{max-height:240px;overflow-y:auto;border-top:1px solid var(--bd);padding:8px 12px}
.wr{display:flex;align-items:center;gap:6px;padding:4px;font-size:12px}
.wh{font-family:var(--fc);font-weight:500;min-width:52px;text-align:center;flex-shrink:0}
.wp{font-family:var(--fm);color:var(--pr);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.we{color:var(--fgm);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.mk{background:var(--bgm);border-radius:var(--r);padding:16px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.mk.ac{background:var(--acl);border:1px solid rgba(201,164,86,.2)}
.mk.snt{background:linear-gradient(135deg,var(--prl),var(--acl));border:1px solid rgba(45,122,111,.15)}
.mi{display:flex;align-items:center;gap:12px}
.mic{width:42px;height:42px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}

.hg{height:200px;background:linear-gradient(135deg,#e8f5f2,#faf3e0,#e8f5f2);position:relative;overflow:hidden;display:flex;align-items:flex-end}
[data-theme="dark"] .hg{background:linear-gradient(135deg,var(--prl),var(--bgm),var(--prl))}
.hg::before{content:"書";position:absolute;right:-20px;top:-20px;font-size:180px;font-family:var(--fc);color:var(--pr);opacity:.06;font-weight:700;line-height:1}
.hg::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,var(--bgc),transparent 60%)}
.ht{position:relative;z-index:1;padding:24px}.ht h2{font-size:28px;font-weight:700}.ht p{font-size:13px;color:var(--fgm);margin-top:4px}

.is2{display:flex;align-items:center;gap:12px;padding:8px 12px;border-radius:var(--rs);background:var(--bg)}
.isn{width:24px;height:24px;border-radius:50%;background:var(--prl);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--pr);flex-shrink:0}

.ft{border-top:1px solid var(--bd);padding:16px 0;text-align:center;margin-top:auto}.ft p{font-size:12px;color:var(--fgm)}
.tst{padding:10px 16px;border-radius:var(--rs);display:flex;align-items:center;gap:8px;font-size:13px}
.tst.ok{background:var(--prl);color:var(--fg)}.tst.ng{background:var(--dnl);color:var(--dn)}
.smb{background:var(--bgm);border-radius:var(--rs);padding:8px 16px;text-align:center;font-size:12px;color:var(--fgm)}
.smb strong{color:var(--fg);font-weight:600}
.kbd{font-size:10px;opacity:.7;background:rgba(255,255,255,.2);padding:2px 6px;border-radius:4px;margin-left:6px}
[data-theme="dark"] .kbd{background:rgba(255,255,255,.1)}
.osg{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}
.os{background:var(--bgm);border-radius:var(--rs);padding:10px;text-align:center}
.os .v{font-size:18px;font-weight:700;font-family:var(--fm);color:var(--pr)}.os .l{font-size:10px;color:var(--fgm);margin-top:2px}
.es{text-align:center;padding:40px 20px}
.eic{width:64px;height:64px;border-radius:16px;background:var(--bgm);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:var(--fgm)}
.spk{padding:6px;border-radius:8px;border:none;background:none;cursor:pointer;color:var(--pr);transition:all .2s;display:flex;align-items:center;justify-content:center}
.spk:hover{background:var(--prl)}.spk:active{transform:scale(.9)}
.snd{font-size:18px;font-family:var(--fc);line-height:2;text-align:center;margin:12px 0}
.snb{display:inline-block;min-width:60px;border-bottom:2.5px solid var(--pr);margin:0 2px;padding:0 4px;color:var(--pr);font-weight:600}
.snb.ok{border-color:var(--ok);color:var(--ok)}.snb.ng{border-color:var(--dn);color:var(--dn)}
.mo{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:100;display:flex;align-items:center;justify-content:center;padding:20px;animation:fi .2s ease-out}
.md{background:var(--bgc);border-radius:var(--r);box-shadow:0 20px 60px rgba(0,0,0,.15);width:100%;max-width:440px;animation:si .25s ease-out}
.mdh{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--bd)}
.mdh h3{font-size:15px;font-weight:600}
.mdb{padding:20px;display:flex;flex-direction:column;gap:12px}
.mdf{padding:12px 20px;border-top:1px solid var(--bd);display:flex;gap:8px;justify-content:flex-end}
.fg2{display:flex;flex-direction:column;gap:4px}.fg2 label{font-size:12px;font-weight:500;color:var(--fgm)}
.cc{max-width:420px;margin:0 auto}.cch{text-align:center;padding:32px 24px 48px;background:var(--prl)}
.ccs .bi{width:72px;height:72px;border-radius:50%;background:var(--prl);border:3px solid var(--pr);display:flex;align-items:center;justify-content:center;color:var(--pr)}
.ccm{font-size:24px;font-weight:700;margin-top:16px}.ccb{padding:24px;margin-top:-16px;position:relative}
.cst{background:var(--bg);border:1px solid var(--bd);border-radius:var(--r);padding:16px;display:grid;grid-template-columns:1fr 1fr;gap:16px}
.cs2{text-align:center}.cs2 .v{font-size:20px;font-weight:700;font-family:var(--fm);display:flex;align-items:center;justify-content:center;gap:4px}
.cs2 .l{font-size:11px;color:var(--fgm);font-weight:500}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--bd);border-radius:3px}
.cat-card{background:var(--bgc);border:1px solid var(--bd);border-radius:var(--r);margin-bottom:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.cat-hdr{display:flex;align-items:center;gap:12px;padding:14px 16px}
.cat-modes{display:flex;gap:6px;padding:0 16px 14px;flex-wrap:wrap}
.mode-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:var(--rs);font-size:12px;font-weight:600;font-family:var(--fb);cursor:pointer;border:1.5px solid var(--bd);background:var(--bg);color:var(--fg);transition:all .2s}
.mode-btn:hover{border-color:var(--pr);color:var(--pr);background:var(--prl)}
.mode-btn:active{transform:scale(.96)}
.mode-btn.snt{border-color:rgba(45,122,111,.25);color:var(--pr)}
.mode-btn.snt:hover{background:var(--prl);border-color:var(--pr)}
.mode-btn.both{border-color:rgba(201,164,86,.25);color:var(--ac)}
.mode-btn.both:hover{background:var(--acl);border-color:var(--ac)}
.mode-btn.review{border-color:rgba(224,96,96,.2);color:var(--dn)}
.mode-btn.review:hover{background:var(--dnl);border-color:var(--dn)}
.order-btn{display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border-radius:6px;font-size:11px;font-weight:500;font-family:var(--fb);cursor:pointer;border:1.5px solid var(--bd);background:transparent;color:var(--fgs);transition:all .2s}
.order-btn.active{background:var(--prl);border-color:var(--pr);color:var(--pr);font-weight:600}
.order-btn:hover{border-color:var(--pr);color:var(--pr)}
`;


/* ── CSV Uploader (unified - words + sentences in one CSV) ── */
function CsvUploader({ onLoaded }) {
  const [drag, setDrag] = useState(false);
  const [name, setName] = useState("");
  const [result, setResult] = useState(null);
  const ref = useRef(null);

  const handle = useCallback((file) => {
    const r = new FileReader();
    r.onload = (e) => {
      const { words, sentences } = parseUnifiedCSV(e.target.result);
      if (!words.length && !sentences.length) { setResult({ err: "CSVから単語/文章を読み取れませんでした" }); return; }
      const n = name.trim() || file.name.replace(/\.csv$/i, "");
      onLoaded(n, words, sentences);
      setResult({ wc: words.length, sc: sentences.length });
      setName("");
      setTimeout(() => setResult(null), 4000);
    };
    r.readAsText(file);
  }, [onLoaded, name]);

  return (
    <div>
      <div className="fg2" style={{ marginBottom: 12 }}>
        <label>セット名（任意）</label>
        <input className="ip" value={name} onChange={e => setName(e.target.value)} placeholder="例: ビジネス用語、HSK4級..." />
      </div>
      <div className={`dz ${drag ? "dr" : ""}`}
        onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]); }}
        onClick={() => ref.current?.click()}>
        <input ref={ref} type="file" accept=".csv" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) handle(e.target.files[0]); e.target.value = ""; }} />
        <div className="dzi">
          <Svg size={20}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></Svg>
        </div>
        <p style={{ fontSize: 13, fontWeight: 500 }}>CSVファイルをドラッグ＆ドロップ</p>
        <p style={{ fontSize: 12, color: "var(--fgm)", marginTop: 4 }}>またはクリックしてファイルを選択</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--fgs)", marginTop: 12, textAlign: "left", background: "var(--bgm)", padding: "8px 12px", borderRadius: 8 }}>
          <div><strong style={{ color: "var(--fgm)" }}>単語行:</strong> 繁体字/簡体字 | ピンイン | 英語</div>
          <div><strong style={{ color: "var(--fgm)" }}>文章行:</strong> 英文 | 簡体字(___) | 答え | 繁体字(___) | ピンイン</div>
          <div style={{ color: "var(--pr)" }}>※ 区切りは「|」（パイプ）。1つのファイルに混在OK</div>
        </div>
      </div>
      {result && (
        <div className={`tst afu ${result.err ? "ng" : "ok"}`} style={{ marginTop: 10 }}>
          {result.err || `${result.wc > 0 ? result.wc + "単語" : ""}${result.wc > 0 && result.sc > 0 ? " + " : ""}${result.sc > 0 ? result.sc + "文章" : ""} を追加しました`}
        </div>
      )}
    </div>
  );
}

/* ── Category Card (per CSV set) with mode buttons ── */
function CategoryCard({ set, stats, onStart, onRename, onRemove, onEditWord, onDeleteWord, onAddWord }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(set.name);
  const [addMode, setAddMode] = useState(false);
  const [nw, setNw] = useState({ traditional: "", simplified: "", pinyin: "", english: "" });
  const [order, setOrder] = useState("random");
  const [confirmDel, setConfirmDel] = useState(null); // null | "set" | wordId // "random" | "sequential"

  const wc = set.words.length;
  const sc = set.sentences.length;

  const getAcc = () => {
    let t = 0, c = 0;
    for (const w of set.words) {
      const s = stats[w.id];
      if (s) {
        const h = Array.isArray(s.history) ? s.history : [];
        if (h.length > 0) { t += h.length; c += h.filter(x => x).length; }
      }
    }
    return t > 0 ? Math.round((c / t) * 100) : -1;
  };
  const acc = getAcc();

  const doAdd = () => {
    if (nw.simplified && nw.pinyin && nw.english) {
      onAddWord(set.id, { traditional: nw.traditional || nw.simplified, simplified: nw.simplified, pinyin: nw.pinyin, english: nw.english });
      setNw({ traditional: "", simplified: "", pinyin: "", english: "" });
      setAddMode(false);
    }
  };

  return (
    <div className="cat-card asl">
      {/* Header */}
      <div className="cat-hdr">
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <input className="ip" style={{ padding: "4px 8px", fontSize: 13 }} value={editName} onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && editName.trim()) { onRename(set.id, editName.trim()); setEditing(false); } if (e.key === "Escape") setEditing(false); }} autoFocus />
              <button className="ib" onClick={() => { if (editName.trim()) onRename(set.id, editName.trim()); setEditing(false); }} style={{ color: "var(--pr)" }}>
                <Svg size={14}><path d="M20 6L9 17l-5-5" /></Svg>
              </button>
            </div>
          ) : (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{set.name}</h3>
              <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                {wc > 0 && <span className="bd2 bm">{wc} 単語</span>}
                {sc > 0 && <span className="bd2 bgd">{sc} 文章</span>}
                {acc >= 0 && <span className={`bd2 ${acc >= 70 ? "bgd" : "bbd"}`}>正解率 {acc}%</span>}
              </div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
          <button className="ib" onClick={() => setExpanded(!expanded)} title="詳細">
            <Svg size={16}>{expanded ? <path d="M6 9l6 6 6-6" /> : <path d="M9 18l6-6-6-6" />}</Svg>
          </button>
          <button className="ib" onClick={() => { setEditing(true); setEditName(set.name); }} title="名前変更">
            <Svg size={14}><path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></Svg>
          </button>
          <button className="ib dg" onClick={() => setConfirmDel("set")} title="削除">
            <Svg size={14}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></Svg>
          </button>
        </div>
      </div>

      {/* Order toggle + Mode buttons */}
      <div className="cat-modes">
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginRight: 8 }}>
          <button className={`order-btn ${order === "random" ? "active" : ""}`} onClick={() => setOrder("random")} title="ランダム">
            <Svg size={12}><polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" /><polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" /><line x1="4" y1="4" x2="9" y2="9" /></Svg>
            ランダム
          </button>
          <button className={`order-btn ${order === "sequential" ? "active" : ""}`} onClick={() => setOrder("sequential")} title="順番">
            <Svg size={12}><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></Svg>
            順番
          </button>
        </div>
        {wc > 0 && (
          <button className="mode-btn" onClick={() => onStart(set.id, "word", order)}>
            <Svg size={14}><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" /><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" /></Svg>
            単語 only
          </button>
        )}
        {sc > 0 && (
          <button className="mode-btn snt" onClick={() => onStart(set.id, "sentence", order)}>
            <Svg size={14}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></Svg>
            文章 only
          </button>
        )}
        {wc > 0 && sc > 0 && (
          <button className="mode-btn both" onClick={() => onStart(set.id, "both", order)}>
            <Svg size={14}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Svg>
            単語 &amp; 文章
          </button>
        )}
        {wc > 0 && (
          <button className="mode-btn review" onClick={() => onStart(set.id, "review", order)}>
            <Svg size={14}><path d="M12 2a5 5 0 015 5v3a5 5 0 01-10 0V7a5 5 0 015-5z" /><path d="M12 18v4M8 22h8" /></Svg>
            復習
          </button>
        )}
      </div>

      {/* Expanded: word list */}
      {expanded && (
        <div className="afi">
          {wc > 0 && (
            <div className="wl">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--fgm)" }}>単語 ({wc})</span>
                <button className="b bg bs" onClick={() => setAddMode(!addMode)}>{addMode ? "閉じる" : "+ 追加"}</button>
              </div>
              {addMode && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 8 }}>
                  <input className="ip" style={{ padding: "5px 8px", fontSize: 11 }} placeholder="簡体字 *" value={nw.simplified} onChange={e => setNw(p => ({ ...p, simplified: e.target.value }))} />
                  <input className="ip" style={{ padding: "5px 8px", fontSize: 11 }} placeholder="繁体字" value={nw.traditional} onChange={e => setNw(p => ({ ...p, traditional: e.target.value }))} />
                  <input className="ip" style={{ padding: "5px 8px", fontSize: 11 }} placeholder="ピンイン *" value={nw.pinyin} onChange={e => setNw(p => ({ ...p, pinyin: e.target.value }))} />
                  <input className="ip" style={{ padding: "5px 8px", fontSize: 11 }} placeholder="英語 *" value={nw.english} onChange={e => setNw(p => ({ ...p, english: e.target.value }))} />
                  <button className="b bp bs" style={{ gridColumn: "span 2" }} onClick={doAdd} disabled={!nw.simplified || !nw.pinyin || !nw.english}>追加</button>
                </div>
              )}
              {set.words.map(w => {
                const x = stats[w.id]; const h = x && Array.isArray(x.history) ? x.history : [];
                const rate = h.length > 0 ? Math.round((h.filter(v => v).length / h.length) * 100) : -1;
                return (
                  <div key={w.id} className="wr">
                    <span className="wh">{w.simplified}{w.traditional && w.traditional !== w.simplified && <span style={{ color: "var(--fgm)", fontSize: 11 }}> / {w.traditional}</span>}</span>
                    <span className="wp">{w.pinyin}</span>
                    <span className="we">{w.english}</span>
                    {rate >= 0 && <span style={{ fontSize: 11, color: rate >= 70 ? "var(--pr)" : "var(--dn)", flexShrink: 0 }}>{rate}%</span>}
                    <button className="ib" onClick={() => onEditWord(set.id, w.id)} style={{ padding: 2 }}><Svg size={12}><path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></Svg></button>
                    <button className="ib dg" onClick={() => setConfirmDel(w.id)} style={{ padding: 2 }}><Svg size={12}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></Svg></button>
                    <button className="spk" onClick={() => speak(w.simplified)} style={{ padding: 2 }}><Svg size={12}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 010 7.07" /></Svg></button>
                  </div>
                );
              })}
            </div>
          )}
          {sc > 0 && (
            <div className="wl" style={{ borderTop: wc > 0 ? "1px solid var(--bd)" : "none" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--fgm)", display: "block", marginBottom: 6 }}>文章 ({sc})</span>
              {set.sentences.map(x => (
                <div key={x.id} className="wr" style={{ flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, flex: 1, color: "var(--fgm)", minWidth: "40%" }}>{x.english}</span>
                  <span style={{ fontSize: 12, flex: 1, fontFamily: "var(--fc)" }}>{x.chineseWithBlank.replace(/___/g, `[${x.answer}]`)}{x.chineseTraditional && <span style={{ color: "var(--fgm)", fontSize: 11 }}>{" / "}{x.chineseTraditional.replace(/___/g, `[${x.answer}]`)}</span>}</span>
                  <button className="spk" onClick={() => speak(x.chineseWithBlank.replace(/___/g, x.answer))} style={{ padding: 2 }}>
                    <Svg size={12}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 010 7.07" /></Svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDel && (
        <div style={{ padding: "12px 16px", background: "var(--dnl)", borderTop: "1px solid var(--dn)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 13, color: "var(--dn)", fontWeight: 500 }}>
            {confirmDel === "set" ? `「${set.name}」を削除しますか？` : `「${set.words.find(w => w.id === confirmDel)?.simplified || ""}」を削除しますか？`}
          </span>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button className="b bo bs" onClick={() => setConfirmDel(null)}>キャンセル</button>
            <button className="b bs" style={{ background: "var(--dn)", color: "#fff", border: "none" }} onClick={() => {
              if (confirmDel === "set") onRemove(set.id);
              else onDeleteWord(set.id, confirmDel);
              setConfirmDel(null);
            }}>削除</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Edit Word Modal ── */
function EditModal({ sets, target, onClose, onSave }) {
  const set = sets.find(x => x.id === target.s);
  const word = set?.words.find(x => x.id === target.w);
  const [f, setF] = useState(word ? { traditional: word.traditional, simplified: word.simplified, pinyin: word.pinyin, english: word.english } : {});
  if (!word) return null;
  return (
    <div className="mo" onClick={onClose}>
      <div className="md" onClick={e => e.stopPropagation()}>
        <div className="mdh"><h3>単語を編集</h3><button className="ib" onClick={onClose}><Svg size={18}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Svg></button></div>
        <div className="mdb">
          {[["簡体字", "simplified"], ["繁体字", "traditional"], ["ピンイン", "pinyin"], ["英語", "english"]].map(([l, k]) => (
            <div key={k} className="fg2"><label>{l}</label><input className="ip" value={f[k] || ""} onChange={e => setF(p => ({ ...p, [k]: e.target.value }))} /></div>
          ))}
        </div>
        <div className="mdf">
          <button className="b bo" onClick={onClose}>キャンセル</button>
          <button className="b bp" onClick={() => { onSave(target.s, target.w, f); onClose(); }}>保存</button>
        </div>
      </div>
    </div>
  );
}

/* ── Stats Bar ── */
function StatsBar({ s }) {
  const a = s.ta > 0 ? Math.round((s.cc / s.ta) * 100) : 0;
  const items = [
    { label: "正解率", val: `${a}%`, bg: "var(--prl)", color: "var(--pr)" },
    { label: "回答数", val: `${s.cc}/${s.ta}`, bg: "var(--bgm)", color: "var(--fg)" },
    { label: "連続正解", val: s.cs, bg: "var(--acl)", color: "var(--ac)", pulse: s.cs >= 3 },
    { label: "最高記録", val: s.bs, bg: "var(--okl)", color: "var(--ok)" },
  ];
  return (
    <div className="sg afi">
      {items.map((x, i) => (
        <div key={i} className="sc" style={{ background: x.bg, animation: x.pulse ? "pul .6s ease" : undefined }}>
          <div className="sv2" style={{ color: x.color }}>{x.val}</div>
          <div className="sl2">{x.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Word Quiz Card ── */
function WordQuiz({ w, qs, ci, tw, lua, onSub, onNxt, onSkp, tts, sets, onOverride }) {
  const [iv, siv] = useState("");
  const [hint, setHint] = useState("");
  const ir = useRef(null);
  const nr = useRef(null);
  useEffect(() => { if (qs === "question") { siv(""); setHint(""); setTimeout(() => ir.current?.focus(), 100); } }, [qs, ci]);
  useEffect(() => { if (qs === "correct" || qs === "incorrect") setTimeout(() => nr.current?.focus(), 100); }, [qs]);
  if (!w) return null;
  const show = qs === "correct" || qs === "incorrect";
  const ok = qs === "correct";
  const pct = ((ci + (show ? 1 : 0)) / tw) * 100;

  const giveHint = () => {
    const plain = w.pinyinPlain;
    // Progressive hints: 1st call = first char, 2nd = first 2, etc.
    const next = Math.min((hint ? hint.length + 1 : 1), plain.length);
    setHint(plain.slice(0, next));
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontFamily: "var(--fm)", color: "var(--fgm)" }}>{ci + 1}/{tw}</span>
        <div className="pb" style={{ flex: 1 }}><div className="pf" style={{ width: `${pct}%` }} /></div>
      </div>
      <div className={`qc ${ok ? "ok" : ""} ${qs === "incorrect" ? "ng" : ""}`}>
        <div className="qh" />
        <div className="qb">
          <div className="qe"><label>英語の意味</label><h2>{w.english}</h2></div>
          {!show ? (
            <div>
              <input ref={ir} className="ip ipm" value={iv} onChange={e => siv(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (iv.trim()) onSub(iv); } }}
                placeholder="ピンインまたは漢字を入力..." autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
              {hint && <div style={{ textAlign: "center", marginTop: 8, fontSize: 15, fontFamily: "var(--fm)", color: "var(--ac)", fontWeight: 600, letterSpacing: 1 }}>ヒント: {hint}...</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="b bp" style={{ flex: 1, height: 44, fontSize: 14 }} onClick={() => iv.trim() && onSub(iv)} disabled={!iv.trim()}>回答する<span className="kbd">Enter</span></button>
                <button className="b bo" style={{ height: 44, padding: "0 14px", color: "var(--ac)", borderColor: "rgba(201,164,86,.3)" }} onClick={giveHint} title="ヒント">
                  <Svg size={16}><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></Svg>
                </button>
                <button className="b bo" style={{ height: 44, padding: "0 14px" }} onClick={onSkp}><Svg size={16}><polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" /></Svg></button>
              </div>
            </div>
          ) : (
            <div className="afu">
              <div className={`ri apo ${ok ? "ok" : "ng"}`}>
                {ok ? <Svg size={28}><path d="M20 6L9 17l-5-5" /></Svg> : <Svg size={28}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Svg>}
              </div>
              {!ok && lua && <p className="ua">あなたの回答: <span>{lua}</span></p>}
              <div className="rd">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <p className="rh">{w.simplified}{w.traditional && w.traditional !== w.simplified && <span style={{ fontSize: 20, color: "var(--fgm)", marginLeft: 4 }}> / {w.traditional}</span>}</p>
                  {tts && <button className="spk" onClick={() => speak(w.simplified)}><Svg size={18}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 010 7.07" /></Svg></button>}
                </div>
                <p className="rp">{w.pinyin}</p>
                <p className="re">{w.english}</p>
                {(() => {
                  if (!sets) return null;
                  // Find a sentence containing this word across all sets
                  for (const s of sets) {
                    for (const sn of s.sentences) {
                      if (sn.answer === w.simplified || sn.answer === w.traditional || (sn.chineseWithBlank && sn.chineseWithBlank.includes(w.simplified))) {
                        const full = sn.chineseWithBlank.replace(/___/g, sn.answer);
                        const fullTrad = sn.chineseTraditional ? sn.chineseTraditional.replace(/___/g, sn.answerTraditional || sn.answer) : "";
                        return (
                          <div style={{ marginTop: 10, padding: "8px 12px", background: "var(--bgm)", borderRadius: 8, borderLeft: "3px solid var(--pr)" }}>
                            <p style={{ fontSize: 11, color: "var(--fgs)", marginBottom: 4 }}>例文</p>
                            <p style={{ fontSize: 13, fontFamily: "var(--fc)" }}>{full}</p>
                            {fullTrad && <p style={{ fontSize: 12, fontFamily: "var(--fc)", color: "var(--fgm)", marginTop: 2 }}>{fullTrad}</p>}
                            <p style={{ fontSize: 12, color: "var(--fgm)", marginTop: 4 }}>{sn.english}</p>
                          </div>
                        );
                      }
                    }
                  }
                  return null;
                })()}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                {!ok && onOverride && <button className="b bo" style={{ height: 44, fontSize: 13, padding: "0 14px", color: "var(--pr)" }} onClick={onOverride}>正解に訂正</button>}
                <button ref={nr} className={`b ${ok ? "bp" : "bo"}`} style={{ flex: 1, height: 44, fontSize: 14 }} onClick={onNxt}
                  onKeyDown={e => { if (e.key === "Enter") onNxt(); }}>次の問題<span className="kbd">Enter</span></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sentence Quiz Card ── */
function SentenceQuiz({ w, qs, ci, tw, lua, onSub, onNxt, onSkp, tts, onOverride }) {
  const [iv, siv] = useState("");
  const [hint, setHint] = useState("");
  const ir = useRef(null);
  const nr = useRef(null);
  useEffect(() => { if (qs === "question") { siv(""); setHint(""); setTimeout(() => ir.current?.focus(), 100); } }, [qs, ci]);
  useEffect(() => { if (qs === "correct" || qs === "incorrect") setTimeout(() => nr.current?.focus(), 100); }, [qs]);
  if (!w) return null;
  const show = qs === "correct" || qs === "incorrect";
  const ok = qs === "correct";
  const pct = ((ci + (show ? 1 : 0)) / tw) * 100;
  const parts = w.chineseWithBlank.split("___");
  const partsTrad = w.chineseTraditional ? w.chineseTraditional.split("___") : null;
  // Find traditional answer if available (extract from chineseTraditional by comparing with chineseWithBlank)
  const tradAnswer = w.answerTraditional || "";

  const giveHint = () => {
    const target = w.answerPinyinPlain || w.answer;
    const next = Math.min((hint ? hint.length + 1 : 1), target.length);
    setHint(target.slice(0, next));
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontFamily: "var(--fm)", color: "var(--fgm)" }}>{ci + 1}/{tw}</span>
        <div className="pb" style={{ flex: 1 }}><div className="pf" style={{ width: `${pct}%` }} /></div>
      </div>
      <div className={`qc ${ok ? "ok" : ""} ${qs === "incorrect" ? "ng" : ""}`}>
        <div className="qh" />
        <div className="qb">
          <div className="qe"><label>英語の文章</label><h2 style={{ fontSize: 18 }}>{w.english}</h2></div>
          <div className="snd">{parts.map((part, i) => (<span key={i}>{part}{i < parts.length - 1 && <span className={`snb ${show ? (ok ? "ok" : "ng") : ""}`}>{show ? w.answer : "___"}</span>}</span>))}</div>
          {partsTrad && <div className="snd" style={{ fontSize: 13, color: "var(--fgm)", marginTop: 4 }}>({partsTrad.map((part, i) => (<span key={i}>{part}{i < partsTrad.length - 1 && <span className={`snb ${show ? (ok ? "ok" : "ng") : ""}`}>{show ? (tradAnswer || w.answer) : "___"}</span>}</span>))})</div>}
          {!show ? (
            <div>
              <input ref={ir} className="ip ipm" style={{ fontSize: 16 }} value={iv} onChange={e => siv(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (iv.trim()) onSub(iv); } }}
                placeholder="空欄に入る漢字またはピンインを入力..." autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
              {hint && <div style={{ textAlign: "center", marginTop: 8, fontSize: 15, fontFamily: "var(--fm)", color: "var(--ac)", fontWeight: 600, letterSpacing: 1 }}>ヒント: {hint}...</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="b bp" style={{ flex: 1, height: 44, fontSize: 14 }} onClick={() => iv.trim() && onSub(iv)} disabled={!iv.trim()}>回答する<span className="kbd">Enter</span></button>
                <button className="b bo" style={{ height: 44, padding: "0 14px", color: "var(--ac)", borderColor: "rgba(201,164,86,.3)" }} onClick={giveHint} title="ヒント">
                  <Svg size={16}><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></Svg>
                </button>
                <button className="b bo" style={{ height: 44, padding: "0 14px" }} onClick={onSkp}><Svg size={16}><polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" /></Svg></button>
              </div>
            </div>
          ) : (
            <div className="afu">
              <div className={`ri apo ${ok ? "ok" : "ng"}`}>
                {ok ? <Svg size={28}><path d="M20 6L9 17l-5-5" /></Svg> : <Svg size={28}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Svg>}
              </div>
              {!ok && lua && <p className="ua">あなたの回答: <span>{lua}</span></p>}
              <div className="rd">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <p className="rh">{w.answer}{tradAnswer && tradAnswer !== w.answer && <span style={{ color: "var(--fgm)", fontSize: 20 }}> / {tradAnswer}</span>}</p>
                  {tts && <button className="spk" onClick={() => speak(w.chineseWithBlank.replace(/___/g, w.answer))}><Svg size={18}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 010 7.07" /></Svg></button>}
                </div>
                {w.answerPinyin && <p className="rp">{w.answerPinyin}</p>}
                <p className="re" style={{ marginTop: 8, fontFamily: "var(--fc)", fontSize: 15 }}>{w.chineseWithBlank.replace(/___/g, w.answer)}</p>
                {w.chineseTraditional && <p className="re" style={{ marginTop: 4, fontFamily: "var(--fc)", fontSize: 13, color: "var(--fgm)" }}>{w.chineseTraditional.replace(/___/g, tradAnswer || w.answer)}</p>}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                {!ok && onOverride && <button className="b bo" style={{ height: 44, fontSize: 13, padding: "0 14px", color: "var(--pr)" }} onClick={onOverride}>正解に訂正</button>}
                <button ref={nr} className={`b ${ok ? "bp" : "bo"}`} style={{ flex: 1, height: 44, fontSize: 14 }} onClick={onNxt}
                  onKeyDown={e => { if (e.key === "Enter") onNxt(); }}>次の問題<span className="kbd">Enter</span></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Complete Screen ── */
function CompleteScreen({ s, onRe, onBk }) {
  const a = s.ta > 0 ? Math.round((s.cc / s.ta) * 100) : 0;
  const el = Math.round((Date.now() - s.st) / 1000);
  const m = Math.floor(el / 60);
  const sc = el % 60;
  const msg = a >= 90 ? "素晴らしい！" : a >= 70 ? "よくできました！" : a >= 50 ? "もう少し頑張りましょう！" : "復習が必要です";

  return (
    <div className="cc cd asi" style={{ overflow: "hidden" }}>
      <div className="cch">
        <div className="ccs apo" style={{ display: "inline-flex" }}>
          <div className="bi"><Svg size={36}><path d="M6 9H4.5a2.5 2.5 0 010-5H6" /><path d="M18 9h1.5a2.5 2.5 0 000-5H18" /><path d="M4 22h16" /><path d="M18 2H6v7a6 6 0 0012 0V2z" /></Svg></div>
        </div>
        <h2 className="ccm">{msg}</h2>
      </div>
      <div className="ccb">
        <div className="cst">
          {[[`${a}%`, "正解率"], [`${s.cc}/${s.ta}`, "回答数"], [String(s.bs), "最高連続正解"], [`${m}:${String(sc).padStart(2, "0")}`, "所要時間"]].map(([v, l], i) => (
            <div key={i} className="cs2 afu" style={{ animationDelay: `${0.2 + i * 0.1}s` }}>
              <div className="v">{v}</div><div className="l">{l}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          <button className="b bp" style={{ width: "100%", height: 44, fontSize: 14 }} onClick={onRe}>もう一度挑戦</button>
          <button className="b bo" style={{ width: "100%", height: 44 }} onClick={onBk}>メニューに戻る</button>
        </div>
      </div>
    </div>
  );
}

/* ── Main App ── */
export default function ChineseTypingApp() {
  const [theme, setTheme] = useState(() => load(SK.THEME, "light"));
  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); save(SK.THEME, theme); }, [theme]);

  // Each set: { id, name, words:[], sentences:[], createdAt }
  const [sets, setSets] = useState(() => load(SK.SETS, []));
  const [stats, setStats] = useState(() => load(SK.STATS, {}));
  useEffect(() => save(SK.SETS, sets), [sets]);
  useEffect(() => save(SK.STATS, stats), [stats]);

  // TTS is now handled via Google Translate Audio in n1.jsx, no setup needed

  const [tab, setTab] = useState("home");
  const [qs, setQs] = useState("idle"); // idle | question | correct | incorrect | finished
  const [quizItems, setQuizItems] = useState([]);
  const [ci, setCi] = useState(0);
  const [ss, setSs] = useState({ ta: 0, cc: 0, cs: 0, bs: 0, st: Date.now() });
  const [lua, setLua] = useState("");
  const [em, setEm] = useState(null);
  const [tts, setTts] = useState(true);
  const [quizSetName, setQuizSetName] = useState("");

  const cw = quizItems[ci] || null;
  const iqa = qs === "question" || qs === "correct" || qs === "incorrect";
  const iqf = qs === "finished";

  // CRUD
  const addSet = useCallback((name, words, sentences) => {
    const ns = { id: gid(), name, words, sentences, createdAt: Date.now() };
    setSets(p => [...p, ns]);
  }, []);

  const rmSet = useCallback(id => setSets(p => p.filter(s => s.id !== id)), []);
  const rnSet = useCallback((id, n) => setSets(p => p.map(s => s.id === id ? { ...s, name: n } : s)), []);

  const editW = useCallback((sid, wid, u) => setSets(p => p.map(s => s.id !== sid ? s : {
    ...s, words: s.words.map(w => w.id !== wid ? w : { ...w, ...u, pinyinPlain: u.pinyin !== undefined ? normP(u.pinyin) : w.pinyinPlain })
  })), []);
  const delW = useCallback((sid, wid) => setSets(p => p.map(s => s.id !== sid ? s : { ...s, words: s.words.filter(w => w.id !== wid) })), []);
  const addW = useCallback((sid, w) => {
    const nw = { ...w, id: gid(), type: "word", pinyinPlain: normP(w.pinyin) };
    setSets(p => p.map(s => s.id !== sid ? s : { ...s, words: [...s.words, nw] }));
  }, []);

  const REVIEW_N = 5; // 直近N回で判定
  const recRes = useCallback((wid, ok) => setStats(p => {
    const s = p[wid] || { history: [], lastAttempt: 0 };
    // Migrate old format if needed
    const hist = Array.isArray(s.history) ? s.history : [];
    const newHist = [...hist, ok].slice(-20); // keep last 20 for data, judge on last N
    return { ...p, [wid]: { history: newHist, lastAttempt: Date.now() } };
  }), []);

  // Start quiz for a specific category/mode
  const startQuiz = useCallback((setId, mode, order) => {
    const set = sets.find(s => s.id === setId);
    if (!set) return;
    const shuffle = order !== "sequential";

    let items = [];
    if (mode === "word") {
      items = set.words.map(w => ({ ...w, _qtype: "word" }));
    } else if (mode === "sentence") {
      items = set.sentences.map(s => ({ ...s, _qtype: "sentence" }));
    } else if (mode === "both") {
      items = [
        ...set.words.map(w => ({ ...w, _qtype: "word" })),
        ...set.sentences.map(s => ({ ...s, _qtype: "sentence" }))
      ];
    } else if (mode === "review") {
      // Only words where recent N attempts include at least 1 incorrect
      items = [...set.words].filter(w => {
        const s = stats[w.id];
        if (!s) return false;
        const hist = Array.isArray(s.history) ? s.history : [];
        if (hist.length === 0) return false;
        const recent = hist.slice(-REVIEW_N);
        // If last N are all correct, no need to review
        if (recent.length >= REVIEW_N && recent.every(x => x)) return false;
        // Include if any incorrect in history
        return recent.some(x => !x);
      }).sort((a, b) => {
        const sa = stats[a.id], sb = stats[b.id];
        const ha = (sa?.history || []).slice(-REVIEW_N), hb = (sb?.history || []).slice(-REVIEW_N);
        const ra = ha.filter(x => x).length / ha.length;
        const rb = hb.filter(x => x).length / hb.length;
        return ra !== rb ? ra - rb : ((sb?.lastAttempt || 0) - (sa?.lastAttempt || 0));
      }).map(w => ({ ...w, _qtype: "word" }));
    }

    if (!items.length) return;

    // Shuffle unless sequential or review mode
    if (shuffle && mode !== "review") {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
    }

    setQuizItems(items);
    setCi(0);
    setSs({ ta: 0, cc: 0, cs: 0, bs: 0, st: Date.now() });
    setQs("question");
    setLua("");
    const orderLabel = shuffle ? "" : " 順番";
    setQuizSetName(set.name + (mode === "review" ? " (復習)" : mode === "sentence" ? ` (文章${orderLabel})` : mode === "both" ? ` (全部${orderLabel})` : ` (単語${orderLabel})`));
  }, [sets, stats]);

  const chkAns = useCallback(inp => {
    if (!cw) return;
    const tr = inp.trim();
    setLua(tr);
    let ok = false;

    if (cw._qtype === "sentence") {
      ok = tr.length > 0 && (tr === cw.answer || (cw.answerTraditional && tr === cw.answerTraditional) || (cw.answerPinyinPlain && normP(tr) === cw.answerPinyinPlain));
    } else {
      const ni = normP(tr);
      ok = tr.length > 0 && (ni === cw.pinyinPlain || tr === cw.simplified || tr === cw.traditional);
    }

    if (cw.id && cw._qtype === "word") recRes(cw.id, ok);
    setSs(p => { const ns = ok ? p.cs + 1 : 0; return { ...p, ta: p.ta + 1, cc: p.cc + (ok ? 1 : 0), cs: ns, bs: Math.max(p.bs, ns) }; });
    setQs(ok ? "correct" : "incorrect");

    if (tts) {
      if (cw._qtype === "word" && cw.simplified) speak(cw.simplified);
      if (cw._qtype === "sentence" && cw.answer) speak(cw.answer);
    }
  }, [cw, recRes, tts]);

  const nextQ = useCallback(() => {
    if (ci + 1 >= quizItems.length) setQs("finished");
    else { setCi(p => p + 1); setQs("question"); setLua(""); }
  }, [ci, quizItems.length]);

  const overrideCorrect = useCallback(() => {
    if (!cw) return;
    if (cw.id && cw._qtype === "word") {
      setStats(p => {
        const s = p[cw.id];
        if (!s) return p;
        const hist = Array.isArray(s.history) ? [...s.history] : [];
        // Replace last entry (false) with true
        if (hist.length > 0 && hist[hist.length - 1] === false) {
          hist[hist.length - 1] = true;
        }
        return { ...p, [cw.id]: { ...s, history: hist } };
      });
    }
    setSs(p => ({ ...p, cc: p.cc + 1, cs: p.cs + 1, bs: Math.max(p.bs, p.cs + 1) }));
    setQs("correct");
  }, [cw]);

  const stopQ = useCallback(() => setQs("idle"), []);

  const expData = useCallback(() => {
    const d = { sets, stats, exportedAt: new Date().toISOString() };
    const b = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
    const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = "chinese-typing-backup.json"; a.click(); URL.revokeObjectURL(u);
  }, [sets, stats]);

  const impData = useCallback(f => {
    const r = new FileReader();
    r.onload = e => {
      try {
        const d = JSON.parse(e.target.result);
        if (d.sets) setSets(d.sets);
        if (d.stats) setStats(d.stats);
      } catch {}
    };
    r.readAsText(f);
  }, []);

  const VolIcon = ({ size = 18 }) => tts
    ? <Svg size={size}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 010 7.07" /><path d="M19.07 4.93a10 10 0 010 14.14" /></Svg>
    : <Svg size={size}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></Svg>;

  // TTS is now simple synchronous speechSynthesis

  return (
    <><style>{CSS}</style>
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header className="hd"><div className="ct hi">
        <div className="lo">
          <div className="li"><Svg size={18}><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></Svg></div>
          <div className="lt"><h1>中文打字練習</h1><p>Chinese Typing Practice</p></div>
        </div>
        <div className="ha">
          {iqa && (
            <>
              <span style={{ fontSize: 12, color: "var(--fgm)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{quizSetName}</span>
              <button className="b bo bs" onClick={stopQ}>終了</button>
            </>
          )}
          <button className="ib" onClick={() => setTts(p => !p)} style={{ color: tts ? "var(--pr)" : "var(--fgs)" }}><VolIcon size={18} /></button>
          <button className="b bg" style={{ width: 34, height: 34, borderRadius: 8, padding: 0 }} onClick={() => setTheme(t => t === "light" ? "dark" : "light")}>
            {theme === "light"
              ? <Svg size={16}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></Svg>
              : <Svg size={16}><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /></Svg>}
          </button>
        </div>
      </div></header>

      <main style={{ flex: 1 }}>
        {/* Quiz active */}
        {iqa ? (
          <div className="ct" style={{ padding: "24px 20px" }}>
            <StatsBar s={ss} />
            <div style={{ marginTop: 20 }} className="asi">
              {cw?._qtype === "sentence"
                ? <SentenceQuiz w={cw} qs={qs} ci={ci} tw={quizItems.length} lua={lua} onSub={chkAns} onNxt={nextQ} onSkp={() => cw && chkAns("")} tts={tts} onOverride={qs === "incorrect" ? overrideCorrect : null} />
                : <WordQuiz w={cw} qs={qs} ci={ci} tw={quizItems.length} lua={lua} onSub={chkAns} onNxt={nextQ} onSkp={() => cw && chkAns("")} tts={tts} sets={sets} onOverride={qs === "incorrect" ? overrideCorrect : null} />}
            </div>
          </div>
        ) : iqf ? (
          <div className="ct" style={{ padding: "32px 20px" }}>
            <CompleteScreen s={ss} onRe={() => { /* restart same quiz */ setQs("question"); setCi(0); setSs({ ta: 0, cc: 0, cs: 0, bs: 0, st: Date.now() }); setLua(""); }} onBk={stopQ} />
          </div>
        ) : (
          /* Home */
          <div className="ct" style={{ padding: "24px 20px" }}>
            {/* Upload section */}
            <div className="cd" style={{ padding: 20, marginBottom: 24 }}>
              <CsvUploader onLoaded={(n, w, s) => { addSet(n, w, s); setTab("home"); }} />
            </div>

            {/* Category list */}
            {sets.length > 0 ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700 }}>カテゴリ一覧</h2>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="b bg bs" onClick={expData}>バックアップ</button>
                    <label className="b bg bs" style={{ cursor: "pointer" }}>復元<input type="file" accept=".json" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) impData(e.target.files[0]); e.target.value = ""; }} /></label>
                  </div>
                </div>
                {sets.map((s, i) => (
                  <CategoryCard key={s.id} set={s} stats={stats}
                    onStart={startQuiz} onRename={rnSet} onRemove={rmSet}
                    onEditWord={(sid, wid) => setEm({ s: sid, w: wid })}
                    onDeleteWord={delW} onAddWord={addW} />
                ))}
              </div>
            ) : (
              <div className="es">
                <div className="eic"><Svg size={28}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></Svg></div>
                <p style={{ fontSize: 13, color: "var(--fgm)" }}>CSVファイルをアップロードして<br />カテゴリを作成してください</p>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="ft">
        <div className="ct"><p>中文打字練習 — Chinese Typing Practice</p></div>
      </footer>
      {em && <EditModal sets={sets} target={em} onClose={() => setEm(null)} onSave={editW} />}
    </div></>
  );
}
