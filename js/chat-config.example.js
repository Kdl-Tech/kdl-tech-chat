/* ============================================================
   KDL TECH — Tchat privé · chat-config.example.js
   MODÈLE PUBLIC — aucune vraie valeur ici.
   Usage : copier vers js/chat-config.js (gitignoré) puis remplir.
   Seules des clés PUBLIQUES sont autorisées dans ce fichier :
   URL projet, clé anon, site key Turnstile.
   ⛔ JAMAIS de service_role ni de secret key Turnstile côté front.
   ============================================================ */
window.KDL_CHAT_CONFIG = {
    /* URL du projet Supabase — publique. Ex: https://abcdefgh.supabase.co */
    SUPABASE_URL: 'https://VOTRE-PROJET.supabase.co',

    /* Clé anon Supabase — publique par conception, la sécurité = RLS. */
    SUPABASE_ANON_KEY: 'VOTRE_CLE_ANON_PUBLIQUE',

    /* Site key Cloudflare Turnstile — publique (la secret key va dans
       Supabase Auth, jamais ici). */
    TURNSTILE_SITE_KEY: 'VOTRE_SITE_KEY_TURNSTILE',

    /* Salon par défaut (slug, pas un secret). */
    CHAT_ROOM_SLUG: 'salon-kdl-tech',

    /* false = mode démo statique (Palier 1/2), aucun appel réseau.
       Passera à true seulement au branchement réel (Palier 3+). */
    CHAT_ENABLED: false,
    DEMO_MODE: true
};
