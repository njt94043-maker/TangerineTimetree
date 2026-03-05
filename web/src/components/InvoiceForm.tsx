import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getClients, searchClients, createClient, createInvoice,
  getVenuesForClient,
} from '@shared/supabase/queries';
import { loadSettingsCached } from '../utils/settingsCache';
import type { Client, Venue, UserSettings, BandSettings } from '@shared/supabase/types';
import type { InvoiceStyle } from '@shared/supabase/types';
import type { InvoiceTemplateData } from '@shared/templates';
import { getInvoiceHtml, INVOICE_STYLES, DEFAULT_INVOICE_STYLE } from '@shared/templates';
import { formatDateLong, todayISO, addDaysISO } from '../utils/format';
import { ErrorAlert } from './ErrorAlert';

interface InvoiceFormProps {
  onClose: () => void;
  onSaved: (invoiceId: string) => void;
}

const STEP_LABELS = ['Client', 'Details', 'Preview'];

export function InvoiceForm({ onClose, onSaved }: InvoiceFormProps) {
  const [step, setStep] = useState(1);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [bandSettings, setBandSettings] = useState<BandSettings | null>(null);
  const [error, setError] = useState('');

  // Step 1 — Client
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newCompany, setNewCompany] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  // Step 2 — Details
  const [venue, setVenue] = useState('');
  const [gigDate, setGigDate] = useState(todayISO());
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionEdited, setDescriptionEdited] = useState(false);
  const [venues, setVenues] = useState<Venue[]>([]);

  // Step 3 — Preview carousel
  const [selectedStyle, setSelectedStyle] = useState<InvoiceStyle>(DEFAULT_INVOICE_STYLE);
  const [previewHtmls, setPreviewHtmls] = useState<{ id: InvoiceStyle; name: string; description: string; html: string }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [generating, setGenerating] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Scale A4 iframe to fit container
  const scaleIframes = useCallback(() => {
    if (!carouselRef.current) return;
    const frames = carouselRef.current.querySelectorAll<HTMLDivElement>('.a4-frame');
    frames.forEach(frame => {
      const iframe = frame.querySelector('iframe');
      if (iframe) {
        const scale = frame.clientWidth / 800;
        iframe.style.transform = `scale(${scale})`;
      }
    });
  }, []);

  useEffect(() => {
    if (step === 3) {
      const timer = setTimeout(scaleIframes, 50);
      window.addEventListener('resize', scaleIframes);
      return () => { clearTimeout(timer); window.removeEventListener('resize', scaleIframes); };
    }
  }, [step, scaleIframes]);

  // Track current slide via scroll
  const handleCarouselScroll = useCallback(() => {
    if (!carouselRef.current) return;
    const { scrollLeft, clientWidth } = carouselRef.current;
    const idx = Math.round(scrollLeft / clientWidth);
    setCurrentIndex(idx);
  }, []);

  useEffect(() => {
    loadSettingsCached(
      (us, bs) => { setUserSettings(us); setBandSettings(bs); },
      () => setError('Failed to load settings'),
    );
    loadClients();
  }, []);

  async function loadClients() {
    try {
      const list = clientSearch.trim() ? await searchClients(clientSearch.trim()) : await getClients();
      setClients(list);
    } catch { /* client list non-critical */ }
  }

  useEffect(() => { loadClients(); }, [clientSearch]);

  // Auto-generate description
  useEffect(() => {
    if (!descriptionEdited && venue.trim()) {
      setDescription(`Live music performance at ${venue.trim()} on ${formatDateLong(gigDate)}`);
    }
  }, [venue, gigDate, descriptionEdited]);

  // Load venues for selected client
  useEffect(() => {
    if (selectedClient) {
      getVenuesForClient(selectedClient.id).then(setVenues).catch(() => setVenues([]));
    }
  }, [selectedClient]);

  function selectClient(client: Client) {
    setSelectedClient(client);
    setStep(2);
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

  function goToStep3() {
    if (!venue.trim()) { setError('Venue name is required'); return; }
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) { setError('Enter a valid amount'); return; }
    if (!userSettings || !bandSettings) { setError('Settings not loaded — please configure Settings first'); return; }
    if (!selectedClient) return;
    setError('');

    const templateData: InvoiceTemplateData = {
      invoiceNumber: `TGT-${String(bandSettings.next_invoice_number).padStart(4, '0')}`,
      issueDate: formatDateLong(todayISO()),
      dueDate: formatDateLong(addDaysISO(todayISO(), bandSettings.payment_terms_days)),
      fromName: userSettings.your_name,
      tradingAs: bandSettings.trading_as,
      businessType: bandSettings.business_type,
      website: bandSettings.website,
      toCompany: selectedClient.company_name,
      toContact: selectedClient.contact_name,
      toAddress: selectedClient.address,
      description: description.trim() || `Live music performance at ${venue.trim()} on ${formatDateLong(gigDate)}`,
      amount: parsedAmount,
      bankAccountName: userSettings.bank_account_name,
      bankName: userSettings.bank_name,
      bankSortCode: userSettings.bank_sort_code,
      bankAccountNumber: userSettings.bank_account_number,
      paymentTermsDays: bandSettings.payment_terms_days,
    };

    const previews = INVOICE_STYLES.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      html: getInvoiceHtml(s.id, templateData),
    }));

    setPreviewHtmls(previews);
    const prefIndex = previews.findIndex(p => p.id === selectedStyle);
    setCurrentIndex(prefIndex >= 0 ? prefIndex : 0);
    setStep(3);
  }

  async function handleApprove() {
    if (!selectedClient) return;
    const style = previewHtmls[currentIndex]?.id || DEFAULT_INVOICE_STYLE;
    setSelectedStyle(style);
    setGenerating(true);
    setError('');
    try {
      const invoice = await createInvoice({
        client_id: selectedClient.id,
        venue: venue.trim(),
        gig_date: gigDate,
        amount: parseFloat(amount),
        description: description.trim(),
        style,
      });
      onSaved(invoice.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice');
    } finally {
      setGenerating(false);
    }
  }

  const currentPreview = previewHtmls[currentIndex];

  return (
    <div className="form-wrap form-top">
      <div className="page-header">
        <button className="btn btn-small btn-green" onClick={step === 1 ? onClose : () => setStep(s => (s - 1) as 1 | 2)}>
          {step === 1 ? '\u25C0 Cancel' : '\u25C0 Back'}
        </button>
        <h2 className="page-title">New Invoice</h2>
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

      {/* Step 1: Client Selection */}
      {step === 1 && (
        <div className="invoice-step">
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

          {/* New client modal */}
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
        </div>
      )}

      {/* Step 2: Gig Details */}
      {step === 2 && selectedClient && (
        <div className="invoice-step">
          <div className="neu-card invoice-client-badge">
            Client: <strong>{selectedClient.company_name}</strong>
          </div>

          <label className="label">VENUE NAME *</label>
          <div className="neu-inset">
            <input className="input-field" value={venue} onChange={e => setVenue(e.target.value)} placeholder="Venue name" list="venue-suggestions" />
            <datalist id="venue-suggestions">
              {venues.map(v => <option key={v.id} value={v.venue_name} />)}
            </datalist>
          </div>

          <label className="label">GIG DATE</label>
          <div className="neu-inset">
            <input className="input-field" type="date" value={gigDate} onChange={e => setGigDate(e.target.value)} />
          </div>

          <label className="label">AMOUNT (GBP) *</label>
          <div className="neu-inset">
            <input
              className="input-field"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              onBlur={() => { const n = parseFloat(amount); if (!isNaN(n) && n > 0) setAmount(n.toFixed(2)); }}
              placeholder="e.g. 400"
              type="number"
              step="0.01"
              min="0"
            />
          </div>

          <label className="label">DESCRIPTION</label>
          <div className="neu-inset">
            <textarea
              className="input-field input-textarea"
              value={description}
              onChange={e => { setDescription(e.target.value); setDescriptionEdited(true); }}
              placeholder="Auto-generated from venue + date"
              rows={3}
            />
          </div>
          <p className="hint-text">Edit above to customise, or leave as-is</p>

          <button className="btn btn-primary btn-full" onClick={goToStep3} style={{ marginTop: 12 }}>
            Preview Invoice
          </button>
        </div>
      )}

      {/* Step 3: Style Preview Carousel */}
      {step === 3 && currentPreview && (
        <div className="invoice-preview-step">
          {/* Style name bar */}
          <div className="style-name-bar">
            <span className="style-name">{currentPreview.name}</span>
            <span className="style-desc">{currentPreview.description}</span>
            <span className="style-counter">{currentIndex + 1} / {previewHtmls.length}</span>
          </div>

          {/* Swipeable A4 preview carousel */}
          <div className="preview-carousel" ref={carouselRef} onScroll={handleCarouselScroll}>
            {previewHtmls.map((p) => (
              <div key={p.id} className="preview-slide">
                <div className="a4-frame">
                  <iframe
                    srcDoc={p.html}
                    title={`${p.name} Preview`}
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Navigation arrows */}
          {currentIndex > 0 && (
            <button className="carousel-arrow carousel-arrow-left" onClick={() => {
              carouselRef.current?.scrollTo({ left: (currentIndex - 1) * (carouselRef.current?.clientWidth || 0), behavior: 'smooth' });
            }}>{'\u2039'}</button>
          )}
          {currentIndex < previewHtmls.length - 1 && (
            <button className="carousel-arrow carousel-arrow-right" onClick={() => {
              carouselRef.current?.scrollTo({ left: (currentIndex + 1) * (carouselRef.current?.clientWidth || 0), behavior: 'smooth' });
            }}>{'\u203A'}</button>
          )}

          {/* Style dots */}
          <div className="style-dots">
            {previewHtmls.map((p, i) => (
              <button
                key={p.id}
                className={`style-dot ${i === currentIndex ? 'active' : ''}`}
                onClick={() => {
                  carouselRef.current?.scrollTo({ left: i * (carouselRef.current?.clientWidth || 0), behavior: 'smooth' });
                }}
                title={p.name}
              />
            ))}
          </div>

          <button
            className="btn btn-primary btn-full"
            onClick={handleApprove}
            disabled={generating}
            style={{ marginTop: 8 }}
          >
            {generating ? 'Saving...' : 'Approve & Save'}
          </button>
        </div>
      )}
    </div>
  );
}
