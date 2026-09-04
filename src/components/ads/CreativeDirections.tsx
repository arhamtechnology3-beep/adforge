'use client';

import { Loader2, Sparkles } from 'lucide-react';

export type CreativeDirectionCard = {
  conceptId: string;
  name: string;
  angle: string;
  emotion: string;
  hook: string;
  visualStory: string;
  headline: string;
  primaryText: string;
  cta: string;
  recommendedFormats: string[];
};

export type CompetitorPatternCard = {
  sourceId: string;
  hook: string;
  marketingAngle: string;
  emotionalTrigger: string;
  visualStrategy: string;
};

export function CreativeDirections(props: {
  patterns: CompetitorPatternCard[];
  directions: CreativeDirectionCard[];
  selectedIds: string[];
  loading?: boolean;
  onToggle: (conceptId: string) => void;
  onGenerate: () => void;
  generating?: boolean;
}) {
  return (
    <div className="space-y-4">
      {props.patterns.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-2">Winning patterns detected</h3>
          <div className="flex flex-wrap gap-2">
            {props.patterns.slice(0, 4).map((pattern) => (
              <span
                key={pattern.sourceId}
                className="text-xs px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700"
              >
                {pattern.marketingAngle} · {pattern.emotionalTrigger}
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            We use these as strategy signals only — your creatives will be original, not copies.
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {props.directions.map((direction) => {
          const selected = props.selectedIds.includes(direction.conceptId);
          return (
            <button
              key={direction.conceptId}
              type="button"
              onClick={() => props.onToggle(direction.conceptId)}
              className={`text-left rounded-2xl border p-4 transition ${
                selected
                  ? 'border-indigo-400 bg-indigo-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-indigo-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-bold text-slate-900 text-sm">{direction.name}</h4>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {selected ? 'Selected' : 'Tap to select'}
                </span>
              </div>
              <p className="text-xs text-indigo-700 mt-2 font-medium">{direction.hook}</p>
              <p className="text-xs text-slate-600 mt-2 line-clamp-3">{direction.visualStory}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {direction.recommendedFormats.map((format) => (
                  <span
                    key={format}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600"
                  >
                    {format}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Select up to 3 directions. Each generates distinct image, story, carousel, and video variants.
        </p>
        <button
          type="button"
          className="btn-primary text-sm inline-flex items-center gap-2"
          disabled={props.generating || props.selectedIds.length === 0}
          onClick={props.onGenerate}
        >
          {props.generating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          Generate creative pack
        </button>
      </div>
    </div>
  );
}
