import { useState, useEffect, useRef } from 'react';
import {
  getClients, searchClients, createClient, createQuote,
  getUserSettings, getBandSettings, getServiceCatalogue,
} from '@shared/supabase/queries';
import type { Client, UserSettings, BandSettings, ServiceCatalogueItem, EventType, PLIOption, InvoiceStyle } from '@shared/supabase/types';
import type { QuoteTemplateData } from '@shared/templates';
import { getQuoteHtml, INVOICE_STYLES, DEFAULT_INVOICE_STYLE } from '@shared/templates';
import { formatDateLong, todayISO, addDaysISO, formatGBP } from '../utils/format';
import { ErrorAlert } from './ErrorAlert';

interface QuoteFormProps {
  onClose: () => void;
  onSaved: (quoteId: string) => void;
}

interface LineItem {
  key: string;
  service_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
}

const STEP_LABELS = ['Client & Event', 'Package', 'Extras', 'Preview'];

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'wedding', label: 'Wedding' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'private', label: 'Private Party' },
  { value: 'festival', label: 'Festival' },
  { value: 'other', label: 'Other' },
];

let keyCounter = 0;
function nextKey() { return `li-${++keyCounter}`; }

export function QuoteForm({ onClose, onSaved }: QuoteFormProps) {
  const [step, setStep] = useState(1);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [bandSettings, setBandSettings] = useState<BandSettings | null>(null);
  const [error, setError] = useState('');

  // Step 1 — Client & Event
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newCompany, setNewCompany] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [eventType, setEventType] = useState<EventType>('wedding');
  const [eventDate, setEventDate] = useState(todayISO());
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');

  // Step 2 — Package builder
  const [services, setServices] = useState<ServiceCatalogueItem[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState('0');

  // Step 3 — Extras
  const [pliOption, setPliOption] = useState<PLIOption>('none');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [validityDays, setValidityDays] = useState(30);
  const [notes, setNotes] = useState('');

  // Step 4 — Preview
  const [selectedStyle, setSelectedStyle] = useState<InvoiceStyle>(DEFAULT_INVOICE_STYLE);
  const [previewHtmls, setPreviewHtmls] = useState<{ id: InvoiceStyle; name: string; description: string; html: string }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [generating, setGenerating] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load settings + clients + services on mount
  useEffect(() => {
    Promise.all([getUserSettings(), getBandSettings(), getServiceCatalogue()]).then(([us, bs, svc]) => {
      setUserSettings(us);
      setBandSettings(bs);
      setServices(svc);
      if (bs) {
        setTermsAndConditions(bs.default_terms_and_conditions ?? '');
        setValidityDays(bs.default_quote_validity_days ?? 30);
      }
    }).catch(() => setError('Failed to load settings'));
    loadClients();
  }, []);

  async function loadClients() {
    try {
      const list = clientSearch.trim() ? await searchClients(clientSearch.trim()) : await getClients();
      setClients(list);
    } catch { /* client list non-critical */ }
  }

  useEffect(() => { loadClients(); }, [clientSearch]);

  // Computed totals
  const subtotal = lineItems.reduce((s, li) => s + li.quantity * li.unit_price, 0);
  const discount = parseFloat(discountAmount) || 0;
  const total = Math.max(0, subtotal - discount);

  // --- Client selection ---
  function selectClient(client: Client) {
    setSelectedClient(client);
  }

  async function saveNewClient() {
    if (!newCompany.trim()) { setError('Company name is required'); return; }
    setError('');
    try {
      const client = await createClient({
        company_name: newCompany.trim(),
        contact_name: newContact.trim(),
        address: newAddress.trim(),
        email: newEmail.trim(),
        phone: newPhone.trim(),
      });
      setShowNewClient(false);
      setNewCompany(''); setNewContact(''); setNewAddress(''); setNewEmail(''); setNewPhone('');
      selectClient(client);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create client');
    }
  }

  // --- Step navigation ---
  function goToStep2() {
    if (!selectedClient) { setError('Select a client'); return; }
    if (!venueName.trim()) { setError('Venue name is required'); return; }
    setError('');
    setStep(2);
  }

  function goToStep3() {
    if (lineItems.length === 0) { setError('Add at least one line item'); return; }
    setError('');
    setStep(3);
  }

  function goToStep4() {
    if (!userSettings || !bandSettings || !selectedClient) return;
    setError('');

    const templateData: QuoteTemplateData = {
      quoteNumber: 'PREVIEW',
      quoteDate: formatDateLong(todayISO()),
      validUntil: formatDateLong(addDaysISO(todayISO(), validityDays)),
      fromName: userSettings.your_name,
      tradingAs: bandSettings.trading_as,
      businessType: bandSettings.business_type,
      website: bandSettings.website,
      toCompany: selectedClient.company_name,
      toContact: selectedClient.contact_name,
      toAddress: selectedClient.address,
      toEmail: selectedClient.email,
      toPhone: selectedClient.phone,
      eventType: EVENT_TYPES.find(e => e.value === eventType)?.label ?? eventType,
      eventDate: formatDateLong(eventDate),
      venueName: venueName.trim(),
      venueAddress: venueAddress.trim(),
      lineItems: lineItems.map(li => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unit_price,
        lineTotal: li.quantity * li.unit_price,
      })),
      subtotal,
      discountAmount: discount,
      total,
      pliOption,
      pliInsurer: bandSettings.pli_insurer ?? '',
      pliPolicyNumber: bandSettings.pli_policy_number ?? '',
      pliCoverAmount: bandSettings.pli_cover_amount ?? '',
      pliExpiryDate: bandSettings.pli_expiry_date ? formatDateLong(bandSettings.pli_expiry_date) : '',
      termsAndConditions,
      validityDays,
      notes,
    };

    const previews = INVOICE_STYLES.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      html: getQuoteHtml(s.id, templateData),
    }));

    setPreviewHtmls(previews);
    const prefIndex = previews.findIndex(p => p.id === selectedStyle);
    setCurrentIndex(prefIndex >= 0 ? prefIndex : 0);
    setStep(4);
  }

  // --- Line item helpers ---
  function addServiceItem(svc: ServiceCatalogueItem) {
    setLineItems(items => [...items, {
      key: nextKey(),
      service_id: svc.id,
      description: svc.name + (svc.description ? ` — ${svc.description}` : ''),
      quantity: 1,
      unit_price: svc.default_price,
    }]);
  }

  function addCustomItem() {
    setLineItems(items => [...items, {
      key: nextKey(),
      service_id: null,
      description: '',
      quantity: 1,
      unit_price: 0,
    }]);
  }

  function updateLineItem(key: string, field: keyof LineItem, value: string | number) {
    setLineItems(items => items.map(li => li.key === key ? { ...li, [field]: value } : li));
  }

  function removeLineItem(key: string) {
    setLineItems(items => items.filter(li => li.key !== key));
  }

  // --- Create quote ---
  async function handleCreate() {
    if (!selectedClient) return;
    const style = previewHtmls[currentIndex]?.id || DEFAULT_INVOICE_STYLE;
    setSelectedStyle(style);
    setGenerating(true);
    setError('');
    try {
      const quote = await createQuote({
        client_id: selectedClient.id,
        event_type: eventType,
        event_date: eventDate,
        venue_name: venueName.trim(),
        venue_address: venueAddress.trim(),
        subtotal,
        discount_amount: discount,
        total,
        pli_option: pliOption,
        terms_and_conditions: termsAndConditions,
        validity_days: validityDays,
        notes,
        style,
        line_items: lineItems.map((li, i) => ({
          service_id: li.service_id,
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unit_price,
          line_total: li.quantity * li.unit_price,
          sort_order: i,
        })),
      });
      onSaved(quote.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create quote');
    } finally {
      setGenerating(false);
    }
  }

  function goBackStep() {
    if (step === 1) onClose();
    else setStep(s => (s - 1) as 1 | 2 | 3);
  }

  const currentPreview = previewHtmls[currentIndex];

  return (
    <div className="form-wrap form-top">
      <div className="page-header">
        <button className="btn btn-small btn-green" onClick={goBackStep}>
          {step === 1 ? '\u25C0 Cancel' : '\u25C0 Back'}
        </button>
        <h2 className="page-title">New Quote</h2>
        <div className="page-header-spacer" />
      </div>

      {/* Step indicator */}
      <div className="step-indicator">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className={`step-dot ${i + 1 === step ? 'active' : i + 1 < step ? 'done' : ''}`}>
            <span className="step-num">{i + 1}</span>
            <span className="step-label">{label}</span>
          </div>
        ))}
      </div>

      {error && <ErrorAlert message={error} compact />}

      {/* Step 1: Client & Event */}
      {step === 1 && (
        <div className="invoice-step">
          {selectedClient ? (
            <>
              <div className="neu-card invoice-client-badge">
                Client: <strong>{selectedClient.company_name}</strong>
                <button className="btn btn-small btn-outline" onClick={() => setSelectedClient(null)} style={{ marginLeft: 'auto' }}>Change</button>
              </div>

              <label className="label">EVENT TYPE</label>
              <div className="neu-inset">
                <select className="input-field" value={eventType} onChange={e => setEventType(e.target.value as EventType)}>
                  {EVENT_TYPES.map(et => <option key={et.value} value={et.value}>{et.label}</option>)}
                </select>
              </div>

              <label className="label">EVENT DATE</label>
              <div className="neu-inset">
                <input className="input-field" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
              </div>

              <label className="label">VENUE NAME *</label>
              <div className="neu-inset">
                <input className="input-field" value={venueName} onChange={e => setVenueName(e.target.value)} placeholder="Venue name" />
              </div>

              <label className="label">VENUE ADDRESS</label>
              <div className="neu-inset">
                <textarea className="input-field input-textarea" value={venueAddress} onChange={e => setVenueAddress(e.target.value)} placeholder="Full address" rows={3} />
              </div>

              <button className="btn btn-primary btn-full" onClick={goToStep2} style={{ marginTop: 12 }}>
                Next: Build Package
              </button>
            </>
          ) : (
            <>
              <div className="neu-inset" style={{ marginBottom: 8 }}>
                <input
                  className="input-field"
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  placeholder="Search clients..."
                />
              </div>

              <button className="btn btn-primary btn-small btn-full" onClick={() => setShowNewClient(true)} style={{ marginBottom: 8 }}>
                + Add New Client
              </button>

              <div className="client-select-list">
                {clients.map(c => (
                  <div key={c.id} className="client-select-item neu-card" onClick={() => selectClient(c)}>
                    <span className="client-select-name">{c.company_name}</span>
                    {c.contact_name && <span className="client-select-contact">{c.contact_name}</span>}
                  </div>
                ))}
                {clients.length === 0 && (
                  <p className="empty-text">{clientSearch ? 'No matching clients' : 'No clients yet'}</p>
                )}
              </div>

              {showNewClient && (
                <div className="overlay" onClick={() => setShowNewClient(false)}>
                  <div className="modal-card" onClick={e => e.stopPropagation()}>
                    <h3 className="modal-title">New Client</h3>
                    <label className="label">COMPANY NAME *</label>
                    <div className="neu-inset"><input className="input-field" value={newCompany} onChange={e => setNewCompany(e.target.value)} placeholder="Company name" /></div>
                    <label className="label">CONTACT NAME</label>
                    <div className="neu-inset"><input className="input-field" value={newContact} onChange={e => setNewContact(e.target.value)} placeholder="Optional" /></div>
                    <label className="label">ADDRESS</label>
                    <div className="neu-inset"><textarea className="input-field input-textarea" value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="Full address" rows={3} /></div>
                    <label className="label">EMAIL</label>
                    <div className="neu-inset"><input className="input-field" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Optional" type="email" /></div>
                    <label className="label">PHONE</label>
                    <div className="neu-inset"><input className="input-field" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Optional" type="tel" /></div>
                    <div className="form-actions">
                      <button className="btn btn-primary" onClick={saveNewClient}>Save & Select</button>
                      <button className="btn btn-outline" onClick={() => setShowNewClient(false)}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 2: Build Package */}
      {step === 2 && (
        <div className="invoice-step">
          {/* Service picker */}
          {services.length > 0 && (
            <div className="package-service-picker">
              <label className="label">ADD FROM CATALOGUE</label>
              <div className="package-service-grid">
                {services.map(svc => (
                  <button key={svc.id} className="btn btn-outline btn-small package-service-btn" onClick={() => addServiceItem(svc)}>
                    {svc.name} — {formatGBP(svc.default_price)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button className="btn btn-tangerine btn-small btn-full" onClick={addCustomItem} style={{ marginBottom: 12 }}>
            + Add Custom Item
          </button>

          {/* Line items */}
          {lineItems.length > 0 && (
            <div className="line-items-list">
              {lineItems.map(li => (
                <div key={li.key} className="line-item-row neu-card">
                  <div className="line-item-desc">
                    <div className="neu-inset">
                      <input
                        className="input-field"
                        value={li.description}
                        onChange={e => updateLineItem(li.key, 'description', e.target.value)}
                        placeholder="Description"
                      />
                    </div>
                  </div>
                  <div className="line-item-numbers">
                    <div className="line-item-field">
                      <label className="label label-tiny">QTY</label>
                      <div className="neu-inset">
                        <input
                          className="input-field input-narrow"
                          type="number"
                          min="1"
                          value={li.quantity}
                          onChange={e => updateLineItem(li.key, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                        />
                      </div>
                    </div>
                    <div className="line-item-field">
                      <label className="label label-tiny">PRICE</label>
                      <div className="neu-inset">
                        <input
                          className="input-field input-narrow"
                          type="number"
                          step="0.01"
                          min="0"
                          value={li.unit_price}
                          onChange={e => updateLineItem(li.key, 'unit_price', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                    <div className="line-item-total">
                      {formatGBP(li.quantity * li.unit_price)}
                    </div>
                    <button className="btn btn-small btn-danger line-item-remove" onClick={() => removeLineItem(li.key)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {lineItems.length === 0 && (
            <p className="empty-text">No items yet — add from the catalogue or create a custom item</p>
          )}

          {/* Discount */}
          <div className="package-discount">
            <label className="label">DISCOUNT (£)</label>
            <div className="neu-inset">
              <input
                className="input-field"
                type="number"
                step="0.01"
                min="0"
                value={discountAmount}
                onChange={e => setDiscountAmount(e.target.value)}
                onBlur={() => { const n = parseFloat(discountAmount); if (!isNaN(n) && n >= 0) setDiscountAmount(n.toFixed(2)); }}
              />
            </div>
          </div>

          {/* Running total */}
          <div className="running-total neu-card">
            <div className="running-total-row">
              <span>Subtotal</span>
              <span>{formatGBP(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="running-total-row running-total-discount">
                <span>Discount</span>
                <span>-{formatGBP(discount)}</span>
              </div>
            )}
            <div className="running-total-row running-total-final">
              <span>Total</span>
              <span>{formatGBP(total)}</span>
            </div>
          </div>

          <button className="btn btn-primary btn-full" onClick={goToStep3} style={{ marginTop: 12 }}>
            Next: Extras
          </button>
        </div>
      )}

      {/* Step 3: Extras */}
      {step === 3 && (
        <div className="invoice-step">
          {/* PLI Toggle */}
          <div className="extras-section">
            <label className="label">PUBLIC LIABILITY INSURANCE</label>
            <div className="pli-toggle-group">
              {(['none', 'details', 'certificate'] as PLIOption[]).map(opt => (
                <button
                  key={opt}
                  className={`btn btn-small ${pliOption === opt ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setPliOption(opt)}
                >
                  {opt === 'none' ? 'None' : opt === 'details' ? 'Show Details' : 'Certificate'}
                </button>
              ))}
            </div>
            {pliOption !== 'none' && bandSettings && (
              <div className="pli-info neu-card">
                <p><strong>Insurer:</strong> {bandSettings.pli_insurer || 'Not set'}</p>
                <p><strong>Policy:</strong> {bandSettings.pli_policy_number || 'Not set'}</p>
                <p><strong>Cover:</strong> {bandSettings.pli_cover_amount || 'Not set'}</p>
                {bandSettings.pli_expiry_date && <p><strong>Expiry:</strong> {formatDateLong(bandSettings.pli_expiry_date)}</p>}
              </div>
            )}
          </div>

          {/* Terms & Conditions */}
          <label className="label">TERMS & CONDITIONS</label>
          <div className="neu-inset">
            <textarea
              className="input-field input-textarea"
              value={termsAndConditions}
              onChange={e => setTermsAndConditions(e.target.value)}
              placeholder="Terms and conditions..."
              rows={6}
            />
          </div>

          {/* Validity */}
          <label className="label">QUOTE VALIDITY (DAYS)</label>
          <div className="neu-inset">
            <input
              className="input-field"
              type="number"
              min={1}
              max={365}
              value={validityDays}
              onChange={e => setValidityDays(parseInt(e.target.value) || 30)}
            />
          </div>

          {/* Notes */}
          <label className="label">NOTES</label>
          <div className="neu-inset">
            <textarea
              className="input-field input-textarea"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Additional notes (optional)"
              rows={3}
            />
          </div>

          <button className="btn btn-primary btn-full" onClick={goToStep4} style={{ marginTop: 12 }}>
            Preview Quote
          </button>
        </div>
      )}

      {/* Step 4: Preview Carousel */}
      {step === 4 && currentPreview && (
        <div className="invoice-preview-step">
          <div className="style-name-bar">
            <span className="style-name">{currentPreview.name}</span>
            <span className="style-desc">{currentPreview.description}</span>
            <span className="style-counter">{currentIndex + 1} / {previewHtmls.length}</span>
          </div>

          <div className="preview-carousel">
            {currentIndex > 0 && (
              <button className="carousel-arrow carousel-arrow-left" onClick={() => setCurrentIndex(i => i - 1)}>{'\u2039'}</button>
            )}
            <iframe
              ref={iframeRef}
              className="invoice-iframe"
              srcDoc={currentPreview.html}
              title="Quote Preview"
              sandbox="allow-same-origin"
            />
            {currentIndex < previewHtmls.length - 1 && (
              <button className="carousel-arrow carousel-arrow-right" onClick={() => setCurrentIndex(i => i + 1)}>{'\u203A'}</button>
            )}
          </div>

          <div className="style-dots">
            {previewHtmls.map((p, i) => (
              <button
                key={p.id}
                className={`style-dot ${i === currentIndex ? 'active' : ''}`}
                onClick={() => setCurrentIndex(i)}
                title={p.name}
              />
            ))}
          </div>

          <button
            className="btn btn-primary btn-full"
            onClick={handleCreate}
            disabled={generating}
            style={{ marginTop: 8 }}
          >
            {generating ? 'Creating...' : 'Create Quote'}
          </button>
        </div>
      )}
    </div>
  );
}
