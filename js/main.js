/* ============================================================
   KDL TECH — V2.1 « Cockpit » · main.js
   Terminal scan, compteurs, reveal, devis→WhatsApp, QR,
   cookies, compteurs soutien, nav mobile
   ============================================================ */
(function () {
    'use strict';
    var $ = function (s) { return document.querySelector(s); };
    var $$ = function (s) { return document.querySelectorAll(s); };
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ===== Nav mobile ===== */
    var burger = $('#burger'), nav = $('#nav');
    if (burger && nav) {
        burger.addEventListener('click', function () {
            var open = nav.classList.toggle('open');
            burger.setAttribute('aria-expanded', open);
        });
        nav.addEventListener('click', function (e) {
            if (e.target.tagName === 'A') nav.classList.remove('open');
        });
    }

    /* ===== Terminal scan (boucle douce) ===== */
    var LINES = [
        '> Initialisation du scan...',
        '> Analyse du systeme de fichiers...',
        '> Verification des processus actifs...',
        '> Scan des ports reseau...',
        '> Analyse de la memoire vive...',
        '> Verification des pilotes...',
        '> Scan antivirus en cours...',
        '> Verification de l\'integrite systeme...',
        '> Nettoyage des fichiers temporaires...',
        '> Optimisation des performances...',
        '✅ SYSTEME OK'
    ];
    var term = $('#term-body');
    if (term && !reduced) {
        var idx = 0;
        var tick = function () {
            idx = (idx + 1) % LINES.length;
            var start = Math.max(0, idx - 3);
            term.textContent = LINES.slice(start, idx + 1).join('\n');
            setTimeout(tick, idx === LINES.length - 1 ? 4000 : 900);
        };
        setTimeout(tick, 900);
    } else if (term) {
        term.textContent = LINES.slice(-4).join('\n');
    }

    /* ===== Compteurs animés [data-count] ===== */
    var animateCount = function (el) {
        var target = parseInt(el.getAttribute('data-count'), 10) || 0;
        if (reduced) { el.textContent = target; return; }
        var t0 = null;
        var step = function (ts) {
            if (!t0) t0 = ts;
            var p = Math.min((ts - t0) / 1200, 1);
            el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    };
    var counted = new WeakSet();
    var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
            if (!en.isIntersecting) return;
            en.target.classList.add('in');
            en.target.querySelectorAll('[data-count]').forEach(function (el) {
                if (!counted.has(el)) { counted.add(el); animateCount(el); }
            });
            io.unobserve(en.target);
        });
    }, { threshold: 0.15 }) : null;

    /* ===== Reveal au scroll ===== */
    $$('.card, .step, .sec-head, .hero-dash, .devis-form, .counter').forEach(function (el) {
        el.classList.add('reveal');
        if (io) io.observe(el); else el.classList.add('in');
    });

    /* ===== Devis → WhatsApp ===== */
    var form = $('#devis-form');
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var msg = 'Bonjour KDL Tech !\n\n--- DEMANDE DE DEVIS ---\n' +
                'Prénom : ' + $('#f-name').value.trim() + '\n' +
                'Problème : ' + $('#f-type').value + '\n' +
                'Système : ' + $('#f-os').value + '\n' +
                'Description : ' + $('#f-desc').value.trim() + '\n\nMerci !';
            window.open('https://wa.me/590690706008?text=' + encodeURIComponent(msg), '_blank', 'noopener');
        });
    }

    /* ===== QR carte de visite ===== */
    var qrBox = $('#qrcode');
    var renderQR = function () {
        if (!qrBox || typeof qrcode === 'undefined') return;
        var qr = qrcode(0, 'M');
        qr.addData('https://kdl-tech.fr/carte.html');
        qr.make();
        qrBox.innerHTML = qr.createImgTag(4, 8);
        qrBox.querySelector('img').alt = 'QR code carte de visite KDL TECH';
    };
    if (typeof qrcode !== 'undefined') renderQR();
    else window.addEventListener('load', renderQR);

    /* ===== Retour en haut ===== */
    var toTop = $('#to-top');
    if (toTop) {
        var onScroll = function () { toTop.classList.toggle('show', window.scrollY > 400); };
        window.addEventListener('scroll', onScroll, { passive: true });
        toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); });
        onScroll();
    }

    /* ===== Cookies RGPD ===== */
    var ck = $('#cookies');
    if (ck && !localStorage.getItem('kdl-cookies')) {
        ck.hidden = false;
        var close = function (v) { localStorage.setItem('kdl-cookies', v); ck.hidden = true; };
        $('#ck-ok').addEventListener('click', function () { close('accepted'); });
        $('#ck-no').addEventListener('click', function () { close('refused'); });
    }

    /* ===== Compteurs soutien (counterapi) ===== */
    var getJSON = function (url, cb) {
        fetch(url).then(function (r) { return r.json(); }).then(cb).catch(function () {});
    };
    var visitEl = $('#visit-count'), coffeeEl = $('#coffee-count');
    if (visitEl) {
        getJSON('https://api.counterapi.dev/v1/kdl-tech-fr/visits/up', function (d) {
            if (d && typeof d.count === 'number') visitEl.textContent = d.count;
        });
    }
    var showCoffees = function (n) {
        if (!coffeeEl) return;
        coffeeEl.textContent = n;
        var goal = 50, pct = Math.min(100, Math.round(n / goal * 100));
        var prog = $('#coffee-progress'), label = $('#coffee-label');
        if (prog) prog.style.setProperty('--w', pct + '%');
        if (label) label.textContent = n + ' café(s) offert(s) sur ' + goal + ' — objectif ' + pct + ' %';
    };
    if (coffeeEl) {
        if (new URLSearchParams(location.search).get('cafe') === 'merci') {
            getJSON('https://api.counterapi.dev/v1/kdl-tech-fr/donations/up', function (d) {
                if (d && typeof d.count === 'number') showCoffees(d.count);
            });
            history.replaceState(null, '', location.pathname);
            var toast = document.createElement('div');
            toast.className = 'cookies glass';
            toast.style.bottom = '90px';
            toast.innerHTML = '<p>☕ Merci infiniment pour votre soutien ! 🙏</p>';
            document.body.appendChild(toast);
            setTimeout(function () { toast.remove(); }, 5000);
        } else {
            getJSON('https://api.counterapi.dev/v1/kdl-tech-fr/donations/', function (d) {
                if (d && typeof d.count === 'number') showCoffees(d.count);
            });
        }
    }

    /* ===== Divers ===== */
    var y = $('#year');
    if (y) y.textContent = new Date().getFullYear();
})();
