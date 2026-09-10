import type { HealthScoreReport } from './types';
import type { BudgetAdvice } from './budget-advisor';
import type { DiversityReport } from './creative-diversity';
import type { TrackingHealthReport } from './tracking-health';
import type { PpcReport } from './ppc-math';
import type { AttributionReport } from './attribution';
import type { LandingScoreReport } from './landing-score';

export type AuditReportInput = {
  brandName?: string | null;
  health: HealthScoreReport;
  tracking?: TrackingHealthReport | null;
  diversity?: DiversityReport | null;
  budget?: BudgetAdvice | null;
  ppc?: PpcReport | null;
  attribution?: AttributionReport | null;
  landing?: LandingScoreReport | null;
};

/** Client-ready HTML audit (print → PDF). */
export function buildAuditHtml(input: AuditReportInput): string {
  const brand = input.brandName || 'Ad account';
  const h = input.health;
  const pillarRows = (Object.keys(h.pillars) as Array<keyof typeof h.pillars>)
    .map((p) => {
      const pillar = h.pillars[p];
      return `<tr><td>${p}</td><td>${pillar.score}</td><td>${Math.round(pillar.weight * 100)}%</td></tr>`;
    })
    .join('');

  const wins = h.quickWins
    .map(
      (w) =>
        `<li><strong>${w.id} ${w.title}</strong> — ${w.evidence}${
          w.recommendation ? ` · <em>${w.recommendation}</em>` : ''
        }</li>`
    )
    .join('');

  const kills = h.killList
    .map((k) => `<li>${k.name}: ${k.reason} (${k.metric})</li>`)
    .join('') || '<li>None</li>';
  const scales = h.scaleList
    .map(
      (k) =>
        `<li>${k.name}: ${k.reason}${
          k.nextBudget != null ? ` → ₹${k.nextBudget}/day` : ''
        }</li>`
    )
    .join('') || '<li>None</li>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Meta Ads Health Audit — ${escapeHtml(brand)}</title>
<style>
  body{font-family:ui-sans-serif,system-ui,sans-serif;max-width:880px;margin:40px auto;padding:0 20px;color:#0b1b33;line-height:1.45}
  h1{font-size:28px;margin:0 0 4px} .meta{color:#64748b;font-size:13px}
  .score{font-size:56px;font-weight:800;letter-spacing:-.03em}
  .grade{display:inline-block;background:#1877f2;color:#fff;padding:4px 12px;border-radius:8px;font-weight:700}
  table{width:100%;border-collapse:collapse;margin:16px 0}
  th,td{border-bottom:1px solid #e2e8f0;text-align:left;padding:8px 6px;font-size:14px}
  section{margin:28px 0} ul{padding-left:18px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  @media print{body{margin:12px}}
</style>
</head>
<body>
  <header>
    <h1>${escapeHtml(brand)} — Meta Ads Health Audit</h1>
    <p class="meta">Generated ${escapeHtml(h.generatedAt)} · AdForge Optimize</p>
    <p><span class="score">${h.score}</span> <span class="grade">Grade ${h.grade}</span></p>
  </header>
  <section>
    <h2>Pillars</h2>
    <table><thead><tr><th>Pillar</th><th>Score</th><th>Weight</th></tr></thead>
    <tbody>${pillarRows}</tbody></table>
  </section>
  <section>
    <h2>Quick wins</h2>
    <ul>${wins || '<li>No critical gaps</li>'}</ul>
  </section>
  <div class="grid">
    <section><h2>Kill list</h2><ul>${kills}</ul></section>
    <section><h2>Scale list</h2><ul>${scales}</ul></section>
  </div>
  ${
    input.tracking
      ? `<section><h2>Tracking</h2><p>Score ${input.tracking.score} (${input.tracking.grade})</p>
         <ul>${input.tracking.issues.map((i) => `<li>${escapeHtml(i.title)}: ${escapeHtml(i.detail)}</li>`).join('')}</ul></section>`
      : ''
  }
  ${
    input.diversity
      ? `<section><h2>Creative diversity</h2><p>Score ${input.diversity.diversityScore} · formats ${input.diversity.formatCount} · concepts ${input.diversity.conceptCount}</p>
         <ul>${input.diversity.recommendations.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul></section>`
      : ''
  }
  ${
    input.budget
      ? `<section><h2>Budget advice</h2><p>${input.budget.recommendedModel} · ${input.budget.biddingStrategy}</p>
         <ul>${input.budget.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul></section>`
      : ''
  }
  ${
    input.ppc
      ? `<section><h2>PPC math</h2>
         <p>Break-even CPA ₹${input.ppc.breakEvenCpa.toFixed(0)} · Target CPA ₹${input.ppc.targetCpa.toFixed(0)} · Target ROAS ${input.ppc.targetRoas.toFixed(2)}x</p>
         <ul>${input.ppc.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul></section>`
      : ''
  }
  ${
    input.attribution
      ? `<section><h2>Attribution</h2><p>Score ${input.attribution.score} · prefer ${escapeHtml(input.attribution.recommendedWindow)}</p></section>`
      : ''
  }
  ${
    input.landing
      ? `<section><h2>Landing page</h2><p>Score ${input.landing.score} (${input.landing.grade})</p>
         <ul>${input.landing.quickWins.map((q) => `<li>${escapeHtml(q)}</li>`).join('')}</ul></section>`
      : ''
  }
  <footer class="meta">Confidential — generated for subscription client reporting.</footer>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
