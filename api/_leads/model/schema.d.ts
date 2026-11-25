/** Stable v1 contract. Changes after merge require an explicit migration. */
export declare const SCHEMA_VERSION: 1;
export declare const STATUSES: readonly ["new", "contacted", "call", "offer_sent", "won", "lost"];
export type LeadStatus = typeof STATUSES[number];
export type Source = 'reddit' | 'x' | 'places' | 'warm';
export type Urgency = 'urgent' | 'this_week' | 'normal' | 'unknown';
export interface Offer {
    tier: string;
    title: string;
    scope: string;
    price: number;
    currency: 'EUR';
    delivery: string;
    upfront_percent: number;
    upfront_amount: number;
    pay_link: string;
    text: string;
    note: string;
}
export interface Lead {
    id: string;
    source: Source;
    name: string;
    contact: string;
    need: string;
    budget_min: number | null;
    budget_max: number | null;
    currency: string;
    urgency: Urgency;
    warm: boolean;
    next_action: string;
    status: LeadStatus;
    offer: Offer | null;
    url?: string;
    snippet?: string;
    score?: number;
    posted_at?: string | null;
    first_seen_at?: string;
    expires_at?: string;
    updated_at?: string;
    revision?: number;
    contact_kind?: string;
    handle?: string;
    evidence?: Record<string, unknown>;
    outreach?: {
        body: string;
        subject: string;
        url: string;
        ready: boolean;
        missing: string[];
    };
    reasons?: Array<{
        label: string;
        points: number;
    }>;
    note?: string;
    city?: string;
}
export interface Tier {
    id: string;
    name: string;
    min: number;
    max: number;
    price: number;
    currency: string;
    scope: string;
    delivery: string;
    upfront_percent: number;
}
export declare function validHttps(value: unknown): string;
export declare function validateLead(input: Partial<Lead>, now?: string): Lead;
export declare function makeOffer(lead: Lead, tiers: Tier[], payLink?: string): Offer;
export declare function canStartBuild(lead: Lead): boolean;
export declare function draftLink(contact: string, kind: string, body: string, subject?: string): string;
