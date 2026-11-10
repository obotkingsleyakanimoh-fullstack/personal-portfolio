import { useEffect, useState } from 'react';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { ArrowUpRight, ChevronDown, Heart, LogOut, Menu, MessageCircle, UserRound, X } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { ownerName, siteName } from '../lib/supabase';
import { defaultSiteTheme, useSiteTheme } from '../lib/siteSettings';

const publicLinks = [
  { label: 'Home', to: '/' },
  { label: 'The Story', to: '/about' },
  { label: 'Gallery', to: '/gallery' },
  { label: 'Private videos', to: '/videos' },
  { label: 'Membership', to: '/membership' },
];

export function SiteLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: siteTheme = defaultSiteTheme } = useSiteTheme();
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--site-primary', siteTheme.primary);
    root.style.setProperty('--site-accent', siteTheme.accent);
    root.style.setProperty('--site-background', siteTheme.background);
    root.style.setProperty('--site-surface', siteTheme.surface);
    root.style.setProperty('--site-text', siteTheme.text);
    root.style.setProperty('--site-muted', siteTheme.muted);
    root.style.setProperty('--site-deep', siteTheme.deep);
    root.style.setProperty('--site-highlight', siteTheme.highlight);
    root.style.setProperty('--site-border', siteTheme.border);
  }, [siteTheme]);
  const [ageAccepted, setAgeAccepted] = useState(() => { try { return window.localStorage.getItem('atelier-adult-entry') === 'accepted'; } catch { return false; } });
  const acceptAdultEntry = () => { try { window.localStorage.setItem('atelier-adult-entry', 'accepted'); } catch { /* The entry confirmation still applies for this page session. */ } setAgeAccepted(true); };
  const leaveAdultEntry = () => { window.location.href = 'https://www.google.com/'; };
  const { user, profile, isOwner, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAccount = ['/dashboard', '/chat', '/admin'].some((p) => pathname.startsWith(p));

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="announcement-bar"><span className="adult-chip">18+</span> Pink Doll Mansion <span className="announcement-dot">✦</span> A private world of beauty, confidence and self-expression</div>
      <header className="site-header">
        <div className="site-header-inner">
          <Link to="/" className="brand-lockup" aria-label={`${siteName} home`}>
            <img className="brand-logo-image" src="/logo.svg" alt="Pink Doll Mansion" />
          </Link>
          <nav className="desktop-nav" aria-label="Main navigation">
            {publicLinks.map((item) => (
              <Link key={item.to} to={item.to} className={`nav-link ${pathname === item.to ? 'active' : ''}`}>{item.label}</Link>
            ))}
          </nav>
          <div className="header-actions">
            {user ? (
              <div className="account-menu-wrap">
                <Link to={isOwner ? '/admin' : '/dashboard'} className="account-link">
                  <span className="account-avatar"><UserRound size={15} /></span>
                  <span>{profile?.full_name?.split(' ')[0] || 'Account'}</span>
                  <ChevronDown size={13} />
                </Link>
                <div className="account-dropdown">
                  <Link to="/dashboard">My account</Link>
                  <Link to="/account">Profile settings</Link>
                  <Link to="/purchases">My purchases</Link>
                  <Link to="/payments">Payment history</Link>
                  <Link to="/chat">Private chat</Link>
                  {isOwner && <Link to="/admin">Owner studio</Link>}
                  <button onClick={() => signOut()}><LogOut size={14} /> Sign out</button>
                </div>
              </div>
            ) : <Link to="/login" className="header-login">Sign in</Link>}
            <Link to="/membership" className="button button-dark header-cta">Explore membership <ArrowUpRight size={14} /></Link>
            <button className="mobile-menu-button" aria-label="Open navigation" onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X /> : <Menu />}</button>
          </div>
        </div>
        {mobileOpen && (
          <div className="mobile-nav-panel">
            {publicLinks.map((item) => <Link key={item.to} to={item.to} onClick={() => setMobileOpen(false)}>{item.label}</Link>)}
            {user ? <><Link to="/dashboard" onClick={() => setMobileOpen(false)}>My account</Link><Link to="/account" onClick={() => setMobileOpen(false)}>Profile settings</Link><Link to="/purchases" onClick={() => setMobileOpen(false)}>My purchases</Link><Link to="/payments" onClick={() => setMobileOpen(false)}>Payment history</Link><Link to="/chat" onClick={() => setMobileOpen(false)}>Private chat</Link></> : <Link to="/login" onClick={() => setMobileOpen(false)}>Sign in / Register</Link>}
            <Link to="/membership" onClick={() => setMobileOpen(false)}>Explore membership</Link>
          </div>
        )}
      </header>

      <main className={isAccount ? 'account-main' : ''}><Outlet /></main>

      <footer className="site-footer">
        <div className="footer-top">
          <div className="footer-brand-block">
            <Link to="/" className="brand-lockup footer-brand"><img className="brand-logo-image footer-logo-image" src="/logo.svg" alt="Pink Doll Mansion" /></Link>
            <p>Pink Doll Mansion is a private, adults-only collection of sensual portraits, boudoir photography, artistic imagery and personal experiences, shared by choice and with care.</p>
          </div>
          <div className="footer-column"><span className="footer-heading">Explore my world</span><Link to="/about">The story</Link><Link to="/gallery">Gallery</Link><Link to="/videos">Private videos</Link><Link to="/membership">Membership</Link></div>
          <div className="footer-column"><span className="footer-heading">Your private access</span><Link to="/login">Sign in</Link><Link to="/dashboard">My account</Link><Link to="/chat">Private chat</Link><Link to="/contact">Write to me</Link></div>
          <div className="footer-column"><span className="footer-heading">The essentials</span><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/refunds">Refund policy</Link><Link to="/cookies">Cookies</Link></div>
        </div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} {siteName}. All rights reserved.</span><span>Shared on my terms <Heart size={12} fill="currentColor" /></span><span>{ownerName}</span></div>
      </footer>
      {!ageAccepted && <div className="age-gate" role="dialog" aria-modal="true" aria-labelledby="age-gate-title"><div className="age-gate-card"><div className="age-gate-mark">P</div><span className="age-gate-kicker">PINK DOLL MANSION · 18+</span><h2 id="age-gate-title">Welcome to Pink Doll Mansion, <em>for adults only.</em></h2><p>Pink Doll Mansion is intended for adults aged 18 and over. By entering, you confirm that you meet the legal age requirement where you live and that viewing adult-oriented material is lawful for you.</p><div className="age-gate-actions"><button className="button button-dark" onClick={acceptAdultEntry}>I am 18 or older · Enter</button><button className="age-gate-leave" onClick={leaveAdultEntry}>I am under 18 · Leave</button></div><small>Consent, privacy, respect and lawful adult content are essential.</small></div></div>}
    </div>
  );
}
