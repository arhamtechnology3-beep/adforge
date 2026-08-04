export type ReportViewId =
  | 'executive'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'pacing'
  | 'policy_actions'
  | 'delivery_issues'
  | 'spend_budget'
  | 'efficiency'
  | 'cpa_trends'
  | 'roas'
  | 'frequency'
  | 'engagement_video'
  | 'creative_leaderboard'
  | 'fatigue'
  | 'format_mix'
  | 'audience'
  | 'placement'
  | 'device'
  | 'age_gender'
  | 'geo'
  | 'funnel'
  | 'dropoff'
  | 'sku_roas'
  | 'new_returning'
  | 'aov'
  | 'recommendations'
  | 'audit_trail'
  | 'ab_tests'
  | 'best_of'
  | 'weekly_checklist'
  | 'monthly_strategy';

export type ReportGroup =
  | 'Overview'
  | 'Delivery'
  | 'Efficiency'
  | 'Creative'
  | 'Audience'
  | 'Funnel'
  | 'Agent'
  | 'Strategy';

export type ReportCatalogItem = {
  id: ReportViewId;
  group: ReportGroup;
  title: string;
  description: string;
  needs?: Array<'meta' | 'shopify' | 'phase2'>;
};

export const REPORT_CATALOG: ReportCatalogItem[] = [
  { id: 'executive', group: 'Overview', title: 'Executive dashboard', description: 'Spend, ROAS, CPA, CTR, purchases, health' },
  { id: 'daily', group: 'Overview', title: 'Daily performance', description: 'Day-by-day metrics table' },
  { id: 'weekly', group: 'Overview', title: 'Weekly summary', description: 'WoW deltas and wins/losses' },
  { id: 'monthly', group: 'Overview', title: 'Monthly summary', description: 'MoM budget vs spend' },
  { id: 'pacing', group: 'Delivery', title: 'Delivery / pacing', description: 'Over/under daily budget' },
  { id: 'policy_actions', group: 'Delivery', title: 'Disapprovals & policy', description: 'Policy Guard actions' },
  { id: 'delivery_issues', group: 'Delivery', title: 'Learning & delivery', description: 'Delivery health board' },
  { id: 'spend_budget', group: 'Efficiency', title: 'Spend & budget', description: 'Utilization vs caps' },
  { id: 'efficiency', group: 'Efficiency', title: 'CPC / CPM / CTR', description: 'Efficiency trends' },
  { id: 'cpa_trends', group: 'Efficiency', title: 'CPA trends', description: 'Cost per purchase over time' },
  { id: 'roas', group: 'Efficiency', title: 'ROAS & CVR', description: 'Return and conversion rate' },
  { id: 'frequency', group: 'Efficiency', title: 'Frequency & reach', description: 'Saturation risk' },
  { id: 'engagement_video', group: 'Efficiency', title: 'Engagement & video', description: 'Video views and engagement' },
  { id: 'creative_leaderboard', group: 'Creative', title: 'Creative leaderboard', description: 'Ads ranked by CTR/CPA' },
  { id: 'fatigue', group: 'Creative', title: 'Fatigue watchlist', description: 'Frequency up, CTR down' },
  { id: 'format_mix', group: 'Creative', title: 'Format mix', description: '1:1 / carousel / stories / video' },
  { id: 'audience', group: 'Audience', title: 'Audience performance', description: 'Ad sets / interest buckets', needs: ['meta'] },
  { id: 'placement', group: 'Audience', title: 'Placement breakdown', description: 'Feed, Stories, Reels, AN', needs: ['meta'] },
  { id: 'device', group: 'Audience', title: 'Device', description: 'Android / iOS / Desktop', needs: ['meta'] },
  { id: 'age_gender', group: 'Audience', title: 'Age & gender', description: 'Demographic split', needs: ['meta'] },
  { id: 'geo', group: 'Audience', title: 'Geo', description: 'India state / city', needs: ['meta'] },
  { id: 'funnel', group: 'Funnel', title: 'Funnel', description: 'Impression → Purchase' },
  { id: 'dropoff', group: 'Funnel', title: 'Drop-off analysis', description: 'Biggest leak stage' },
  { id: 'sku_roas', group: 'Funnel', title: 'Product / SKU ROAS', description: 'Top products', needs: ['shopify'] },
  { id: 'new_returning', group: 'Funnel', title: 'New vs returning', description: 'Customer mix', needs: ['shopify'] },
  { id: 'aov', group: 'Funnel', title: 'AOV & purchase CVR', description: 'Order value proxies', needs: ['shopify'] },
  { id: 'recommendations', group: 'Agent', title: 'Recommendations log', description: 'Pending / applied / rejected' },
  { id: 'audit_trail', group: 'Agent', title: 'Auto-pause & policy audit', description: 'Agent actions history' },
  { id: 'ab_tests', group: 'Agent', title: 'A/B test board', description: 'Structure ready', needs: ['phase2'] },
  { id: 'best_of', group: 'Strategy', title: 'Best creatives / audiences', description: 'Ranked winners + next steps' },
  { id: 'weekly_checklist', group: 'Strategy', title: 'Weekly optimization checklist', description: 'Auto from rules' },
  { id: 'monthly_strategy', group: 'Strategy', title: 'Monthly strategic review', description: 'ROI and planning pack' },
];

export type ReportResult = {
  view: ReportViewId;
  title: string;
  dryRun: boolean;
  kpis: Array<{ label: string; value: string; hint?: string }>;
  series?: Array<Record<string, string | number>>;
  table?: { columns: string[]; rows: Array<Array<string | number>> };
  notes?: string[];
  chips?: string[];
};
