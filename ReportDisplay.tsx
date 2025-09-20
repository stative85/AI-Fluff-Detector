
import React from 'react';
import type { AnalysisReport } from '../types';
import StatCard from './StatCard';
import AnnotatedText from './AnnotatedText';
import SamplesDisplay from './SamplesDisplay';

interface ReportDisplayProps {
  report: AnalysisReport;
  originalText: string;
}

const ReportDisplay: React.FC<ReportDisplayProps> = ({ report, originalText }) => {
  
  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case 'FLUFF-FREE':
        return 'text-green-400';
      case 'MARGINAL PADDING':
        return 'text-yellow-400';
      case 'FLUFF OVERLOAD':
        return 'text-red-400';
      default:
        return 'text-slate-200';
    }
  };

  return (
    <div className="space-y-8">
      {/* Verdict & Top Stats */}
      <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
        <h2 className={`text-3xl font-bold text-center mb-4 ${getVerdictColor(report.verdict)}`}>
          {report.verdict}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <StatCard label="Word Count" value={report.wordCount.toString()} />
          <StatCard label="Total Hits" value={report.counts.totalHits.toString()} />
          <StatCard label="Fluff Ratio" value={`${report.hitRatioPercent}%`} />
        </div>
      </div>

      {/* Annotated Text */}
      <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
        <h3 className="text-xl font-semibold mb-4 text-slate-100">Annotated Text</h3>
        <div className="bg-slate-900 p-4 rounded-md max-h-96 overflow-y-auto">
            <AnnotatedText text={originalText} spans={report.mergedSpans} />
        </div>
      </div>
      
      {/* Suggestions */}
      {report.suggestions.length > 0 && (
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <h3 className="text-xl font-semibold mb-4 text-slate-100 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Quick Cuts
          </h3>
          <ul className="space-y-2">
            {report.suggestions.map((s, i) => (
              <li key={i} className="p-3 bg-slate-700/50 rounded-md text-slate-300">
                {s.split('→').map((part, index) => 
                  index === 1 ? <span key={index} className="font-mono bg-green-900/50 text-green-300 py-0.5 px-1.5 rounded">{part}</span> : <span key={index}>{part} →</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Detailed Counts & Samples */}
      <SamplesDisplay report={report} />

    </div>
  );
};

export default ReportDisplay;
