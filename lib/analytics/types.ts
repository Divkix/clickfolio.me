export interface AnalyticsStats {
  pageviews: number;
  visitors: number;
  visits?: number;
  bounces?: number;
  totaltime?: number;
  comparison?: {
    pageviews?: number;
    visitors?: number;
    visits?: number;
    bounces?: number;
    totaltime?: number;
  };
}

export interface AnalyticsPageviews {
  pageviews: { x: string; y: number }[];
  sessions: { x: string; y: number }[];
}

export interface AnalyticsMetric {
  x: string;
  y: number;
}

export interface StatsOptions {
  startAt: number;
  endAt: number;
  path?: string;
}

export interface PageviewsOptions {
  startAt: number;
  endAt: number;
  unit: string;
  timezone: string;
  path?: string;
}

export interface MetricsOptions {
  startAt: number;
  endAt: number;
  type: string;
  unit: string;
  timezone: string;
  path?: string;
  limit?: number;
}
