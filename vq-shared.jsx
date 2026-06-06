// vq-shared.jsx — Header, Footer, AnnouncementBar, BoQMockup, ToastContainer
const { useState } = React;

function AnnouncementBar({ go }) {
  return null;
}

function Header({ page, go, toast, user }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoOk, setLogoOk] = useState(true);
  const links = [
    { label: 'How it works', target: 'landing' },
    { label: 'Pricing', target: 'pricing' },
    { label: 'Docs', soon: true, action: () => toast('Documentation coming soon.', 'info') },
  ];

  const handleSignOut = async () => {
    setMenuOpen(false);
    if (window.VQAuth) {
      await window.VQAuth.signOut();
    } else {
      go('landing');
    }
  };

  return (
    <header className="hdr">
      <div className="hdr-inner">
        <span onClick={() => go('landing')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          {logoOk ? (
            <img src="logo-transparent.png" alt="Vulcan Quanta"
              onError={() => setLogoOk(false)}
              style={{ height: '34px', display: 'block', filter: 'drop-shadow(0 0 1px rgba(255,255,255,0.15)) brightness(1.15)' }} />
          ) : (
            <span style={{ fontFamily: 'var(--font-d)', fontSize: '17px', fontWeight: 700, color: '#fff', letterSpacing: '0.08em' }}>VULCAN QUANTA</span>
          )}
        </span>
        <nav>
          <ul className="nav-links">
            {links.map((l, i) => (
              <li key={i}>
                <span className="nav-link" onClick={() => l.target ? go(l.target) : l.action?.()}>
                  {l.label}
                  {l.soon && <sup style={{ fontSize: '9px', color: 'var(--c-500)', marginLeft: '3px' }}>soon</sup>}
                </span>
              </li>
            ))}
          </ul>
        </nav>
        <div className="hdr-right">
          {user ? (
            <>
              <button className="btn btn-ghost-dim" onClick={() => go('dashboard')}>Dashboard</button>
              <button className="btn btn-nav-pill" onClick={handleSignOut}>Sign out</button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost-dim" onClick={() => go('signin')}>Sign in</button>
              <button className="btn btn-nav-pill" onClick={() => go('signup')}>Start free</button>
            </>
          )}
        </div>
        <button className="hamburger" aria-label="Menu" onClick={() => setMenuOpen(o => !o)}>
          <span></span><span></span><span></span>
        </button>
      </div>
      {menuOpen && (
        <div className="mobile-menu">
          {links.map((l, i) => (
            <span key={i} className="mobile-link"
              onClick={() => { l.target ? go(l.target) : l.action?.(); setMenuOpen(false); }}>
              {l.label}
            </span>
          ))}
          {user ? (
            <>
              <button className="btn btn-outline btn-pill" style={{ alignSelf: 'flex-start', marginTop: '8px' }}
                onClick={() => { go('dashboard'); setMenuOpen(false); }}>
                Dashboard
              </button>
              <button className="btn btn-ghost btn-pill" style={{ alignSelf: 'flex-start', color: 'rgba(255,255,255,0.6)' }}
                onClick={handleSignOut}>
                Sign out
              </button>
            </>
          ) : (
            <button className="btn btn-amber btn-pill" style={{ alignSelf: 'flex-start', marginTop: '8px' }}
              onClick={() => { go('signup'); setMenuOpen(false); }}>
              Start free
            </button>
          )}
        </div>
      )}
    </header>
  );
}

function Footer({ go }) {
  const cs = (fn) => (e) => { e.preventDefault(); fn(); };
  return (
    <footer className="ftr">
      <div className="inner">
        <div className="ftr-grid">
          <div>
            <img src="logo-transparent.png" alt="Vulcan Quanta" style={{ height: '52px', filter: 'brightness(0) invert(1)', marginBottom: '14px', display: 'block' }} />
            <p className="ftr-desc">AI-powered quantity surveying for UK builders and contractors. A priced Bill of Quantities in under 2 minutes.</p>
          </div>
          <div>
            <p className="ftr-col-title">Product</p>
            <a className="ftr-link" href="#" onClick={cs(() => go('landing'))}>How it works</a>
            <a className="ftr-link" href="#" onClick={cs(() => go('pricing'))}>Pricing</a>
            <a className="ftr-link ftr-link-dim" href="#">Docs (soon)</a>
            <a className="ftr-link ftr-link-dim" href="#">API (soon)</a>
          </div>
          <div>
            <p className="ftr-col-title">Company</p>
            <a className="ftr-link" href="#">About</a>
            <a className="ftr-link" href="#">Blog</a>
            <a className="ftr-link" href="#">Careers</a>
            <a className="ftr-link" href="#">Contact</a>
          </div>
          <div>
            <p className="ftr-col-title">Legal</p>
            <a className="ftr-link" href="#">Terms of service</a>
            <a className="ftr-link" href="#">Privacy policy</a>
            <a className="ftr-link" href="#">Cookie policy</a>
            <a className="ftr-link" href="#">GDPR</a>
          </div>
        </div>
        <hr className="ftr-rule" />
        <div className="ftr-bottom">
          <p className="ftr-copy">© 2026 Vulcan Quanta Ltd. All rights reserved.<br />Company No. 14987234 · VAT No. 456 789 012</p>
          <address className="ftr-address">
            Vulcan Quanta Ltd<br />
            12 St Ann's Square<br />
            Manchester, M2 7HG
          </address>
        </div>
      </div>
    </footer>
  );
}

function BoQMockup() {
  return (
    <div className="boq-mockup">
      <div className="boq-mock-hdr">
        <div>
          <p className="boq-mock-eyebrow">Bill of Quantities</p>
          <p className="boq-mock-title">Oak View Residential Extension</p>
          <p className="boq-mock-meta">Ref: OVR-2026-047 · Jun 2026 · BCIS Q2 2026 rates</p>
        </div>
        <span className="boq-conf-pill">94% confidence</span>
      </div>
      <table className="boq-mini">
        <thead>
          <tr>
            <th>Description</th>
            <th className="r">Qty</th>
            <th className="r">Unit</th>
            <th className="r">Rate</th>
            <th className="r">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr className="boq-trade-hd"><td colSpan="5">A — GROUNDWORKS</td></tr>
          <tr className="boq-row"><td>Excavation to reduced level</td><td className="r">86</td><td className="r">m²</td><td className="r">£6.50</td><td className="r">£559.00</td></tr>
          <tr className="boq-row alt"><td>Concrete strip foundations</td><td className="r">28</td><td className="r">lm</td><td className="r">£95.00</td><td className="r">£2,660.00</td></tr>
          <tr className="boq-trade-hd"><td colSpan="5">B — BRICKWORK</td></tr>
          <tr className="boq-row"><td>Common brickwork, stretcher bond</td><td className="r">210</td><td className="r">m²</td><td className="r">£65.00</td><td className="r">£13,650.00</td></tr>
          <tr className="boq-row flagged"><td>⚠ Clay tile roof covering</td><td className="r">320</td><td className="r">m²</td><td className="r">£38.50</td><td className="r">£12,320.00</td></tr>
          <tr className="boq-sub"><td colSpan="4">Works subtotal</td><td className="r">£29,189.00</td></tr>
          <tr className="boq-sub"><td colSpan="4">Contingency (10%)</td><td className="r">£2,918.90</td></tr>
          <tr className="boq-grand"><td colSpan="4">GRAND TOTAL (EX. VAT)</td><td className="r">£32,107.90</td></tr>
        </tbody>
      </table>
      <div className="boq-mock-ftr">
        <p>AI-generated draft — professional review required before issue to client.</p>
      </div>
    </div>
  );
}

function ToastContainer({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
      ))}
    </div>
  );
}

Object.assign(window, { AnnouncementBar, Header, Footer, BoQMockup, ToastContainer });
