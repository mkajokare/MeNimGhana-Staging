/* Shared site-wide header logic.
   The nav's profile widget previously showed a hardcoded "Kwame A." on every
   page regardless of who (if anyone) was actually signed in. This file makes
   it reflect the real Supabase session: real initials, real short name, real
   dropdown name/email -- and when no one is signed in, it hides the profile
   widget and shows a plain "Sign in" link instead (there was previously no
   logged-out state at all). It also wires the Sign Out menu item, which was
   previously a dead `href="#"` that did nothing. */
(function () {
  function initials(name) {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  /* Email links (confirm sign-up etc.) now arrive as ?token_hash=...&type=...
     and are verified here by script instead of by a one-time link that mail
     scanners (Outlook, Brevo link tracking) open first and use up. Recovery
     links are handled by ResetPassword.html itself. */
  function showAuthBanner(text, ok) {
    const el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.textContent = text;
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;padding:12px 16px;text-align:center;font:600 14px/1.4 system-ui,sans-serif;color:#fff;background:' + (ok ? '#006B3F' : '#CE1126') + ';';
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 7000);
  }

  async function handleAuthLink() {
    if (!window.sbClient) return;
    let params;
    try { params = new URLSearchParams(window.location.search); } catch (e) { return; }
    const tokenHash = params.get('token_hash');
    const type = params.get('type');
    if (!tokenHash || !type || type === 'recovery') return;
    try {
      const { error } = await window.sbClient.auth.verifyOtp({ token_hash: tokenHash, type: type });
      if (error) showAuthBanner('That email link is invalid or has expired. Please sign in, or request a new one.', false);
      else if (type === 'signup') { window.location.replace('Welcome.html'); return; }
      else showAuthBanner('Done. You are signed in.', true);
    } catch (e) {
      showAuthBanner('That email link could not be verified. Please try again.', false);
    }
    try {
      params.delete('token_hash'); params.delete('type');
      const qs = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : '') + window.location.hash);
    } catch (e) { /* cosmetic only */ }
  }

  async function initNavProfile() {
    if (!window.sbClient) return;
    const wrapper = document.querySelector('.profile-wrapper');
    const signInLink = document.getElementById('navSignInLink');

    let session = null;
    try {
      const { data } = await window.sbClient.auth.getSession();
      session = data && data.session;
    } catch (e) {
      session = null;
    }

    if (!session) {
      if (wrapper) wrapper.style.display = 'none';
      if (signInLink) signInLink.style.display = 'inline-flex';
      return;
    }

    if (wrapper) wrapper.style.display = '';
    if (signInLink) signInLink.style.display = 'none';

    const user = session.user;
    const meta = user.user_metadata || {};
    const fullName = meta.full_name || '';
    const displayName = meta.display_name || fullName || user.email || 'Account';
    const firstName = meta.first_name || fullName.split(' ')[0] || '';
    const lastName = meta.last_name || fullName.split(' ').slice(1).join(' ') || '';
    const shortName = firstName ? `${firstName} ${lastName ? lastName[0] + '.' : ''}`.trim() : displayName;
    const initialsText = initials(displayName);

    const avatarSm = document.getElementById('navAvatarSm');
    const nameSm = document.getElementById('navNameSm');
    const avatarLg = document.getElementById('navAvatarLg');
    const dropName = document.getElementById('navDropdownName');
    const dropEmail = document.getElementById('navDropdownEmail');
    if (avatarSm) avatarSm.textContent = initialsText;
    if (nameSm) nameSm.textContent = shortName;
    if (avatarLg) avatarLg.textContent = initialsText;
    if (dropName) dropName.textContent = displayName;
    if (dropEmail) dropEmail.textContent = user.email || '';
    maybeShowOnboardingPrompt(meta);
  }

  /* Accounts that have not done the one-time "Tell us about you" step get a small,
     dismissible prompt (once per browser session). Not shown on the auth pages or Admin. */
  function maybeShowOnboardingPrompt(meta) {
    if (meta.account_type || meta.onboarded_at || meta.onboarding_skipped_at) return;
    const page = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (['welcome.html', 'login.html', 'signup.html', 'forgotpassword.html', 'resetpassword.html', 'admin.html'].indexOf(page) !== -1) return;
    try { if (sessionStorage.getItem('sg_onboard_dismissed')) return; } catch (e) { /* show anyway */ }
    if (document.getElementById('sgOnboardPrompt')) return;
    const box = document.createElement('div');
    box.id = 'sgOnboardPrompt';
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', 'Finish setting up your account');
    box.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:9998;max-width:340px;background:#fff;border:1px solid #E0DDD5;border-left:4px solid #006B3F;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.18);padding:14px 16px;font:14px/1.45 system-ui,sans-serif;color:#2A2723;';
    const t = document.createElement('strong');
    t.textContent = 'Finish setting up your account';
    t.style.cssText = 'display:block;margin-bottom:2px;';
    const d = document.createElement('div');
    d.textContent = 'Tell us if you are looking for businesses or own one. It takes a minute.';
    d.style.cssText = 'color:#5A5650;font-size:13px;margin-bottom:10px;';
    const go = document.createElement('a');
    go.href = 'Welcome.html'; go.textContent = 'Set up now';
    go.style.cssText = 'display:inline-block;background:#006B3F;color:#fff;text-decoration:none;font-weight:600;padding:8px 14px;border-radius:8px;margin-right:8px;';
    const no = document.createElement('button');
    no.type = 'button'; no.textContent = 'Not now';
    no.style.cssText = 'background:none;border:0;color:#5A5650;font:inherit;cursor:pointer;text-decoration:underline;padding:8px 4px;';
    no.addEventListener('click', function () {
      try { sessionStorage.setItem('sg_onboard_dismissed', '1'); } catch (e) { /* ignore */ }
      box.remove();
    });
    box.appendChild(t); box.appendChild(d); box.appendChild(go); box.appendChild(no);
    document.body.appendChild(box);
  }

  window.navSignOut = async function () {
    if (window.sbClient) {
      try { await window.sbClient.auth.signOut(); } catch (e) { /* fall through to redirect regardless */ }
    }
    window.location.href = 'index.html';
  };

  /* ── Accessibility: the profile dropdown had no ARIA state at all (a sighted
     mouse user could tell it was open; a screen-reader user had no way to
     know), and keyboard users had no visible focus indicator anywhere on the
     site. Both are added here, centrally, rather than in each page's own
     copy-pasted script. ── */
  function wireDropdownAria() {
    const btn = document.getElementById('profileBtn');
    const dropdown = document.getElementById('profileDropdown');
    if (!btn || !dropdown) return;
    btn.setAttribute('aria-haspopup', 'true');
    if (!btn.hasAttribute('aria-expanded')) btn.setAttribute('aria-expanded', 'false');
    dropdown.setAttribute('role', 'menu');
    dropdown.querySelectorAll('.menu-item').forEach(item => item.setAttribute('role', 'menuitem'));

    // The page's own toggleProfile() flips the 'open' class; reflect that
    // in aria-expanded a tick later rather than re-implementing the toggle.
    btn.addEventListener('click', function () {
      setTimeout(function () {
        btn.setAttribute('aria-expanded', btn.classList.contains('open') ? 'true' : 'false');
      }, 0);
    });
  }

  function injectFocusVisibleStyle() {
    if (document.getElementById('navA11yFocusStyle')) return;
    const style = document.createElement('style');
    style.id = 'navA11yFocusStyle';
    style.textContent = '*:focus-visible { outline: 2px solid var(--brand-red, #CE1126); outline-offset: 2px; }';
    document.head.appendChild(style);
  }

  document.addEventListener('DOMContentLoaded', function () {
    handleAuthLink().then(initNavProfile, initNavProfile);
    wireDropdownAria();
    injectFocusVisibleStyle();
  });
  if (window.sbClient && window.sbClient.auth && window.sbClient.auth.onAuthStateChange) {
    window.sbClient.auth.onAuthStateChange(function () { initNavProfile(); });
  }
})();
