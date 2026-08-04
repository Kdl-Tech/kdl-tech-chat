<div align="center">

# 💬 KDL Tchat

**A private real-time chat: static vanilla-JS frontend on Supabase, with security enforced by Row Level Security rather than by a trusted backend.**

[![No build step](https://img.shields.io/badge/Build-none%20%C2%B7%20vanilla%20JS-f7df1e.svg)]()
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%C2%B7%20RLS%20%C2%B7%20Realtime-3ecf8e.svg)]()
[![No secrets](https://img.shields.io/badge/Secrets%20in%20repo-none-22c55e.svg)](#security-model)
[![Status](https://img.shields.io/badge/status-in%20preparation-orange.svg)](#status)

*🇫🇷 [Documentation française complète plus bas](#-documentation-française)*

</div>

---

## What it is

The private chat module of [kdl-tech.fr](https://kdl-tech.fr), released as open
source. It is a useful reference if you are building on Supabase and want to see
**a frontend that holds no secret at all** — no service key, no privileged
endpoint, no trusted middle tier.

<a id="security-model"></a>
### Security model

- **No secret in the repository.** Only the **public** (anon/publishable) key and
  the project URL reach the browser — real security is enforced by RLS.
- **`service_role` is banned from the frontend** (admin key, never published).
- **RLS on every table**: nothing is readable unless authenticated and not banned.
- **Immutable messages**: no `UPDATE`/`DELETE` policy; soft deletion goes through
  `security definer` functions (`soft_delete_message`, `restore_message`).
- **Anti-XSS**: all user content rendered via `textContent`, never `innerHTML`.
- **Anti-bot**: Cloudflare Turnstile wired into `signUp`/`signIn`.

<a id="status"></a>
> ⚠️ **Status: in preparation.** The code is complete and tested locally; the
> public deployment is not live yet.

## Contributing

RLS policy reviews are especially welcome — that is where the entire security of
this design lives. ⭐ helps others find it.

---

<a id="-documentation-française"></a>

## 🇫🇷 Documentation française

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

---

<div align="center">

**Other tools by [KDL TECH](https://kdl-tech.fr)** — an independent computer repair
and software workshop in Guadeloupe 🇬🇵

[Anti-arnaque](https://github.com/Kdl-Tech/kdl-anti-arnaque) ·
[Privacy Dev Browser](https://github.com/Kdl-Tech/kdl-privacy-dev-browser) ·
[Prompt Studio](https://github.com/Kdl-Tech/kdl-prompt-studio) ·
[DNS Shield](https://github.com/Kdl-Tech/kdl-dns-shield) ·
[Security Free](https://github.com/Kdl-Tech/kdl-security-free) ·
[MAIA Conky](https://github.com/Kdl-Tech/maia-conky)

</div>
