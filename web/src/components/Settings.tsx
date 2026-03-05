import { useState, useEffect } from 'react';
import {
  getUserSettings, upsertUserSettings, getBandSettings, updateBandSettings,
  updateBandSettingsExtended, getAllServiceCatalogue, createServiceItem,
  updateServiceItem, deleteServiceItem,
  getSiteContent, upsertSiteContent,
  getAllReviews, createReview, updateReview, deleteReview,
} from '@shared/supabase/queries';
import type { ServiceCatalogueItem, SiteReview } from '@shared/supabase/types';
import { ErrorAlert } from './ErrorAlert';

interface SettingsProps {
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  // User settings
  const [yourName, setYourName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankSortCode, setBankSortCode] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');

  // Band settings
  const [tradingAs, setTradingAs] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [website, setWebsite] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState(14);

  // PLI (Insurance)
  const [pliInsurer, setPliInsurer] = useState('');
  const [pliPolicyNumber, setPliPolicyNumber] = useState('');
  const [pliCoverAmount, setPliCoverAmount] = useState('');
  const [pliExpiryDate, setPliExpiryDate] = useState('');

  // T&Cs + Quote Defaults
  const [defaultTerms, setDefaultTerms] = useState('');
  const [quoteValidityDays, setQuoteValidityDays] = useState(30);

  // Service Catalogue
  const [services, setServices] = useState<ServiceCatalogueItem[]>([]);
  const [showAddService, setShowAddService] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [svcName, setSvcName] = useState('');
  const [svcDescription, setSvcDescription] = useState('');
  const [svcPrice, setSvcPrice] = useState('');
  const [svcUnitLabel, setSvcUnitLabel] = useState('');

  // Website Content
  const [siteContent, setSiteContent] = useState<Record<string, string>>({});
  const [contentSaved, setContentSaved] = useState<string | null>(null);

  // Reviews
  const [siteReviews, setSiteReviews] = useState<SiteReview[]>([]);
  const [showAddReview, setShowAddReview] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [revAuthor, setRevAuthor] = useState('');
  const [revText, setRevText] = useState('');
  const [revRating, setRevRating] = useState(5);
  const [revSource, setRevSource] = useState('Facebook');
  const [revDate, setRevDate] = useState('');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([getUserSettings(), getBandSettings(), getAllServiceCatalogue(), getSiteContent(), getAllReviews()]).then(([us, bs, svc, sc, rev]) => {
      if (us) {
        setYourName(us.your_name);
        setEmail(us.email);
        setPhone(us.phone);
        setBankAccountName(us.bank_account_name);
        setBankName(us.bank_name);
        setBankSortCode(us.bank_sort_code);
        setBankAccountNumber(us.bank_account_number);
      }
      if (bs) {
        setTradingAs(bs.trading_as);
        setBusinessType(bs.business_type);
        setWebsite(bs.website);
        setPaymentTermsDays(bs.payment_terms_days);
        setPliInsurer(bs.pli_insurer ?? '');
        setPliPolicyNumber(bs.pli_policy_number ?? '');
        setPliCoverAmount(bs.pli_cover_amount ?? '');
        setPliExpiryDate(bs.pli_expiry_date ?? '');
        setDefaultTerms(bs.default_terms_and_conditions ?? '');
        setQuoteValidityDays(bs.default_quote_validity_days ?? 30);
      }
      setServices(svc);
      const contentMap: Record<string, string> = {};
      for (const row of sc) contentMap[row.key] = row.value;
      setSiteContent(contentMap);
      setSiteReviews(rev);
      setLoaded(true);
    });
  }, []);

  function handleSortCodeChange(val: string) {
    // Auto-format: XX-XX-XX
    const digits = val.replace(/\D/g, '').slice(0, 6);
    const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)].filter(Boolean);
    setBankSortCode(parts.join('-'));
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await Promise.all([
        upsertUserSettings({
          your_name: yourName,
          email,
          phone,
          bank_account_name: bankAccountName,
          bank_name: bankName,
          bank_sort_code: bankSortCode,
          bank_account_number: bankAccountNumber,
        }),
        updateBandSettings({
          trading_as: tradingAs,
          business_type: businessType,
          website,
          payment_terms_days: Math.max(1, Math.min(365, paymentTermsDays)),
        }),
        updateBandSettingsExtended({
          pli_insurer: pliInsurer,
          pli_policy_number: pliPolicyNumber,
          pli_cover_amount: pliCoverAmount,
          pli_expiry_date: pliExpiryDate || null,
          default_terms_and_conditions: defaultTerms,
          default_quote_validity_days: Math.max(1, Math.min(365, quoteValidityDays)),
        }),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  // Service catalogue handlers
  function resetServiceForm() {
    setSvcName(''); setSvcDescription(''); setSvcPrice(''); setSvcUnitLabel('');
    setShowAddService(false); setEditingServiceId(null);
  }

  function startEditService(svc: ServiceCatalogueItem) {
    setEditingServiceId(svc.id);
    setSvcName(svc.name);
    setSvcDescription(svc.description);
    setSvcPrice(svc.default_price.toFixed(2));
    setSvcUnitLabel(svc.unit_label ?? '');
    setShowAddService(true);
  }

  async function handleSaveService() {
    if (!svcName.trim()) { setError('Service name is required'); return; }
    const price = parseFloat(svcPrice);
    if (isNaN(price) || price < 0) { setError('Enter a valid price'); return; }
    setError('');
    try {
      if (editingServiceId) {
        await updateServiceItem(editingServiceId, {
          name: svcName.trim(),
          description: svcDescription.trim(),
          default_price: price,
          unit_label: svcUnitLabel.trim() || null,
        });
      } else {
        await createServiceItem({
          name: svcName.trim(),
          description: svcDescription.trim(),
          default_price: price,
          unit_label: svcUnitLabel.trim() || null,
          sort_order: services.length,
        });
      }
      const updated = await getAllServiceCatalogue();
      setServices(updated);
      resetServiceForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save service');
    }
  }

  async function handleDeleteService(id: string) {
    try {
      await deleteServiceItem(id);
      setServices(s => s.filter(x => x.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete service');
    }
  }

  async function handleMoveService(id: string, direction: -1 | 1) {
    const idx = services.findIndex(s => s.id === id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= services.length) return;
    try {
      await Promise.all([
        updateServiceItem(services[idx].id, { sort_order: swapIdx }),
        updateServiceItem(services[swapIdx].id, { sort_order: idx }),
      ]);
      const updated = await getAllServiceCatalogue();
      setServices(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder');
    }
  }

  // Website content handlers
  async function handleContentSave(key: string, value: string) {
    try {
      await upsertSiteContent(key, value);
      setSiteContent(prev => ({ ...prev, [key]: value }));
      setContentSaved(key);
      setTimeout(() => setContentSaved(null), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save content');
    }
  }

  function getContent(key: string) { return siteContent[key] ?? ''; }

  // Review handlers
  function resetReviewForm() {
    setRevAuthor(''); setRevText(''); setRevRating(5); setRevSource('Facebook'); setRevDate('');
    setShowAddReview(false); setEditingReviewId(null);
  }

  function startEditReview(r: SiteReview) {
    setEditingReviewId(r.id);
    setRevAuthor(r.author_name);
    setRevText(r.review_text);
    setRevRating(r.rating);
    setRevSource(r.source);
    setRevDate(r.review_date ?? '');
    setShowAddReview(true);
  }

  async function handleSaveReview() {
    if (!revAuthor.trim() || !revText.trim()) { setError('Author and review text required'); return; }
    setError('');
    try {
      if (editingReviewId) {
        await updateReview(editingReviewId, {
          author_name: revAuthor.trim(),
          review_text: revText.trim(),
          rating: revRating,
          source: revSource,
          review_date: revDate || null,
        });
      } else {
        await createReview({
          author_name: revAuthor.trim(),
          review_text: revText.trim(),
          rating: revRating,
          source: revSource,
          review_date: revDate || null,
          sort_order: siteReviews.length,
        });
      }
      const updated = await getAllReviews();
      setSiteReviews(updated);
      resetReviewForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save review');
    }
  }

  async function handleDeleteReview(id: string) {
    try {
      await deleteReview(id);
      setSiteReviews(r => r.filter(x => x.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete review');
    }
  }

  async function handleToggleReviewVisibility(id: string, visible: boolean) {
    try {
      await updateReview(id, { visible: !visible });
      setSiteReviews(r => r.map(x => x.id === id ? { ...x, visible: !visible } : x));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update review');
    }
  }

  async function handleMoveReview(id: string, direction: -1 | 1) {
    const idx = siteReviews.findIndex(r => r.id === id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= siteReviews.length) return;
    try {
      await Promise.all([
        updateReview(siteReviews[idx].id, { sort_order: swapIdx }),
        updateReview(siteReviews[swapIdx].id, { sort_order: idx }),
      ]);
      const updated = await getAllReviews();
      setSiteReviews(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder');
    }
  }

  if (!loaded) return null;

  return (
    <div className="form-wrap form-top">
      <div className="page-header">
        <button className="btn btn-small btn-green" onClick={onClose}>{'\u25C0'} Back</button>
        <h2 className="page-title">Settings</h2>
        <div className="page-header-spacer" />
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Your Details</h3>

        <label className="label" htmlFor="s-name">YOUR NAME</label>
        <div className="neu-inset">
          <input id="s-name" className="input-field" value={yourName} onChange={e => setYourName(e.target.value)} placeholder="Your full name" />
        </div>

        <label className="label" htmlFor="s-email">EMAIL</label>
        <div className="neu-inset">
          <input id="s-email" className="input-field" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" />
        </div>

        <label className="label" htmlFor="s-phone">PHONE</label>
        <div className="neu-inset">
          <input id="s-phone" className="input-field" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" />
        </div>

        <label className="label" htmlFor="s-bank-name">BANK NAME</label>
        <div className="neu-inset">
          <input id="s-bank-name" className="input-field" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. Barclays" />
        </div>

        <label className="label" htmlFor="s-bank-acc-name">ACCOUNT NAME</label>
        <div className="neu-inset">
          <input id="s-bank-acc-name" className="input-field" value={bankAccountName} onChange={e => setBankAccountName(e.target.value)} placeholder="Account holder name" />
        </div>

        <label className="label" htmlFor="s-sort-code">SORT CODE</label>
        <div className="neu-inset">
          <input id="s-sort-code" className="input-field" value={bankSortCode} onChange={e => handleSortCodeChange(e.target.value)} placeholder="XX-XX-XX" maxLength={8} />
        </div>

        <label className="label" htmlFor="s-acc-num">ACCOUNT NUMBER</label>
        <div className="neu-inset">
          <input id="s-acc-num" className="input-field" value={bankAccountNumber} onChange={e => setBankAccountNumber(e.target.value)} placeholder="8-digit account number" maxLength={8} />
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Band Settings</h3>

        <label className="label" htmlFor="s-trading">TRADING AS</label>
        <div className="neu-inset">
          <input id="s-trading" className="input-field" value={tradingAs} onChange={e => setTradingAs(e.target.value)} placeholder="e.g. The Green Tangerine" />
        </div>

        <label className="label" htmlFor="s-biz-type">BUSINESS TYPE</label>
        <div className="neu-inset">
          <input id="s-biz-type" className="input-field" value={businessType} onChange={e => setBusinessType(e.target.value)} placeholder="e.g. Partnership" />
        </div>

        <label className="label" htmlFor="s-website">WEBSITE</label>
        <div className="neu-inset">
          <input id="s-website" className="input-field" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." />
        </div>

        <label className="label" htmlFor="s-terms">PAYMENT TERMS (DAYS)</label>
        <div className="neu-inset">
          <input
            id="s-terms"
            className="input-field"
            type="number"
            min={1}
            max={365}
            value={paymentTermsDays}
            onChange={e => setPaymentTermsDays(parseInt(e.target.value) || 14)}
            onBlur={() => setPaymentTermsDays(Math.max(1, Math.min(365, paymentTermsDays)))}
          />
        </div>
      </div>

      {/* Service Catalogue */}
      <div className="settings-section">
        <h3 className="settings-section-title">Service Catalogue</h3>
        <p className="hint-text">Services available when building quote packages</p>

        {services.length > 0 && (
          <div className="service-catalogue-list">
            {services.map((svc, i) => (
              <div key={svc.id} className="service-catalogue-item neu-card">
                <div className="service-catalogue-info">
                  <span className="service-catalogue-name">{svc.name}</span>
                  <span className="service-catalogue-price">£{svc.default_price.toFixed(2)}{svc.unit_label ? ` / ${svc.unit_label}` : ''}</span>
                </div>
                <div className="service-catalogue-actions">
                  <button className="btn btn-small btn-outline" onClick={() => handleMoveService(svc.id, -1)} disabled={i === 0}>↑</button>
                  <button className="btn btn-small btn-outline" onClick={() => handleMoveService(svc.id, 1)} disabled={i === services.length - 1}>↓</button>
                  <button className="btn btn-small btn-outline" onClick={() => startEditService(svc)}>Edit</button>
                  <button className="btn btn-small btn-danger" onClick={() => handleDeleteService(svc.id)}>Del</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {services.length === 0 && !showAddService && (
          <p className="empty-text">No services yet</p>
        )}

        {showAddService ? (
          <div className="service-form neu-card">
            <label className="label">SERVICE NAME *</label>
            <div className="neu-inset"><input className="input-field" value={svcName} onChange={e => setSvcName(e.target.value)} placeholder="e.g. 3-Hour Live Set" /></div>
            <label className="label">DESCRIPTION</label>
            <div className="neu-inset"><input className="input-field" value={svcDescription} onChange={e => setSvcDescription(e.target.value)} placeholder="Optional description" /></div>
            <label className="label">DEFAULT PRICE (£) *</label>
            <div className="neu-inset"><input className="input-field" type="number" step="0.01" min="0" value={svcPrice} onChange={e => setSvcPrice(e.target.value)} placeholder="0.00" /></div>
            <label className="label">UNIT LABEL</label>
            <div className="neu-inset"><input className="input-field" value={svcUnitLabel} onChange={e => setSvcUnitLabel(e.target.value)} placeholder="e.g. per hour, per set" /></div>
            <div className="form-actions">
              <button className="btn btn-primary btn-small" onClick={handleSaveService}>{editingServiceId ? 'Update' : 'Add Service'}</button>
              <button className="btn btn-outline btn-small" onClick={resetServiceForm}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="btn btn-green btn-small btn-full" onClick={() => { resetServiceForm(); setShowAddService(true); }} style={{ marginTop: 8 }}>
            + Add Service
          </button>
        )}
      </div>

      {/* PLI (Insurance) */}
      <div className="settings-section">
        <h3 className="settings-section-title">Public Liability Insurance</h3>

        <label className="label" htmlFor="s-pli-insurer">INSURER</label>
        <div className="neu-inset">
          <input id="s-pli-insurer" className="input-field" value={pliInsurer} onChange={e => setPliInsurer(e.target.value)} placeholder="e.g. Hiscox" />
        </div>

        <label className="label" htmlFor="s-pli-policy">POLICY NUMBER</label>
        <div className="neu-inset">
          <input id="s-pli-policy" className="input-field" value={pliPolicyNumber} onChange={e => setPliPolicyNumber(e.target.value)} placeholder="Policy number" />
        </div>

        <label className="label" htmlFor="s-pli-cover">COVER AMOUNT</label>
        <div className="neu-inset">
          <input id="s-pli-cover" className="input-field" value={pliCoverAmount} onChange={e => setPliCoverAmount(e.target.value)} placeholder="e.g. £10,000,000" />
        </div>

        <label className="label" htmlFor="s-pli-expiry">EXPIRY DATE</label>
        <div className="neu-inset">
          <input id="s-pli-expiry" className="input-field" type="date" value={pliExpiryDate} onChange={e => setPliExpiryDate(e.target.value)} />
        </div>
      </div>

      {/* Terms & Conditions */}
      <div className="settings-section">
        <h3 className="settings-section-title">Default Terms & Conditions</h3>
        <p className="hint-text">Pre-filled on new quotes — editable per quote</p>
        <div className="neu-inset">
          <textarea
            className="input-field input-textarea"
            value={defaultTerms}
            onChange={e => setDefaultTerms(e.target.value)}
            placeholder="Enter default terms and conditions..."
            rows={6}
          />
        </div>
      </div>

      {/* Quote Defaults */}
      <div className="settings-section">
        <h3 className="settings-section-title">Quote Defaults</h3>

        <label className="label" htmlFor="s-validity">QUOTE VALIDITY (DAYS)</label>
        <div className="neu-inset">
          <input
            id="s-validity"
            className="input-field"
            type="number"
            min={1}
            max={365}
            value={quoteValidityDays}
            onChange={e => setQuoteValidityDays(parseInt(e.target.value) || 30)}
            onBlur={() => setQuoteValidityDays(Math.max(1, Math.min(365, quoteValidityDays)))}
          />
        </div>
      </div>

      {/* Website Content */}
      <div className="settings-section">
        <h3 className="settings-section-title">Website Content</h3>
        <p className="hint-text">Edit public website text — changes appear immediately</p>

        <label className="label">HERO TAGLINE</label>
        <div className="neu-inset">
          <textarea
            className="input-field input-textarea"
            rows={2}
            value={getContent('hero_tagline')}
            onChange={e => setSiteContent(prev => ({ ...prev, hero_tagline: e.target.value }))}
            onBlur={e => e.target.value && handleContentSave('hero_tagline', e.target.value)}
            placeholder="Live rock covers for pubs, weddings & events..."
          />
        </div>
        {contentSaved === 'hero_tagline' && <span className="content-saved-flash">Saved</span>}

        <label className="label" style={{ marginTop: 16 }}>ABOUT — PARAGRAPH 1</label>
        <div className="neu-inset">
          <textarea
            className="input-field input-textarea"
            rows={4}
            value={getContent('about_text_1')}
            onChange={e => setSiteContent(prev => ({ ...prev, about_text_1: e.target.value }))}
            onBlur={e => e.target.value && handleContentSave('about_text_1', e.target.value)}
            placeholder="The Green Tangerine is a tribute to classic rock..."
          />
        </div>
        {contentSaved === 'about_text_1' && <span className="content-saved-flash">Saved</span>}

        <label className="label" style={{ marginTop: 16 }}>ABOUT — PARAGRAPH 2</label>
        <div className="neu-inset">
          <textarea
            className="input-field input-textarea"
            rows={4}
            value={getContent('about_text_2')}
            onChange={e => setSiteContent(prev => ({ ...prev, about_text_2: e.target.value }))}
            onBlur={e => e.target.value && handleContentSave('about_text_2', e.target.value)}
            placeholder="Based in the Rhondda, performing at venues across South Wales..."
          />
        </div>
        {contentSaved === 'about_text_2' && <span className="content-saved-flash">Saved</span>}

        <label className="label" style={{ marginTop: 16 }}>SLOGAN</label>
        <div className="neu-inset">
          <input
            className="input-field"
            value={getContent('about_slogan')}
            onChange={e => setSiteContent(prev => ({ ...prev, about_slogan: e.target.value }))}
            onBlur={e => e.target.value && handleContentSave('about_slogan', e.target.value)}
            placeholder="We don't just play — we display!"
          />
        </div>
        {contentSaved === 'about_slogan' && <span className="content-saved-flash">Saved</span>}
      </div>

      {/* Reviews */}
      <div className="settings-section">
        <h3 className="settings-section-title">Reviews</h3>
        <p className="hint-text">Manage reviews displayed on the public website</p>

        {siteReviews.length > 0 && (
          <div className="service-catalogue-list">
            {siteReviews.map((rev, i) => (
              <div key={rev.id} className={`service-catalogue-item neu-card ${!rev.visible ? 'review-hidden' : ''}`}>
                <div className="service-catalogue-info">
                  <span className="service-catalogue-name">{rev.author_name}</span>
                  <span className="service-catalogue-price" style={{ fontSize: 12, opacity: 0.6 }}>
                    {rev.review_text.slice(0, 60)}{rev.review_text.length > 60 ? '...' : ''}
                  </span>
                </div>
                <div className="service-catalogue-actions">
                  <button className="btn btn-small btn-outline" onClick={() => handleMoveReview(rev.id, -1)} disabled={i === 0}>&#x2191;</button>
                  <button className="btn btn-small btn-outline" onClick={() => handleMoveReview(rev.id, 1)} disabled={i === siteReviews.length - 1}>&#x2193;</button>
                  <button className="btn btn-small btn-outline" onClick={() => handleToggleReviewVisibility(rev.id, rev.visible)}>
                    {rev.visible ? 'Hide' : 'Show'}
                  </button>
                  <button className="btn btn-small btn-outline" onClick={() => startEditReview(rev)}>Edit</button>
                  <button className="btn btn-small btn-danger" onClick={() => handleDeleteReview(rev.id)}>Del</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {siteReviews.length === 0 && !showAddReview && (
          <p className="empty-text">No reviews yet</p>
        )}

        {showAddReview ? (
          <div className="service-form neu-card">
            <label className="label">REVIEWER NAME *</label>
            <div className="neu-inset"><input className="input-field" value={revAuthor} onChange={e => setRevAuthor(e.target.value)} placeholder="e.g. John Smith" /></div>
            <label className="label">REVIEW TEXT *</label>
            <div className="neu-inset"><textarea className="input-field input-textarea" rows={3} value={revText} onChange={e => setRevText(e.target.value)} placeholder="Their review..." /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div>
                <label className="label">RATING</label>
                <div className="neu-inset">
                  <select className="input-field" value={revRating} onChange={e => setRevRating(Number(e.target.value))}>
                    {[5,4,3,2,1].map(n => <option key={n} value={n}>{'★'.repeat(n)} ({n})</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">SOURCE</label>
                <div className="neu-inset">
                  <select className="input-field" value={revSource} onChange={e => setRevSource(e.target.value)}>
                    <option value="Facebook">Facebook</option>
                    <option value="Google">Google</option>
                    <option value="Direct">Direct</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">DATE</label>
                <div className="neu-inset"><input className="input-field" type="date" value={revDate} onChange={e => setRevDate(e.target.value)} /></div>
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-primary btn-small" onClick={handleSaveReview}>{editingReviewId ? 'Update' : 'Add Review'}</button>
              <button className="btn btn-outline btn-small" onClick={resetReviewForm}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="btn btn-green btn-small btn-full" onClick={() => { resetReviewForm(); setShowAddReview(true); }} style={{ marginTop: 8 }}>
            + Add Review
          </button>
        )}
      </div>

      {error && <ErrorAlert message={error} compact />}
      {saved && <p className="saved-text">Saved!</p>}

      <div className="form-actions">
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
