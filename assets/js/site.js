/* Secrets Hideaway concept page: mounts the flight, renders the calendar,
   marks "tonight", and runs the nav. Plain JS, no build step. */
(function () {
  'use strict';

  var BOOK_URL = 'https://www.secretsfl.com/book-now-iframe#/room';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------
     1. Dates. "Today" is the viewer's local date, so the demo stays right
        on whatever day it is shown. Once the calendar data has run out
        (it ends 2027-04-30) nothing dated is shown: the agenda keeps its
        evergreen line and the flight's event beat turns generic.
     ------------------------------------------------------------------ */
  var EVENTS = (window.SECRETS_EVENTS || []).slice();
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var today = iso(new Date());
  var todayDow = parse(today).getDay();
  var tomorrow = addDays(today, 1);

  /* ------------------------------------------------------------------
     2. Takeovers. Each one is shown as a single agenda entry listing its
        themed nights, and the next (or current) one drives the flight's
        event beat, so that beat is never out of date.
     ------------------------------------------------------------------ */
  var TAKEOVERS = [
    { re: /Hallowswing/, name: 'Hallowswing® 17', start: '2026-10-22', end: '2026-11-01',
      url: 'https://www.secretsfl.com/groups/oct-22-25-hallowswing-week-1',
      note: 'Ten themed nights, then Sip & Reminisce poolside to wind down on Sunday, November 1. Costume contests on October 24 ($500 for first place) and on Halloween night ($1,000 for first place).',
      bigText: 'nights in costume',
      beat: 'From House of Screams to Carnival of Terror on Halloween night, with a $1,000 first prize for the best costume.' },
    { re: /Hallowsweet/, name: 'i.Candy Hallowsweet Takeover', start: '2026-11-05', end: '2026-11-08',
      url: 'https://www.secretsfl.com/groups/nov-5-8-i-candy-hallowsweet',
      note: 'Candy-coated looks, cosplay and sweet temptations, with Sip & Reminisce poolside on Sunday.' },
    { re: /Holiday Bash/, name: 'i.Candy Holiday Bash Takeover', start: '2026-12-03', end: '2026-12-06',
      url: 'https://www.secretsfl.com/groups/dec-3-6-i-candy-holiday-bash-takeover',
      note: 'Festive cheer with a flirty edge, all weekend long.' },
    { re: /New Years Celebration|Colosseum Glow/, name: 'New Year’s Celebration', start: '2026-12-30', end: '2027-01-02',
      url: 'https://www.secretsfl.com/6277.event', note: 'Four Roman-themed nights to see in 2027.' },
    { re: /Lusty Lovers/, name: 'Lusty Lovers Valentine’s Takeover', start: '2027-02-11', end: '2027-02-14', url: '' },
    { re: /Spring Fling/, name: 'Spring Fling Takeover', start: '2027-03-04', end: '2027-03-07', url: '' },
    { re: /i\.Candy Lifestyle Takeover/, name: 'i.Candy Lifestyle Takeover', start: '2027-03-17', end: '2027-03-21', url: '' }
  ];
  var WEEKLY = /^(Karaoke Monday with DJ Drift|Pride Tuesday|Erotic Rendezvous|Newbie Night - Meet & Greet|Sip & Reminisce|(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day Pool Party.*)$/;
  var POOL = /Pool Party/;

  function takeoverOf(e) {
    for (var i = 0; i < TAKEOVERS.length; i++) {
      var t = TAKEOVERS[i];
      if (t.re.test(e.title) || t.re.test(e.series)) return t;
    }
    return null;
  }
  function couplePrice(p) { var m = /^\$(\d+)\s+(?:a\s+)?Couples?\b/i.exec(p || ''); return m ? +m[1] : null; }
  // The listing's own title, with " - " suffixes kept ("Erotic Rendezvous: Veterans Day").
  // Nights inside a takeover drop the takeover's name, which the entry already shows.
  function display(e) { return e.series ? e.base : e.title.replace(/\s+-\s+/g, ': '); }
  function kind(e) {
    var c = e.cats.join(' ');
    if (/Holiday/.test(c)) return 'Holiday party';
    if (/Pool Party/.test(c)) return 'Pool party';
    if (/Themed|Kink/.test(c)) return 'Themed night';
    if (/Social|Meet/.test(c)) return 'Social';
    return 'Party';
  }
  function when(d) {
    if (d === today) return '<span class="tonight">Tonight</span>';
    if (d === tomorrow) return 'Tomorrow';
    return DAY[parse(d).getDay()];
  }
  function range(a, b) {
    var A = parse(a), B = parse(b);
    return MON[A.getMonth()] + ' ' + A.getDate() + ' to ' + (A.getMonth() === B.getMonth() ? '' : MON[B.getMonth()] + ' ') + B.getDate();
  }
  function shortDate(s) { var d = parse(s); return DAY[d.getDay()].slice(0, 3) + ' ' + MON[d.getMonth()] + ' ' + d.getDate(); }

  /* The flight's event beat: the takeover that is on now, or the next one. */
  function eventBeat() {
    var t = null, i;
    for (i = 0; i < TAKEOVERS.length; i++) if (TAKEOVERS[i].end >= today) { t = TAKEOVERS[i]; break; }
    if (!t) {
      return { id: 'booth', label: 'Takeovers', cls: 'beat--event',
        eyebrow: 'Takeovers', title: 'Whole-resort weekends.',
        body: 'Themed takeovers fill the whole resort, from the pool to the club.',
        cta: { primary: { label: 'See what’s on', href: '#events' } } };
    }
    var nights = {};
    EVENTS.forEach(function (e) { if (takeoverOf(e) === t && !POOL.test(e.title)) nights[e.date] = 1; });
    var n = Object.keys(nights).length;
    return {
      id: 'booth', label: t.name, cls: 'beat--event',
      eyebrow: (today >= t.start ? 'On now' : 'Next up') + ' · ' + range(t.start, t.end),
      title: t.name,
      big: n > 1 ? { num: String(n), text: t.bigText || 'themed nights' } : null,
      body: t.beat || t.note || '',
      cta: { primary: { label: 'See every night', href: '#events' } }
    };
  }

  /* ------------------------------------------------------------------
     3. The flight. Clip and poster paths are fixed: drop the real AI legs
        into assets/flight/ under the same names and nothing else changes.
     ------------------------------------------------------------------ */
  var world = document.getElementById('world');
  var flight = { index: 0, target: 0, duration: 0 };   // where the camera is (for the music, 3b)
  // The tiki sweep, upright phones only. The tiki bar is one wide shot (bar group far left,
  // table group far right, stage in the middle), and a phone shows only the middle quarter,
  // which is an empty floor until the night crowd arrives. So the phone's view slides across
  // the room with the scroll: from the stage to the bar group as the camera comes under the
  // roof, across the stage to the tables while the light holds, and back to the centre as the
  // lights drop. `x` is the view's centre across the shot, per frame, from `from`. The path
  // runs straight through the join of the two legs, so it never stops there.
  // Printed by tools/make-phone-frames.py (which also cuts the frames to match): do not edit by hand.
  var SWEEP = {
    L2: { from: 89, x: [0.5, 0.4975, 0.4904, 0.4793, 0.4646, 0.4469, 0.4268, 0.4048, 0.3814, 0.3572, 0.3328, 0.3086, 0.2852, 0.2632, 0.2431, 0.2254, 0.2107, 0.1996, 0.1925, 0.19, 0.1922, 0.1988, 0.2093, 0.2234, 0.2409, 0.2614, 0.2846, 0.3102, 0.3378, 0.3672, 0.398, 0.4299] },
    L3: { from: 0, x: [0.4299, 0.4626, 0.4958, 0.5292, 0.5624, 0.5951, 0.627, 0.6578, 0.6872, 0.7148, 0.7404, 0.7636, 0.7841, 0.8016, 0.8157, 0.8262, 0.8328, 0.835, 0.8323, 0.8246, 0.8126, 0.7967, 0.7776, 0.7559, 0.7321, 0.7068, 0.6807, 0.6543, 0.6282, 0.6029, 0.5791, 0.5574, 0.5383, 0.5224, 0.5104, 0.5027, 0.5] }
  };
  if (world && window.mountScrollWorld) {
    var beat = eventBeat();
    beat.still = 'assets/flight/K5.jpg'; beat.clip = 'assets/flight/L5.mp4'; beat.clipMobile = 'assets/flight/m/L5.mp4'; beat.linger = 0.25;
    // Portrait phones draw still frames instead of seeking the clip (tools/make-phone-frames.py prints these).
    beat.frames = { url: 'assets/flight/f/L5/', count: 121, duration: 10.0417 };
    window.__flight = window.mountScrollWorld(world, {   // the handle is only read by the checks in work/qa
      nav: false,
      atmosphere: false,
      hint: 'Scroll to fly in',
      diveScroll: 1.8,     // viewport-heights of scroll per leg (each leg is 10 s of footage)
      crossfade: 0.08,     // seams are frame-identical: a short dissolve on the shared frame
      dips: [4],           // L5 -> L6: leave the club, dip through black, arrive in the suite
      dipScroll: 0.32,
      dipText: 'Later.',
      copyHold: 0.2,       // each beat stays fully readable through the middle of its leg
      holdLast: true,      // keep the suite on screen while the page slides up over it
      onRead: function (s) { flight = s; },   // the music follows the camera (3b)
      sections: [
        {
          id: 'arrival', label: 'Arrival', cls: 'beat--hero',
          still: 'assets/flight/K1.jpg', clip: 'assets/flight/L1.mp4', clipMobile: 'assets/flight/m/L1.mp4',
          frames: { url: 'assets/flight/f/L1/', count: 121, duration: 10.0417 },
          scroll: 1.7,
          eyebrow: 'Kissimmee, Florida · Private membership resort · 21+',
          title: 'Florida’s adults-only hideaway.',
          body: 'Your secret is safe with us.'
        },
        {
          id: 'pool', label: 'The pool', cls: 'beat--pool',
          still: 'assets/flight/K2.jpg', clip: 'assets/flight/L2.mp4', clipMobile: 'assets/flight/m/L2.mp4',
          frames: { url: 'assets/flight/f/L2/', count: 121, duration: 10.0417, pan: SWEEP.L2 },
          // Phones: the arrival under the tiki roof gets more scroll, rising towards the join,
          // so the camera eases to rest and the sweep is unhurried under a finger.
          slow: [[0.70, 1], [0.78, 2.5], [1, 3.3]],
          linger: 0.25,
          copyAt: 0.28,      // the words peak over the pool, and are gone before the roof
          eyebrow: 'The pool',
          title: 'The weekend starts poolside.',
          body: 'Pool parties Friday to Sunday, 10am to 5pm, with a DJ on the deck. Not staying the night? Members can buy a day pass.'
        },
        {
          id: 'tiki', label: 'The tiki bar', cls: 'beat--tiki',
          still: 'assets/flight/K3.jpg', clip: 'assets/flight/L3.mp4', clipMobile: 'assets/flight/m/L3.mp4',
          frames: { url: 'assets/flight/f/L3/', count: 121, duration: 10.0417, pan: SWEEP.L3 },
          // Phones: the same pace carries on through the join (3.3 on both sides), then back
          // to normal once the lights are down and the view is centred again.
          slow: [[0, 3.3], [0.30, 2.2], [0.38, 1]],
          copyAtPhone: 0.58,   // phones: the words wait for the sweep, and come in while the lights are down
          linger: 0.25,
          eyebrow: 'The tiki bar',
          title: 'Then the lights go down.',
          body: 'Cocktails at the Tiki Bar, right on the pool, and the Sunset Meet & Greet Happy Hour from 6pm to 9pm.',
          tags: ['Happy hour 6pm–9pm', 'Buy two well drinks, get one free']
        },
        {
          id: 'club', label: 'The nightclub', cls: 'beat--club',
          still: 'assets/flight/K4.jpg', clip: 'assets/flight/L4.mp4', clipMobile: 'assets/flight/m/L4.mp4',
          frames: { url: 'assets/flight/f/L4/', count: 121, duration: 10.0417 },
          linger: 0.25,
          eyebrow: 'The nightclub',
          title: 'The party moves inside.',
          body: 'Thursday to Saturday, 9pm to 2am. Pride Tuesday from 10pm.'
        },
        beat,
        {
          id: 'suite', label: 'Your suite', cls: 'beat--suite',
          still: 'assets/flight/K7.jpg', clip: 'assets/flight/L6.mp4', clipMobile: 'assets/flight/m/L6.mp4',
          frames: { url: 'assets/flight/f/L6/', count: 73, duration: 6.0417 },
          scroll: 2.0,       // a long, slow landing so the Book a Room moment holds
          eyebrow: 'Your suite',
          title: 'Stay the night. Stay the weekend.',
          body: 'Themed suites and privately owned condos, a short walk from the pool. Check in from 3pm, check out at 11am.',
          cta: {
            primary: { label: 'Book a Room', href: BOOK_URL },
            secondary: { label: 'Prices & rules', href: '#prices' }
          }
        }
      ],
      connectors: []
    });
    // Hero headline: "Florida's" on its own line, "adults-only" never split.
    var hero = world.querySelector('.sw-copy__title');
    if (hero) hero.innerHTML = hero.innerHTML.replace('Florida’s adults-only', 'Florida’s<br><span class="nowrap">adults-only</span>');
    // The engine builds its own links: booking opens the live site in a new tab.
    Array.prototype.forEach.call(world.querySelectorAll('a[href^="http"]'), function (a) {
      a.target = '_blank'; a.rel = 'noopener';
    });
  }

  /* ------------------------------------------------------------------
     3b. Sound: off until the speaker is tapped (or M is pressed). The pool
         track plays by day, fades as the tiki lights go down (L3, 1 s to
         3 s into the clip), and the club track hits as they come back up:
         it waits until they are half up (3.5 s), then comes in at once
         from its first bar. Softer in the suite, softer
         again once the page is up. Plain <audio>, so it also works from disk.
         On the demo laptop (localhost or opened from disk) it first tries
         assets/audio/private/, a git-ignored folder for a licensed track
         that must not be published, and falls back to the standard loops.
         iPhone: a track can only be started by a tap, so the first tap
         starts both (the silent one muted, then parked), and since iOS
         ignores an element's volume the tracks switch cleanly instead of
         fading: pool off as the lights go down, club on as they come up.
         (Written from the platform's rules; not yet heard on a real iPhone.)
     ------------------------------------------------------------------ */
  var soundBtn = document.getElementById('sound');
  var tracks = null, soundOn = false, lastT = 0;
  var MASTER = 0.9, TAU = 0.25;   // overall level; volume glide time constant (s)
  function ease01(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  // iOS reports volume 1 whatever is set.
  var CAN_FADE = (function () { try { var a = new Audio(); a.volume = 0.5; return a.volume === 0.5; } catch (e) { return true; } })();
  var LOCAL_DEMO = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  function makeTrack(name, rewind) {
    var std = 'assets/audio/' + name + '.mp3';
    var a = new Audio(LOCAL_DEMO ? 'assets/audio/private/' + name + '.mp3' : std);
    a.loop = true; a.preload = 'auto'; a.volume = 0;
    if (LOCAL_DEMO) a.addEventListener('error', function once() {   // no private track here: use the standard loop
      a.removeEventListener('error', once); a.src = std; a.load();
    });
    return { el: a, level: 0, rewind: rewind, on: false, primed: false };
  }
  // Inside the first tap: start a track that is silent right now, muted, and park it again,
  // so it may be started later without a tap.
  function prime(tr) {
    if (tr.primed) return;
    tr.primed = true;
    var el = tr.el;
    el.muted = true;
    var done = function () {
      if (!tr.on) { el.pause(); if (tr.rewind) { try { el.currentTime = 0; } catch (e) {} } }
      el.muted = false;
    };
    var p; try { p = el.play(); } catch (e) { el.muted = false; return; }
    if (p && p.then) p.then(done, function () { el.muted = false; }); else done();
  }
  function soundTargets() {
    var i = flight.index, t = flight.target * (flight.duration || 10), pool = 0, club = 0;
    if (i < 2) pool = 1;
    else if (i === 2) { pool = 1 - ease01((t - 1) / 2); club = ease01(t - 3); }
    else club = i >= 5 ? 0.55 : 1;
    var top = document.getElementById('main').getBoundingClientRect().top;
    var page = 1 - 0.55 * ease01(1 - top / window.innerHeight);   // the page rising over the suite
    var m = soundOn ? MASTER * page : 0;
    return { pool: pool * m, club: club * m, rawPool: soundOn ? pool : 0, rawClub: soundOn ? club : 0 };
  }
  function soundFrame(now) {
    var dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 0.016, k = 1 - Math.exp(-dt / TAU), busy = false;
    lastT = now;
    var tg = soundTargets();
    ['pool', 'club'].forEach(function (n) {
      var tr = tracks[n], want = tg[n], raw = tg[n === 'pool' ? 'rawPool' : 'rawClub'];
      // A drop should land, not fade in: the club track stays parked until the lights are
      // half up, then comes in at once from its first bar. (It still fades out normally.)
      if (tr.rewind && tr.level === 0 && raw <= 0.5) want = 0;
      tr.level += (want - tr.level) * (tr.rewind && want > tr.level ? 1 - Math.exp(-dt / 0.05) : k);
      if (Math.abs(want - tr.level) < 0.004) tr.level = want;
      // No volume control (iPhone): on or off, switching at the halfway point of a fade.
      tr.on = CAN_FADE ? (tr.level > 0 || want > 0) : raw > 0.5;
      if (tr.on) {
        busy = true;
        if (tr.el.paused) { var p = tr.el.play(); if (p && p.catch) p.catch(function () {}); }
        if (CAN_FADE) tr.el.volume = Math.max(0, Math.min(1, tr.level));
      } else if (!tr.el.paused && !tr.el.muted) {
        // Silent: park it. The club starts again from its first bar, so the
        // lights coming up always land on a downbeat.
        tr.el.pause(); tr.el.volume = 0;
        if (tr.rewind) tr.el.currentTime = 0;
      }
    });
    if (busy || soundOn) requestAnimationFrame(soundFrame); else lastT = 0;
  }
  function setSound(on) {
    if (!soundBtn) return;
    if (!tracks) tracks = { pool: makeTrack('pool', false), club: makeTrack('club', true) };
    var wasIdle = !soundOn && tracks.pool.level === 0 && tracks.club.level === 0;
    soundOn = on;
    soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    soundBtn.querySelector('.nav__sound-label').textContent = on ? 'Sound on' : 'Sound off';
    if (on) {
      // Start the audible track inside the click itself, so the browser's autoplay rule is met.
      var tg = soundTargets();
      ['pool', 'club'].forEach(function (n) {
        if (tg[n] > 0) { tracks[n].on = true; tracks[n].primed = true; var p = tracks[n].el.play(); if (p && p.catch) p.catch(function () {}); }
        else prime(tracks[n]);
      });
    }
    if (wasIdle && on) requestAnimationFrame(soundFrame);
  }
  if (soundBtn) {
    soundBtn.addEventListener('click', function () { setSound(!soundOn); });
    document.addEventListener('keydown', function (ev) {
      if ((ev.key === 'm' || ev.key === 'M') && !ev.metaKey && !ev.ctrlKey && !ev.altKey &&
          !/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) setSound(!soundOn);
    });
  }

  /* ------------------------------------------------------------------
     4. "Coming up": the next 8 dates, with weekly regulars left out
        (they are in "Every week") and each takeover collapsed into one
        entry that lists its themed nights.
     ------------------------------------------------------------------ */
  function buildAgenda() {
    var rows = [], byKey = {};
    EVENTS.forEach(function (e) {
      var t = takeoverOf(e);
      if (t) {
        if (t.end < today) return;
        var r = byKey[t.name];
        if (!r) { r = byKey[t.name] = { type: 'takeover', t: t, date: t.start, nights: [], prices: [] }; rows.push(r); }
        if (!POOL.test(e.title)) r.nights.push(e);
        var cp = couplePrice(e.price); if (cp != null) r.prices.push(cp);
        return;
      }
      if (e.date < today || WEEKLY.test(e.title)) return;
      var key = 'd' + e.date, row = byKey[key];
      if (!row) { row = byKey[key] = { type: 'day', date: e.date, events: [] }; rows.push(row); }
      row.events.push(e);
    });
    rows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return rows.slice(0, 8);
  }

  function eventLink(e) {
    return '<a href="https://www.secretsfl.com/' + e.id + '.event" target="_blank" rel="noopener">' + esc(display(e)) + '</a>';
  }
  function passLink(e) {
    return e.pass ? '<a class="link" href="' + esc(e.pass) + '" target="_blank" rel="noopener">Get passes</a>' : '';
  }
  function priceText(e) { var cp = couplePrice(e.price); return cp != null ? '$' + cp + ' a couple' : esc(e.price); }

  function renderAgenda() {
    var host = document.getElementById('agenda');
    if (!host || !EVENTS.length) return;
    var html = buildAgenda().map(function (r) {
      var d = parse(r.date), num = d.getDate(), mon = MON[d.getMonth()];
      var date = '<div class="agenda__date"><span class="agenda__num">' + num + '</span><span class="agenda__mon">' + mon + '</span></div>';
      if (r.type === 'takeover') {
        var t = r.t, live = today >= t.start && today <= t.end;
        var nights = r.nights.map(function (e) {
          var nd = parse(e.date);
          return '<li><span>' + DAY[nd.getDay()].slice(0, 3) + ' ' + nd.getDate() + '</span>' + esc(e.base) + '</li>';
        }).join('');
        var min = r.prices.length ? Math.min.apply(null, r.prices) : null;
        var title = t.url ? '<a href="' + esc(t.url) + '" target="_blank" rel="noopener">' + esc(t.name) + '</a>' : esc(t.name);
        return '<li class="agenda__item agenda__item--takeover">' + date +
          '<div class="agenda__body"><p class="agenda__meta">' + (live ? '<span class="tonight">On now</span>' : '') +
          'Takeover, ' + range(t.start, t.end) + '</p>' +
          '<h4 class="agenda__title">' + title + '</h4>' +
          (t.note ? '<p class="agenda__detail">' + esc(t.note) + '</p>' : '') +
          (nights ? '<ul class="agenda__nights">' + nights + '</ul>' : '') + '</div>' +
          (min != null ? '<div class="agenda__price"><small class="agenda__from">from</small>$' + min + '<small>a couple</small></div>' : '<div></div>') +
          '</li>';
      }
      // Daytime first, then the night's party.
      var evs = r.events.slice().sort(function (a, b) { return (POOL.test(b.title) ? 1 : 0) - (POOL.test(a.title) ? 1 : 0); });
      var main = evs[evs.length - 1];
      var meta = '<p class="agenda__meta">' + when(r.date) + '<span>' + kind(main) + '</span></p>';
      if (evs.length === 1) {
        var e = evs[0], cp = couplePrice(e.price);
        return '<li class="agenda__item">' + date +
          '<div class="agenda__body">' + meta + '<h4 class="agenda__title">' + eventLink(e) + '</h4></div>' +
          '<div class="agenda__price">' + (cp != null ? '$' + cp + '<small>a couple</small>' : esc(e.price)) + passLink(e) + '</div>' +
          '</li>';
      }
      // Several events on one day: each gets its own title, price and passes.
      var list = evs.map(function (e) {
        return '<div class="agenda__event"><h4 class="agenda__title">' + eventLink(e) + '</h4>' +
          '<p class="agenda__sub">' + (POOL.test(e.title) ? '<span>By day</span>' : '<span>At night</span>') +
          '<span>' + priceText(e) + '</span>' + passLink(e) + '</p></div>';
      }).join('');
      return '<li class="agenda__item agenda__item--multi">' + date +
        '<div class="agenda__body">' + meta + list + '</div><div></div></li>';
    }).join('');
    if (html) host.innerHTML = html;   // nothing left to list: the page's own evergreen line stays
  }

  /* "Every week": mark today, and name the coming Friday and Saturday themes by date. */
  function renderWeekly() {
    var list = document.getElementById('weekly');
    if (!list) return;
    var row = list.querySelector('li[data-dow="' + todayDow + '"]');
    if (row) row.classList.add('is-today');
    [5, 6].forEach(function (dow) {
      var slot = list.querySelector('[data-theme-for="' + dow + '"]');
      if (!slot) return;
      for (var i = 0; i < EVENTS.length; i++) {
        var e = EVENTS[i];
        if (e.date < today || e.date > addDays(today, 6)) continue;
        if (parse(e.date).getDay() === dow && !POOL.test(e.title)) {
          var label = e.date === today ? 'Tonight' : e.date === tomorrow ? 'Tomorrow' : shortDate(e.date);
          slot.textContent = label + ': ' + display(e);
          break;
        }
      }
    });
  }

  /* Prices: highlight tonight's row. */
  function markTonight() {
    var tr = document.querySelector('#night-table tr[data-dow="' + todayDow + '"]');
    if (tr) tr.classList.add('is-tonight');
  }

  /* ------------------------------------------------------------------
     5. Nav: solid once the flight has landed; highlight the section in view.
     ------------------------------------------------------------------ */
  var nav = document.getElementById('nav');
  var main = document.getElementById('main');
  function onScroll() {
    var vh = window.innerHeight, top = main.getBoundingClientRect().top;
    nav.classList.toggle('is-solid', top < vh * 0.15);
    document.body.classList.toggle('past-flight', top < vh * 0.55);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  var links = {};
  Array.prototype.forEach.call(document.querySelectorAll('[data-nav]'), function (a) { links[a.getAttribute('data-nav')] = a; });
  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var a = links[en.target.id];
        if (a) a.classList.toggle('is-active', en.isIntersecting);
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(links).forEach(function (id) { var s = document.getElementById(id); if (s) spy.observe(s); });
  }

  /* In-page links. A jump that would cross the flight (Events from the hero,
     the logo from the footer) dips to black and cuts, instead of smooth-
     scrolling through every leg at fast-forward. Short hops on the page
     still glide. */
  var veil = document.createElement('div');
  veil.className = 'veil'; veil.setAttribute('aria-hidden', 'true');
  document.body.appendChild(veil);
  document.addEventListener('click', function (ev) {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    var a = ev.target.closest ? ev.target.closest('a[href^="#"]') : null;
    if (!a) return;
    closeMenu();
    var id = a.getAttribute('href').slice(1);
    var el = id && id !== 'top' ? document.getElementById(id) : null;
    if (id && id !== 'top' && !el) return;
    ev.preventDefault();
    var navH = nav.offsetHeight;
    var dest = el ? Math.max(0, el.getBoundingClientRect().top + window.scrollY - navH) : 0;
    var flightEnd = main.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.5;
    var crosses = Math.min(dest, window.scrollY) < flightEnd;
    if (history.replaceState) history.replaceState(null, '', '#' + (id || 'top'));
    function land() {
      window.scrollTo({ top: dest, behavior: 'instant' });
      if (el) {
        el.setAttribute('tabindex', '-1');
        el.focus({ preventScroll: true });
      }
    }
    if (reduce) { land(); return; }
    if (!crosses) { window.scrollTo({ top: dest, behavior: 'smooth' }); if (el) { el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); } return; }
    veil.classList.add('is-on');
    setTimeout(function () {
      land();
      // Give the scenes and clips a couple of frames to settle, then lift the veil.
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        setTimeout(function () { veil.classList.remove('is-on'); }, 120);
      }); });
    }, 200);
  });

  /* ------------------------------------------------------------------
     6. Gentle reveal on scroll (skipped entirely under reduced motion).
     ------------------------------------------------------------------ */
  if (!reduce && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('js-reveal');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    Array.prototype.forEach.call(document.querySelectorAll('.reveal'), function (n) { io.observe(n); });
  }

  /* "Every week" stays pinned beside the agenda, but only when it fits the window. */
  var weekly = document.querySelector('.weekly');
  function fitWeekly() {
    if (!weekly) return;
    weekly.classList.toggle('is-sticky', window.innerWidth > 1080 && weekly.offsetHeight < window.innerHeight - nav.offsetHeight - 48);
  }

  /* Set the registered-trademark sign small and raised (Bodoni draws it at cap height). */
  function smallReg(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), nodes = [], n;
    while ((n = walker.nextNode())) if (n.nodeValue.indexOf('®') !== -1 && !(n.parentNode.classList && n.parentNode.classList.contains('reg'))) nodes.push(n);
    nodes.forEach(function (t) {
      var parts = t.nodeValue.split('®'), frag = document.createDocumentFragment();
      parts.forEach(function (p, i) {
        if (p) frag.appendChild(document.createTextNode(p));
        if (i < parts.length - 1) { var sup = document.createElement('sup'); sup.className = 'reg'; sup.textContent = '®'; frag.appendChild(sup); }
      });
      t.parentNode.replaceChild(frag, t);
    });
  }

  /* ------------------------------------------------------------------
     7. The menu for phones and narrow windows.
     ------------------------------------------------------------------ */
  var menu = document.getElementById('menu'), menuBtn = document.getElementById('menu-btn'), menuTimer = 0;
  function openMenu() {
    if (!menu || !menuBtn || !menu.hidden) return;
    clearTimeout(menuTimer);
    menu.hidden = false;
    document.body.classList.add('menu-open');
    menuBtn.setAttribute('aria-expanded', 'true');
    menuBtn.setAttribute('aria-label', 'Close the menu');
    requestAnimationFrame(function () { menu.classList.add('is-open'); });
    var first = menu.querySelector('a'); if (first) first.focus({ preventScroll: true });
  }
  function closeMenu(refocus) {
    if (!menu || !menuBtn || menu.hidden) return;
    menu.classList.remove('is-open');
    document.body.classList.remove('menu-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.setAttribute('aria-label', 'Menu');
    menuTimer = setTimeout(function () { menu.hidden = true; }, reduce ? 0 : 200);
    if (refocus) menuBtn.focus({ preventScroll: true });
  }
  if (menu && menuBtn) {
    menuBtn.addEventListener('click', function () { if (menu.hidden) openMenu(); else closeMenu(true); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') closeMenu(true); });
    menu.addEventListener('click', function (ev) { if (ev.target.closest && ev.target.closest('a')) closeMenu(); });
    // The window grew past the point where the button shows: don't leave the menu open behind it.
    window.addEventListener('resize', function () { if (!menu.hidden && getComputedStyle(menuBtn).display === 'none') closeMenu(); });
  }

  /* ------------------------------------------------------------------
     8. "What will it cost me?" Reads the three price tables on the page,
        so there is one copy of every price. Tuesday night is priced per
        person. Newbie Night (Thursday): a new couple pays $45 for entry
        and a one-month membership together (from "Every week").
     ------------------------------------------------------------------ */
  var NEWBIE = { dow: 4, who: 'couple', mem: 1, total: 45 };
  function money(t) { if (/free/i.test(t)) return 0; var m = /\$\s*([\d,]+)/.exec(t); return m ? +m[1].replace(/,/g, '') : null; }
  function dollars(n) { return n === 0 ? 'free' : '$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function setupCost() {
    var form = document.getElementById('cost');
    var night = document.getElementById('night-table'), day = document.getElementById('day-table'), mem = document.getElementById('mem-table');
    if (!form || !night || !day || !mem) return;
    var COL = { couple: 0, lady: 1, man: 2 };
    var WHO = { couple: 'a couple', lady: 'a single lady', man: 'a single man' };
    var MEM = ['', 'one-month', 'six-month', 'one-year'];
    function nightPrice(dow, who) {
      var tr = night.querySelector('tr[data-dow="' + dow + '"]'); if (!tr) return null;
      var per = tr.getAttribute('data-per-person');
      if (per) return { amount: +per * (who === 'couple' ? 2 : 1), per: +per };
      var td = tr.querySelectorAll('td')[COL[who]]; var v = td ? money(td.textContent) : null;
      return v == null ? null : { amount: v };
    }
    function dayPrice(dow, who) {
      var rows = day.querySelectorAll('tr[data-dows]');
      for (var i = 0; i < rows.length; i++) {
        if ((' ' + rows[i].getAttribute('data-dows') + ' ').indexOf(' ' + dow + ' ') === -1) continue;
        var td = rows[i].querySelectorAll('td')[COL[who]]; var v = td ? money(td.textContent) : null;
        return v == null ? null : { amount: v };
      }
      return null;
    }
    function memPrice(who, term) {
      var tr = mem.querySelector('tr[data-who="' + who + '"]'); if (!tr) return null;
      var td = tr.querySelectorAll('td')[term - 1]; return td ? money(td.textContent) : null;
    }
    function val(name) { var el = form.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : null; }
    var totalEl = document.getElementById('cost-total'), linesEl = document.getElementById('cost-lines'), noteEl = document.getElementById('cost-note');
    function update() {
      var who = val('who'), dow = +val('dow'), time = val('time'), term = +val('mem');
      var entry = time === 'day' ? dayPrice(dow, who) : nightPrice(dow, who);
      var m = term ? memPrice(who, term) : 0;
      if (!entry || m == null) { form.hidden = true; return; }
      var when = (dow === todayDow ? (time === 'day' ? 'Today' : 'Tonight') : DAY[dow] + (time === 'day' ? ' daytime' : ' night'));
      var entryText = (time === 'day' ? 'Day pass' : 'Night entry') + ' for ' + WHO[who] + ', ' + dollars(entry.amount) + (entry.per && who === 'couple' ? ' ($' + entry.per + ' a person)' : '');
      var total = entry.amount + m, note = [];
      if (time === 'night' && term === NEWBIE.mem && dow === NEWBIE.dow && who === NEWBIE.who && NEWBIE.total < total) {
        total = NEWBIE.total;
        linesEl.textContent = when + ': Newbie Night. $' + NEWBIE.total + ' covers a new couple’s entry and a one-month membership.';
      } else {
        linesEl.textContent = when + ': ' + entryText + (term ? ', plus a ' + MEM[term] + ' membership, ' + dollars(m) + '.' : '.');
      }
      if (time === 'night') note.push('Night prices are for entry before 11pm.');
      note.push(term ? 'Memberships are approved on site: 21 and over, with photo ID.' : 'Every guest needs a current membership.');
      totalEl.textContent = total === 0 ? 'Free' : dollars(total);
      noteEl.textContent = note.join(' ');
    }
    var todayInput = form.querySelector('input[name="dow"][value="' + todayDow + '"]');
    if (todayInput) { todayInput.checked = true; todayInput.parentNode.classList.add('is-today'); }
    form.addEventListener('change', update);
    form.addEventListener('submit', function (ev) { ev.preventDefault(); });
    form.hidden = false;
    update();
  }

  renderAgenda();
  setupCost();
  renderWeekly();
  markTonight();
  fitWeekly();
  window.addEventListener('resize', fitWeekly);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitWeekly);
  Array.prototype.forEach.call(document.querySelectorAll('.sw-copy, .sw-route__label, .agenda__title, .agenda__meta'), smallReg);
})();
