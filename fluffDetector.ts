import type { AnalysisReport, Span } from '../types';

const HEDGES: string[] = [
    "very","really","just","actually","basically","literally","totally","absolutely","completely","essentially",
    "kinda","kind of","sort of","you know","like","um","uh","perhaps","maybe","quite","somewhat","pretty",
    "in my opinion","i think","i believe"
];

const VAGUE: string[] = [
    "in order to","due to the fact that","at this point in time","at this time","in terms of","a number of",
    "the fact that","as a matter of fact","for all intents and purposes"
];

const WEASEL: string[] = [
    "important","innovative","world-class","cutting-edge","best-in-class","robust","leverage","synergy","impactful",
    "optimize","scalable","state-of-the-art","revolutionary","holistic","paradigm","transformative","mission-critical",
];

// crude passive voice pattern: BE-aux + past participle (ed/en), avoiding common false positives
const PASSIVE_AUX = `\\b(is|are|was|were|be|been|being|'s|'re|'m)\\b`;
const PAST_PARTICIPLE = `\\b\\w+(ed|en)\\b`;
const PASSIVE_RE = new RegExp(PASSIVE_AUX + `\\s+(?:\\w+\\s+){0,2}` + PAST_PARTICIPLE, 'gi');

const WORD_RE = /\b[\w']+\b/gu;

function normalize(text: string): string {
    return text.trim().replace(/\s+/g, " ");
}

function findPhrases(text: string, phrases: string[]): Array<[string, Span]> {
    const hits: Array<[string, Span]> = [];
    const low = text.toLowerCase();
    for (const p of phrases) {
        // word-boundary safe search for multi or single word phrase
        const pattern = new RegExp(`\\b` + p.toLowerCase().replace(/ /g, '\\s+') + `\\b`, 'g');
        let match;
        while ((match = pattern.exec(low)) !== null) {
            hits.push([p, [match.index, match.index + match[0].length]]);
        }
    }
    return hits;
}

function countCategory(tokens: string[], items: string[]): number[] {
    const s = new Set(items.filter(w => !w.includes(" ")).map(w => w.toLowerCase()));
    return tokens.map((t, i) => (s.has(t.toLowerCase()) ? i : -1)).filter(i => i !== -1);
}

function tokensWithSpans(text: string): Array<[string, Span]> {
    return Array.from(text.matchAll(WORD_RE)).map(m => [m[0], [m.index!, m.index! + m[0].length]]);
}

function endsWithLy(word: string): boolean {
    // ignore some common non-adverb 'ly' words
    const ignore = new Set(["family","reply","apply","supply","comply","only","friendly","early","belly","silly"]);
    const w = word.toLowerCase();
    return w.endsWith("ly") && !ignore.has(w);
}

function isNominalization(word: string): boolean {
    return /(tion|sion|ment|ance|ence|ity)\b/i.test(word.toLowerCase());
}

export function analyze(text: string): AnalysisReport {
    const normalizedText = text; // Don't normalize whitespace for accurate spans
    const toksSpans = tokensWithSpans(normalizedText);
    const tokens = toksSpans.map(t => t[0]);
    const wc = tokens.length;

    const hedgesHits = findPhrases(normalizedText, HEDGES.filter(p => p.includes(" ")));
    const hedgesIdx = countCategory(tokens, HEDGES);
    const vagueHits = findPhrases(normalizedText, VAGUE);
    const weaselIdx = countCategory(tokens, WEASEL);

    // FIX: Explicitly type `passiveHits` as `Array<[string, Span]>` to prevent TypeScript
    // from inferring it as `(string | Span)[][]`, which caused a type error on a later line (128).
    const passiveHits: Array<[string, Span]> = Array.from(normalizedText.matchAll(PASSIVE_RE)).map(m => [m[0], [m.index!, m.index! + m[0].length]]);

    const adverbIdx = tokens.map((t, i) => (endsWithLy(t) ? i : -1)).filter(i => i !== -1);
    const nominalIdx = tokens.map((t, i) => (isNominalization(t) ? i : -1)).filter(i => i !== -1);
    
    const uniqueHedgesIdx = [...new Set(hedgesIdx)];
    const uniqueWeaselIdx = [...new Set(weaselIdx)];
    const uniqueAdverbIdx = [...new Set(adverbIdx)];
    const uniqueNominalIdx = [...new Set(nominalIdx)];

    const multiHitsCount = hedgesHits.length + vagueHits.length + passiveHits.length;
    const singleHitsCount = uniqueHedgesIdx.length + uniqueWeaselIdx.length + uniqueAdverbIdx.length + uniqueNominalIdx.length;

    const totalHits = multiHitsCount + singleHitsCount;
    const ratio = wc > 0 ? (totalHits / wc) * 100 : 0.0;

    let verdict: string;
    if (ratio < 5) {
        verdict = "FLUFF-FREE";
    } else if (ratio > 20) {
        verdict = "FLUFF OVERLOAD";
    } else {
        verdict = "MARGINAL PADDING";
    }

    const extract = (wordsIdx: number[]): string[] => wordsIdx.map(i => tokens[i]);

    const suggestions: string[] = [];
    const replacements: { [key: string]: string } = {
        "in order to": "to",
        "due to the fact that": "because",
        "at this point in time": "now",
        "as a matter of fact": "(delete)",
        "for all intents and purposes": "(delete)",
        "the fact that": "(usually delete)"
    };
    for (const [p, _] of vagueHits) {
        if (p in replacements) {
            suggestions.push(`Replace '${p}' → '${replacements[p]}'`);
        }
    }

    const weakAdverbs = new Set(["very","really","just","actually","basically","literally","totally","absolutely","completely","essentially"]);
    for (const i of uniqueHedgesIdx) {
        if (weakAdverbs.has(tokens[i].toLowerCase())) {
            suggestions.push(`Consider deleting hedge: '${tokens[i]}'`);
        }
    }

    const spansToMark: Span[] = [];
    spansToMark.push(...hedgesHits.map(h => h[1]));
    spansToMark.push(...vagueHits.map(v => v[1]));
    spansToMark.push(...passiveHits.map(p => p[1]));
    
    const allSingleIndices = new Set([...uniqueHedgesIdx, ...uniqueWeaselIdx, ...uniqueAdverbIdx, ...uniqueNominalIdx]);
    allSingleIndices.forEach(idx => {
      if (toksSpans[idx]) {
        spansToMark.push(toksSpans[idx][1]);
      }
    });

    // merge overlapping spans
    spansToMark.sort((a, b) => a[0] - b[0]);
    const mergedSpans: Span[] = [];
    if (spansToMark.length > 0) {
        let currentSpan = spansToMark[0];
        for (let i = 1; i < spansToMark.length; i++) {
            const nextSpan = spansToMark[i];
            if (nextSpan[0] < currentSpan[1]) {
                currentSpan[1] = Math.max(currentSpan[1], nextSpan[1]);
            } else {
                mergedSpans.push(currentSpan);
                currentSpan = nextSpan;
            }
        }
        mergedSpans.push(currentSpan);
    }
    
    // Create annotated text string for cases where component rendering isn't possible
    let annotatedText = "";
    let last = 0;
    for (const [s, e] of mergedSpans) {
        annotatedText += text.substring(last, s);
        annotatedText += `«${text.substring(s, e)}»`;
        last = e;
    }
    annotatedText += text.substring(last);


    return {
        wordCount: wc,
        hitRatioPercent: parseFloat(ratio.toFixed(2)),
        verdict: verdict,
        counts: {
            hedgesSingle: uniqueHedgesIdx.length,
            hedgesPhrases: hedgesHits.length,
            vaguePhrases: vagueHits.length,
            passiveEst: passiveHits.length,
            weaselWords: uniqueWeaselIdx.length,
            adverbsLy: uniqueAdverbIdx.length,
            nominalizations: uniqueNominalIdx.length,
            totalHits: totalHits
        },
        samples: {
            hedgesWords: [...new Set(extract(uniqueHedgesIdx))].slice(0, 10),
            weaselWords: [...new Set(extract(uniqueWeaselIdx))].slice(0, 10),
            adverbsLy: [...new Set(extract(uniqueAdverbIdx))].slice(0, 10),
            nominalizations: [...new Set(extract(uniqueNominalIdx))].slice(0, 10),
        },
        annotatedText: annotatedText,
        mergedSpans: mergedSpans,
        suggestions: suggestions.slice(0, 8)
    };
}