/* Cloudflare Turnstile helper, shared by Login, Sign up, Forgot password and Profile.
   Supabase's CAPTCHA protection rejects sign-in, sign-up, password-reset and resend-email requests
   that do not carry a token from this widget. The SITE KEY below is public by design; the matching
   SECRET key lives only in the Supabase dashboard (Authentication > Attack Protection).
   Usage:  sgCaptcha.mount('#someDiv');  const t = await sgCaptcha.token();  ... { options: { captchaToken: t } }  sgCaptcha.reset(); */
(function () {
  var SITE_KEY = '0x4AAAAAAFV8-esPq4cljK8l';
  var SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  var widgetId = null, token = null, failed = false, waiters = [], loading = null;

  function injectStyle() {
    if (document.getElementById('sgCaptchaStyle')) return;
    var s = document.createElement('style');
    s.id = 'sgCaptchaStyle';
    s.textContent = '.sg-captcha{display:flex;justify-content:center;margin:0 0 16px;max-width:100%}.sg-captcha:empty{display:none}' +
      '@media (max-width:380px){.auth-container{padding:12px!important}.auth-card{padding:28px 16px!important}}';
    document.head.appendChild(s);
  }

  function flush(t) {
    var w = waiters; waiters = [];
    w.forEach(function (fn) { fn(t); });
  }

  function loadScript() {
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      if (window.turnstile) { resolve(); return; }
      var el = document.createElement('script');
      el.src = SCRIPT_URL; el.async = true; el.defer = true;
      el.onload = function () { resolve(); };
      el.onerror = function () { reject(new Error('Turnstile script blocked or offline')); };
      document.head.appendChild(el);
      setTimeout(function () { if (!window.turnstile) reject(new Error('Turnstile script timed out')); }, 15000);
    });
    loading.catch(function () { failed = true; flush(null); });
    return loading;
  }

  function mount(target) {
    injectStyle();
    return loadScript().then(function () {
      var node = typeof target === 'string' ? document.querySelector(target) : target;
      if (!node) return;
      if (widgetId !== null) { try { window.turnstile.remove(widgetId); } catch (e) { /* ignore */ } widgetId = null; }
      node.textContent = '';
      token = null;
      widgetId = window.turnstile.render(node, {
        sitekey: SITE_KEY,
        theme: 'light',
        size: 'flexible',
        callback: function (t) { token = t; flush(t); },
        'expired-callback': function () { token = null; },
        'error-callback': function () { token = null; }
      });
    }).catch(function () { failed = true; flush(null); });
  }

  /* Resolves with a fresh token, or null if the check could not run (blocked script, offline, or timeout). */
  function getToken(timeoutMs) {
    if (token) return Promise.resolve(token);
    if (failed) return Promise.resolve(null);
    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () { if (!done) { done = true; resolve(null); } }, timeoutMs || 25000);
      waiters.push(function (t) { if (!done) { done = true; clearTimeout(timer); resolve(t); } });
    });
  }

  /* A token can be used only once, so call this after every request that used one. */
  function reset() {
    token = null;
    if (widgetId !== null && window.turnstile) { try { window.turnstile.reset(widgetId); } catch (e) { /* ignore */ } }
  }

  window.sgCaptcha = {
    mount: mount,
    token: getToken,
    reset: reset,
    failMessage: 'We could not complete the security check. Please check your connection, turn off any ad or content blocker for this site, and try again.'
  };
})();
