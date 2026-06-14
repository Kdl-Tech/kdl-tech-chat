/* ============================================================
   KDL TECH — Tchat privé · chat.js (orchestrateur, Palier 6)
   Deux modes selon js/chat-config.js (gitignoré) :
   - DÉMO (CHAT_ENABLED=false ou placeholders) : bascule visuelle
     statique, AUCUN appel réseau, aucune auth réelle.
   - RÉEL (CHAT_ENABLED=true + config réelle) : charge la lib
     Supabase à la demande, auth email + confirmation, session,
     profil, puis délègue le salon temps réel à KDL_CHAT_ROOM.
   Sécurité : aucun secret ici (URL + clé publishable viennent de
   la config locale) ; messages/erreurs en textContent ; le
   captchaToken Turnstile est passé à Auth seulement si configuré.
   ============================================================ */
(function () {
    'use strict';

    /* CDN Supabase JS v2 (UMD → window.supabase), chargé uniquement
       en mode réel pour préserver le « zéro réseau » de la démo. */
    var SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';

    var cfg = window.KDL_CHAT_CONFIG || {};
    var isPlaceholder = !cfg.SUPABASE_URL || cfg.SUPABASE_URL.indexOf('VOTRE-PROJET') !== -1
        || !cfg.SUPABASE_ANON_KEY || cfg.SUPABASE_ANON_KEY.indexOf('VOTRE_') !== -1;
    var connected = cfg.CHAT_ENABLED === true && !isPlaceholder;

    var authZone = document.getElementById('auth-zone');
    var chatZone = document.getElementById('chat-zone');
    if (!authZone || !chatZone) return;

    /* ===== Turnstile (préparé Palier 4) ===== */
    var ts = window.KDL_TURNSTILE;
    var tsStatus = document.getElementById('turnstile-status');
    var tsWidget = document.getElementById('turnstile-widget');
    var tsActive = false;
    if (ts && ts.isConfigured(cfg)) {
        ts.mount(tsWidget, cfg);
        tsActive = true;
        if (tsStatus) tsStatus.textContent = '(vérification active — un jeton sera exigé à l\'inscription)';
    } else if (tsStatus) {
        tsStatus.textContent = '⚠ Vérification humaine non configurée (site key placeholder) — aucun script Cloudflare chargé.';
    }

    /* =========================================================
       MODE DÉMO — comportement Paliers 1-2 conservé.
       ========================================================= */
    if (!connected) {
        console.info('[KDL chat] mode démo statique (configuration non connectée).');
        var banner = document.querySelector('.demo-banner .chip');
        if (banner) banner.textContent = '⚠ Démo statique — configuration non connectée';
        var demoIn = document.getElementById('demo-login');
        var demoOut = document.getElementById('demo-logout');
        var showDemo = function (logged) {
            authZone.hidden = logged;
            chatZone.hidden = !logged;
            var msgs = chatZone.querySelector('.chat-msgs');
            if (logged && msgs) msgs.scrollTop = msgs.scrollHeight;
        };
        if (demoIn) demoIn.addEventListener('click', function () { showDemo(true); });
        if (demoOut) demoOut.addEventListener('click', function () { showDemo(false); });
        return;
    }

    /* =========================================================
       MODE RÉEL — Supabase Auth + Realtime.
       ========================================================= */
    console.info('[KDL chat] mode réel — connexion Supabase.');

    // En réel, les commandes de démo n'ont plus de sens.
    ['demo-login', 'demo-logout'].forEach(function (id) {
        var el = document.getElementById(id); if (el) el.hidden = true;
    });
    var realBanner = document.querySelector('.demo-banner .chip');
    if (realBanner) realBanner.textContent = '🔐 Espace membres — salon connecté';

    // Références DOM (créées dans chat.html)
    var elEmail = document.getElementById('auth-email');
    var elPass = document.getElementById('auth-password');
    var elUser = document.getElementById('auth-username');
    var elSubmit = document.getElementById('auth-submit');
    var elToggle = document.getElementById('auth-mode-toggle');
    var elAuthMsg = document.getElementById('auth-msg');
    var elSignupOnly = document.getElementById('signup-only');
    var elForm = document.getElementById('email-auth-form');
    var elSessionUser = document.getElementById('session-user');
    var elLogout = document.getElementById('logout-btn');
    var roomRefs = {
        form: document.getElementById('send-form'),
        input: document.getElementById('msg-input'),
        sendBtn: document.getElementById('send-btn'),
        list: document.getElementById('chat-msgs'),
        status: document.getElementById('chat-status'),
        empty: document.getElementById('chat-empty')
    };

    var signupMode = false;
    var sb = null;

    function setAuthMsg(text, kind) {
        if (!elAuthMsg) return;
        elAuthMsg.textContent = text || '';
        elAuthMsg.className = 'auth-msg' + (kind ? ' auth-msg-' + kind : '');
    }

    function friendlyAuth(err) {
        var m = (err && err.message) || '';
        if (/Email not confirmed/i.test(m)) return 'Votre email n\'est pas encore confirmé. Vérifiez votre boîte mail.';
        if (/Invalid login credentials/i.test(m)) return 'Email ou mot de passe incorrect.';
        if (/already registered|User already/i.test(m)) return 'Un compte existe déjà avec cet email.';
        if (/Password should be at least/i.test(m)) return 'Mot de passe trop court (minimum 10 caractères).';
        if (/rate limit|too many/i.test(m)) return 'Trop de tentatives. Réessayez dans quelques minutes.';
        if (/captcha/i.test(m)) return 'Vérification anti-bot requise. Validez le défi puis réessayez.';
        if (/network|fetch/i.test(m)) return 'Problème de connexion réseau.';
        return 'Une erreur est survenue. Réessayez plus tard.';
    }

    function updateAuthModeUI() {
        if (elSignupOnly) elSignupOnly.hidden = !signupMode;
        if (elSubmit) elSubmit.textContent = signupMode ? 'Créer mon compte' : 'Se connecter';
        if (elToggle) elToggle.textContent = signupMode ? 'J\'ai déjà un compte' : 'Créer un compte';
        if (elPass) elPass.setAttribute('autocomplete', signupMode ? 'new-password' : 'current-password');
        setAuthMsg('');
    }

    function captchaOpts(base) {
        if (tsActive && ts.getToken && ts.getToken()) {
            base = base || {};
            base.captchaToken = ts.getToken();
        }
        return base;
    }

    function handleSubmit(e) {
        e.preventDefault();
        var email = (elEmail.value || '').trim();
        var pass = elPass.value || '';
        if (!email || !pass) { setAuthMsg('Renseignez email et mot de passe.', 'err'); return; }
        elSubmit.disabled = true;
        setAuthMsg(signupMode ? 'Création du compte…' : 'Connexion…');

        if (signupMode) {
            var uname = (elUser && elUser.value || '').trim();
            var opts = captchaOpts({});
            if (uname) { opts.data = { user_name: uname }; }
            sb.auth.signUp({ email: email, password: pass, options: opts }).then(function (res) {
                elSubmit.disabled = false;
                if (tsActive && ts.reset) ts.reset();
                if (res.error) { setAuthMsg(friendlyAuth(res.error), 'err'); return; }
                // Confirmation obligatoire : pas de session immédiate.
                if (res.data && res.data.user && !res.data.session) {
                    signupMode = false; updateAuthModeUI();   // updateAuthModeUI efface le message…
                    setAuthMsg('Compte créé. Un email de confirmation vous a été envoyé : cliquez le lien pour activer l\'accès, puis connectez-vous.', 'ok'); // …on le repose après.
                }
            });
        } else {
            sb.auth.signInWithPassword(captchaOpts({ email: email, password: pass }) || { email: email, password: pass })
                .then(function (res) {
                    elSubmit.disabled = false;
                    if (tsActive && ts.reset) ts.reset();
                    if (res.error) { setAuthMsg(friendlyAuth(res.error), 'err'); return; }
                    setAuthMsg('');
                });
        }
    }

    function showLoggedOut() {
        authZone.hidden = false;
        chatZone.hidden = true;
        if (elPass) elPass.value = '';
        try { window.KDL_CHAT_ROOM.teardown(); } catch (e) {}
    }

    function showLoggedIn(session) {
        // Profil : username (peut manquer si trigger non passé → repli email).
        sb.from('profiles').select('username, role').eq('id', session.user.id).single()
            .then(function (res) {
                var profile = res.data || { username: (session.user.email || 'membre').split('@')[0], role: 'member' };
                if (elSessionUser) {
                    var label = 'Connecté : ' + profile.username;
                    if (profile.role === 'admin' || profile.role === 'moderator') label += ' (' + profile.role + ')';
                    elSessionUser.textContent = label;
                }
                authZone.hidden = true;
                chatZone.hidden = false;
                window.KDL_CHAT_ROOM.init(sb, cfg, session, profile, roomRefs);
            });
    }

    function bindAuthUI() {
        if (elForm) elForm.addEventListener('submit', handleSubmit);
        if (elToggle) elToggle.addEventListener('click', function () { signupMode = !signupMode; updateAuthModeUI(); });
        if (elLogout) elLogout.addEventListener('click', function () { sb.auth.signOut(); });
        updateAuthModeUI();
    }

    /* Chargement dynamique de la lib Supabase (UMD → window.supabase). */
    function loadSupabaseLib() {
        return new Promise(function (resolve, reject) {
            if (window.supabase && window.supabase.createClient) return resolve();
            var s = document.createElement('script');
            s.src = SUPABASE_CDN; s.async = true;
            s.onload = function () { resolve(); };
            s.onerror = function () { reject(new Error('cdn')); };
            document.head.appendChild(s);
        });
    }

    setAuthMsg('Initialisation…');
    loadSupabaseLib().then(function () {
        sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        bindAuthUI();
        setAuthMsg('');
        sb.auth.onAuthStateChange(function (_event, session) {
            if (session) showLoggedIn(session); else showLoggedOut();
        });
        // État initial (session persistée éventuelle).
        sb.auth.getSession().then(function (res) {
            if (res.data && res.data.session) showLoggedIn(res.data.session);
        });
    }).catch(function () {
        setAuthMsg('Impossible de charger le module de connexion (réseau). Réessayez plus tard.', 'err');
    });
})();
