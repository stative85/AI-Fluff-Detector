
import React from 'react';
import type { AnalysisReport } from '../types';

interface SamplesDisplayProps {
  report: AnalysisReport;
}

interface Category {
  title: string;
  count: number;
  samples: string[];
}

const SamplesDisplay: React.FC<SamplesDisplayProps> = ({ report }) => {
  const categories: Category[] = [
    { title: 'Hedges (Words & Phrases)', count: report.counts.hedgesSingle + report.counts.hedgesPhrases, samples: report.samples.hedgesWords },
    { title: 'Vague Phrases', count: report.counts.vaguePhrases, samples: [] }, // Samples are handled via suggestions
    { title: 'Weasel Words', count: report.counts.weaselWords, samples: report.samples.weaselWords },
    { title: '-ly Adverbs', count: report.counts.adverbsLy, samples: report.samples.adverbsLy },
    { title: 'Nominalizations', count: report.counts.nominalizations, samples: report.samples.nominalizations },
    { title: 'Passive Voice (Est.)', count: report.counts.passiveEst, samples: [] },
  ];

  return (
    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
        <h3 className="text-xl font-semibold mb-4 text-slate-100">Fluff Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.filter(c => c.count > 0).map((cat) => (
                <div key={cat.title} className="bg-slate-700/50 p-4 rounded-lg">
                    <div className="flex justify-between items-baseline">
                        <h4 className="font-semibold text-slate-300">{cat.title}</h4>
                        <span className="text-lg font-bold text-cyan-400">{cat.count}</span>
                    </div>
                    {cat.samples.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-600/50 flex flex-wrap gap-2">
                            {cat.samples.map((word, i) => (
                                <span key={i} className="text-xs bg-slate-600 text-slate-300 px-2 py-1 rounded-full">
                                    {word}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    </div>
  );
};

export default SamplesDisplay;
