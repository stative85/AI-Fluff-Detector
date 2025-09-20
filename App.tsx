import React, { useState } from "react";
import { analyze, rewrite, Report } from "./services/analyze";

export default function App() {
  const [text, setText] = useState("You know, basically, this is really important at this point in time due to the fact that it's kind of essential.");
  const [report, setReport] = useState<Report | null>(null);
  const [mode, setMode] = useState<"analyze"|"rewrite">("analyze");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  const onAnalyze = async () => {
    if (!text.trim()) { setError("Give me something to cut."); return; }
    setError(null); setLoading(true);
    setTimeout(() => { // UX fake-latency
      try { 
        const analysisResult = analyze(text);
        setReport(analysisResult);
        setMode("analyze"); // Switch back to analyze mode on new analysis
      }
      catch (e:any) { setError(e?.message || "Analysis failed."); }
      finally { setLoading(false); }
    }, 200);
  };

  const exportJSON = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "fluff_report.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const rewritten = mode==="rewrite" && text ? rewrite(text) : null;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans">
      <header className="px-6 py-4 border-b border-slate-800 sticky top-0 bg-slate-900/70 backdrop-blur-sm z-10">
        <h1 className="text-xl md:text-2xl font-bold tracking-wide">
          AI Fluff Detector <span className="text-rose-400">/ brutal cut</span>
        </h1>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 grid gap-6 md:grid-cols-2">
        {/* Input */}
        <section className="space-y-4">
          <textarea
            value={text}
            onChange={e=>setText(e.target.value)}
            className="w-full h-64 p-4 bg-slate-950/70 border border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
            placeholder="Paste the suspect paragraph, deck, or press release..."
          />
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={onAnalyze}
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 font-semibold transition-colors disabled:bg-slate-600 disabled:cursor-wait">
              {loading ? "Sharpening…" : "Analyze"}
            </button>
            <button onClick={()=>setMode(mode==="analyze"?"rewrite":"analyze")}
              disabled={!text.trim()}
              className="px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {mode==="analyze" ? "Rewrite Preview" : "Back to Analysis"}
            </button>
            {report && (
              <button onClick={exportJSON}
                className="px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors">
                Export JSON
              </button>
            )}
            {error && <span className="text-amber-400 text-sm">{error}</span>}
          </div>
        </section>

        {/* Output */}
        <section className="space-y-4">
          {mode==="rewrite" && rewritten && (
            <div className="p-4 bg-emerald-900/30 border border-emerald-700 rounded-lg animate-fade-in">
              <div className="text-emerald-300 font-semibold mb-2">Rewrite (Safe Cuts)</div>
              <p className="leading-7 whitespace-pre-wrap">{rewritten}</p>
            </div>
          )}

          {mode==="analyze" && report && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-lg">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm uppercase tracking-wider text-slate-400">Verdict</div>
                    <div className="text-xl font-bold">
                      {report.verdict}
                    </div>
                     <div className="text-slate-400 text-sm">({report.hitRatioPercent}% / {report.totalHits} hits, {report.wordCount} words)</div>
                  </div>
                  {report.cuts.length > 0 && (
                    <div className="text-right flex-shrink-0">
                        <div className="text-sm uppercase tracking-wider text-slate-400">Cuts</div>
                        <ul className="text-sm text-slate-300">{report.cuts.map((c,i)=><li key={i}>{c.replace("→", "→ ")}</li>)}</ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Heatmap */}
              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-lg">
                <div className="text-slate-300 font-semibold mb-3">Sentence Heatmap</div>
                <div className="space-y-3">
                  {report.sentences.map((s,i)=>{
                    const pct = Math.min(100, Math.round(s.ratio));
                    const hue = s.verdict==="OK" ? "bg-emerald-600" : s.verdict==="WARN" ? "bg-amber-600" : "bg-rose-600";
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="w-10 text-right font-mono text-slate-400">{pct}%</span>
                          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-2 ${hue} rounded-full`} style={{width:`${pct}%`}}/>
                          </div>
                          <span className={`w-16 font-semibold text-right ${s.verdict === 'OK' ? 'text-emerald-400' : s.verdict === 'WARN' ? 'text-amber-400' : 'text-rose-400'}`}>{s.verdict}</span>
                        </div>
                        <div className="text-sm text-slate-400 leading-relaxed pl-12">{s.text}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Annotated */}
              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-lg">
                <div className="text-slate-300 font-semibold mb-2">Annotated Full Text</div>
                <div className="text-slate-300 leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{__html: report.annotatedHTML.replace(/class="[^"]*"/, 'class="bg-rose-700/40 text-rose-200 rounded px-1"')}} />
              </div>
            </div>
          )}
          
          {!report && !loading && (
            <div className="p-8 text-center bg-slate-950/50 border border-dashed border-slate-700 rounded-lg">
                <p className="text-slate-500">Analysis results will appear here.</p>
            </div>
          )}

           {loading && (
             <div className="p-8 flex justify-center items-center space-x-3 bg-slate-800/50 rounded-lg">
                <svg className="animate-spin h-8 w-8 text-rose-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-lg text-slate-400">Running analysis...</span>
             </div>
          )}

        </section>
      </main>
    </div>
  );
}
