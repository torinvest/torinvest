/**
 * Gate Fondamental — session serveur (signature Phantom + solde KRM ≥ ACADEMY).
 * Le solde lu côté navigateur n’est PAS une preuve d’accès.
 */
(function () {
  'use strict';

  var API = '/api/fondamental-access.php';

  function setMsg(text, ok) {
    var msg = document.getElementById('tf-fonda-msg');
    if (!msg) return;
    msg.textContent = text || '';
    msg.className = 'msg ' + (ok ? 'ok' : 'ko');
  }

  function showGate() {
    document.documentElement.classList.add('tf-fonda-locked');
    var el = document.getElementById('tf-fonda-gate');
    if (el) el.hidden = false;
  }

  function hideGate() {
    document.documentElement.classList.remove('tf-fonda-locked');
    var el = document.getElementById('tf-fonda-gate');
    if (el) el.hidden = true;
  }

  function fmtKrm(n) {
    try {
      return Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
    } catch (e) {
      return String(n);
    }
  }

  function bytesToBase64(bytes) {
    var bin = '';
    var u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (var i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    return btoa(bin);
  }

  function getProvider() {
    var p = window.solana || (window.phantom && window.phantom.solana);
    if (p && p.isPhantom) return p;
    return null;
  }

  function apiFetch(url, opts) {
    opts = opts || {};
    opts.credentials = 'include';
    opts.headers = opts.headers || {};
    if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    return fetch(url, opts).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || (j && j.ok === false)) {
          var err = new Error((j && (j.error || j.message)) || 'HTTP ' + r.status);
          err.payload = j || {};
          err.status = r.status;
          throw err;
        }
        return j;
      });
    });
  }

  async function pingSession() {
    try {
      return await apiFetch(API + '?action=ping', { method: 'GET' });
    } catch (e) {
      return null;
    }
  }

  async function loginWithProvider(provider, wallet) {
    setMsg('Challenge serveur…', true);
    var ch = await apiFetch(API, {
      method: 'POST',
      body: { action: 'challenge', wallet: wallet },
    });
    if (!ch.message || !ch.nonce) throw new Error('Challenge invalide');

    setMsg('Signature Phantom…', true);
    var encoded = new TextEncoder().encode(ch.message);
    var signed = await provider.signMessage(encoded, 'utf8');
    var sig = signed.signature || signed;

    setMsg('Vérification solde KRM (serveur)…', true);
    var login = await apiFetch(API, {
      method: 'POST',
      body: {
        action: 'login_wallet',
        wallet: wallet,
        message: ch.message,
        nonce: ch.nonce,
        signature: bytesToBase64(sig),
      },
    });

    setMsg(
      'Accès ACADEMY OK — ' + fmtKrm(login.krm) + ' KRM. Chargement…',
      true
    );
    hideGate();
    // Recharge pour que les bundles /applifonda/assets/* passent avec le cookie.
    setTimeout(function () {
      window.location.reload();
    }, 200);
    return login;
  }

  async function connectAndUnlock() {
    var btn = document.getElementById('tf-fonda-connect');
    if (btn) btn.disabled = true;
    try {
      var provider = getProvider();
      if (!provider) {
        setMsg('Phantom introuvable. Installe l’extension puis réessaie.', false);
        window.open('https://phantom.app/', '_blank', 'noopener');
        return;
      }
      setMsg('Connexion Phantom…', true);
      var res = await provider.connect();
      var pk = (res && res.publicKey) || provider.publicKey;
      if (!pk) throw new Error('Wallet non détecté');
      var wallet = pk.toString();
      await loginWithProvider(provider, wallet);
    } catch (e) {
      console.warn('[fondamental-gate]', e);
      var p = (e && e.payload) || {};
      if (p.code === 'INSUFFICIENT_KRM' || (p.krm != null && p.minKrm != null)) {
        setMsg(
          'Accès refusé — ' +
            fmtKrm(p.krm) +
            ' KRM. Il faut ≥ ' +
            fmtKrm(p.minKrm) +
            ' KRM (ACADEMY).',
          false
        );
      } else {
        setMsg((e && e.message) || 'Erreur de connexion', false);
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function boot() {
    var path = window.location.pathname || '';
    if (path === '/fondamental' || path === '/fondamental/') {
      window.location.replace('/applifonda/');
      return;
    }

    showGate();
    setMsg('Vérification de session…', true);

    var sess = await pingSession();
    if (sess && sess.ok) {
      if (sess.role === 'admin') {
        setMsg('Session admin active.', true);
      } else {
        setMsg(
          'Session active — ' + fmtKrm(sess.krm) + ' KRM. Ouverture…',
          true
        );
      }
      hideGate();
      return;
    }

    setMsg('Connecte Phantom pour vérifier ton niveau TorPass (serveur).', true);
    var btn = document.getElementById('tf-fonda-connect');
    if (btn && !btn._tfBound) {
      btn._tfBound = true;
      btn.addEventListener('click', connectAndUnlock);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
