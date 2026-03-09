import { useState, useEffect, useCallback } from 'react';
import {
  getUserSettings, upsertUserSettings, getBandSettings, updateBandSettings,
  updateBandSettingsExtended, getAllServiceCatalogue, createServiceItem,
  updateServiceItem, deleteServiceItem,
  getSiteContent, upsertSiteContent,
  getAllReviews, createReview, updateReview, deleteReview,
  getPlayerPrefs, updatePlayerPrefs,
} from '@shared/supabase/queries';
import type { PlayerPrefs } from '@shared/supabase/queries';
import type { ServiceCatalogueItem, SiteReview } from '@shared/supabase/types';
import { ErrorAlert } from './ErrorAlert';

const GALLERY_PHOTOS = [
  '597106079_122203114304318312_6658064872395739304_n.jpg',
  '599940850_122203114316318312_7234787539894986138_n.jpg',
  '597816557_122203114208318312_1511647365440667672_n.jpg',
  '597686988_122203114196318312_7380671637909424026_n.jpg',
  '597766945_122203114262318312_2855019826452984325_n.jpg',
  '599942438_122203114250318312_4715496230997956731_n.jpg',
  '598806438_122203114154318312_3738731288650294377_n.jpg',
  '597667933_122203114232318312_3376259773236282285_n.jpg',
  '597686467_122203114220318312_8499032770169649442_n.jpg',
  '599950695_122203114184318312_4075550291178093672_n.jpg',
  '599937526_122203114166318312_8822826353486095203_n.jpg',
  '596616100_122203114280318312_4774789225283861685_n.jpg',
  '599931778_122203114142318312_2510743017703448193_n.jpg',
  '599945802_122203522964318312_8505338935023776184_n.jpg',
  '559917240_122198179376318312_338513422612439942_n.jpg',
  '573046765_122198179160318312_6611713516069725623_n.jpg',
  '517373707_122184618476318312_9079173012852202353_n.jpg',
  '518292004_122184618194318312_7470469164487337077_n.jpg',
  '518178779_122184618356318312_5797258311142432207_n.jpg',
  '517932280_122184618398318312_7899127581410056593_n.jpg',
  '517593387_122184618308318312_1469287926402591328_n.jpg',
  '517658459_122184618320318312_918293111362977779_n.jpg',
  '517915069_122184618218318312_1289342786448300270_n.jpg',
  '516694328_122184618176318312_3053346118825880157_n.jpg',
  '472670979_122156629358318312_8073782115706429438_n.jpg',
  '472735587_122156647370318312_1328698029704239520_n.jpg',
  '475068530_122159718272318312_1808472951566202610_n.jpg',
  '475166599_122159718284318312_7103355741818100711_n.jpg',
  '475458199_122159718188318312_513881708284064786_n.jpg',
  '475756232_122160803756318312_5485839986337765140_n.jpg',
  '475794011_122160803684318312_2167642453336680850_n.jpg',
  '475870045_122160803702318312_5106760121842329194_n.jpg',
  '475944088_122160803738318312_3019678196786161403_n.jpg',
  '476220689_122160803516318312_6973583794071836750_n.jpg',
  '476603930_122160803714318312_2269170579322988337_n.jpg',
  '475101818_122159718266318312_8134630960279957291_n.jpg',
  '475167972_122159718278318312_3589011426051096025_n.jpg',
  '475818158_122160803678318312_6529702723166442073_n.jpg',
  '475904381_122160803510318312_6087368118378830505_n.jpg',
  '475951073_122160803540318312_5779162694975329062_n.jpg',
  '475990453_122160803648318312_48028581563210430_n.jpg',
  '476082222_122160242924318312_5404536789557330705_n.jpg',
  '599929404_122203522574318312_4278800614656553218_n.jpg',
  '601819856_122203522562318312_938249262472603777_n.jpg',
];

const ALL_BG_IMAGES = [
  '/images/hero-wedding.jpg',
  '/images/hero-stage.jpg',
  '/images/hero-halloween.jpg',
  '/images/band-group.jpg',
  '/images/band-singing.jpg',
  ...GALLERY_PHOTOS.map(p => `/images/gallery/${p}`),
];

const BG_SLOTS = [
  { key: 'bg_hero_desktop', label: 'Hero (Desktop)', default: '/images/hero-wedding.jpg' },
  { key: 'bg_hero_mobile', label: 'Hero (Mobile)', default: '/images/band-singing.jpg' },
  { key: 'bg_about', label: 'About Section', default: '/images/hero-stage.jpg' },
  { key: 'bg_venues', label: 'Venues Section', default: '/images/band-group.jpg' },
];

interface SettingsProps {
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  // Preferences (device-local)
  const [mapApp, setMapApp] = useState(() => {
    const saved = localStorage.getItem('tgt_map_app');
    if (saved) return saved;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ? 'apple' : 'google';
  });

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

  // Calendar colours (per-user)
  const [calColourPub, setCalColourPub] = useState('#00e676');
  const [calColourClient, setCalColourClient] = useState('#f39c12');
  const [calColourPractice, setCalColourPractice] = useState('#bb86fc');

  // Cancellation threshold (band setting)
  const [cancellationThresholdDays, setCancellationThresholdDays] = useState(14);

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
  const [expandedBgSlot, setExpandedBgSlot] = useState<string | null>(null);

  // Reviews
  const [siteReviews, setSiteReviews] = useState<SiteReview[]>([]);
  const [showAddReview, setShowAddReview] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [revAuthor, setRevAuthor] = useState('');
  const [revText, setRevText] = useState('');
  const [revRating, setRevRating] = useState(5);
  const [revSource, setRevSource] = useState('Facebook');
  const [revSourceUrl, setRevSourceUrl] = useState('');
  const [revDate, setRevDate] = useState('');

  // Player prefs
  const [playerPrefs, setPlayerPrefs] = useState<PlayerPrefs>({
    player_click_enabled: true,
    player_flash_enabled: true,
    player_lyrics_enabled: true,
    player_chords_enabled: true,
    player_notes_enabled: true,
    player_drums_enabled: true,
    player_vis_enabled: true,
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([getUserSettings(), getBandSettings(), getAllServiceCatalogue(), getSiteContent(), getAllReviews(), getPlayerPrefs()]).then(([us, bs, svc, sc, rev, pp]) => {
      if (us) {
        setYourName(us.your_name);
        setEmail(us.email);
        setPhone(us.phone);
        setBankAccountName(us.bank_account_name);
        setBankName(us.bank_name);
        setBankSortCode(us.bank_sort_code);
        setBankAccountNumber(us.bank_account_number);
      }
      if (us) {
        setCalColourPub(us.calendar_colour_pub ?? '#00e676');
        setCalColourClient(us.calendar_colour_client ?? '#f39c12');
        setCalColourPractice(us.calendar_colour_practice ?? '#bb86fc');
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
        setCancellationThresholdDays(bs.cancellation_threshold_days ?? 14);
      }
      setServices(svc);
      const contentMap: Record<string, string> = {};
      for (const row of sc) contentMap[row.key] = row.value;
      setSiteContent(contentMap);
      setSiteReviews(rev);
      setPlayerPrefs(pp);
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
          calendar_colour_pub: calColourPub,
          calendar_colour_client: calColourClient,
          calendar_colour_practice: calColourPractice,
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
          cancellation_threshold_days: Math.max(1, Math.min(90, cancellationThresholdDays)),
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
    setRevAuthor(''); setRevText(''); setRevRating(5); setRevSource('Facebook'); setRevSourceUrl(''); setRevDate('');
    setShowAddReview(false); setEditingReviewId(null);
  }

  function startEditReview(r: SiteReview) {
    setEditingReviewId(r.id);
    setRevAuthor(r.author_name);
    setRevText(r.review_text);
    setRevRating(r.rating);
    setRevSource(r.source);
    setRevSourceUrl(r.source_url ?? '');
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
          source_url: revSourceUrl.trim() || null,
          review_date: revDate || null,
        });
      } else {
        await createReview({
          author_name: revAuthor.trim(),
          review_text: revText.trim(),
          rating: revRating,
          source: revSource,
          source_url: revSourceUrl.trim() || null,
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

  const autoGrow = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  if (!loaded) return null;

  return (
    <div className="form-wrap form-top">
      <div className="page-header">
        <button className="btn btn-small btn-green" onClick={onClose}>{'\u25C0'} Back</button>
        <h2 className="page-title">Settings</h2>
        <div className="page-header-spacer" />
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Preferences</h3>

        <label className="label" htmlFor="s-map-app">MAP APP</label>
        <div className="neu-inset">
          <select
            id="s-map-app"
            className="input-field"
            value={mapApp}
            onChange={e => { setMapApp(e.target.value); localStorage.setItem('tgt_map_app', e.target.value); }}
          >
            <option value="google">Google Maps</option>
            <option value="waze">Waze</option>
            <option value="apple">Apple Maps</option>
          </select>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Player Settings</h3>
        <p className="hint-text">Defaults for Live and Practice modes</p>
        {([
          ['player_click_enabled', 'Click Track', 'Metronome click during playback'],
          ['player_flash_enabled', 'Beat Flash', 'Screen flash on downbeat'],
          ['player_lyrics_enabled', 'Lyrics', 'Show lyrics panel'],
          ['player_chords_enabled', 'Chords', 'Show chord symbols inline'],
          ['player_notes_enabled', 'Notes', 'Show song notes'],
          ['player_drums_enabled', 'Drum Track', 'Include drum stem in mix'],
          ['player_vis_enabled', 'Waveform', 'Show waveform visualiser'],
        ] as const).map(([key, label, hint]) => (
          <label key={key} className="settings-toggle-row">
            <div className="settings-toggle-text">
              <span className="settings-toggle-label">{label}</span>
              <span className="settings-toggle-hint">{hint}</span>
            </div>
            <div
              className={`settings-toggle${playerPrefs[key] ? ' active' : ''}`}
              role="switch"
              aria-checked={playerPrefs[key]}
              onClick={() => {
                const next = { ...playerPrefs, [key]: !playerPrefs[key] };
                setPlayerPrefs(next);
                updatePlayerPrefs({ [key]: next[key] });
              }}
            >
              <div className="settings-toggle-thumb" />
            </div>
          </label>
        ))}
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Calendar Colours</h3>
        <CalendarColourPicker label="PUB GIGS" value={calColourPub} onChange={setCalColourPub} />
        <CalendarColourPicker label="CLIENT BOOKINGS" value={calColourClient} onChange={setCalColourClient} />
        <CalendarColourPicker label="PRACTICE" value={calColourPractice} onChange={setCalColourPractice} />
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

        <label className="label" htmlFor="s-cancel-threshold">CANCELLATION WINDOW (DAYS)</label>
        <div className="neu-inset">
          <input
            id="s-cancel-threshold"
            className="input-field"
            type="number"
            min={1}
            max={90}
            value={cancellationThresholdDays}
            onChange={e => setCancellationThresholdDays(parseInt(e.target.value) || 14)}
            onBlur={() => setCancellationThresholdDays(Math.max(1, Math.min(90, cancellationThresholdDays)))}
          />
        </div>
        <p className="settings-hint">Minimum days' notice required for pub gig cancellation</p>
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

        <h4 className="settings-subsection-title" style={{ marginTop: 24 }}>Background Images</h4>
        <p className="hint-text">Choose which photos appear as section backgrounds</p>

        {BG_SLOTS.map(slot => {
          const currentImg = getContent(slot.key) || slot.default;
          const isExpanded = expandedBgSlot === slot.key;
          return (
            <div key={slot.key} className="bg-picker-slot">
              <div className="bg-picker-top">
                <span className="bg-picker-label">{slot.label}</span>
                <button className="btn btn-small btn-outline" onClick={() => setExpandedBgSlot(isExpanded ? null : slot.key)}>
                  {isExpanded ? 'Close' : 'Change'}
                </button>
                {contentSaved === slot.key && <span className="content-saved-flash">Saved</span>}
              </div>
              <div className="bg-picker-preview" style={{ backgroundImage: `url('${currentImg}')` }}>
                <span className="bg-picker-preview-label">{currentImg.split('/').pop()}</span>
              </div>
              {isExpanded && (
                <div className="bg-picker-grid">
                  {ALL_BG_IMAGES.map(img => (
                    <img
                      key={img}
                      src={img}
                      alt=""
                      className={`bg-picker-thumb ${currentImg === img ? 'selected' : ''}`}
                      loading="lazy"
                      onClick={() => {
                        handleContentSave(slot.key, img);
                        setExpandedBgSlot(null);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <h4 className="settings-subsection-title" style={{ marginTop: 24 }}>Pricing Tiers</h4>
        <p className="hint-text">Edit prices, durations and features shown on the public website</p>

        {[
          { label: 'Pub Gig', key: 'pub_gig', defaultPrice: '£400–£600', defaultDuration: '2×45min + 15min encore', defaultFeatures: ['Full 4-piece band', 'PA & lighting included', 'Flexible setlist', 'Background music between sets'] },
          { label: 'Private Party', key: 'private_party', defaultPrice: '£600–£800', defaultDuration: '2×45min + 15min encore', defaultFeatures: ['Everything in Pub Gig', 'Custom setlist options', 'MC & announcements', 'Party atmosphere guaranteed'] },
          { label: 'Wedding', key: 'wedding', defaultPrice: '£800–£1,200', defaultDuration: '2×45min + 15min encore', defaultFeatures: ['Everything in Private Party', 'First dance song', 'Tailored setlist', 'Venue coordination'] },
          { label: 'Corporate', key: 'corporate', defaultPrice: '£1,000–£1,500', defaultDuration: '2×45min + 15min encore', defaultFeatures: ['Everything in Wedding', 'Corporate-appropriate setlist', 'Professional attire', 'Background music option'] },
          { label: 'Festival', key: 'festival', defaultPrice: '£1,000+', defaultDuration: '45–90min set', defaultFeatures: ['Festival-ready performance', 'High-energy crowd engagement', 'Flexible set length', 'Own backline available'] },
        ].map(tier => {
          const priceKey = `pricing_${tier.key}_price`;
          const durationKey = `pricing_${tier.key}_duration`;
          const featuresKey = `pricing_${tier.key}_features`;
          return (
            <div key={tier.key} className="pricing-edit-card neu-card" style={{ padding: 12, marginBottom: 8 }}>
              <div className="pricing-edit-header">{tier.label}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label className="label">PRICE</label>
                  <div className="neu-inset">
                    <input
                      className="input-field"
                      value={getContent(priceKey) || tier.defaultPrice}
                      onChange={e => setSiteContent(prev => ({ ...prev, [priceKey]: e.target.value }))}
                      onBlur={e => e.target.value && handleContentSave(priceKey, e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">DURATION</label>
                  <div className="neu-inset">
                    <input
                      className="input-field"
                      value={getContent(durationKey) || tier.defaultDuration}
                      onChange={e => setSiteContent(prev => ({ ...prev, [durationKey]: e.target.value }))}
                      onBlur={e => e.target.value && handleContentSave(durationKey, e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <label className="label" style={{ marginTop: 6 }}>FEATURES (one per line)</label>
              <div className="neu-inset">
                <textarea
                  className="input-field input-textarea"
                  rows={4}
                  value={(() => {
                    const raw = getContent(featuresKey);
                    if (raw) { try { return JSON.parse(raw).join('\n'); } catch { return raw; } }
                    return tier.defaultFeatures.join('\n');
                  })()}
                  onChange={e => setSiteContent(prev => ({ ...prev, [featuresKey]: JSON.stringify(e.target.value.split('\n').filter(Boolean)) }))}
                  onBlur={e => {
                    const lines = e.target.value.split('\n').filter(Boolean);
                    if (lines.length > 0) handleContentSave(featuresKey, JSON.stringify(lines));
                  }}
                />
              </div>
              {(contentSaved === priceKey || contentSaved === durationKey || contentSaved === featuresKey) && <span className="content-saved-flash">Saved</span>}
            </div>
          );
        })}

        <h4 className="settings-subsection-title" style={{ marginTop: 16 }}>Additional Services</h4>
        <p className="hint-text">One item per line</p>
        <div className="neu-inset">
          <textarea
            className="input-field input-textarea"
            rows={5}
            value={(() => {
              const raw = getContent('extras_list');
              if (raw) { try { return JSON.parse(raw).join('\n'); } catch { return raw; } }
              return 'Travel within 50 miles included\nAdditional travel: £0.50/mile\nExtra sets: £100–£200/hour\nCustom song requests (with advance notice)\nPA hire for speeches: £150';
            })()}
            onChange={e => setSiteContent(prev => ({ ...prev, extras_list: JSON.stringify(e.target.value.split('\n').filter(Boolean)) }))}
            onBlur={e => {
              const lines = e.target.value.split('\n').filter(Boolean);
              if (lines.length > 0) handleContentSave('extras_list', JSON.stringify(lines));
            }}
          />
        </div>
        {contentSaved === 'extras_list' && <span className="content-saved-flash">Saved</span>}
      </div>

      {/* Reviews */}
      <div className="settings-section">
        <h3 className="settings-section-title">Reviews</h3>
        <p className="hint-text">Manage reviews displayed on the public website</p>

        {siteReviews.length > 0 && (
          <div className="review-manage-list">
            {siteReviews.map((rev, i) => (
              <div key={rev.id}>
                <div className={`review-manage-card neu-card ${!rev.visible ? 'review-hidden' : ''}`}>
                  <div className="review-manage-top">
                    <div className="review-manage-author">{rev.author_name}</div>
                    <span className={`review-manage-source review-manage-source-${rev.source.toLowerCase()}`}>{rev.source}</span>
                  </div>
                  <div className="review-manage-stars">{'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}</div>
                  <p className="review-manage-preview">{rev.review_text.length > 120 ? rev.review_text.slice(0, 120) + '...' : rev.review_text}</p>
                  <div className="review-manage-actions">
                    <button className="btn btn-small btn-outline" onClick={() => handleMoveReview(rev.id, -1)} disabled={i === 0}>&#x2191;</button>
                    <button className="btn btn-small btn-outline" onClick={() => handleMoveReview(rev.id, 1)} disabled={i === siteReviews.length - 1}>&#x2193;</button>
                    <button className="btn btn-small btn-outline" onClick={() => handleToggleReviewVisibility(rev.id, rev.visible)}>
                      {rev.visible ? 'Hide' : 'Show'}
                    </button>
                    <button className="btn btn-small btn-outline" onClick={() => startEditReview(rev)}>Edit</button>
                    <button className="btn btn-small btn-danger" onClick={() => handleDeleteReview(rev.id)}>Del</button>
                  </div>
                </div>
                {/* Inline edit form below the card being edited */}
                {editingReviewId === rev.id && showAddReview && (
                  <div className="review-edit-form neu-card">
                    <div className="review-edit-form-header">
                      <h4>Edit Review</h4>
                      <button className="btn btn-small btn-outline" onClick={resetReviewForm}>&times;</button>
                    </div>
                    <label className="label">REVIEWER NAME *</label>
                    <div className="neu-inset"><input className="input-field" value={revAuthor} onChange={e => setRevAuthor(e.target.value)} placeholder="e.g. John Smith" /></div>
                    <label className="label">REVIEW TEXT *</label>
                    <div className="neu-inset"><textarea className="input-field input-textarea input-textarea-auto" rows={5} value={revText} onChange={e => { setRevText(e.target.value); autoGrow(e); }} onFocus={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} placeholder="Their review..." /></div>
                    <div className="review-edit-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
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
                      <div className="review-edit-grid-date">
                        <label className="label">DATE</label>
                        <div className="neu-inset"><input className="input-field" type="date" value={revDate} onChange={e => setRevDate(e.target.value)} /></div>
                      </div>
                    </div>
                    <label className="label">ORIGINAL REVIEW LINK</label>
                    <div className="neu-inset"><input className="input-field" type="url" inputMode="url" value={revSourceUrl} onChange={e => setRevSourceUrl(e.target.value)} placeholder="https://facebook.com/..." /></div>
                    <div className="form-actions">
                      <button className="btn btn-primary btn-small" onClick={handleSaveReview}>Update</button>
                      <button className="btn btn-outline btn-small" onClick={resetReviewForm}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {siteReviews.length === 0 && !showAddReview && (
          <p className="empty-text">No reviews yet</p>
        )}

        {/* Add new review form (only for new reviews, not edits) */}
        {showAddReview && !editingReviewId ? (
          <div className="review-edit-form neu-card">
            <div className="review-edit-form-header">
              <h4>Add Review</h4>
              <button className="btn btn-small btn-outline" onClick={resetReviewForm}>&times;</button>
            </div>
            <label className="label">REVIEWER NAME *</label>
            <div className="neu-inset"><input className="input-field" value={revAuthor} onChange={e => setRevAuthor(e.target.value)} placeholder="e.g. John Smith" /></div>
            <label className="label">REVIEW TEXT *</label>
            <div className="neu-inset"><textarea className="input-field input-textarea input-textarea-auto" rows={5} value={revText} onChange={e => { setRevText(e.target.value); autoGrow(e); }} onFocus={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} placeholder="Their review..." /></div>
            <div className="review-edit-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
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
              <div className="review-edit-grid-date">
                <label className="label">DATE</label>
                <div className="neu-inset"><input className="input-field" type="date" value={revDate} onChange={e => setRevDate(e.target.value)} /></div>
              </div>
            </div>
            <label className="label">ORIGINAL REVIEW LINK</label>
            <div className="neu-inset"><input className="input-field" type="url" inputMode="url" value={revSourceUrl} onChange={e => setRevSourceUrl(e.target.value)} placeholder="https://facebook.com/..." /></div>
            <div className="form-actions">
              <button className="btn btn-primary btn-small" onClick={handleSaveReview}>Add Review</button>
              <button className="btn btn-outline btn-small" onClick={resetReviewForm}>Cancel</button>
            </div>
          </div>
        ) : !showAddReview && (
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

const COLOUR_SWATCHES = [
  '#00e676', '#f39c12', '#bb86fc', '#1abc9c', '#42a5f5', '#ff5252', '#ff6ec7', '#ffd54f',
];

function CalendarColourPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label className="label">{label}</label>
      <div className="colour-swatch-grid">
        {COLOUR_SWATCHES.map(c => (
          <button
            key={c}
            className={`colour-swatch${value === c ? ' selected' : ''}`}
            style={{ background: c }}
            onClick={() => onChange(c)}
            aria-label={`Select colour ${c}`}
          >
            {value === c && <span className="colour-swatch-check">{'\u2713'}</span>}
          </button>
        ))}
      </div>
      <div className="colour-preview" style={{ background: `${value}10`, borderColor: `${value}30` }}>
        <span className="colour-preview-dot" style={{ background: value }} />
        <span className="colour-preview-label" style={{ color: value }}>{label}</span>
      </div>
    </div>
  );
}
