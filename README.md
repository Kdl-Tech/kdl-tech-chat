**Français** · [English](README.en.md)

# KDL Tchat

Le module de salon privé en temps réel de [kdl-tech.fr](https://kdl-tech.fr), publié en
open source : frontend statique en JavaScript sans build, base Supabase, et une sécurité
qui repose entièrement sur des règles Postgres — pas sur un backend de confiance.

```bash
git clone https://github.com/Kdl-Tech/kdl-tech-chat.git
cd kdl-tech-chat
cp js/chat-config.example.js js/chat-config.js   # clés publiques uniquement
node scripts/check-chat-config.mjs               # vérifie qu'aucun secret ne fuit
```

![Sortie du script de vérification : chat-config.example.js présent, chat-config.js ignoré par Git, chat.html charge la config avant chat.js, aucun motif sensible dans les cinq fichiers frontend suivis — tout est vert](docs/check-config.svg)

## L'intérêt de ce dépôt

Un frontend qui ne détient **aucun secret**. Pas de clé de service, pas d'endpoint
privilégié, pas d'intermédiaire de confiance : le navigateur ne reçoit que l'URL du projet
et la clé publique `anon`, et tout le reste est arbitré par la Row Level Security de
Postgres. Si vous construisez sur Supabase, le schéma `supabase/schema.sql` est la partie
qui mérite d'être lue.

| | |
|---|---|
| **Authentification** | e-mail/mot de passe et Google, via Supabase Auth |
| **Temps réel** | Realtime Supabase, sans polling |
| **Isolation** | RLS sur toutes les tables : rien n'est lisible sans être authentifié et non banni |
| **Anti-XSS** | tout contenu utilisateur rendu par `textContent`, jamais `innerHTML` |
| **Anti-bot** | Cloudflare Turnstile branché sur `signUp` et `signIn` |
| **Modération** | suppression douce et bannissement réservés au staff |
| **Build** | aucun. Trois fichiers JS, une page HTML |

## Pourquoi il n'y a aucune policy UPDATE sur les messages

La suppression d'un message ne passe pas par une policy mais par une fonction
`security definer` (`soft_delete_message`). Ce n'est pas un choix de style : une policy
`UPDATE` **ne pouvait pas fonctionner**.

PostgreSQL exige que la ligne modifiée reste visible par la policy `SELECT` de celui qui
la modifie. Or ici un message supprimé devient invisible pour son auteur — seul le staff
voit les messages supprimés. L'`UPDATE` de l'auteur violait donc sa propre policy de
lecture et échouait systématiquement en `42501`. Le comportement a été découvert en
exécutant les tests RLS réels, pas en relisant la documentation.

Conséquence utile : un message posté est **immuable** côté client. Aucune policy `UPDATE`
ni `DELETE` n'existe, donc aucun client ne peut réécrire l'historique, même avec la clé
publique en main.

## Ce que ça ne fait pas

- **Ce n'est pas un service prêt à l'emploi.** Il faut votre propre projet Supabase :
  appliquer `supabase/schema.sql`, puis renseigner `js/chat-config.js`.
- **Ce n'est pas un module autonome visuellement.** La feuille de style `css/style.css`
  vient du site kdl-tech.fr et ne fait pas partie de ce dépôt : servi seul, le HTML
  s'affiche sans mise en forme.
- **Pas de chiffrement de bout en bout.** Les messages sont lisibles par l'administrateur
  du projet Supabase, comme dans tout salon modéré.
- **Le déploiement public n'est pas actif.** Le code est complet et testé ; la mise en
  ligne sur kdl-tech.fr reste à faire.

## Mise en place

1. Créer un projet Supabase, exécuter `supabase/schema.sql` dans l'éditeur SQL.
2. Copier `js/chat-config.example.js` vers `js/chat-config.js` (gitignoré) et renseigner
   l'URL du projet, la clé `anon` et la site key Turnstile — **des valeurs publiques
   uniquement**.
3. Vérifier les règles avec `supabase/tests_rls.sql`, qui rejoue les cas limites :
   lecture anonyme, utilisateur banni, message d'un tiers, suppression par le staff.
4. Servir `chat.html` avec la feuille de style de votre site.

`node scripts/check-chat-config.mjs` avant chaque commit : il refuse de laisser passer un
motif de secret dans les fichiers suivis, et vérifie que la configuration locale est bien
ignorée par Git.

## Licence

MIT — voir [LICENSE](LICENSE).

---

**KDL TECH** — dépannage informatique, développement et outils logiciels.
[kdl-tech.fr](https://kdl-tech.fr)
