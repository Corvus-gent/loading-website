import { type Lead, type Tier } from './schema.js';
export declare const SCORE_VERSION: 1;
export interface Evidence {
    account_created_at?: string;
    karma?: number;
    followers?: number;
    past_hires?: number;
    payment_verified?: boolean;
    business_url?: string;
    linkedin_url?: string;
    responded_in_thread?: boolean;
    copy_paste_spam?: boolean;
    origin_platform?: string;
    hourly?: boolean;
}
export interface Fx {
    date: string;
    eur_per_unit: Record<string, number>;
}
export interface Flag {
    id: string;
    label: string;
    penalty: number;
    critical: boolean;
}
export interface Assessment {
    version: number;
    score: number;
    breakdown: {
        pay: number;
        urgency: number;
        trust: number;
        fit: number;
        reachability: number;
        penalties: number;
    };
    red_flags: Flag[];
    budget_eur: {
        min: number;
        max: number;
        mid: number;
    } | null;
    budget_basis: string;
    close_probability: number;
    expected_value: number | null;
    why: string;
    suggested_tier: string;
    missing: string[];
    fx_date: string | null;
}
export declare function suggestedTier(need: string): string;
export declare function parseBudget(text: string): {
    budget_min: number | null;
    budget_max: number | null;
    currency: string;
    hourly: boolean;
};
export declare function assess(lead: Lead, tiers: Tier[], fx?: Fx, now?: number): Assessment;
export declare function rankByValue<T extends {
    id: string;
    assessment: Assessment;
}>(leads: T[]): T[];
