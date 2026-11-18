export type Trust = 'scraped' | 'founder-confirmed' | 'proposed';
export type Confidence = 'high' | 'medium' | 'low';

export interface Signal<T> {
  value: T;
  source: string;
  fetchedAt: string;
  status: Trust;
  confidence: Confidence;
}

export interface CompanyLocation {
  city: string | null;
  country: string;
  label: string;
  source: string;
  kind: 'primary' | 'office' | 'hiring' | 'announced';
}

export interface PublicSignals {
  locations?: CompanyLocation[];
  founded?: Signal<number>;
  website?: Signal<string>;
  funding?: Signal<{ label: string; announced: string }>;
  jobs?: Signal<{ count: number; roles: string[]; departments?: string[]; provider?: string; delta?: number; priorAt?: string }>;
  github?: Signal<{ repo: string; pushedAt: string; stars?: number }>;
  news?: Signal<{ title: string; url: string; date: string }[]>;
  identity?: Signal<{ name: string; description: string; website?: string; founded?: number; github?: string }>;
}

export interface RiskSnapshot {
  value: number | null;
  grade: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  coverage: number;
  provisional: boolean;
  asOf: string;
  trend: number | null;
  priorAt?: string;
  breakdown: { key: string; title: string; weight: number; points: number | null; basis?: 'directory'; signal?: Signal<unknown> }[];
}

export interface Dossier {
  id: string;
  name: string;
  city: string;
  sector: string;
  domain: string;
  description: string;
  source: string;
  asOf: string;
  signals: PublicSignals;
  risk: RiskSnapshot;
}

export type ResearchEvent =
  | { key: 'start'; value: string }
  | { key: 'identity'; value: PublicSignals['identity'] | null; status: 'observed' | 'unavailable' }
  | { key: 'news'; value: PublicSignals['news'] | null; status: 'observed' | 'unavailable' }
  | { key: 'engineering'; value: PublicSignals['github'] | null; status: 'observed' | 'unavailable' }
  | { key: 'score'; value: RiskSnapshot };
