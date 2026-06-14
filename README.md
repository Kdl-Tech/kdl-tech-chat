# KDL Tchat — chat privé sécurisé

Module de chat privé temps réel du site [kdl-tech.fr](https://kdl-tech.fr),
publié en open-source. Frontend statique (vanilla JS, zéro build) + **Supabase**
(Auth e-mail, Postgres, Row Level Security, Realtime). Aucun secret côté client :
la sécurité repose entièrement sur la RLS et une clé publique.

> ⚠️ **Statut : en préparation.** Le code est complet et testé en local ;
> le déploiement public n'est pas encore actif.

## Principes de sécurité

- **Aucun secret dans le dépôt.** Seule la clé **publique** (anon / publishable)
  et l'URL du projet vont côté navigateur — la sécurité réelle est faite par la RLS.
- **`service_role` interdit côté frontend** (clé d'admin, jamais publiée ni embarquée).
- **RLS sur toutes les tables** : rien n'est lisible sans être authentifié et non banni.
- **Messages immuables** : aucune policy `UPDATE`/`DELETE` ; la suppression douce
  passe par des fonctions `security definer` (`soft_delete_message`, `restore_message`).
- **Anti-XSS** : tout contenu utilisateur est rendu via `textContent`, jamais `innerHTML`.
- **Anti-bot** : Cloudflare Turnstile prévu (code prêt, branché sur `signUp`/`signIn`).

## Contenu

| Fichier | Rôle |
|---|---|
| `chat.html` | Page du salon (auth e-mail + salon temps réel) |
| `js/chat.js` | Orchestrateur : config, mode démo/réel, auth e-mail |
| `js/chat-realtime.js` | Salon : historique, Realtime, envoi, soft-delete |
| `js/turnstile-helper.js` | Intégration Cloudflare Turnstile (montage à la demande) |
| `js/chat-config.example.js` | **Modèle de config** (placeholders publics uniquement) |
| `supabase/schema.sql` | Tables, RLS, triggers, fonctions, Realtime |
| `supabase/tests_rls.sql` | Tests de sécurité RLS rejouables |
| `scripts/check-chat-config.mjs` | Vérifie l'absence de secret et l'ordre de chargement |

## Mise en route

1. Créer un projet [Supabase](https://supabase.com) (plan Free suffisant).
2. Appliquer `supabase/schema.sql` (éditeur SQL ou Management API).
3. Activer l'Auth e-mail (confirmation requise) et Realtime sur `messages`.
4. Copier la config et la remplir avec **vos valeurs publiques** :
   ```bash
   cp js/chat-config.example.js js/chat-config.js
   # éditer js/chat-config.js : SUPABASE_URL + clé publique (anon/publishable)
   ```
   `js/chat-config.js` est **gitignoré** — ne jamais le commiter.
5. Servir en local :
   ```bash
   python3 -m http.server 8080
   # http://localhost:8080/chat.html
   ```

### Dépendances de présentation

`chat.html` réutilise l'en-tête, le pied de page et la feuille de style du site
hôte (`css/style.css`) ainsi qu'un petit script générique (`js/main.js`, optionnel,
null-guardé). Pour un usage autonome, fournir votre propre `css/style.css`
(les classes utilisées : `card`, `glass`, `btn`, `chip`…) ; le chat fonctionne
sans `js/main.js`.

## Vérification anti-secret

```bash
node scripts/check-chat-config.mjs
```

Échoue si un motif sensible (`service_role`, JWT `eyJ…`, `sk_…`) apparaît dans un
fichier suivi, ou si `js/chat-config.js` n'est pas ignoré.

## Licence

MIT.
