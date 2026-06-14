/* ============================================================
   KDL TECH — Tchat privé · turnstile-helper.js (Palier 4)
   Anti-bot Cloudflare Turnstile — préparation SANS clé réelle.
   - Si TURNSTILE_SITE_KEY est un placeholder : AUCUN script
     Cloudflare chargé, aucun appel réseau (mode démo).
   - Si la site key est configurée : charge l'api.js Cloudflare
     en rendu explicite et affiche le widget dans le conteneur.
   - Le jeton obtenu est gardé en mémoire pour le futur Palier 6
     (Supabase Auth `captchaToken`). La VALIDATION du jeton se
     fait côté serveur (Supabase, secret key) — jamais ici.
   ⛔ La secret key Turnstile ne doit JAMAIS apparaître côté front.
   ============================================================ */
(function () {
    'use strict';

    var SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js' +
        '?render=explicit&onload=kdlTurnstileOnload';
    var token = null;
    var widgetId = null;
    var pendingMount = null;

    /* Site key réellement configurée ? (non vide, pas le placeholder
       « VOTRE_… » du fichier example) */
    function isConfigured(cfg) {
        var key = cfg && cfg.TURNSTILE_SITE_KEY;
        return typeof key === 'string' && key.length > 0 && key.indexOf('VOTRE') === -1;
    }

    function renderWidget(el, siteKey) {
        widgetId = window.turnstile.render(el, {
            sitekey: siteKey,
            theme: 'dark',
            callback: function (t) { token = t; },
            'expired-callback': function () { token = null; },
            'error-callback': function () { token = null; }
        });
    }

    /* Callback global appelé par l'api.js Cloudflare une fois chargée. */
    window.kdlTurnstileOnload = function () {
        if (pendingMount && window.turnstile) {
            renderWidget(pendingMount.el, pendingMount.siteKey);
            pendingMount = null;
        }
    };

    /* Monte le widget dans `el` si (et seulement si) la config est réelle.
       Retourne true si le chargement est lancé, false sinon (placeholder). */
    function mount(el, cfg) {
        if (!el || !isConfigured(cfg)) return false;
        pendingMount = { el: el, siteKey: cfg.TURNSTILE_SITE_KEY };
        if (window.turnstile) {                 /* api.js déjà présente */
            window.kdlTurnstileOnload();
            return true;
        }
        var s = document.createElement('script');
        s.src = SCRIPT_URL;
        s.async = true;
        s.defer = true;
        document.head.appendChild(s);
        return true;
    }

    window.KDL_TURNSTILE = {
        isConfigured: isConfigured,
        mount: mount,
        /* Jeton à transmettre à Supabase Auth (Palier 6) :
           supabase.auth.signUp({ …, options: { captchaToken: KDL_TURNSTILE.getToken() } }) */
        getToken: function () { return token; },
        reset: function () {
            token = null;
            if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId);
        }
    };
})();
