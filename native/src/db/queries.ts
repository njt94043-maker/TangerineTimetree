/**
 * Supabase adapter — wraps shared/supabase/queries so that
 * screen-level imports stay unchanged.
 */

import * as SQ from '@shared/supabase/queries';
import { cacheSettings, getCachedSettings } from '../utils/offlineCache';
import type {
  Client as SupaClient,
  Venue as SupaVenue,
  VenuePhoto as SupaVenuePhoto,
  Invoice as SupaInvoice,
  InvoiceWithClient as SupaInvoiceWithClient,
  Receipt as SupaReceipt,
  ReceiptWithMember as SupaReceiptWithMember,
  UserSettings,
  BandSettings,
  DashboardStats as SupaDashboardStats,
  InvoiceStyle,
  Profile,
  QuoteStatus,
  EventType,
  PLIOption,
  ServiceCatalogueItem as SupaServiceCatalogueItem,
  Quote as SupaQuote,
  QuoteWithClient as SupaQuoteWithClient,
  QuoteLineItem as SupaQuoteLineItem,
  FormalInvoice as SupaFormalInvoice,
  FormalInvoiceWithClient as SupaFormalInvoiceWithClient,
  FormalInvoiceLineItem as SupaFormalInvoiceLineItem,
  FormalReceipt as SupaFormalReceipt,
} from '@shared/supabase/types';

// ─── Re-exported types ──────────────────────────────────
// Screens import these from '../db' — keep the same names

export type Client = SupaClient;
export type Venue = SupaVenue;
export type VenuePhoto = SupaVenuePhoto;
export type Invoice = SupaInvoice;
export type InvoiceWithClient = SupaInvoiceWithClient;
export type Receipt = SupaReceipt;
export type ReceiptWithMember = SupaReceiptWithMember;
export type DashboardStats = SupaDashboardStats;
export type ServiceCatalogueItem = SupaServiceCatalogueItem;
export type Quote = SupaQuote;
export type QuoteWithClient = SupaQuoteWithClient;
export type QuoteLineItem = SupaQuoteLineItem;
export type FormalInvoice = SupaFormalInvoice;
export type FormalInvoiceWithClient = SupaFormalInvoiceWithClient;
export type FormalInvoiceLineItem = SupaFormalInvoiceLineItem;
export type FormalReceipt = SupaFormalReceipt;
export type { QuoteStatus, EventType, PLIOption };

export interface GigBooksSettings {
  your_name: string;
  trading_as: string;
  business_type: string;
  website: string;
  email: string;
  phone: string;
  bank_account_name: string;
  bank_name: string;
  bank_sort_code: string;
  bank_account_number: string;
  payment_terms_days: number;
  next_invoice_number: number;
}

export interface BandMember {
  id: string;
  name: string;
  sort_order: number;
  is_self: number;
}

// Fields that belong to user_settings vs band_settings
const USER_FIELDS = new Set([
  'your_name', 'email', 'phone',
  'bank_account_name', 'bank_name', 'bank_sort_code', 'bank_account_number',
]);
const BAND_FIELDS = new Set([
  'trading_as', 'business_type', 'website', 'payment_terms_days',
]);

// ─── Settings ───────────────────────────────────────────

function buildSettings(
  userSettings: UserSettings | null,
  bandSettings: BandSettings | null,
): GigBooksSettings {
  return {
    your_name: userSettings?.your_name ?? '',
    email: userSettings?.email ?? '',
    phone: userSettings?.phone ?? '',
    bank_account_name: userSettings?.bank_account_name ?? '',
    bank_name: userSettings?.bank_name ?? '',
    bank_sort_code: userSettings?.bank_sort_code ?? '',
    bank_account_number: userSettings?.bank_account_number ?? '',
    trading_as: bandSettings?.trading_as ?? 'The Green Tangerine',
    business_type: bandSettings?.business_type ?? 'Live Music Entertainment',
    website: bandSettings?.website ?? 'www.thegreentangerine.com',
    payment_terms_days: bandSettings?.payment_terms_days ?? 14,
    next_invoice_number: bandSettings?.next_invoice_number ?? 1,
  };
}

export async function getSettings(): Promise<GigBooksSettings | null> {
  // Try cache first for instant load
  const cached = await getCachedSettings();

  // Fetch fresh from Supabase
  const freshPromise = Promise.all([
    SQ.getUserSettings(),
    SQ.getBandSettings(),
  ]).then(([us, bs]) => {
    cacheSettings(us, bs);
    return buildSettings(us, bs);
  });

  // If we have cache, return it immediately and refresh in background
  if (cached && (cached.userSettings || cached.bandSettings)) {
    freshPromise.catch(() => {}); // background refresh, ignore errors
    return buildSettings(cached.userSettings, cached.bandSettings);
  }

  // No cache — wait for network
  return freshPromise;
}

export async function updateSettings(updates: Partial<GigBooksSettings>): Promise<void> {
  const userUpdates: Record<string, unknown> = {};
  const bandUpdates: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(updates)) {
    if (USER_FIELDS.has(key)) userUpdates[key] = value;
    else if (BAND_FIELDS.has(key)) bandUpdates[key] = value;
    // next_invoice_number is managed by RPC, ignore here
  }

  const promises: Promise<void>[] = [];
  if (Object.keys(userUpdates).length > 0) {
    promises.push(SQ.upsertUserSettings(userUpdates as Partial<Omit<UserSettings, 'id' | 'updated_at'>>));
  }
  if (Object.keys(bandUpdates).length > 0) {
    promises.push(SQ.updateBandSettings(bandUpdates as Partial<Pick<BandSettings, 'trading_as' | 'business_type' | 'website' | 'payment_terms_days'>>));
  }
  await Promise.all(promises);
}

// ─── Band Members (mapped from Profiles) ────────────────

export async function getBandMembers(): Promise<BandMember[]> {
  const profiles = await SQ.getProfiles();
  return profiles.map((p: Profile, i: number) => ({
    id: p.id,
    name: p.name,
    sort_order: i + 1,
    is_self: p.is_admin ? 1 : 0,
  }));
}

export async function getOtherBandMembers(): Promise<BandMember[]> {
  const all = await getBandMembers();
  return all.filter(m => !m.is_self);
}

export async function updateBandMember(_id: string, _name: string): Promise<void> {
  // No-op: profiles are managed via Supabase auth, not editable from settings
}

// ─── Clients ────────────────────────────────────────────

export const getClients = SQ.getClients;
export const getClient = SQ.getClient;
export const updateClient = SQ.updateClient;
export const deleteClient = SQ.deleteClient;
export const searchClients = SQ.searchClients;

export async function addClient(client: {
  company_name: string;
  contact_name: string;
  address: string;
  email: string;
  phone: string;
}): Promise<Client> {
  return SQ.createClient(client);
}

// ─── Venues ─────────────────────────────────────────────

export const getVenues = SQ.getVenues;
export const getVenue = SQ.getVenue;
export const searchVenues = SQ.searchVenues;
export const updateVenue = SQ.updateVenue;
export const deleteVenue = SQ.deleteVenue;

export async function addVenue(
  venueOrClientId: { venue_name: string; address?: string; postcode?: string } | string,
  venueName?: string,
): Promise<Venue> {
  return SQ.createVenue(venueOrClientId, venueName);
}

// ─── Venue Photos ──────────────────────────────────────

export const getVenuePhotos = SQ.getVenuePhotos;
export const uploadVenuePhoto = SQ.uploadVenuePhoto;
export const deleteVenuePhoto = SQ.deleteVenuePhoto;

// ─── Invoices ───────────────────────────────────────────

export const getInvoices = SQ.getInvoices;
export const getInvoice = SQ.getInvoice;
export const updateInvoiceStatus = SQ.updateInvoiceStatus;
export const markInvoicePaid = SQ.markInvoicePaid;
export const getDashboardStats = SQ.getDashboardStats;

export async function createInvoice(data: {
  client_id: string;
  venue: string;
  venue_id?: string | null;
  gig_date: string;
  amount: number;
  description: string;
  style?: InvoiceStyle;
}): Promise<Invoice> {
  return SQ.createInvoice({
    ...data,
    style: (data.style ?? 'classic') as InvoiceStyle,
  });
}

export async function updateInvoice(
  id: string,
  updates: Partial<Pick<Invoice, 'venue' | 'venue_id' | 'gig_date' | 'amount' | 'description' | 'due_date' | 'style'>>,
): Promise<void> {
  return SQ.updateInvoice(id, updates);
}

export async function deleteInvoice(id: string): Promise<string[]> {
  await SQ.deleteInvoice(id);
  return []; // No pdf_uri cleanup needed — PDFs generated on demand
}

// No-ops: PDFs are generated on demand, not persisted
export async function updateInvoicePdfUri(_id: string, _uri: string): Promise<void> {}
export async function updateInvoiceStyle(_id: string, _style: InvoiceStyle): Promise<void> {
  await SQ.updateInvoice(_id, { style: _style as InvoiceStyle });
}

// ─── Receipts ───────────────────────────────────────────

export const getReceiptsForInvoice = SQ.getReceiptsForInvoice;

export async function createReceipts(invoiceId: string): Promise<ReceiptWithMember[]> {
  // Shared markInvoicePaid creates receipts + marks paid in one step
  return SQ.markInvoicePaid(invoiceId);
}

// No-op: PDFs are generated on demand
export async function updateReceiptPdfUri(_id: string, _uri: string): Promise<void> {}

// ─── Service Catalogue ──────────────────────────────────

export const getServiceCatalogue = SQ.getServiceCatalogue;
export const getAllServiceCatalogue = SQ.getAllServiceCatalogue;
export const createServiceItem = SQ.createServiceItem;
export const updateServiceItem = SQ.updateServiceItem;
export const deleteServiceItem = SQ.deleteServiceItem;

// ─── Quotes ─────────────────────────────────────────────

export const getQuotes = SQ.getQuotes;
export const getQuote = SQ.getQuote;
export const getQuoteLineItems = SQ.getQuoteLineItems;
export const sendQuote = SQ.sendQuote;
export const acceptQuote = SQ.acceptQuote;
export const declineQuote = SQ.declineQuote;
export const expireQuote = SQ.expireQuote;

export async function createQuote(data: {
  client_id: string;
  venue_id?: string | null;
  event_type: EventType;
  event_date: string;
  venue_name: string;
  venue_address?: string;
  subtotal: number;
  discount_amount?: number;
  total: number;
  pli_option?: PLIOption;
  terms_and_conditions?: string;
  validity_days?: number;
  notes?: string;
  style?: InvoiceStyle;
  line_items: Array<{
    service_id?: string | null;
    description: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    sort_order?: number;
  }>;
}): Promise<Quote> {
  return SQ.createQuote(data);
}

export async function deleteQuote(id: string): Promise<void> {
  await SQ.deleteQuote(id);
}

// ─── Formal Invoices ────────────────────────────────────

export const getFormalInvoice = SQ.getFormalInvoice;
export const getFormalInvoiceByQuote = SQ.getFormalInvoiceByQuote;
export const getFormalInvoiceLineItems = SQ.getFormalInvoiceLineItems;
export const sendFormalInvoice = SQ.sendFormalInvoice;
export const markFormalInvoicePaid = SQ.markFormalInvoicePaid;
export const getFormalReceipts = SQ.getFormalReceipts;

// ─── Extended Band Settings ─────────────────────────────

export const updateBandSettingsExtended = SQ.updateBandSettingsExtended;
export const getBandSettings = SQ.getBandSettings;
