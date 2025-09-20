
export type Span = [number, number];

export interface AnalysisReport {
  wordCount: number;
  hitRatioPercent: number;
  verdict: string;
  counts: {
    hedgesSingle: number;
    hedgesPhrases: number;
    vaguePhrases: number;
    passiveEst: number;
    weaselWords: number;
    adverbsLy: number;
    nominalizations: number;
    totalHits: number;
  };
  samples: {
    hedgesWords: string[];
    weaselWords: string[];
    adverbsLy: string[];
    nominalizations: string[];
  };
  annotatedText: string;
  mergedSpans: Span[];
  suggestions: string[];
}
