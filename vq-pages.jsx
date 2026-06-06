// vq-pages.jsx — all page components
const { useState, useEffect, useRef } = React;
const { BoQMockup } = window;

// ─── LANDING ────────────────────────────────────────────────────────────────────────
function LandingPage({ go, tweaks = {}, toast }) {
  const [openFaq, setOpenFaq] = useState(null);
  const videoRef     = useRef(null);
  const pinWrapRef   = useRef(null);
  const taglineRef   = useRef(null);
  const phase2Ref    = useRef(null);
  const logoRef      = useRef(null);
  const scrollHintRef = useRef(null);

  // ── GSAP scroll-scrubbed video + text phases ──────────────────────────────────
  useEffect(() => {
    const video   = videoRef.current;
    const pinWrap = pinWrapRef.current;
    if (!video || !pinWrap) return;

    // Respect users who ask for reduced motion: skip the scroll-scrub entirely.
    // CSS collapses the pin wrap to a static hero; the first frame + tagline show.
    const reduceMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      video.setAttribute('preload', 'metadata');
      return;
    }

    let triggers = [];
    let timeline = null;
    let metaHandler = null;
    let primeHandler = null;
    let onLoad = null;

    const init = () => {
      const { gsap, ScrollTrigger } = window;
      if (!gsap || !ScrollTrigger) return;
      gsap.registerPlugin(ScrollTrigger);

      const dur = video.duration || 10;

      // 1. Scrub video currentTime with scroll. Guard against piling up seeks
      //    on slow decoders by skipping updates while a seek is still in flight.
      const st = ScrollTrigger.create({
        trigger: pinWrap,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
        onUpdate: (self) => {
          if (video.readyState >= 1 && !video.seeking) {
            video.currentTime = self.progress * dur;
          }
        },
      });
      triggers.push(st);

      // 2. Text phase timeline — mapped to full scroll distance
      timeline = gsap.timeline({
        scrollTrigger: {
          trigger: pinWrap,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1.8,
        },
      });
      if (timeline.scrollTrigger) triggers.push(timeline.scrollTrigger);

      // Phase 1 tagline: fade in 0→10%, hold 10→58%, fade out 58→70%
      timeline.from(taglineRef.current, { opacity: 0, y: 26, duration: 0.10 }, 0)
        .to(taglineRef.current,   { opacity: 1,          duration: 0.48 }, 0.10)
        .to(taglineRef.current,   { opacity: 0, y: -18,  duration: 0.12 }, 0.58);

      // Scroll hint fades out as the first phase ends
      timeline.to(scrollHintRef.current, { opacity: 0, duration: 0.08 }, 0.12);

      // Phase 2 "upload measure price": fade in 68→78%, hold 78→87%, fade out 87→92%
      timeline.fromTo(phase2Ref.current,
          { opacity: 0, y: 22 },
          { opacity: 1, y: 0,  duration: 0.10 }, 0.68)
        .to(phase2Ref.current,   { opacity: 1,          duration: 0.09 }, 0.78)
        .to(phase2Ref.current,   { opacity: 0,          duration: 0.05 }, 0.87);

      // Phase 3 logo reveal: fade in 93→100%
      timeline.fromTo(logoRef.current,
          { opacity: 0, scale: 0.94 },
          { opacity: 1, scale: 1,    duration: 0.07, ease: 'power2.out' }, 0.93);

      // Recalculate trigger positions once everything below the fold has laid
      // out (fonts swapped, BoQ mockup rendered) so the scrub maps accurately.
      ScrollTrigger.refresh();
      onLoad = () => ScrollTrigger.refresh();
      window.addEventListener('load', onLoad);
    };

    // iOS Safari will not paint video frames from currentTime seeks until the
    // element has been played at least once. Prime it on the first user gesture.
    primeHandler = () => {
      const p = video.play();
      if (p && p.then) p.then(() => video.pause()).catch(() => {});
      else { try { video.pause(); } catch (e) {} }
    };
    window.addEventListener('touchstart', primeHandler, { once: true, passive: true });
    window.addEventListener('pointerdown', primeHandler, { once: true });

    // Small delay so the GSAP CDN scripts have executed before we register.
    const timer = setTimeout(() => {
      if (video.readyState >= 1) {
        init();
      } else {
        metaHandler = init;
        video.addEventListener('loadedmetadata', metaHandler, { once: true });
      }
    }, 80);

    return () => {
      clearTimeout(timer);
      if (metaHandler) video.removeEventListener('loadedmetadata', metaHandler);
      if (onLoad) window.removeEventListener('load', onLoad);
      window.removeEventListener('touchstart', primeHandler);
      window.removeEventListener('pointerdown', primeHandler);
      triggers.forEach(t => t && t.kill());
      if (timeline) timeline.kill();
      if (window.gsap) {
        window.gsap.killTweensOf([
          taglineRef.current, phase2Ref.current, logoRef.current, scrollHintRef.current,
        ]);
      }
    };
  }, []);

  const faqs = [
    { q: 'How accurate is Vulcan Quanta?',
      a: 'Our AI is trained on thousands of professional BoQs and UK drawings. Accuracy is 94% on standard projects. Every item is confidence-scored so you know exactly where to focus your review.' },
    { q: 'What drawing formats does it accept?',
      a: 'Currently PDF — raster and vector, single or multi-page. JPG and PNG support is planned.' },
    { q: 'Is my data secure?',
      a: 'Drawings are encrypted in transit and at rest, deleted after 30 days, and never used for model training. GDPR-compliant, UK-hosted.' },
    { q: 'Do I still need a qualified quantity surveyor?',
      a: 'Vulcan removes the measurement and rate-application work — typically 5–8 hours per job. A human QS still reviews every output for fitness for purpose and professional liability. You save time; you keep control.' },
    { q: 'Can I customise rate tables and output branding?',
      a: 'Pro plan includes custom branding, logo and trade breakdowns. Studio adds custom rate tables, regional overrides and up to 5 team seats.' },
  ];

  const plans = [
    { name: 'Free', price: '£0', period: 'forever', rec: false,
      feats: [
        { on: true,  t: '2 projects per month' },
        { on: true,  t: 'Watermarked output' },
        { on: true,  t: 'PDF export' },
        { on: false, t: 'Excel export' },
        { on: false, t: 'Custom branding' },
        { on: false, t: 'Priority support' },
      ],
      cta: 'Get started', action: () => go('signup') },
    { name: 'Pro', price: '£39', period: 'per month', rec: true,
      feats: [
        { on: true,  t: 'Unlimited projects' },
        { on: true,  t: 'No watermark' },
        { on: true,  t: 'PDF & Excel export' },
        { on: true,  t: 'Your branding & logo' },
        { on: true,  t: 'Custom trade sections' },
        { on: false, t: 'Team seats (up to 5)' },
      ],
      cta: 'Start free trial', action: () => go('signup') },
    { name: 'Studio', price: '£99', period: 'per month', rec: false,
      feats: [
        { on: true, t: 'Everything in Pro' },
        { on: true, t: 'Up to 5 team seats' },
        { on: true, t: 'White-label output' },
        { on: true, t: 'Custom rates & rules' },
        { on: true, t: 'Variation order templates' },
        { on: true, t: 'Priority support' },
      ],
      cta: 'Contact sales', action: () => toast('Get in touch: hello@vulcanquanta.com', 'info') },
  ];

  return (
    <>
      {/* ── 1. PINNED CINEMATIC HERO ─────────────────────────────────────────── */}
      <div ref={pinWrapRef} className="cin-pin-wrap">
        <div className="cin-sticky">
          <video
            ref={videoRef}
            className="cin-video"
            src="hero.mp4"
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            tabIndex={-1}
          />
          <div className="cin-overlay" />

          {/* Phase 1 — Tagline */}
          <div ref={taglineRef} className="cin-content">
            <p className="cin-eyebrow">Vulcan Quanta</p>
            <h1 className="cin-h1">
              Cost plans that used<br />to take days.<br />Now they don't.
            </h1>
            <button
              className="btn btn-amber btn-pill"
              style={{ padding: '14px 28px', fontSize: '15px', fontWeight: 600 }}
              onClick={() => go('signup')}
            >
              Start free
            </button>
            <p className="cin-hero-note">
              No credit card required · UK quantity surveying · AI-powered
            </p>
          </div>

          {/* Phase 2 — Process hint */}
          <div ref={phase2Ref} className="cin-content cin-phase2">
            <p className="cin-eyebrow">The process</p>
            <p className="cin-h2">Upload. Measure. Price.</p>
            <p className="cin-phase2-sub">
              From drawing to itemised Bill of Quantities. Under 2 minutes.
            </p>
          </div>

          {/* Phase 3 — Logo reveal (inline SVG: transparent, scalable, always renders) */}
          <div ref={logoRef} className="cin-logo-reveal" role="img" aria-label="Vulcan Quanta">
            <svg className="cin-logo-img" viewBox="0 0 120 80" fill="none"
                 xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <polyline points="8,12 33,66 58,12" stroke="#FAFAFA"
                        strokeWidth="11" strokeLinejoin="miter" strokeLinecap="square" />
              <circle cx="89" cy="40" r="25" stroke="var(--amber)" strokeWidth="11" />
              <line x1="95" y1="50" x2="113" y2="71" stroke="var(--amber)"
                    strokeWidth="11" strokeLinecap="square" />
            </svg>
            <p className="cin-logo-wordmark">VULCAN QUANTA</p>
            <p className="cin-logo-tagline">AI-Powered Quantity Surveying</p>
          </div>

          {/* Scroll cue */}
          <div ref={scrollHintRef} className="cin-scroll-hint" aria-hidden="true">
            <div className="cin-scroll-line" />
            <span>Scroll</span>
          </div>
        </div>
      </div>

      {/* ── 2. EDITORIAL STATEMENT ───────────────────────────────────────────── */}
      <section className="cin-statement">
        <div className="inner">
          <p className="cin-section-label">The work</p>
          <p className="cin-statement-text">
            Vulcan reads your drawings. Every wall, every span, every height.
            Priced to BCIS. Structured to NRM2. Ready to issue.
          </p>
        </div>
      </section>

      {/* ── 3. THREE-STEP PROCESS ────────────────────────────────────────────── */}
      <section className="cin-process">
        <div className="inner">
          <p className="cin-section-label">Three steps</p>
          <h2 className="cin-section-h">From drawing to priced BoQ.</h2>
          <div className="cin-process-grid">
            {[
              { n: '01', title: 'Upload your drawing',
                desc: 'Drag a PDF — single or multi-page, raster or vector. Takes seconds.' },
              { n: '02', title: 'Vulcan measures and prices',
                desc: 'AI reads every element, applies current BCIS rates, and produces a fully itemised BoQ. Under 2 minutes.' },
              { n: '03', title: 'Review, edit, export',
                desc: 'Edit any item inline. Export as PDF or Excel, ready to issue under your own branding.' },
            ].map((s, i) => (
              <div key={i} className="cin-process-item">
                <p className="cin-process-num">{s.n}</p>
                <p className="cin-process-title">{s.title}</p>
                <p className="cin-process-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. PRODUCT SPLIT — BoQ MOCKUP ────────────────────────────────────── */}
      <section className="cin-split">
        <div className="cin-split-inner">
          <div>
            <p className="cin-section-label-dk">Output</p>
            <h2 className="cin-section-h-lt">A professional BoQ, ready to issue.</h2>
            <p className="cin-split-sub">
              Every element measured. Every item priced to BCIS Q2 2026 rates.
              Confidence-scored. Structured to NRM2.
            </p>
            <button
              className="btn btn-amber btn-pill"
              style={{ marginTop: '32px', padding: '14px 28px', fontSize: '15px', fontWeight: 600 }}
              onClick={() => go('results')}
            >
              See a sample BoQ →
            </button>
          </div>
          <div>
            <BoQMockup />
          </div>
        </div>
      </section>

      {/* ── 5. CAPABILITY GRID ───────────────────────────────────────────────── */}
      <section className="cin-features">
        <div className="inner">
          <p className="cin-section-label-dk">Capabilities</p>
          <h2 className="cin-section-h-lt">Built for professional work.</h2>
          <div className="cin-feat-grid">
            {[
              { name: 'Automated measurement',
                desc: 'Reads every wall, opening, span and height directly from your PDF. No manual scaling.' },
              { name: 'Current UK rates',
                desc: 'BCIS Q2 2026 labour and material rates, with regional variations included.' },
              { name: 'Confidence scoring',
                desc: 'Every item flagged for confidence level. Low-confidence items highlighted for review.' },
              { name: 'Professional export',
                desc: 'PDF and Excel output. Your branding on Pro and Studio plans. Ready to issue.' },
              { name: 'Variation orders',
                desc: 'Duplicate, edit and track additions with a timestamped audit trail.' },
              { name: 'Your branding',
                desc: 'Add your logo, address and colours to every output on Pro and Studio plans.' },
            ].map((f, i) => (
              <div key={i} className="cin-feat-item">
                <p className="cin-feat-name">{f.name}</p>
                <p className="cin-feat-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. PROOF — REAL CLAIMS ONLY ──────────────────────────────────────── */}
      <section className="cin-proof">
        <div className="inner">
          <p className="cin-section-label">What you can rely on</p>
          <h2 className="cin-section-h">Methodology and data.</h2>
          <div className="cin-proof-grid">
            {[
              { label: 'Accuracy',
                claim: '94% accuracy on standard UK construction projects.',
                note: 'Trained on thousands of professional BoQs and UK drawings. Every item is confidence-scored.' },
              { label: 'Rates',
                claim: 'BCIS Q2 2026 labour and material rates.',
                note: 'National schedule with regional variations. Updated quarterly to reflect current market costs.' },
              { label: 'Data',
                claim: 'GDPR-compliant. UK-hosted. Deleted after 30 days.',
                note: 'Encrypted in transit and at rest. Your drawings are never used for model training.' },
              { label: 'Standard',
                claim: 'Output structured to NRM2.',
                note: 'Aligned with the RICS standard method of measurement. Professional QS review always recommended.' },
              { label: 'Control',
                claim: 'Human approval is always required.',
                note: 'Every output is a reviewable draft. Vulcan removes the measurement work — not the professional.' },
              { label: 'Status',
                claim: 'Private beta. Built with QS practices.',
                note: 'We are working with a select group of UK builders and QS firms before full public launch.' },
            ].map((p, i) => (
              <div key={i} className="cin-proof-item">
                <p className="cin-proof-label">{p.label}</p>
                <p className="cin-proof-claim">{p.claim}</p>
                <p className="cin-proof-note">{p.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. PRICING ───────────────────────────────────────────────────────── */}
      <section className="cin-pricing">
        <div className="inner">
          <p className="cin-section-label-dk">Pricing</p>
          <h2 className="cin-section-h-lt">Simple pricing. No surprises.</h2>
          <p className="cin-pricing-sub">Start free. Scale as you grow. No long-term contracts.</p>
          <div className="pricing-grid" style={{ marginTop: '64px' }}>
            {plans.map((plan, i) => (
              <div key={i} className={`pricing-card ${plan.rec ? 'rec' : ''}`}>
                {plan.rec && <p className="pricing-badge">Most popular</p>}
                <p className="pricing-name">{plan.name}</p>
                <p className="pricing-price">{plan.price}</p>
                <p className="pricing-period">{plan.period}</p>
                <ul className="pricing-feats">
                  {plan.feats.map((f, j) =>
                    <li key={j} className={f.on ? 'on' : 'off'}>{f.t}</li>
                  )}
                </ul>
                <button
                  className={`btn btn-pill ${plan.rec ? 'btn-amber' : 'btn-outline'}`}
                  style={{ width: '100%' }}
                  onClick={plan.action}
                >{plan.cta}</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. FAQ ───────────────────────────────────────────────────────────── */}
      <section className="cin-faq">
        <div className="inner">
          <p className="cin-section-label-dk">Questions</p>
          <h2 className="cin-section-h-lt" style={{ marginBottom: '56px' }}>Frequently asked.</h2>
          <div className="acc-wrap">
            {faqs.map((item, i) => (
              <div key={i} className="acc-item">
                <button
                  type="button"
                  className="acc-hd"
                  style={{ width: '100%', textAlign: 'left' }}
                  aria-expanded={openFaq === i}
                  aria-controls={`faq-body-${i}`}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="acc-q">{item.q}</span>
                  <svg
                    className={`acc-chevron ${openFaq === i ? 'open' : ''}`}
                    viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                <div id={`faq-body-${i}`} className={`acc-body ${openFaq === i ? 'open' : ''}`}>
                  <p>{item.a}</p>
                </div>
              </div>
            ))}
          </div>
          <p style={{ marginTop: '48px', fontSize: '14px', color: 'var(--c-400)' }}>
            Anything else? <a href="mailto:hello@vulcanquanta.com" style={{ color: 'var(--amber)', fontWeight: 600 }}>hello@vulcanquanta.com</a>
          </p>
        </div>
      </section>

      {/* ── 9. FINAL CTA ─────────────────────────────────────────────────────── */}
      <section className="cin-cta">
        <div className="inner" style={{ textAlign: 'center' }}>
          <p className="cin-eyebrow" style={{ color: 'rgba(255,255,255,0.28)', marginBottom: '28px' }}>Vulcan Quanta</p>
          <h2 className="cin-cta-h">Cost plans that used<br />to take days.</h2>
          <p className="cin-cta-sub">Now they don't.</p>
          <div className="cin-cta-actions">
            <button className="btn btn-amber btn-pill btn-lg" onClick={() => go('signup')}>
              Start free
            </button>
            <button className="btn-ghost-lt" onClick={() => go('results')}>
              See a sample BoQ →
            </button>
          </div>
          <p style={{ marginTop: '28px', fontSize: '13px', color: 'rgba(255,255,255,0.22)' }}>
            No credit card required · Cancel anytime
          </p>
        </div>
      </section>

      {/* Security strip */}
      <div className="sec-strip">
        <div className="inner">
          <div className="sec-items">
            {[
              { icon: '🔒', text: 'GDPR compliant' },
              { icon: '🛡️', text: 'Encrypted at rest' },
              { icon: '🇬🇧', text: 'UK-hosted' },
              { icon: '👤', text: 'Human review built in' },
            ].map((s, i) => (
              <div key={i} className="sec-item"><span>{s.icon}</span><span>{s.text}</span></div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── RESULTS ───────────────────────────────────────────────────────────────────────
function ResultsPage({ go, toast }) {
  const [pdfState, setPdfState] = useState('idle');
  const [contingency, setContingency] = useState(10);

  const baseItems = [
    { id: 1, trade: 'Groundworks', desc: 'Excavation to reduced level', qty: 250, unit: 'm²', rate: 8.50, flag: false },
    { id: 2, trade: 'Groundworks', desc: 'Concrete strip foundations', qty: 85, unit: 'm³', rate: 95.00, flag: false },
    { id: 3, trade: 'Brickwork', desc: 'Common brickwork, stretcher bond', qty: 2400, unit: 'No', rate: 0.65, flag: true },
    { id: 4, trade: 'Brickwork', desc: 'Blockwork (common)', qty: 1850, unit: 'No', rate: 0.45, flag: false },
    { id: 5, trade: 'Carpentry', desc: 'Timber joists 4×2"', qty: 450, unit: 'lm', rate: 2.20, flag: false },
    { id: 6, trade: 'Roofing', desc: 'Clay tile roof covering', qty: 320, unit: 'm²', rate: 38.50, flag: true },
    { id: 7, trade: 'Plastering', desc: 'Internal plaster (float & set)', qty: 980, unit: 'm²', rate: 7.50, flag: false },
    { id: 8, trade: 'Electrical', desc: 'Cable & conduit first fix', qty: 1200, unit: 'lm', rate: 3.20, flag: false },
    { id: 9, trade: 'Plumbing', desc: 'Water pipes (15mm copper)', qty: 450, unit: 'lm', rate: 5.50, flag: false },
    { id: 10, trade: 'Finishes', desc: 'Emulsion paint (2 coats)', qty: 1420, unit: 'm²', rate: 2.10, flag: false },
  ];
  const [qtys, setQtys] = useState(() => Object.fromEntries(baseItems.map(i => [i.id, i.qty])));
  const fmt = n => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const calc = (id, rate) => (qtys[id] || 0) * rate;
  const trades = ['Groundworks','Brickwork','Carpentry','Roofing','Plastering','Electrical','Plumbing','Finishes'];
  const subtotal = baseItems.reduce((s, i) => s + calc(i.id, i.rate), 0);
  const contAmt = subtotal * (contingency / 100);
  const grandTotal = subtotal + contAmt;
  let rowIdx = 0;

  const handlePDF = () => {
    if (pdfState !== 'idle') return;
    setPdfState('generating');
    toast('Generating your PDF…', 'info');
    setTimeout(() => {
      setPdfState('done');
      toast('PDF export coming soon — your BoQ has been saved to your account.', 'success');
      setTimeout(() => setPdfState('idle'), 5000);
    }, 1500);
  };

  return (
    <div className="res-wrap">
      <div className="res-pad">
        <span className="res-back" onClick={() => go('dashboard')}>← Back to dashboard</span>
        <h1 className="res-title">Bill of Quantities</h1>
        <div className="res-meta">
          <span><strong>Drawing:</strong> Commercial Unit — Main Floor Plan</span>
          <span><strong>Processed:</strong> 4 Jun 2026</span>
          <span><strong>Rates:</strong> BCIS Q2 2026</span>
        </div>
        <div className="conf-row">
          <span className="conf-lbl">Confidence:</span>
          <div className="conf-track"><div className="conf-fill" style={{ width: '92%' }} /></div>
          <span className="conf-pct">92%</span>
          <span className="conf-note">— 2 items flagged for review</span>
        </div>
        <p className="res-disclaimer">AI-generated draft — professional review required before issue to client. Edit inline, then export.</p>
        <div className="res-controls">
          <button className="btn btn-amber btn-pill" onClick={handlePDF} disabled={pdfState === 'generating'}>
            {pdfState === 'idle' && '↓ Download PDF'}
            {pdfState === 'generating' && '⏳ Generating…'}
            {pdfState === 'done' && '✓ Saved to account'}
          </button>
          <button className="btn btn-outline btn-pill" onClick={() => toast('Excel export coming soon — your BoQ data is ready.', 'info')}>📊 Excel</button>
          <button className="btn btn-outline btn-pill" onClick={() => { navigator.clipboard?.writeText?.(window.location.href); toast('Share link copied to clipboard!', 'success'); }}>🔗 Share</button>
        </div>

        <table className="rboq">
          <thead>
            <tr>
              <th>Description</th>
              <th className="r">Qty</th>
              <th className="r">Unit</th>
              <th className="r">Unit rate</th>
              <th className="r">Line total</th>
            </tr>
          </thead>
          <tbody>
            {trades.map(trade => {
              const tItems = baseItems.filter(i => i.trade === trade);
              const tTotal = tItems.reduce((s, i) => s + calc(i.id, i.rate), 0);
              return (
                <React.Fragment key={trade}>
                  <tr className="rboq-trade"><td colSpan="5">{trade}</td></tr>
                  {tItems.map(item => {
                    rowIdx++;
                    return (
                      <tr key={item.id} className={`rboq-item${rowIdx % 2 === 0 ? ' alt' : ''}${item.flag ? ' flagged' : ''}`}>
                        <td>{item.desc}{item.flag && <span className="flag-chip">⚠ Verify</span>}</td>
                        <td className="r">
                          <input className="edit-inp" type="number"
                            value={qtys[item.id]}
                            onChange={e => setQtys(p => ({ ...p, [item.id]: parseFloat(e.target.value) || 0 }))} />
                        </td>
                        <td className="r">{item.unit}</td>
                        <td className="r">{fmt(item.rate)}</td>
                        <td className="r fw">{fmt(calc(item.id, item.rate))}</td>
                      </tr>
                    );
                  })}
                  <tr className="rboq-sub">
                    <td colSpan="4" style={{ textAlign: 'right' }}>Subtotal — {trade}</td>
                    <td className="r">{fmt(tTotal)}</td>
                  </tr>
                </React.Fragment>
              );
            })}
            <tr className="rboq-sub rboq-sub-main">
              <td colSpan="4" style={{ textAlign: 'right' }}>Works subtotal</td>
              <td className="r">{fmt(subtotal)}</td>
            </tr>
            <tr className="rboq-item">
              <td>Contingency / risk allowance</td>
              <td className="r" colSpan="2">
                <input className="edit-inp" type="number" value={contingency}
                  onChange={e => setContingency(parseFloat(e.target.value) || 0)}
                  style={{ width: '48px' }} /> %
              </td>
              <td></td>
              <td className="r fw">{fmt(contAmt)}</td>
            </tr>
            <tr className="rboq-total">
              <td colSpan="4" style={{ textAlign: 'right' }}>Grand Total (ex. VAT)</td>
              <td className="r">{fmt(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ marginTop: '20px', fontSize: '12px', color: 'var(--c-400)', fontStyle: 'italic' }}>
          AI-estimated using BCIS Q2 2026 rates. Subject to market variation and supplier pricing. Professional QS review recommended before tender or client issue.
        </p>
      </div>
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────────────
function DashboardPage({ go, toast }) {
  const handleSignOut = async () => {
    if (window.VQAuth) {
      await window.VQAuth.signOut();
    } else {
      go('landing');
    }
  };

  return (
    <div className="dash-wrap">
      <aside className="dash-side">
        <p className="side-lbl">Workspace</p>
        <div className="side-item active" onClick={() => {}}>
          <span>📋</span><span>Projects</span>
        </div>
        <div className="side-item" onClick={() => go('upload')}>
          <span>➕</span><span>New project</span>
        </div>
        <p className="side-lbl">Account</p>
        <div className="side-item" onClick={() => go('settings')}>
          <span>⚙️</span><span>Settings</span>
        </div>
        <div className="side-item" onClick={handleSignOut}>
          <span style={{ fontSize: '12px' }}>→</span><span>Sign out</span>
        </div>
      </aside>
      <main className="dash-main">
        <div className="dash-hd">
          <h1 className="dash-h1">Projects</h1>
          <button className="btn btn-amber btn-pill" onClick={() => go('upload')}>+ New project</button>
        </div>
        <div className="empty-state">
          <div className="empty-icon">📄</div>
          <h3 className="empty-h">No projects yet</h3>
          <p className="empty-p">Upload an architectural drawing and Vulcan will produce a priced Bill of Quantities in under 2 minutes.</p>
          <button className="btn btn-amber btn-lg btn-pill" onClick={() => go('upload')}>Upload first drawing</button>
          <span className="demo-lnk" onClick={() => go('results')}>Or view a demo project →</span>
        </div>
      </main>
    </div>
  );
}

// ─── UPLOAD ─────────────────────────────────────────────────────────────────────────
function UploadPage({ go, toast }) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('idle');

  const processFile = name => {
    setFileName(name);
    setStatus('uploading');
    setProgress(0);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 15 + 8;
      if (p >= 100) {
        clearInterval(iv);
        setProgress(100);
        setStatus('processing');
        setTimeout(() => { setStatus('done'); setTimeout(() => go('results'), 700); }, 1200);
      } else {
        setProgress(p);
      }
    }, 200);
  };

  const statusMsg = { uploading: 'Uploading drawing…', processing: 'AI reading your drawing…', done: '✓ Ready! Opening your BoQ…' };
  const barColor = status === 'done' ? 'var(--green)' : status === 'processing' ? 'var(--amber)' : 'var(--blue)';

  return (
    <div className="upload-page">
      <div className="upload-wrap">
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 className="display-md" style={{ marginBottom: '8px' }}>Upload a drawing</h2>
          <p style={{ color: 'var(--c-400)', fontSize: '15px' }}>PDF, single or multi-page. Raster or vector. Up to 50 MB.</p>
        </div>
        <div
          className={`upload-zone${dragOver ? ' drag' : ''}`}
          onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0].name); }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => document.getElementById('vq-file-input').click()}
        >
          <p className="upload-icon">📄</p>
          <p className="upload-h">Drop your drawing here</p>
          <p className="upload-sub">or click to select a file</p>
          {status === 'idle' && (
            <button className="btn btn-outline btn-pill" onClick={e => { e.stopPropagation(); document.getElementById('vq-file-input').click(); }}>
              Select PDF
            </button>
          )}
          <input id="vq-file-input" type="file" accept=".pdf" style={{ display: 'none' }}
            onChange={e => { if (e.target.files[0]) processFile(e.target.files[0].name); }} />
        </div>
        {fileName && (
          <div className="upload-status">
            <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--c-950)', marginBottom: '6px' }}>{fileName}</p>
            <p style={{ fontSize: '13px', color: status === 'done' ? 'var(--green)' : 'var(--c-400)', marginBottom: '12px' }}>{statusMsg[status]}</p>
            <div className="upload-track">
              <div className="upload-bar" style={{ width: `${progress}%`, background: barColor }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SETTINGS ───────────────────────────────────────────────────────────────────────
function SettingsPage({ go, toast }) {
  const [tab, setTab] = useState('account');
  const [saved, setSaved] = useState({});
  const save = key => { setSaved(p => ({ ...p, [key]: true })); toast('Changes saved.', 'success'); setTimeout(() => setSaved(p => ({ ...p, [key]: false })), 2000); };

  const tabs = [{ id: 'account', icon: '👤', label: 'Account' },{ id: 'branding', icon: '🎨', label: 'Branding' },{ id: 'rates', icon: '💷', label: 'Rates' },{ id: 'billing', icon: '💳', label: 'Billing' }];

  return (
    <div className="dash-wrap">
      <aside className="dash-side">
        <div style={{ padding: '0 24px 16px' }}>
          <span style={{ fontSize: '13px', color: 'var(--amber)', cursor: 'pointer', fontWeight: 600 }} onClick={() => go('dashboard')}>← Dashboard</span>
        </div>
        <p className="side-lbl">Settings</p>
        {tabs.map(t => (
          <div key={t.id} className={`side-item${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            <span>{t.icon}</span><span>{t.label}</span>
          </div>
        ))}
      </aside>
      <main className="dash-main">
        {tab === 'account' && (
          <>
            <div className="dash-hd"><h1 className="dash-h1">Account</h1></div>
            <div className="scard">
              <p className="scard-title">Personal details</p>
              <div className="form-grid">
                <div className="fld"><label className="flbl">First name</label><input className="finp" defaultValue="James" /></div>
                <div className="fld"><label className="flbl">Last name</label><input className="finp" defaultValue="Henderson" /></div>
                <div className="fld"><label className="flbl">Email address</label><input className="finp" type="email" defaultValue="james@henderson-qs.co.uk" /></div>
                <div className="fld"><label className="flbl">Phone</label><input className="finp" type="tel" defaultValue="+44 7700 900000" /></div>
              </div>
              <button className="btn btn-amber btn-pill" onClick={() => save('account')}>{saved.account ? '✓ Saved' : 'Save changes'}</button>
            </div>
            <div className="scard">
              <p className="scard-title">Change password</p>
              <div className="form-grid">
                <div className="fld"><label className="flbl">Current password</label><input className="finp" type="password" placeholder="••••••••" /></div>
                <div className="fld"><label className="flbl">New password</label><input className="finp" type="password" placeholder="••••••••" /></div>
              </div>
              <button className="btn btn-outline btn-pill" onClick={() => save('password')}>{saved.password ? '✓ Updated' : 'Update password'}</button>
            </div>
            <div className="scard">
              <p className="scard-title" style={{ color: 'var(--red)' }}>Danger zone</p>
              <p style={{ fontSize: '14px', color: 'var(--c-600)', marginBottom: '16px' }}>Permanently delete your account. Cannot be undone.</p>
              <button className="btn btn-pill" style={{ background: 'var(--red)', color: 'white' }} onClick={() => toast('Contact support to delete your account.', 'info')}>Delete account</button>
            </div>
          </>
        )}
        {tab === 'branding' && (
          <>
            <div className="dash-hd"><h1 className="dash-h1">Branding</h1></div>
            <div className="scard">
              <p className="scard-title">Company identity</p>
              <p style={{ fontSize: '14px', color: 'var(--c-400)', marginBottom: '20px' }}>Appears on all exported BoQs. Available on Pro and Studio plans.</p>
              <div className="form-grid">
                <div className="fld"><label className="flbl">Company name</label><input className="finp" defaultValue="Henderson QS Ltd" /></div>
                <div className="fld"><label className="flbl">Website</label><input className="finp" defaultValue="www.henderson-qs.co.uk" /></div>
                <div className="fld"><label className="flbl">Address</label><input className="finp" defaultValue="12 Victoria Street" /></div>
                <div className="fld"><label className="flbl">City / Postcode</label><input className="finp" defaultValue="Manchester, M1 2EX" /></div>
              </div>
            </div>
            <div className="scard">
              <p className="scard-title">Logo</p>
              <div className="upload-zone" style={{ padding: '32px' }} onClick={() => toast('Logo upload coming soon.', 'info')}>
                <p style={{ fontSize: '14px', color: 'var(--c-400)' }}>Drop your logo here or click to upload. PNG or SVG, max 2 MB.</p>
              </div>
            </div>
            <div className="scard">
              <p className="scard-title">Brand colours</p>
              <div className="form-grid">
                <div className="fld"><label className="flbl">Primary colour</label><input className="finp" defaultValue="#F97316" /></div>
                <div className="fld"><label className="flbl">Secondary / footer</label><input className="finp" defaultValue="#0F172A" /></div>
              </div>
              <button className="btn btn-amber btn-pill" onClick={() => save('branding')}>{saved.branding ? '✓ Saved' : 'Save branding'}</button>
            </div>
          </>
        )}
        {tab === 'rates' && (
          <>
            <div className="dash-hd"><h1 className="dash-h1">Rate overrides</h1></div>
            <div className="scard">
              <p className="scard-title">Regional settings</p>
              <p style={{ fontSize: '14px', color: 'var(--c-400)', marginBottom: '20px' }}>Base rates follow BCIS Q2 2026. Override individual trades below. Leave blank to use BCIS defaults.</p>
              <div className="form-grid">
                <div className="fld"><label className="flbl">Region</label>
                  <select className="finp">{['North West England','London','South East','Yorkshire','East Midlands','West Midlands','Scotland','Wales'].map(r => <option key={r}>{r}</option>)}</select>
                </div>
                <div className="fld"><label className="flbl">Regional uplift (%)</label><input className="finp" type="number" defaultValue="0" /></div>
              </div>
            </div>
            <div className="scard">
              <p className="scard-title">Trade overrides (£/unit)</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead><tr style={{ background: 'var(--c-50)', borderBottom: '1px solid var(--c-200)' }}>
                  {['Trade','BCIS default','Your override'].map(h => <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--c-600)', fontSize: '13px' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {[['Brickwork (stretcher bond)','£0.65/No'],['Blockwork (common)','£0.45/No'],['Clay tile roof covering','£38.50/m²'],['Internal plaster','£7.50/m²'],['Emulsion paint (2 coats)','£2.10/m²']].map(([trade, bcis], i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--c-100)' }}>
                      <td style={{ padding: '12px 16px' }}>{trade}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--c-400)' }}>{bcis}</td>
                      <td style={{ padding: '12px 16px' }}><input type="text" placeholder="e.g. 0.70" className="finp" style={{ width: '120px' }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: '24px' }}>
                <button className="btn btn-amber btn-pill" onClick={() => save('rates')}>{saved.rates ? '✓ Saved' : 'Save rate overrides'}</button>
              </div>
            </div>
          </>
        )}
        {tab === 'billing' && (
          <>
            <div className="dash-hd"><h1 className="dash-h1">Billing</h1></div>
            <div className="scard">
              <p className="scard-title">Current plan</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'var(--c-50)', borderRadius: '8px', marginBottom: '16px' }}>
                <div><p style={{ fontWeight: 700, fontSize: '18px', marginBottom: '4px' }}>Pro — £39/month</p><p style={{ fontSize: '13px', color: 'var(--c-400)' }}>Renews 4 July 2026</p></div>
                <button className="btn btn-outline btn-pill btn-sm" onClick={() => go('pricing')}>Change plan</button>
              </div>
            </div>
            <div className="scard">
              <p className="scard-title">Payment method</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', border: '1px solid var(--c-200)', borderRadius: '6px', marginBottom: '12px' }}>
                <span style={{ fontSize: '14px' }}>Visa ···· 4242 · Exp 12/28</span>
                <button className="btn btn-ghost btn-sm" onClick={() => toast('Payment management coming soon.', 'info')}>Replace</button>
              </div>
              <button className="btn btn-outline btn-pill btn-sm" onClick={() => toast('Payment management coming soon.', 'info')}>+ Add payment method</button>
            </div>
            <div className="scard">
              <p className="scard-title">Invoices</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead><tr style={{ background: 'var(--c-50)', borderBottom: '1px solid var(--c-200)' }}>
                  {['Date','Amount','Status',''].map((h, i) => <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--c-600)', fontSize: '13px' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {[['4 Jun 2026','£39.00'],['4 May 2026','£39.00'],['4 Apr 2026','£39.00']].map(([date, amount], i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--c-100)' }}>
                      <td style={{ padding: '12px 16px' }}>{date}</td>
                      <td style={{ padding: '12px 16px' }}>{amount}</td>
                      <td style={{ padding: '12px 16px' }}><span style={{ color: 'var(--green)', fontWeight: 600 }}>Paid</span></td>
                      <td style={{ padding: '12px 16px' }}><button className="btn btn-ghost btn-sm" onClick={() => toast('Invoice PDF download coming soon.', 'info')}>Download</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ─── SIGN UP ───────────────────────────────────────────────────────────────────────
function SignUpPage({ go, toast, plan = 'pro' }) {
  const [selectedPlan, setSelectedPlan] = useState(plan);
  const [name, setName]                 = useState('');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');

    if (!name.trim())  { setError('Please enter your full name.');            return; }
    if (!email)        { setError('Please enter your work email.');            return; }
    if (!password)     { setError('Please choose a password.');               return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }

    if (!window.VQAuth) {
      setError('Authentication is not configured. Please contact support.');
      return;
    }

    setLoading(true);
    const { data, error: err } = await window.VQAuth.signUp(email, password, name.trim(), selectedPlan);
    setLoading(false);

    if (err) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists')) {
        setError('An account with this email already exists. Try signing in instead.');
      } else {
        setError(msg || 'Could not create account. Please try again.');
      }
      return;
    }

    if (data && data.session) {
      go('dashboard');
    } else {
      go('checkemail', { pendingEmail: email });
    }
  };

  return (
    <div className="signin-pg">
      <div className="signin-card" style={{ maxWidth: '440px' }}>
        <img src="logo-transparent.png" alt="Vulcan Quanta"
          style={{ height: '48px', marginBottom: '32px', display: 'block', cursor: 'pointer' }}
          onClick={() => go('landing')} />
        <h1 className="signin-h">Create your account</h1>
        <p className="signin-sub" style={{ marginBottom: '24px' }}>Get a priced BoQ in under 2 minutes.</p>

        {error && <div className="auth-err" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="fld" style={{ marginBottom: '16px' }}>
            <label className="flbl" htmlFor="su-plan">Plan</label>
            <select id="su-plan" className="finp" value={selectedPlan}
              onChange={e => setSelectedPlan(e.target.value)}>
              <option value="free">Free — £0/month</option>
              <option value="pro">Pro — £39/month</option>
              <option value="studio">Studio — £99/month</option>
            </select>
          </div>
          <div className="fld" style={{ marginBottom: '16px' }}>
            <label className="flbl" htmlFor="su-name">Full name</label>
            <input id="su-name" className="finp" type="text" placeholder="James Henderson"
              value={name} onChange={e => setName(e.target.value)}
              autoComplete="name" required autoFocus />
          </div>
          <div className="fld" style={{ marginBottom: '16px' }}>
            <label className="flbl" htmlFor="su-email">Work email</label>
            <input id="su-email" className="finp" type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)}
              autoComplete="email" required />
          </div>
          <div className="fld" style={{ marginBottom: '28px' }}>
            <label className="flbl" htmlFor="su-pw">Password</label>
            <input id="su-pw" className="finp" type="password" placeholder="8+ characters"
              value={password} onChange={e => setPassword(e.target.value)}
              autoComplete="new-password" required />
          </div>
          <button className="btn btn-amber btn-pill" style={{ width: '100%' }}
            type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p style={{ marginTop: '16px', fontSize: '12px', color: 'var(--c-400)', textAlign: 'center', lineHeight: '1.6' }}>
          By creating an account you agree to our{' '}
          <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>Terms of Service</span>
          {' '}and{' '}
          <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>Privacy Policy</span>.
        </p>
        <p style={{ marginTop: '16px', textAlign: 'center', fontSize: '13px', color: 'var(--c-400)' }}>
          Already have an account?{' '}
          <span style={{ color: 'var(--amber)', fontWeight: 600, cursor: 'pointer' }}
            onClick={() => go('signin')}>Sign in →</span>
        </p>
      </div>
    </div>
  );
}

// ─── SIGN IN ───────────────────────────────────────────────────────────────────────
function SignInPage({ go, toast }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');

    if (!email || !password) { setError('Please fill in all fields.'); return; }

    if (!window.VQAuth) {
      setError('Authentication is not configured. Please contact support.');
      return;
    }

    setLoading(true);
    const { data, error: err } = await window.VQAuth.signIn(email, password);
    setLoading(false);

    if (err) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('credentials')) {
        setError('Incorrect email or password. Please check and try again.');
      } else if (msg.toLowerCase().includes('email not confirmed')) {
        setError('Please verify your email before signing in. Check your inbox.');
      } else {
        setError(msg || 'Sign in failed. Please try again.');
      }
      return;
    }

    go('dashboard');
  };

  return (
    <div className="signin-pg">
      <div className="signin-card">
        <img src="logo-transparent.png" alt="Vulcan Quanta"
          style={{ height: '48px', marginBottom: '32px', cursor: 'pointer', display: 'block' }}
          onClick={() => go('landing')} />
        <h1 className="signin-h">Sign in</h1>
        <p className="signin-sub" style={{ marginBottom: '28px' }}>Welcome back.</p>

        {error && <div className="auth-err" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="fld" style={{ marginBottom: '16px' }}>
            <label className="flbl" htmlFor="si-email">Email address</label>
            <input id="si-email" className="finp" type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)}
              autoComplete="email" required autoFocus />
          </div>
          <div className="fld" style={{ marginBottom: '28px' }}>
            <label className="flbl" htmlFor="si-pw">Password</label>
            <input id="si-pw" className="finp" type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
              autoComplete="current-password" required />
          </div>
          <button className="btn btn-amber btn-pill" style={{ width: '100%' }}
            type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', fontSize: '13px' }}>
          <span style={{ color: 'var(--blue)', cursor: 'pointer' }}
            onClick={() => go('landing')}>← Home</span>
          <span style={{ color: 'var(--blue)', cursor: 'pointer' }}
            onClick={() => go('forgotpassword')}>Forgot password?</span>
        </div>
        <p style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--c-400)' }}>
          No account?{' '}
          <span style={{ color: 'var(--amber)', fontWeight: 600, cursor: 'pointer' }}
            onClick={() => go('signup')}>Start free →</span>
        </p>
      </div>
    </div>
  );
}

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────────────
function ForgotPasswordPage({ go, toast }) {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [sent, setSent]       = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');

    if (!email) { setError('Please enter your email address.'); return; }

    if (!window.VQAuth) {
      setError('Authentication is not configured. Please contact support.');
      return;
    }

    setLoading(true);
    const redirectTo = window.location.href.split('#')[0];
    const { error: err } = await window.VQAuth.forgotPassword(email, redirectTo);
    setLoading(false);

    if (err) {
      setError(err.message || 'Failed to send reset email. Please try again.');
      return;
    }

    setSent(true);
  };

  if (sent) {
    return (
      <div className="signin-pg">
        <div className="signin-card" style={{ textAlign: 'center' }}>
          <img src="logo-transparent.png" alt="Vulcan Quanta"
            style={{ height: '48px', marginBottom: '32px', display: 'block', margin: '0 auto 32px' }} />
          <div style={{ width: '64px', height: '64px', background: 'rgba(249,115,22,0.1)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '28px' }}>
            ✉️
          </div>
          <h1 className="signin-h" style={{ marginBottom: '12px' }}>Check your inbox</h1>
          <p style={{ color: 'var(--c-500)', fontSize: '15px', lineHeight: '1.65', marginBottom: '8px' }}>
            We sent a reset link to
          </p>
          <p style={{ fontWeight: 700, color: 'var(--c-950)', fontSize: '15px', marginBottom: '24px', wordBreak: 'break-word' }}>
            {email}
          </p>
          <p style={{ color: 'var(--c-500)', fontSize: '14px', lineHeight: '1.65', marginBottom: '28px' }}>
            Click the link in the email to choose a new password. The link expires in 1 hour.
          </p>
          <p style={{ fontSize: '13px', color: 'var(--c-400)', marginBottom: '28px' }}>
            Didn't receive it? Check your spam folder, or{' '}
            <span style={{ color: 'var(--amber)', cursor: 'pointer', fontWeight: 600 }}
              onClick={() => { setSent(false); setEmail(''); }}>try again</span>.
          </p>
          <button className="btn btn-outline btn-pill" style={{ width: '100%' }}
            onClick={() => go('signin')}>← Back to sign in</button>
        </div>
      </div>
    );
  }

  return (
    <div className="signin-pg">
      <div className="signin-card">
        <img src="logo-transparent.png" alt="Vulcan Quanta"
          style={{ height: '48px', marginBottom: '32px', cursor: 'pointer', display: 'block' }}
          onClick={() => go('landing')} />
        <h1 className="signin-h">Reset your password</h1>
        <p className="signin-sub" style={{ marginBottom: '28px' }}>
          Enter your account email and we'll send a reset link.
        </p>

        {error && <div className="auth-err" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="fld" style={{ marginBottom: '28px' }}>
            <label className="flbl" htmlFor="fp-email">Email address</label>
            <input id="fp-email" className="finp" type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)}
              autoComplete="email" required autoFocus />
          </div>
          <button className="btn btn-amber btn-pill" style={{ width: '100%' }}
            type="submit" disabled={loading}>
            {loading ? 'Sending reset link…' : 'Send reset link'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <span style={{ color: 'var(--blue)', fontSize: '13px', cursor: 'pointer' }}
            onClick={() => go('signin')}>← Back to sign in</span>
        </div>
      </div>
    </div>
  );
}

// ─── CHECK EMAIL ──────────────────────────────────────────────────────────────────────
function CheckEmailPage({ go, toast, email }) {
  const [resending, setResending] = useState(false);
  const [resent, setResent]       = useState(false);

  const handleResend = async () => {
    if (resending || resent) return;
    if (!email) { toast('Email address not available — try signing up again.', 'error'); return; }

    if (!window.VQAuth) {
      toast('Authentication is not configured. Please contact support.', 'error');
      return;
    }

    setResending(true);
    const { error } = await window.VQAuth.resendVerification(email);
    setResending(false);

    if (error) {
      toast(error.message || 'Failed to resend. Please try again.', 'error');
    } else {
      setResent(true);
      toast('Verification email sent.', 'success');
    }
  };

  return (
    <div className="signin-pg">
      <div className="signin-card" style={{ textAlign: 'center' }}>
        <img src="logo-transparent.png" alt="Vulcan Quanta"
          style={{ height: '48px', marginBottom: '32px', display: 'block', margin: '0 auto 32px' }} />
        <div style={{ width: '64px', height: '64px', background: 'rgba(249,115,22,0.1)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '28px' }}>
          ✉️
        </div>
        <h1 className="signin-h" style={{ marginBottom: '12px' }}>Verify your email</h1>
        {email
          ? <p style={{ color: 'var(--c-500)', fontSize: '15px', lineHeight: '1.65', marginBottom: '8px' }}>
              We sent a verification link to
            </p>
          : null
        }
        {email && (
          <p style={{ fontWeight: 700, color: 'var(--c-950)', fontSize: '15px', marginBottom: '24px', wordBreak: 'break-word' }}>
            {email}
          </p>
        )}
        {!email && (
          <p style={{ color: 'var(--c-500)', fontSize: '15px', lineHeight: '1.65', marginBottom: '24px' }}>
            Check your inbox for a verification link and click it to activate your account.
          </p>
        )}

        <div style={{ background: 'var(--c-50)', border: '1px solid var(--c-200)', borderRadius: '10px', padding: '16px 20px', marginBottom: '28px', fontSize: '14px', color: 'var(--c-600)', lineHeight: '1.65', textAlign: 'left' }}>
          <strong style={{ color: 'var(--c-950)' }}>Tip:</strong> Check your spam or junk folder if the email doesn't arrive within a few minutes.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {email && (
            <button className="btn btn-outline btn-pill" style={{ width: '100%' }}
              onClick={handleResend} disabled={resending || resent}>
              {resent ? '✓ Email sent again' : resending ? 'Sending…' : 'Resend verification email'}
            </button>
          )}
          <p style={{ fontSize: '13px', color: 'var(--c-400)', marginTop: '4px' }}>
            Already verified?{' '}
            <span style={{ color: 'var(--amber)', fontWeight: 600, cursor: 'pointer' }}
              onClick={() => go('signin')}>Sign in →</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── RESET PASSWORD ─────────────────────────────────────────────────────────────────────
function ResetPasswordPage({ go, toast }) {
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [done, setDone]           = useState(false);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => go('signin'), 3000);
    return () => clearTimeout(t);
  }, [done]);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');

    if (!password || !confirm) { setError('Please fill in both password fields.'); return; }
    if (password.length < 8)   { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm)   { setError('Passwords do not match. Please try again.'); return; }

    if (!window.VQAuth) {
      setError('Authentication is not configured. Please contact support.');
      return;
    }

    setLoading(true);
    const { error: err } = await window.VQAuth.updatePassword(password);
    setLoading(false);

    if (err) {
      setError(err.message || 'Failed to update password. Your reset link may have expired.');
      return;
    }

    setDone(true);
    toast('Password updated successfully.', 'success');
  };

  if (done) {
    return (
      <div className="signin-pg">
        <div className="signin-card" style={{ textAlign: 'center' }}>
          <img src="logo-transparent.png" alt="Vulcan Quanta"
            style={{ height: '48px', marginBottom: '32px', display: 'block', margin: '0 auto 32px' }} />
          <div style={{ width: '64px', height: '64px', background: 'rgba(16,185,129,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '28px', color: 'var(--green)', fontWeight: 800 }}>
            ✓
          </div>
          <h1 className="signin-h" style={{ marginBottom: '12px' }}>Password updated</h1>
          <p style={{ color: 'var(--c-500)', fontSize: '15px', lineHeight: '1.65', marginBottom: '32px' }}>
            Your password has been changed. Redirecting you to sign in&hellip;
          </p>
          <button className="btn btn-amber btn-pill" style={{ width: '100%' }}
            onClick={() => go('signin')}>Sign in now</button>
        </div>
      </div>
    );
  }

  return (
    <div className="signin-pg">
      <div className="signin-card">
        <img src="logo-transparent.png" alt="Vulcan Quanta"
          style={{ height: '48px', marginBottom: '32px', cursor: 'pointer', display: 'block' }}
          onClick={() => go('landing')} />
        <h1 className="signin-h">Set a new password</h1>
        <p className="signin-sub" style={{ marginBottom: '28px' }}>Choose a strong password for your account.</p>

        {error && <div className="auth-err" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="fld" style={{ marginBottom: '16px' }}>
            <label className="flbl" htmlFor="rp-pw">New password</label>
            <input id="rp-pw" className="finp"
              type={showPw ? 'text' : 'password'}
              placeholder="8+ characters"
              value={password} onChange={e => setPassword(e.target.value)}
              autoComplete="new-password" required autoFocus />
          </div>
          <div className="fld" style={{ marginBottom: '12px' }}>
            <label className="flbl" htmlFor="rp-confirm">Confirm new password</label>
            <input id="rp-confirm" className="finp"
              type={showPw ? 'text' : 'password'}
              placeholder="Repeat your password"
              value={confirm} onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password" required />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--c-500)', cursor: 'pointer', marginBottom: '28px', userSelect: 'none' }}>
            <input type="checkbox" checked={showPw} onChange={e => setShowPw(e.target.checked)} />
            Show password
          </label>
          <button className="btn btn-amber btn-pill" style={{ width: '100%' }}
            type="submit" disabled={loading}>
            {loading ? 'Updating password…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── PRICING ────────────────────────────────────────────────────────────────────────
function PricingPage({ go, toast }) {
  const plans = [
    { name: 'Free', price: '£0', period: 'forever', rec: false,
      feats: [{ on: true, t: '2 projects per month' },{ on: true, t: 'Watermarked output' },{ on: true, t: 'PDF export' },{ on: false, t: 'Excel export' },{ on: false, t: 'Custom branding' },{ on: false, t: 'Priority support' }],
      cta: 'Get started', action: () => go('signup') },
    { name: 'Pro', price: '£39', period: 'per month', rec: true,
      feats: [{ on: true, t: 'Unlimited projects' },{ on: true, t: 'No watermark' },{ on: true, t: 'PDF & Excel export' },{ on: true, t: 'Your branding & logo' },{ on: true, t: 'Custom trade sections' },{ on: false, t: 'Team seats (up to 5)' }],
      cta: 'Start free trial', action: () => go('signup') },
    { name: 'Studio', price: '£99', period: 'per month', rec: false,
      feats: [{ on: true, t: 'Everything in Pro' },{ on: true, t: 'Up to 5 team seats' },{ on: true, t: 'White-label output' },{ on: true, t: 'Custom rates & rules' },{ on: true, t: 'Variation order templates' },{ on: true, t: 'Priority support' }],
      cta: 'Contact sales', action: () => toast('Contact us: hello@vulcanquanta.com', 'info') },
  ];
  const compareRows = [
    ['Projects / month','2','Unlimited','Unlimited'],['Watermark on output','Yes','No','No'],
    ['PDF export','✓','✓','✓'],['Excel export','—','✓','✓'],
    ['Custom branding','—','✓','✓'],['Custom trade sections','—','✓','✓'],
    ['Team seats','1','1','5'],['White-label output','—','—','✓'],
    ['Custom rates & rules','—','—','✓'],['Variation order templates','—','—','✓'],['Priority support','—','—','✓'],
  ];
  return (
    <div style={{ background: 'var(--white)', paddingBottom: '120px' }}>
      <div style={{ background: 'var(--c-950)', padding: '120px 0 96px', borderBottom: '1px solid var(--c-800)' }}>
        <div className="inner" style={{ textAlign: 'center' }}>
          <h1 className="display-xl" style={{ color: 'white', marginBottom: '20px' }}>Simple, transparent pricing</h1>
          <p style={{ color: 'var(--c-300)', fontSize: '19px', maxWidth: '480px', margin: '0 auto' }}>Start free. Scale as you grow. No long-term contracts. Cancel anytime.</p>
        </div>
      </div>
      <div className="inner" style={{ marginTop: '-48px' }}>
        <div className="pricing-grid">
          {plans.map((plan, i) => (
            <div key={i} className={`pricing-card ${plan.rec ? 'rec' : ''}`}>
              {plan.rec && <p className="pricing-badge">Most popular</p>}
              <p className="pricing-name">{plan.name}</p>
              <p className="pricing-price">{plan.price}</p>
              <p className="pricing-period">{plan.period}</p>
              <ul className="pricing-feats">{plan.feats.map((f, j) => <li key={j} className={f.on ? 'on' : 'off'}>{f.t}</li>)}</ul>
              <button className={`btn btn-pill ${plan.rec ? 'btn-amber' : 'btn-outline'}`} style={{ width: '100%' }} onClick={plan.action}>{plan.cta}</button>
            </div>
          ))}
        </div>
        <h2 className="display-lg" style={{ textAlign: 'center', margin: '96px 0 48px' }}>Full feature comparison</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', border: '1px solid var(--c-200)', borderRadius: '8px', overflow: 'hidden' }}>
          <thead>
            <tr style={{ background: 'var(--c-50)', borderBottom: '2px solid var(--c-200)' }}>
              <th style={{ padding: '16px', textAlign: 'left', fontWeight: 700, color: 'var(--c-950)' }}>Feature</th>
              {['Free','Pro','Studio'].map(p => <th key={p} style={{ padding: '16px', textAlign: 'center', fontWeight: 700, color: 'var(--c-950)' }}>{p}</th>)}
            </tr>
          </thead>
          <tbody>
            {compareRows.map(([feat, ...vals], i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--c-100)', background: i % 2 === 0 ? 'white' : 'var(--c-50)' }}>
                <td style={{ padding: '14px 16px', fontWeight: 500 }}>{feat}</td>
                {vals.map((v, j) => (
                  <td key={j} style={{ padding: '14px 16px', textAlign: 'center', color: v === '✓' ? 'var(--green)' : v === '—' ? 'var(--c-300)' : 'var(--c-700)', fontWeight: v === '✓' ? 700 : 400 }}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

Object.assign(window, {
  LandingPage, ResultsPage, DashboardPage, UploadPage, SettingsPage,
  SignUpPage, SignInPage, PricingPage,
  ForgotPasswordPage, CheckEmailPage, ResetPasswordPage,
});
