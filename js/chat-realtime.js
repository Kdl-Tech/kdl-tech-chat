/* ============================================================
   KDL TECH — Tchat privé · chat-realtime.js (Palier 6)
   Salon temps réel : chargement historique, écoute Realtime,
   envoi, soft-delete via RPC. Sécurité : textContent uniquement
   (jamais innerHTML), longueur bornée, trim. Aucun secret ici.
   Exposé en window.KDL_CHAT_ROOM — piloté par chat.js qui fournit
   le client Supabase déjà authentifié.
   ============================================================ */
(function () {
    'use strict';

    var MAX_LEN = 1000;          // borne UI (la base autorise jusqu'à 2000)
    var HISTORY_LIMIT = 50;

    var sb = null, cfg = null, refs = null;
    var session = null, myProfile = null;
    var channel = null;
    var profileCache = {};       // userId -> { username, role }
    var rendered = {};           // id message -> node (dédoublonnage)

    function isStaff(p) { return !!p && (p.role === 'moderator' || p.role === 'admin'); }

    function initials(name) {
        var s = (name || '?').trim();
        var parts = s.split(/\s+/);
        var a = parts[0] ? parts[0][0] : '?';
        var b = parts[1] ? parts[1][0] : (parts[0] && parts[0][1] ? parts[0][1] : '');
        return (a + b).toUpperCase();
    }

    function fmtTime(iso) {
        try {
            return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        } catch (e) { return ''; }
    }

    function setStatus(text) {
        if (refs.status) refs.status.textContent = text || '';
        if (refs.status) refs.status.hidden = !text;
    }

    function refreshEmpty() {
        var has = Object.keys(rendered).length > 0;
        if (refs.empty) refs.empty.hidden = has;
    }

    /* Récupère un profil (username/role) avec cache, pour les messages
       Realtime dont le payload ne contient pas la jointure. */
    function getProfile(userId) {
        if (profileCache[userId]) return Promise.resolve(profileCache[userId]);
        return sb.from('profiles').select('username, role').eq('id', userId).single()
            .then(function (res) {
                var p = res.data || { username: 'membre', role: 'member' };
                profileCache[userId] = p;
                return p;
            })
            .catch(function () { return { username: 'membre', role: 'member' }; });
    }

    /* Construit le DOM d'un message — 100 % textContent. */
    function buildNode(msg, author) {
        var wrap = document.createElement('div');
        wrap.className = 'msg' + (msg.user_id === session.user.id ? ' msg-own' : '');
        wrap.setAttribute('data-id', String(msg.id));

        var avatar = document.createElement('span');
        avatar.className = 'avatar';
        avatar.textContent = initials(author.username);

        var body = document.createElement('div');
        body.className = 'msg-body';

        var who = document.createElement('b');
        who.textContent = author.username + (isStaff(author) ? ' · ' + author.role : '');

        var p = document.createElement('p');
        if (msg.deleted_at) {
            p.textContent = '(message supprimé)';
            p.classList.add('msg-deleted');
        } else {
            p.textContent = msg.content;
        }

        var time = document.createElement('small');
        time.textContent = fmtTime(msg.created_at);

        body.appendChild(who);
        body.appendChild(p);
        body.appendChild(time);

        // Action supprimer : auteur (si non déjà supprimé) ou staff
        var canDelete = !msg.deleted_at && (msg.user_id === session.user.id || isStaff(myProfile));
        if (canDelete) {
            var del = document.createElement('button');
            del.type = 'button';
            del.className = 'msg-del';
            del.textContent = '🗑';
            del.title = 'Supprimer ce message';
            del.addEventListener('click', function () { softDelete(msg.id, del); });
            body.appendChild(del);
        }

        wrap.appendChild(avatar);
        wrap.appendChild(body);
        return wrap;
    }

    function placeMessage(msg, author) {
        var existing = rendered[msg.id];
        var node = buildNode(msg, author);
        if (existing) {
            existing.replaceWith(node);
        } else {
            refs.list.appendChild(node);
        }
        rendered[msg.id] = node;
        refs.list.scrollTop = refs.list.scrollHeight;
        refreshEmpty();
    }

    function removeMessage(id) {
        if (rendered[id]) { rendered[id].remove(); delete rendered[id]; }
        refreshEmpty();
    }

    function softDelete(id, btn) {
        if (btn) btn.disabled = true;
        sb.rpc('soft_delete_message', { msg_id: id }).then(function (res) {
            if (res.error) {
                setStatus('Suppression impossible : ' + friendly(res.error));
                if (btn) btn.disabled = false;
            }
            // Sinon : l'événement Realtime UPDATE met l'affichage à jour.
        });
    }

    function friendly(err) {
        var m = (err && err.message) || '';
        if (/row-level security|RLS|not authorized|permission/i.test(m)) return 'action non autorisée.';
        if (/network|fetch/i.test(m)) return 'connexion réseau.';
        return 'réessayez plus tard.';
    }

    /* ---- envoi ---- */
    function onSend(e) {
        e.preventDefault();
        var text = (refs.input.value || '').trim();
        if (!text) return;
        if (text.length > MAX_LEN) text = text.slice(0, MAX_LEN);
        refs.input.disabled = true;
        refs.sendBtn.disabled = true;
        sb.from('messages').insert({ user_id: session.user.id, content: text }).then(function (res) {
            refs.input.disabled = false;
            refs.sendBtn.disabled = false;
            if (res.error) {
                setStatus('Envoi impossible : ' + friendly(res.error));
            } else {
                refs.input.value = '';
                setStatus('');
                refs.input.focus();
            }
        });
    }

    /* ---- historique + realtime ---- */
    function loadHistory() {
        setStatus('Connexion au salon…');
        return sb.from('messages')
            .select('id, content, created_at, deleted_at, user_id, author:profiles(username, role)')
            .order('created_at', { ascending: true })
            .limit(HISTORY_LIMIT)
            .then(function (res) {
                if (res.error) { setStatus('Salon indisponible : ' + friendly(res.error)); return; }
                (res.data || []).forEach(function (m) {
                    var author = m.author || { username: 'membre', role: 'member' };
                    profileCache[m.user_id] = author;
                    placeMessage(m, author);
                });
                setStatus('');
                refreshEmpty();
            });
    }

    function subscribe() {
        channel = sb.channel('room-messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, function (payload) {
                var m = payload.new;
                getProfile(m.user_id).then(function (a) { placeMessage(m, a); });
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, function (payload) {
                var m = payload.new;
                if (m.deleted_at && !isStaff(myProfile)) { removeMessage(m.id); return; }
                getProfile(m.user_id).then(function (a) { placeMessage(m, a); });
            })
            .subscribe();
    }

    /* API publique appelée par chat.js après authentification. */
    function init(client, config, sess, profile, domRefs) {
        sb = client; cfg = config; session = sess; myProfile = profile; refs = domRefs;
        profileCache = {}; rendered = {};
        if (refs.list) refs.list.textContent = '';   // vide la maquette démo
        refs.input.maxLength = MAX_LEN;
        refs.input.disabled = false;
        refs.sendBtn.disabled = false;
        refs.form.addEventListener('submit', onSend);
        loadHistory().then(subscribe);
    }

    function teardown() {
        if (channel) { try { sb.removeChannel(channel); } catch (e) {} channel = null; }
        if (refs && refs.form) refs.form.removeEventListener('submit', onSend);
        if (refs && refs.list) refs.list.textContent = '';
        rendered = {}; profileCache = {};
    }

    window.KDL_CHAT_ROOM = { init: init, teardown: teardown, MAX_LEN: MAX_LEN };
})();
