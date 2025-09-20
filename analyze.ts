// AI Fluff Detector — core logic
export type HitKind =
  | "hedge" | "vague" | "weasel" | "adverb" | "nominal" | "passive";

export interface Hit {
  kind: HitKind;
  span: [number, number];
  text: string;
}

export interface SentenceReport {
  text: string;
  start: number; // char offset in full text
  end: number;
  hits: Hit[];
  ratio: number; // hits/words * 100
  verdict: "OK" | "WARN" | "OVERLOAD";
  rewritten?: string;
}

export interface Report {
  wordCount: number;
  totalHits: number;
  hitRatioPercent: number;
  verdict: "FLUFF-FREE" | "MARGINAL PADDING" | "FLUFF OVERLOAD";
  sentences: SentenceReport[];
  annotatedHTML: string; // <mark>-wrapped
  cuts: string[]; // suggestions
}

const HEDGES = [
  "very","really","just","actually","basically","literally","totally","absolutely",
  "completely","essentially","kinda","maybe","perhaps","quite","somewhat","pretty",
  "sort of","kind of","you know","um","uh","i think","i believe","in my opinion"
];

const VAGUE = [
  "in order to","due to the fact that","at this point in time","at this time",
  "in terms of","a number of","the fact that","as a matter of fact","for all intents and purposes"
];

const REPLACEMENTS: Record<string,string> = {
  "in order to":"to",
  "due to the fact that":"because",
  "at this point in time":"now",
  "at this time":"now",
  "as a matter of fact":"",
  "for all intents and purposes":"",
  "the fact that":"" // usually delete
};

const WEASEL = [
  "important","innovative","world-class","cutting-edge","best-in-class",
  "robust","leverage","synergy","impactful","optimize","scalable",
  "state-of-the-art","revolutionary","holistic","paradigm","transformative",
  "mission-critical"
];

// crude passive: be-aux + past participle (ed/en) allowing up to 2 words between
const PASSIVE_RE = /\b(is|are|was|were|be|been|being|'s|'re|'m)\b\s+(?:\w+\s+){0,2}\b\w+(?:ed|en)\b/gi;
const WORD_RE = /\b[\w']+\b/g;

const ADVERB_IGNORE = new Set(["only","family","reply","apply","supply","comply","friendly","early","silly","belly","holy"]);

const toLower = (s:string)=>s.toLowerCase();
const normalize = (s:string)=>s.trim().replace(/\s+/g," ");

function splitSentences(text:string): {text:string,start:number,end:number}[] {
  const parts: {text:string,start:number,end:number}[] = [];
  let i = 0, start = 0;
  while (i < text.length) {
    const c = text[i];
    if (/[.!?]/.test(c)) {
      const end = i+1;
      const chunk = text.slice(start,end).trim();
      if (chunk) parts.push({text:chunk,start, end});
      start = end;
    }
    i++;
  }
  const tail = text.slice(start).trim();
  if (tail) parts.push({text:tail,start, end:text.length});
  return parts.length ? parts : [{text, start:0, end:text.length}];
}

function tokens(text:string) {
  const list: {t:string; start:number; end:number}[] = [];
  let m: RegExpExecArray | null;
  while ((m = WORD_RE.exec(text))) list.push({t:m[0], start:m.index, end:m.index+m[0].length});
  return list;
}

function wordHits(text:string, list:string[], kind:HitKind): Hit[] {
  const singles = list.filter(x=>!x.includes(" "));
  const multi   = list.filter(x=> x.includes(" "));
  const hits: Hit[] = [];
  // singles
  const toks = tokens(text);
  const set = new Set(singles.map(toLower));
  for (const w of toks) {
    const low = w.t.toLowerCase();
    if (set.has(low)) hits.push({kind, span:[w.start,w.end], text:w.t});
  }
  // multi
  const low = text.toLowerCase();
  for (const p of multi) {
    const re = new RegExp(`\\b${escapeRegExp(p.toLowerCase())}\\b`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(low))) hits.push({kind, span:[m.index, m.index + p.length], text:text.slice(m.index, m.index+p.length)});
  }
  return hits;
}

function escapeRegExp(s:string){ return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function passiveHits(text:string): Hit[] {
  const hits: Hit[] = [];
  let m: RegExpExecArray | null;
  while ((m = PASSIVE_RE.exec(text))) {
    hits.push({kind:"passive", span:[m.index, m.index + m[0].length], text:m[0]});
  }
  return hits;
}

function adverbHits(text:string): Hit[] {
  const hits: Hit[] = [];
  for (const w of tokens(text)) {
    const low = w.t.toLowerCase();
    if (low.endsWith("ly") && !ADVERB_IGNORE.has(low)) {
      hits.push({kind:"adverb", span:[w.start,w.end], text:w.t});
    }
  }
  return hits;
}

function nominalHits(text:string): Hit[] {
  const hits: Hit[] = [];
  for (const w of tokens(text)) {
    if (/(tion|sion|ment|ance|ence|ity)\b/i.test(w.t)) {
      hits.push({kind:"nominal", span:[w.start,w.end], text:w.t});
    }
  }
  return hits;
}

function mergeSpans(hits:Hit[]): [number,number][] {
  const spans = hits.map(h=>h.span).sort((a,b)=>a[0]-b[0]);
  const out:[number,number][] = [];
  for (const [s,e] of spans) {
    if (!out.length || s > out[out.length-1][1]) out.push([s,e]);
    else out[out.length-1][1] = Math.max(out[out.length-1][1], e);
  }
  return out;
}

function sentenceReport(text:string, start:number, end:number): SentenceReport {
  const h: Hit[] = [
    ...wordHits(text,HEDGES,"hedge"),
    ...wordHits(text,VAGUE,"vague"),
    ...wordHits(text,WEASEL,"weasel"),
    ...adverbHits(text),
    ...nominalHits(text),
    ...passiveHits(text)
  ];
  const words = (text.match(WORD_RE) || []).length;
  const ratio = words ? (h.length/words)*100 : 0;
  const verdict = ratio < 5 ? "OK" : ratio > 20 ? "OVERLOAD" : "WARN";
  return { text, start, end, hits: h, ratio, verdict };
}

function annotate(full:string, spans:[number,number][]): string {
  if (!spans.length) return escapeHTML(full);
  let last = 0, out = "";
  for (const [s,e] of spans) {
    out += escapeHTML(full.slice(last, s));
    out += `<mark class="bg-rose-700/40">${escapeHTML(full.slice(s,e))}</mark>`;
    last = e;
  }
  out += escapeHTML(full.slice(last));
  return out;
}
function escapeHTML(s:string){ return s.replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m] as string)); }

// safe rewrite: swap vague phrases + delete common hedges; collapse spaces
export function rewrite(text:string): string {
  let out = text;
  for (const [k,v] of Object.entries(REPLACEMENTS)) {
    const re = new RegExp(`\\b${escapeRegExp(k)}\\b`, "gi");
    out = out.replace(re, v);
  }
  const hedgesSingles = HEDGES.filter(h=>!h.includes(" "));
  const reHedges = new RegExp(`\\b(${hedgesSingles.map(escapeRegExp).join("|")})\\b`, "gi");
  out = out.replace(reHedges, "");
  const hedgesMulti = HEDGES.filter(h=>h.includes(" "));
  for (const p of hedgesMulti) {
    const re = new RegExp(`\\b${escapeRegExp(p)}\\b`, "gi");
    out = out.replace(re, "");
  }
  return out.replace(/\s{2,}/g," ").replace(/\s+([,.!?;:])/g,"$1").trim();
}

export function analyze(fullText:string): Report {
  const text = normalize(fullText);
  const sents = splitSentences(text).map(s => sentenceReport(s.text, s.start, s.end));

  // annotate full text
  const allHits = sents.flatMap(s => s.hits.map(h => ({...h, span:[h.span[0]+s.start, h.span[1]+s.start] as [number,number]})));
  const merged = mergeSpans(allHits);
  const annotatedHTML = annotate(text, merged);

  const wordCount = (text.match(WORD_RE) || []).length;
  const totalHits = allHits.length;
  const hitRatioPercent = wordCount ? +( (totalHits/wordCount)*100 ).toFixed(2) : 0;
  const verdict = hitRatioPercent < 5 ? "FLUFF-FREE" : hitRatioPercent > 20 ? "FLUFF OVERLOAD" : "MARGINAL PADDING";

  // per-sentence rewrites
  for (const s of sents) s.rewritten = rewrite(s.text);

  // cut suggestions (top few)
  const cuts:string[] = [];
  if (/due to the fact that/i.test(text)) cuts.push("Replace 'due to the fact that' → 'because'");
  if (/at this point in time/i.test(text)) cuts.push("Replace 'at this point in time' → 'now'");
  if (/\b(very|really|just|actually|basically|literally)\b/i.test(text)) cuts.push("Delete common hedges (very/really/just/actually/…)");

  return { wordCount, totalHits, hitRatioPercent, verdict, sentences: sents, annotatedHTML, cuts };
}
