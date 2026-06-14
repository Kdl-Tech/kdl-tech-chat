#!/usr/bin/env node
/* ============================================================
   KDL TECH — Tchat privé · check-chat-config.mjs
   Vérifications locales SANS SECRET (n'affiche jamais de valeur) :
   1. js/chat-config.example.js existe (placeholders uniquement)
   2. js/chat-config.js est bien ignoré par Git
   3. chat.html charge chat-config.js AVANT chat.js
   4. aucun motif sensible (service_role, JWT eyJ…, sk_…) dans les
      fichiers frontend SUIVIS par Git
   Usage : node scripts/check-chat-config.mjs   (depuis le repo)
   Sortie : code 0 si tout est vert, 1 sinon.
   ============================================================ */
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const rel = (p) => path.join(repoRoot, p);

let failures = 0;
const ok = (msg) => console.log(`  ✅ ${msg}`);
const ko = (msg) => { failures++; console.error(`  ❌ ${msg}`); };

console.log('— Vérification config tchat privé (aucune valeur affichée) —');

/* 1. modèle public présent */
if (existsSync(rel('js/chat-config.example.js'))) {
    ok('js/chat-config.example.js présent');
} else {
    ko('js/chat-config.example.js manquant');
}

/* 2. config réelle gitignorée (le fichier peut être absent : OK aussi) */
try {
    execFileSync('git', ['check-ignore', '-q', 'js/chat-config.js'], { cwd: repoRoot });
    ok('js/chat-config.js ignoré par Git');
} catch {
    ko('js/chat-config.js N\'EST PAS ignoré par Git — corriger .gitignore avant tout commit');
}

/* 3. chat.html charge la config avant chat.js */
const chatHtmlPath = rel('chat.html');
if (existsSync(chatHtmlPath)) {
    const html = readFileSync(chatHtmlPath, 'utf8');
    const idxConfig = html.indexOf('js/chat-config.js');
    const idxChat = html.indexOf('js/chat.js');
    if (idxConfig === -1) {
        ko('chat.html ne charge pas js/chat-config.js');
    } else if (idxChat !== -1 && idxConfig > idxChat) {
        ko('chat.html charge js/chat-config.js APRÈS js/chat.js (ordre à inverser)');
    } else {
        ok('chat.html charge js/chat-config.js avant js/chat.js');
    }
} else {
    ko('chat.html introuvable');
}

/* 4. motifs sensibles dans les fichiers frontend suivis par Git.
   On ne signale que fichier + nom du motif, JAMAIS la ligne ni la valeur. */
/* service_role : cherché hors commentaires (les docs/avertissements en commentaire
   sont légitimes) ; les clés réelles (JWT, sk_) sont cherchées partout. */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const patterns = [
    { name: 'service_role', re: /service_role/, prep: stripComments },
    { name: 'JWT (eyJ…)', re: /eyJ[A-Za-z0-9_-]{20,}/ },
    { name: 'clé sk_…', re: /\bsk_[A-Za-z0-9]{10,}/ },
];
const tracked = execFileSync('git', ['ls-files', '--', '*.html', '*.js', '*.mjs', '*.css'],
    { cwd: repoRoot, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter((f) => f !== 'scripts/check-chat-config.mjs'); // ce script cite les motifs
let leaks = 0;
for (const file of tracked) {
    const content = readFileSync(rel(file), 'utf8');
    for (const { name, re, prep } of patterns) {
        if (re.test(prep ? prep(content) : content)) {
            leaks++;
            ko(`motif sensible « ${name} » détecté dans ${file} (valeur non affichée)`);
        }
    }
}
if (leaks === 0) ok(`aucun motif sensible dans ${tracked.length} fichiers frontend suivis`);

console.log(failures === 0 ? '— Tout est vert. —' : `— ${failures} problème(s) à corriger. —`);
process.exit(failures === 0 ? 0 : 1);
