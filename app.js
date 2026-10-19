(() => {
  "use strict";

  const APP = "Onda";
  const AUDIUS = "https://api.audius.co/v1";
  const DEEZER = "https://api.deezer.com";
  const RADIO_HOSTS = ["de1.api.radio-browser.info", "de2.api.radio-browser.info", "fi1.api.radio-browser.info"];
  const PREVIEW_TTL = 8 * 60 * 1000; // links de prévia do Deezer expiram

  const $ = (id) => document.getElementById(id);
  const audio = $("audio");
  const view = $("view");

  // ---------- Utilidades ----------
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const enc = encodeURIComponent;
  const fmt = (s) => { if (!isFinite(s) || s < 0) return "0:00"; s = Math.floor(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[([](feat|ft|with|part)[^)\]]*[)\]]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const shuffleArr = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const clean = (it) => { const o = {}; for (const k in it) if (k[0] !== "_") o[k] = it[k]; return o; };

  const PLACEHOLDER = "data:image/svg+xml," + enc('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#1c1915"/><g fill="none" stroke="#a69c8f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" transform="translate(24 24) scale(2)"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></g></svg>');
  const PLACEHOLDER_RADIO = "data:image/svg+xml," + enc('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#1c1915"/><g fill="none" stroke="#ffb547" stroke-width="4" stroke-linecap="round" transform="translate(24 24) scale(2)"><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19.1 4.9a10 10 0 0 1 0 14.2M4.9 19.1a10 10 0 0 1 0-14.2"/></g></svg>');
  const artOf = (it, big) => (big ? it.artBig || it.art : it.art) || (it.kind === "radio" ? PLACEHOLDER_RADIO : PLACEHOLDER);
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (img.tagName === "IMG" && !img.dataset.fb) { img.dataset.fb = "1"; img.src = img.dataset.kind === "radio" ? PLACEHOLDER_RADIO : PLACEHOLDER; }
  }, true);

  const I = {
    play: '<svg viewBox="0 0 24 24" class="fill"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" class="fill"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/></svg>',
    heartOn: '<svg viewBox="0 0 24 24" class="fill"><path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/></svg>',
    more: '<svg viewBox="0 0 24 24" class="fill"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    repeat: '<svg viewBox="0 0 24 24"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
    queue: '<svg viewBox="0 0 24 24"><path d="M3 6h13M3 12h13M3 18h9M17 15h6M20 12v6"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M3 6h13M3 12h9M3 18h9M16 14l5 3-5 3z"/></svg>',
    user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    disc: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/></svg>',
    out: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
    download: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="m5 12 5 5L20 7"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  };

  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  // ---------- Rede ----------
  async function getJSON(url, ms = 12000) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  // O Deezer não libera CORS, mas aceita JSONP
  let jsonpSeq = 0;
  function jsonp(url, ms = 12000) {
    return new Promise((resolve, reject) => {
      const cb = `__onda${++jsonpSeq}`;
      const s = document.createElement("script");
      const done = () => { clearTimeout(timer); window[cb] = () => {}; s.remove(); };
      const timer = setTimeout(() => { done(); reject(new Error("timeout")); }, ms);
      window[cb] = (data) => { done(); data && data.error ? reject(new Error(data.error.message || "erro")) : resolve(data); };
      s.onerror = () => { done(); reject(new Error("rede")); };
      s.src = `${url}${url.includes("?") ? "&" : "?"}output=jsonp&callback=${cb}`;
      document.head.appendChild(s);
    });
  }
  const dz = (path) => jsonp(DEEZER + path);

  // ---------- Fontes ----------
  const mapDz = (t, album) => {
    const al = t.album || album || {};
    return {
      id: "dz:" + t.id, kind: "track", source: "deezer",
      title: t.title_short || t.title, artist: t.artist?.name || "", artistId: t.artist?.id,
      album: al.title || "", albumId: al.id,
      art: al.cover_medium || t.artist?.picture_medium || "", artBig: al.cover_xl || al.cover_big || al.cover_medium || "",
      src: t.preview, fetchedAt: Date.now(), duration: t.duration, link: t.link,
    };
  };
  const dzOk = (t) => t && t.preview && t.readable !== false;
  const mapArtist = (a) => ({ id: a.id, name: a.name, art: a.picture_medium, artBig: a.picture_xl || a.picture_big, fans: a.nb_fan });

  const auOk = (t) => t && t.is_streamable === true && !t.stream_conditions && !t.is_stream_gated && !t.is_delete && t.is_available !== false;
  const mapAu = (t) => ({
    id: "au:" + t.id, kind: "track", source: "audius",
    title: t.title, artist: t.user?.name || "Artista independente",
    art: t.artwork?.["480x480"] || t.artwork?.["150x150"] || "", artBig: t.artwork?.["1000x1000"] || t.artwork?.["480x480"] || "",
    src: `${AUDIUS}/tracks/${enc(t.id)}/stream?app_name=${APP}`, duration: t.duration,
    link: t.permalink ? `https://audius.co${t.permalink}` : "",
  });

  const api = {
    chart: () => dz("/chart/0/tracks?limit=50").then((j) => (j.data || []).filter(dzOk).map((t) => mapDz(t))),
    chartArtists: () => dz("/chart/0/artists?limit=20").then((j) => (j.data || []).map(mapArtist)),
    search: async (q) => {
      try {
        const j = await dz(`/search?q=${enc(q)}&limit=40`);
        return (j.data || []).filter(dzOk).map((t) => mapDz(t));
      } catch (e) {
        // Plano B: catálogo da Apple
        const j = await getJSON(`https://itunes.apple.com/search?term=${enc(q)}&media=music&entity=song&limit=40&country=BR`);
        return (j.results || []).filter((t) => t.previewUrl).map((t) => ({
          id: "it:" + t.trackId, kind: "track", source: "itunes",
          title: t.trackName, artist: t.artistName, album: t.collectionName,
          art: (t.artworkUrl100 || "").replace("100x100bb", "300x300bb"), artBig: (t.artworkUrl100 || "").replace("100x100bb", "1000x1000bb"),
          src: t.previewUrl, fetchedAt: Date.now() + 1e12, duration: Math.round((t.trackTimeMillis || 0) / 1000), link: t.trackViewUrl,
        }));
      }
    },
    searchArtists: (q) => dz(`/search/artist?q=${enc(q)}&limit=12`).then((j) => (j.data || []).map(mapArtist)),
    artist: (id) => Promise.all([
      dz(`/artist/${id}`),
      dz(`/artist/${id}/top?limit=30`).then((j) => (j.data || []).filter(dzOk).map((t) => mapDz(t))),
      dz(`/artist/${id}/albums?limit=40`).then((j) => j.data || []).catch(() => []),
    ]),
    album: (id) => dz(`/album/${id}`).then((a) => ({ album: a, tracks: (a.tracks?.data || []).filter(dzOk).map((t) => mapDz(t, a)) })),
    track: (rawId) => dz(`/track/${rawId}`),
    auTrending: () => getJSON(`${AUDIUS}/tracks/trending?app_name=${APP}&limit=60`).then((j) => (j.data || []).filter(auOk).map(mapAu)),
    auSearch: (q) => getJSON(`${AUDIUS}/tracks/search?query=${enc(q)}&app_name=${APP}&limit=40`).then((j) => (j.data || []).filter(auOk).map(mapAu)),
  };

  // Procura a versão completa da mesma música publicada pelo próprio artista no Audius
  const fullCache = new Map();
  const VERSION_WORDS = /\b(remix|cover|sped|slowed|reverb|bootleg|type beat|karaoke|instrumental|mashup|nightcore|8d|edit|flip|rework|vip)\b/;
  async function findFull(item) {
    if (item.source === "audius" || item.kind === "radio") return null;
    if (fullCache.has(item.id)) return fullCache.get(item.id);
    let found = null;
    try {
      const j = await getJSON(`${AUDIUS}/tracks/search?query=${enc(item.artist + " " + item.title)}&app_name=${APP}&limit=10`, 4500);
      const nt = norm(item.title), na = norm(item.artist);
      found = (j.data || []).filter(auOk).find((t) => {
        const tt = norm(t.title), un = norm(t.user?.name);
        const titleOk = tt === nt || tt === `${na} ${nt}` || tt === `${nt} ${na}`;
        const artistOk = un && (un === na || un.includes(na) || na.includes(un));
        const durOk = !item.duration || Math.abs((t.duration || 0) - item.duration) <= 8;
        const versionOk = VERSION_WORDS.test(nt) || !VERSION_WORDS.test(tt);
        return titleOk && artistOk && durOk && versionOk;
      }) || null;
    } catch { return null; }
    const r = found ? mapAu(found) : null;
    fullCache.set(item.id, r);
    return r;
  }

  // Rádios
  const canHls = !!audio.canPlayType("application/vnd.apple.mpegurl");
  const mapStation = (s) => ({
    id: "rd:" + s.stationuuid, kind: "radio", source: "radio",
    title: (s.name || "").trim(),
    artist: [s.state?.trim() || s.country, (s.tags || "").split(",").filter(Boolean).slice(0, 2).join(", ")].filter(Boolean).join(" · ") || "Rádio",
    art: s.favicon || "", artBig: s.favicon || "",
    src: s.url_resolved || s.url, hls: s.hls === 1 || /\.m3u8/i.test(s.url_resolved || ""),
    link: s.homepage || "",
  });
  async function radioQuery(params) {
    const qs = new URLSearchParams({ hidebroken: "true", limit: "60", order: "clickcount", reverse: "true", ...params });
    let err;
    for (const h of RADIO_HOSTS) {
      try {
        const data = await getJSON(`https://${h}/json/stations/search?${qs}`, 9000);
        const seen = new Set();
        return data.map(mapStation).filter((s) => s.src && s.src.startsWith("https:") && (!s.hls || canHls) && s.title && !seen.has(s.title.toLowerCase()) && seen.add(s.title.toLowerCase()));
      } catch (e) { err = e; }
    }
    throw err;
  }

  // ---------- Estado salvo ----------
  let favs = store.get("onda:favs", []);
  let recents = store.get("onda:recents", []);
  const settings = Object.assign({ shuffle: false, repeat: "off" }, store.get("onda:settings", {}));
  const saveSettings = () => store.set("onda:settings", settings);
  const isFav = (it) => !!it && favs.some((f) => f.id === it.id);
  function toggleFav(it) {
    if (!it) return;
    if (isFav(it)) { favs = favs.filter((f) => f.id !== it.id); toast("Removida dos favoritos"); }
    else { favs = [clean(it), ...favs]; toast("Salva nos favoritos"); }
    store.set("onda:favs", favs);
    updatePlayerUI();
    if (route.v === "library") render();
    else refreshFavIcons();
  }
  function addRecent(it) {
    recents = [clean(it), ...recents.filter((r) => r.id !== it.id)].slice(0, 40);
    store.set("onda:recents", recents);
  }

  // ---------- Player ----------
  const P = { queue: [], order: [], pos: -1, context: "", token: 0, retried: false, isFull: false, sleepAt: 0, sleepEnd: false };
  const current = () => (P.pos >= 0 ? P.queue[P.order[P.pos]] : null);

  function setQueue(items, start, context) {
    P.queue = items.slice();
    P.context = context || "";
    const idx = items.map((_, i) => i);
    if (settings.shuffle) { const rest = shuffleArr(idx.filter((i) => i !== start)); P.order = [start, ...rest]; }
    else P.order = idx;
    playPos(settings.shuffle ? 0 : start);
  }

  async function resolveItem(it) {
    if (it.kind === "radio" || it.source === "audius") return { src: it.src, full: it.source === "audius" };
    const full = await findFull(it);
    if (full) return { src: full.src, full: true, at: Date.now() };
    if (it.source === "deezer" && Date.now() - (it.fetchedAt || 0) > PREVIEW_TTL) {
      try {
        const t = await api.track(it.id.slice(3));
        if (t.preview) { it.src = t.preview; it.fetchedAt = Date.now(); }
      } catch {}
    }
    return { src: it.src, full: false, at: Date.now() };
  }

  // Áudio mudo de 1s: destrava o player no toque enquanto o link real carrega
  const SILENT = (() => {
    const n = 8000, b = new ArrayBuffer(44 + n), v = new DataView(b);
    const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true);
    v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, "data"); v.setUint32(40, n, true);
    for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
    return URL.createObjectURL(new Blob([b], { type: "audio/wav" }));
  })();

  function setSource(src, full) {
    P.isFull = full;
    P.silent = src === SILENT;
    audio.loop = P.silent;
    audio.src = src;
    const p = audio.play();
    if (p) p.catch((e) => { if (e.name === "NotAllowedError") updatePlayIcons(); });
    updatePlayerUI();
  }

  function playPos(pos) {
    if (pos < 0 || pos >= P.order.length) return;
    P.pos = pos;
    P.retried = false;
    const it = current();
    const token = ++P.token;
    const pre = it._res && Date.now() - it._res.at < PREVIEW_TTL ? it._res : null;
    // Toca na hora (o iPhone exige que o play aconteça no toque) e troca pela versão completa se ela existir
    if (pre) setSource(pre.src, pre.full);
    else {
      const stale = it.source === "deezer" && Date.now() - (it.fetchedAt || 0) > PREVIEW_TTL;
      setSource(stale ? SILENT : it.src, it.kind === "radio" || it.source === "audius");
      if (it.kind === "track" && it.source !== "audius") {
        resolveItem(it).then((r) => {
          if (token !== P.token) return;
          it._res = r;
          if (P.silent || (r.full && audio.currentTime < 12)) setSource(r.src, r.full);
        });
      }
    }
    addRecent(it);
    setMediaSession(it);
    updatePlayerUI();
    highlightPlaying();
    prefetchNext();
  }

  function prefetchNext() {
    const n = P.order[P.pos + 1];
    if (n === undefined) return;
    const it = P.queue[n];
    if (it && it.kind === "track" && it.source !== "audius" && !it._res) resolveItem(it).then((r) => { it._res = r; });
  }

  function next(auto) {
    if (!P.order.length) return;
    if (auto && settings.repeat === "one") { audio.currentTime = 0; audio.play().catch(() => {}); return; }
    if (auto && P.sleepEnd) { stopSleep(); audio.pause(); toast("Timer: música pausada"); return; }
    if (P.pos + 1 < P.order.length) playPos(P.pos + 1);
    else if (settings.repeat === "all") {
      if (settings.shuffle) P.order = shuffleArr(P.order.slice());
      playPos(0);
    } else if (!auto) toast("Fim da fila");
  }
  function prev() {
    if (audio.currentTime > 4 && current()?.kind === "track") { audio.currentTime = 0; return; }
    if (P.pos > 0) playPos(P.pos - 1);
    else audio.currentTime = 0;
  }
  function togglePlay() {
    if (!current()) return;
    if (audio.paused) audio.play().catch(() => toast("Não deu para tocar. Tente de novo."));
    else audio.pause();
  }
  function addToQueue(it, playNext) {
    if (!current()) { setQueue([it], 0, "Fila"); return; }
    P.queue.push(it);
    const idx = P.queue.length - 1;
    if (playNext) P.order.splice(P.pos + 1, 0, idx); else P.order.push(idx);
    toast(playNext ? "Vai tocar em seguida" : "Adicionada à fila");
    prefetchNext();
  }

  audio.addEventListener("ended", () => { if (!P.silent) next(true); });
  audio.addEventListener("play", updatePlayIcons);
  audio.addEventListener("pause", updatePlayIcons);
  audio.addEventListener("playing", updatePlayIcons);
  audio.addEventListener("error", () => {
    const it = current();
    if (!it || !audio.getAttribute("src") || P.silent) return;
    const token = P.token;
    if (!P.retried && it.source === "deezer") {
      P.retried = true;
      it.fetchedAt = 0; it._res = null;
      resolveItem(it).then((r) => { if (token === P.token) { it._res = r; setSource(r.src, r.full); } });
      return;
    }
    toast(it.kind === "radio" ? "Essa rádio está fora do ar. Tente outra." : `“${it.title}” não abriu. Pulando…`);
    if (it.kind !== "radio") setTimeout(() => { if (token === P.token) next(false); }, 900);
  });

  // Barra de progresso
  const seek = $("full-seek");
  let dragging = false;
  audio.addEventListener("loadedmetadata", () => { seek.max = isFinite(audio.duration) ? audio.duration : 0; $("full-dur").textContent = fmt(audio.duration); });
  audio.addEventListener("timeupdate", () => {
    const d = audio.duration, t = audio.currentTime;
    const live = !isFinite(d);
    $("mini-bar").style.width = live ? "100%" : `${d ? (t / d) * 100 : 0}%`;
    if (!dragging && !$("full").hidden) { seek.value = t; $("full-cur").textContent = fmt(t); }
    if (!live && d && "mediaSession" in navigator && navigator.mediaSession.setPositionState) {
      try { navigator.mediaSession.setPositionState({ duration: d, position: Math.min(t, d), playbackRate: audio.playbackRate || 1 }); } catch {}
    }
    if (P.sleepAt && Date.now() >= P.sleepAt) { stopSleep(); audio.pause(); toast("Timer: música pausada"); }
    if (P.sleepAt) updateTimerLabel();
  });
  seek.addEventListener("input", () => { dragging = true; $("full-cur").textContent = fmt(+seek.value); });
  seek.addEventListener("change", () => { audio.currentTime = +seek.value; dragging = false; });

  // Tela de bloqueio / fone bluetooth
  function setMediaSession(it) {
    if (!("mediaSession" in navigator)) return;
    const art = it.artBig || it.art;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: it.title, artist: it.artist, album: it.kind === "radio" ? "Rádio ao vivo" : it.album || APP,
      artwork: art ? [{ src: art, sizes: "512x512" }] : [{ src: "icons/icon-512.png", sizes: "512x512", type: "image/png" }],
    });
  }
  if ("mediaSession" in navigator) {
    const set = (a, h) => { try { navigator.mediaSession.setActionHandler(a, h); } catch {} };
    set("play", () => audio.play());
    set("pause", () => audio.pause());
    set("nexttrack", () => next(false));
    set("previoustrack", prev);
    set("seekto", (d) => { if (isFinite(audio.duration)) audio.currentTime = d.seekTime; });
    set("seekbackward", (d) => { audio.currentTime = Math.max(0, audio.currentTime - (d.seekOffset || 10)); });
    set("seekforward", (d) => { audio.currentTime += d.seekOffset || 10; });
  }

  // Timer para dormir
  function startSleep(min) {
    P.sleepEnd = min === "end";
    P.sleepAt = min === "end" ? 0 : Date.now() + min * 60000;
    updateTimerLabel();
    toast(min === "end" ? "Pausa no fim desta música" : `Pausa em ${min} minutos`);
  }
  function stopSleep() { P.sleepAt = 0; P.sleepEnd = false; updateTimerLabel(); }
  function updateTimerLabel() {
    const l = $("timer-label");
    if (P.sleepEnd) l.textContent = "Fim da música";
    else if (P.sleepAt) l.textContent = fmt((P.sleepAt - Date.now()) / 1000);
    else l.textContent = "Timer";
    $("btn-timer").setAttribute("aria-pressed", String(!!(P.sleepAt || P.sleepEnd)));
  }
  setInterval(() => { if (P.sleepAt) { updateTimerLabel(); if (Date.now() >= P.sleepAt) { stopSleep(); audio.pause(); } } }, 1000);

  // ---------- UI do player ----------
  function updatePlayIcons() {
    const playing = !audio.paused;
    $("mini-play").innerHTML = playing ? I.pause : I.play;
    $("btn-play").innerHTML = playing ? I.pause : I.play;
    $("mini-play").setAttribute("aria-label", playing ? "Pausar" : "Tocar");
    $("btn-play").setAttribute("aria-label", playing ? "Pausar" : "Tocar");
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }

  function badgesFor(it, full) {
    if (!it) return "";
    if (it.kind === "radio") return '<span class="tag live">Ao vivo</span>';
    return full ? '<span class="tag complete">Completa</span>' : '<span class="tag">Prévia 30s</span>';
  }

  function updatePlayerUI() {
    const it = current();
    $("mini").hidden = !it;
    if (!it) return;
    $("mini-art").src = artOf(it); $("mini-art").dataset.kind = it.kind; delete $("mini-art").dataset.fb;
    $("mini-title").textContent = it.title;
    $("mini-sub").textContent = it.artist;
    const fav = isFav(it);
    $("mini-fav").innerHTML = fav ? I.heartOn : I.heart;
    $("mini-fav").classList.toggle("on", fav);
    $("mini-fav").setAttribute("aria-label", fav ? "Tirar dos favoritos" : "Favoritar");
    $("full-fav").innerHTML = fav ? I.heartOn : I.heart;
    $("full-fav").classList.toggle("on", fav);
    $("full-fav").setAttribute("aria-label", fav ? "Tirar dos favoritos" : "Favoritar");
    $("full-art").src = artOf(it, true); $("full-art").dataset.kind = it.kind; delete $("full-art").dataset.fb;
    $("full-title").textContent = it.title;
    $("full-artist").textContent = it.artist;
    $("full-artist").disabled = !it.artistId;
    $("full-context").textContent = P.context || "Tocando agora";
    $("full-badges").innerHTML = badgesFor(it, P.isFull);
    const live = it.kind === "radio";
    $("full-seek-wrap").hidden = live;
    $("btn-outside").hidden = live || P.isFull;
    $("btn-shuffle").classList.toggle("on", settings.shuffle);
    $("btn-shuffle").setAttribute("aria-pressed", String(settings.shuffle));
    $("btn-repeat").innerHTML = I.repeat;
    $("btn-repeat").classList.toggle("on", settings.repeat !== "off");
    $("btn-repeat").classList.toggle("repeat-one", settings.repeat === "one");
    $("btn-repeat").setAttribute("aria-label", { off: "Repetir: desligado", all: "Repetir: fila", one: "Repetir: esta música" }[settings.repeat]);
    tint(it);
    updatePlayIcons();
  }

  // Cor de fundo do player tirada da capa (quando a imagem permite)
  const tintCache = new Map();
  function tint(it) {
    const bg = $("full-bg");
    const key = it.artBig || it.art;
    const fallback = () => { let h = 0; for (const c of it.title) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 45% 28%)`; };
    if (!key) { bg.style.setProperty("--tint", fallback()); return; }
    if (tintCache.has(key)) { bg.style.setProperty("--tint", tintCache.get(key)); return; }
    bg.style.setProperty("--tint", fallback());
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas"); c.width = c.height = 12;
        const x = c.getContext("2d"); x.drawImage(img, 0, 0, 12, 12);
        const d = x.getImageData(0, 0, 12, 12).data; let r = 0, g = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
        const n = d.length / 4, k = 0.75;
        const col = `rgb(${Math.round(r / n * k)} ${Math.round(g / n * k)} ${Math.round(b / n * k)})`;
        tintCache.set(key, col);
        if ((current()?.artBig || current()?.art) === key) bg.style.setProperty("--tint", col);
      } catch {}
    };
    img.src = key;
  }

  function highlightPlaying() {
    const id = current()?.id;
    view.querySelectorAll(".trow").forEach((r) => r.classList.toggle("playing", r.dataset.id === id));
  }

  // ---------- Overlays com botão voltar do celular ----------
  let overlays = [];
  function applyOverlays() {
    $("full").hidden = !overlays.includes("full");
    const sheetOpen = overlays.includes("sheet");
    $("sheet").hidden = !sheetOpen;
    $("sheet-backdrop").hidden = !sheetOpen;
    document.body.style.overflow = overlays.length ? "hidden" : "";
    if (!$("full").hidden) { seek.value = audio.currentTime; $("full-cur").textContent = fmt(audio.currentTime); $("full-dur").textContent = fmt(audio.duration); }
  }
  function openOverlay(name) {
    overlays = [...overlays.filter((o) => o !== name), name];
    history.pushState({ route, overlays }, "");
    applyOverlays();
  }
  function closeOverlay(name) {
    if (overlays[overlays.length - 1] === name && history.state?.overlays?.includes(name)) history.back();
    else { overlays = overlays.filter((o) => o !== name); applyOverlays(); }
  }
  function openSheet(title, html, onClick) {
    $("sheet-title").textContent = title;
    $("sheet-body").innerHTML = html;
    sheetHandler = onClick || null;
    if (overlays.includes("sheet")) return;
    openOverlay("sheet");
  }
  let sheetHandler = null;
  $("sheet-body").addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b || !sheetHandler) return;
    const keep = sheetHandler(b.dataset.act, b);
    if (!keep) closeOverlay("sheet");
  });
  $("sheet-backdrop").addEventListener("click", () => closeOverlay("sheet"));

  function itemMenu(it) {
    const fav = isFav(it);
    const rows = [
      ["next", I.next, "Tocar em seguida"],
      ["queue", I.queue, "Adicionar à fila"],
      ["fav", fav ? I.heartOn : I.heart, fav ? "Tirar dos favoritos" : "Favoritar"],
    ];
    if (it.artistId) rows.push(["artist", I.user, "Ver artista"]);
    if (it.albumId) rows.push(["album", I.disc, "Ver álbum"]);
    if (it.kind === "track" && it.source !== "audius") rows.push(["outside", I.out, "Ouvir completa em outro app"]);
    openSheet(it.title, `<div class="sheet-list">${rows.map(([a, ic, l]) => `<button class="sheet-item" data-act="${a}">${ic}<span>${l}</span></button>`).join("")}</div>`, (act) => {
      if (act === "next") addToQueue(it, true);
      if (act === "queue") addToQueue(it, false);
      if (act === "fav") toggleFav(it);
      if (act === "artist") { closeAll(); go({ v: "artist", id: it.artistId }); return true; }
      if (act === "album") { closeAll(); go({ v: "album", id: it.albumId }); return true; }
      if (act === "outside") { outsideSheet(it); return true; }
    });
  }

  function outsideSheet(it) {
    const q = enc(`${it.artist} ${it.title}`);
    const links = [
      ["YouTube Music", `https://music.youtube.com/search?q=${q}`],
      ["Spotify", `https://open.spotify.com/search/${q}`],
      ["YouTube", `https://www.youtube.com/results?search_query=${q}`],
    ];
    if (it.link) links.push([it.source === "itunes" ? "Apple Music" : "Deezer", it.link]);
    openSheet("Ouvir completa", `<p>Esta música só tem prévia de 30 segundos liberada de graça. A versão completa está nestes apps, que têm anúncio ou cobram assinatura.</p>
      <div class="sheet-list">${links.map(([n, u]) => `<a class="sheet-item" href="${esc(u)}" target="_blank" rel="noopener">${I.out}<span>${esc(n)}</span></a>`).join("")}</div>`);
  }

  function closeAll() {
    if (!overlays.length) return;
    overlays = [];
    history.replaceState({ route, overlays }, "");
    applyOverlays();
  }

  // Controles do player
  $("mini-open").addEventListener("click", () => openOverlay("full"));
  $("mini-play").addEventListener("click", togglePlay);
  $("mini-fav").addEventListener("click", () => toggleFav(current()));
  $("full-close").addEventListener("click", () => closeOverlay("full"));
  $("full-fav").addEventListener("click", () => toggleFav(current()));
  $("btn-play").addEventListener("click", togglePlay);
  $("btn-next").addEventListener("click", () => next(false));
  $("btn-prev").addEventListener("click", prev);
  $("full-artist").addEventListener("click", () => { const it = current(); if (it?.artistId) { closeAll(); go({ v: "artist", id: it.artistId }); } });
  $("btn-shuffle").addEventListener("click", () => {
    settings.shuffle = !settings.shuffle; saveSettings();
    if (P.order.length) {
      const cur = P.order[P.pos];
      const rest = settings.shuffle ? shuffleArr(P.order.slice(P.pos + 1)) : P.order.slice(P.pos + 1).sort((a, b) => a - b);
      P.order = [...P.order.slice(0, P.pos), cur, ...rest];
    }
    toast(settings.shuffle ? "Aleatório ligado" : "Aleatório desligado");
    updatePlayerUI(); prefetchNext();
  });
  $("btn-repeat").addEventListener("click", () => {
    settings.repeat = { off: "all", all: "one", one: "off" }[settings.repeat]; saveSettings();
    toast({ off: "Repetir desligado", all: "Repetindo a fila", one: "Repetindo esta música" }[settings.repeat]);
    updatePlayerUI();
  });
  $("btn-outside").addEventListener("click", () => { const it = current(); if (it) outsideSheet(it); });
  $("btn-timer").addEventListener("click", () => {
    const on = P.sleepAt || P.sleepEnd;
    const opts = [[15, "15 minutos"], [30, "30 minutos"], [45, "45 minutos"], [60, "1 hora"], ["end", "No fim desta música"]];
    openSheet("Pausar a música em", `<div class="sheet-list">${opts.map(([v, l]) => `<button class="sheet-item" data-act="${v}">${I.clock}<span>${l}</span></button>`).join("")}${on ? `<button class="sheet-item" data-act="off">${I.x}<span>Desligar timer</span></button>` : ""}</div>`, (act) => {
      if (act === "off") { stopSleep(); toast("Timer desligado"); }
      else startSleep(act === "end" ? "end" : +act);
    });
  });
  $("full-queue").addEventListener("click", () => {
    const upcoming = P.order.slice(P.pos + 1, P.pos + 61).map((i, k) => ({ it: P.queue[i], pos: P.pos + 1 + k }));
    const cur = current();
    openSheet("Fila", `${cur ? `<p>Tocando: <strong>${esc(cur.title)}</strong> · ${esc(cur.artist)}</p>` : ""}
      ${upcoming.length ? `<div class="sheet-list">${upcoming.map(({ it, pos }) => `<button class="sheet-item" data-act="${pos}"><img src="${esc(artOf(it))}" data-kind="${it.kind}" alt="" style="width:40px;height:40px;border-radius:6px;object-fit:cover"><span style="min-width:0"><span style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(it.title)}</span><span class="muted" style="display:block;font-size:.8125rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(it.artist)}</span></span></button>`).join("")}</div>` : '<p>Nada depois desta. Adicione músicas pelo menu ⋯ de qualquer faixa.</p>'}`,
      (act) => { playPos(+act); });
  });

  // ---------- Instalar como app ----------
  let installEvt = null;
  const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; });
  window.addEventListener("appinstalled", () => { installEvt = null; toast("Onda instalado"); if (route.v === "home") render(); });
  async function install() {
    if (installEvt) { installEvt.prompt(); try { await installEvt.userChoice; } catch {} installEvt = null; return; }
    if (isIOS) {
      openSheet("Instalar no iPhone", `<ol class="steps">
        <li>Abra este site no <strong>Safari</strong>.</li>
        <li>Toque em <strong>Compartilhar</strong> (o quadrado com a seta para cima).</li>
        <li>Escolha <strong>Adicionar à Tela de Início</strong> e confirme.</li></ol>`);
    } else {
      openSheet("Instalar no celular", `<ol class="steps">
        <li>Abra este site no <strong>Chrome</strong>.</li>
        <li>Toque no menu <strong>⋮</strong> no canto de cima.</li>
        <li>Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</li></ol>`);
    }
  }
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));

  // ---------- Renderização ----------
  let lists = {};
  let listSeq = 0;
  let renderToken = 0;
  const reg = (items) => { const k = "l" + ++listSeq; lists[k] = items; return k; };

  const skRows = (n = 6) => `<ul class="tracks">${Array.from({ length: n }, () => '<li class="trow"><div class="trow-main"><div class="sk" style="width:52px;height:52px"></div><div style="display:grid;gap:6px"><div class="sk" style="height:14px;width:60%"></div><div class="sk" style="height:12px;width:40%"></div></div></div></li>').join("")}</ul>`;
  const skShelf = (n = 5, round) => `<div class="shelf">${Array.from({ length: n }, () => `<div class="card"><div class="sk" style="width:148px;height:148px;${round ? "border-radius:999px" : ""}"></div><div class="sk" style="height:14px;width:80%"></div></div>`).join("")}</div>`;

  function rowsHTML(items, context, opts = {}) {
    if (!items.length) return `<p class="empty">${opts.empty || "Nada encontrado."}</p>`;
    const k = reg(items);
    const id = current()?.id;
    return `<ul class="tracks">${items.map((it, i) => `
      <li class="trow${it.kind === "radio" ? " round" : ""}${it.id === id ? " playing" : ""}" data-id="${esc(it.id)}">
        <button class="trow-main" data-play="${k}" data-i="${i}" data-ctx="${esc(context)}" aria-label="Tocar ${esc(it.title)}"${opts.numbered ? ' style="grid-template-columns:24px 52px minmax(0,1fr)"' : ""}>
          ${opts.numbered ? `<span class="num">${i + 1}</span>` : ""}
          <img class="art" src="${esc(artOf(it))}" data-kind="${it.kind}" alt="" loading="lazy" referrerpolicy="no-referrer">
          <span style="min-width:0"><span class="t" style="display:block">${esc(it.title)}</span>
          <span class="s">${it.kind === "radio" ? '<span class="tag live">Ao vivo</span>' : it.source === "audius" ? '<span class="tag complete">Completa</span>' : ""}<span style="overflow:hidden;text-overflow:ellipsis">${esc(it.artist)}</span></span></span>
        </button>
        <button class="icon-btn" data-menu="${k}" data-i="${i}" aria-label="Mais opções para ${esc(it.title)}">${I.more}</button>
      </li>`).join("")}</ul>`;
  }

  function shelfHTML(items, context) {
    if (!items.length) return '<p class="empty">Nada por aqui ainda.</p>';
    const k = reg(items);
    return `<div class="shelf">${items.map((it, i) => `
      <button class="card${it.kind === "radio" ? " round" : ""}" data-play="${k}" data-i="${i}" data-ctx="${esc(context)}">
        <img class="art" src="${esc(artOf(it, true))}" data-kind="${it.kind}" alt="" loading="lazy" referrerpolicy="no-referrer">
        <span class="t">${esc(it.title)}</span><span class="s">${esc(it.artist)}</span>
      </button>`).join("")}</div>`;
  }

  function artistShelfHTML(artists) {
    if (!artists.length) return "";
    return `<div class="shelf">${artists.map((a) => `
      <button class="card round" data-artist="${a.id}">
        <img class="art" src="${esc(a.artBig || a.art || PLACEHOLDER)}" alt="" loading="lazy" referrerpolicy="no-referrer">
        <span class="t">${esc(a.name)}</span><span class="s">Artista</span>
      </button>`).join("")}</div>`;
  }

  function albumShelfHTML(albums) {
    if (!albums.length) return "";
    return `<div class="shelf">${albums.map((a) => `
      <button class="card" data-album="${a.id}">
        <img class="art" src="${esc(a.cover_medium || PLACEHOLDER)}" alt="" loading="lazy" referrerpolicy="no-referrer">
        <span class="t">${esc(a.title)}</span><span class="s">${esc((a.release_date || "").slice(0, 4))}${a.record_type ? " · " + esc({ album: "Álbum", single: "Single", ep: "EP", compile: "Coletânea" }[a.record_type] || a.record_type) : ""}</span>
      </button>`).join("")}</div>`;
  }

  async function fill(id, token, fn) {
    try {
      const html = await fn();
      if (token !== renderToken) return;
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    } catch (e) {
      if (token !== renderToken) return;
      const el = document.getElementById(id);
      if (el) el.innerHTML = `<p class="error">Não carregou. Confira a internet e <button class="link-btn" style="display:inline;color:inherit;text-decoration:underline" data-retry>tente de novo</button>.</p>`;
    }
  }

  function greeting() {
    const h = new Date().getHours();
    return h < 5 ? "Boa madrugada" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  }

  const GENRES = [
    ["Sertanejo", "#8a4b1d"], ["Funk", "#7a1f5c"], ["Pop", "#1f4f8a"], ["Rap e trap", "#2d2d2d"],
    ["Pagode", "#1d6b4a"], ["Gospel", "#5a3d8a"], ["Eletrônica", "#0f5f6b"], ["MPB", "#8a6a1d"],
    ["Forró", "#8a2d1d"], ["Rock", "#5c1f1f"], ["Lo-fi", "#3d4a5c"], ["Piseiro", "#6b3d1d"],
  ];
  const RADIO_TAGS = [["Mais ouvidas", ""], ["Sertanejo", "sertanejo"], ["Pop", "pop"], ["Gospel", "gospel"], ["Funk", "funk"], ["Rock", "rock"], ["Notícias", "news"], ["Esportes", "sports"], ["Jazz", "jazz"], ["Lo-fi", "lofi"], ["Clássica", "classical"]];

  let route = { v: "home" };
  const searchState = { q: "", filter: "all" };
  const radioState = { tag: "", q: "" };
  const libState = { tab: "favs" };

  function render() {
    const token = ++renderToken;
    lists = {};
    document.querySelectorAll(".tabbar button").forEach((b) => {
      const root = { home: "home", search: "search", radio: "radio", library: "library", chart: "home", artist: route.from || "search", album: route.from || "search" }[route.v];
      b.toggleAttribute("aria-current", b.dataset.nav === root);
      if (b.dataset.nav === root) b.setAttribute("aria-current", "page");
    });
    ({ home: renderHome, search: renderSearch, radio: renderRadio, library: renderLibrary, chart: renderChart, artist: renderArtist, album: renderAlbum }[route.v] || renderHome)(token);
  }

  function renderHome(token) {
    const showInstall = !isStandalone();
    view.innerHTML = `
      <div class="page-head">
        <h1>${greeting()}</h1>
        ${showInstall ? `<button class="install-btn" data-install>${I.download}<span>Instalar app</span></button>` : ""}
      </div>
      ${recents.length ? `<section class="block"><div class="block-head"><h2>Tocadas recentemente</h2></div>${shelfHTML(recents.slice(0, 12), "Recentes")}</section>` : ""}
      <section class="block"><div class="block-head"><h2>Top do momento</h2><span class="note">prévias de 30s</span></div><div id="h-chart">${skRows(5)}</div><button class="chip see-all" data-go="chart">Ver o top 50</button></section>
      <section class="block"><div class="block-head"><h2>Artistas em alta</h2></div><div id="h-artists">${skShelf(5, true)}</div></section>
      <section class="block"><div class="block-head"><h2>Completas e grátis</h2><span class="note">artistas independentes</span></div><div id="h-full">${skShelf()}</div></section>
      <section class="block"><div class="block-head"><h2>Rádios mais ouvidas</h2><span class="note">ao vivo</span></div><div id="h-radio">${skShelf(5, true)}</div></section>
      <div class="notice">${I.info}<span><strong>Como funciona:</strong> as músicas famosas tocam uma prévia de 30 segundos, que é o que as gravadoras liberam de graça. Quando o próprio artista publicou a música completa e grátis, o Onda toca ela inteira e marca como <strong>Completa</strong>. As rádios tocam ao vivo, sem limite.</span></div>`;
    fill("h-chart", token, async () => rowsHTML((await api.chart()).slice(0, 6), "Top do momento", { numbered: true }));
    fill("h-artists", token, async () => artistShelfHTML(await api.chartArtists()));
    fill("h-full", token, async () => shelfHTML((await api.auTrending()).slice(0, 20), "Completas e grátis"));
    fill("h-radio", token, async () => shelfHTML((await radioQuery({ countrycode: "BR", limit: "40" })).slice(0, 16), "Rádios do Brasil"));
  }

  function renderSearch(token) {
    view.innerHTML = `
      <div class="searchbar">
        <form class="search-field" id="search-form" role="search">
          ${I.search}
          <label for="q" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Buscar música, artista ou rádio</label>
          <input id="q" type="search" autocomplete="off" enterkeyhint="search" placeholder="O que você quer ouvir?" value="${esc(searchState.q)}">
          <button type="button" class="icon-btn clear-btn" id="q-clear" aria-label="Limpar busca" ${searchState.q ? "" : "hidden"}>${I.x}</button>
        </form>
        <div class="chips filters" id="filters" ${searchState.q ? "" : "hidden"}>
          ${[["all", "Tudo"], ["songs", "Músicas"], ["artists", "Artistas"], ["full", "Completas"], ["radio", "Rádios"]].map(([v, l]) => `<button class="chip" data-filter="${v}" aria-pressed="${searchState.filter === v}">${l}</button>`).join("")}
        </div>
      </div>
      <div id="s-results" style="display:flex;flex-direction:column;gap:28px"></div>`;
    const input = $("q");
    let deb;
    input.addEventListener("input", () => {
      clearTimeout(deb);
      $("q-clear").hidden = !input.value;
      deb = setTimeout(() => { searchState.q = input.value.trim(); $("filters").hidden = !searchState.q; runSearch(); }, 380);
    });
    $("search-form").addEventListener("submit", (e) => { e.preventDefault(); clearTimeout(deb); searchState.q = input.value.trim(); $("filters").hidden = !searchState.q; input.blur(); runSearch(); });
    $("q-clear").addEventListener("click", () => { input.value = ""; searchState.q = ""; $("q-clear").hidden = true; $("filters").hidden = true; runSearch(); input.focus(); });
    runSearch();
    if (!searchState.q) setTimeout(() => { if (token === renderToken && matchMedia("(hover: hover)").matches) input.focus(); }, 50);
  }

  function runSearch() {
    const token = ++renderToken;
    lists = {};
    const box = $("s-results");
    const q = searchState.q;
    if (!q) {
      box.innerHTML = `<section class="block"><div class="block-head"><h2>Navegar por gênero</h2></div>
        <div class="genres">${GENRES.map(([g, c]) => `<button class="genre" style="--g:${c}" data-genre="${esc(g)}">${esc(g)}</button>`).join("")}</div></section>`;
      return;
    }
    const f = searchState.filter;
    const parts = [];
    if (f === "all" || f === "artists") parts.push(["s-art", "Artistas", skShelf(4, true)]);
    if (f === "all" || f === "songs") parts.push(["s-songs", "Músicas", skRows(6)]);
    if (f === "all" || f === "full") parts.push(["s-full", "Completas e grátis", skRows(3)]);
    if (f === "all" || f === "radio") parts.push(["s-radio", "Rádios", skRows(3)]);
    box.innerHTML = parts.map(([id, t, sk]) => `<section class="block" id="${id}-b"><div class="block-head"><h2>${t}</h2></div><div id="${id}">${sk}</div></section>`).join("");
    const lim = f === "all" ? { songs: 12, full: 6, radio: 5, art: 10 } : { songs: 40, full: 40, radio: 40, art: 12 };
    const hideIfEmpty = (id, html, n) => { if (!n && f === "all") { const b = $(id + "-b"); if (b) b.hidden = true; } return html; };
    if ($("s-art")) fill("s-art", token, async () => { const a = (await api.searchArtists(q)).slice(0, lim.art); return hideIfEmpty("s-art", artistShelfHTML(a) || '<p class="empty">Nenhum artista com esse nome.</p>', a.length); });
    if ($("s-songs")) fill("s-songs", token, async () => { const s = (await api.search(q)).slice(0, lim.songs); return rowsHTML(s, `Busca: ${q}`, { empty: "Nenhuma música encontrada. Confira se o nome está certo." }); });
    if ($("s-full")) fill("s-full", token, async () => { const s = (await api.auSearch(q)).slice(0, lim.full); return hideIfEmpty("s-full", rowsHTML(s, `Completas: ${q}`, { empty: "Nenhuma versão completa grátis para essa busca." }), s.length); });
    if ($("s-radio")) fill("s-radio", token, async () => {
      const [a, b] = await Promise.all([radioQuery({ name: q, limit: "30" }), radioQuery({ tag: q.toLowerCase(), limit: "20" }).catch(() => [])]);
      const seen = new Set(); const s = [...a, ...b].filter((x) => !seen.has(x.id) && seen.add(x.id)).slice(0, lim.radio);
      return hideIfEmpty("s-radio", rowsHTML(s, `Rádios: ${q}`, { empty: "Nenhuma rádio encontrada." }), s.length);
    });
  }

  function renderRadio(token) {
    view.innerHTML = `
      <div class="page-head"><h1>Rádios</h1></div>
      <form class="search-field" id="r-form" role="search">
        ${I.search}
        <label for="rq" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Buscar rádio</label>
        <input id="rq" type="search" autocomplete="off" enterkeyhint="search" placeholder="Nome da rádio ou cidade" value="${esc(radioState.q)}">
      </form>
      <div class="chips">${RADIO_TAGS.map(([l, t]) => `<button class="chip" data-rtag="${t}" aria-pressed="${!radioState.q && radioState.tag === t}">${l}</button>`).join("")}</div>
      <div id="r-list">${skRows(8)}</div>`;
    $("r-form").addEventListener("submit", (e) => { e.preventDefault(); radioState.q = $("rq").value.trim(); $("rq").blur(); render(); });
    const params = radioState.q ? { name: radioState.q } : radioState.tag ? { tag: radioState.tag } : { countrycode: "BR" };
    if (radioState.tag && !radioState.q && ["sertanejo", "funk", "gospel", "pop", "rock", "news", "sports"].includes(radioState.tag)) params.countrycode = "BR";
    const label = radioState.q ? `Rádios: ${radioState.q}` : "Rádios";
    fill("r-list", token, async () => rowsHTML(await radioQuery(params), label, { empty: "Nenhuma rádio encontrada. Tente outro nome." }));
  }

  function renderLibrary() {
    const items = libState.tab === "favs" ? favs : recents;
    view.innerHTML = `
      <div class="page-head"><h1>Sua biblioteca</h1>${!isStandalone() ? `<button class="install-btn" data-install>${I.download}<span>Instalar</span></button>` : ""}</div>
      <div class="chips">
        <button class="chip" data-lib="favs" aria-pressed="${libState.tab === "favs"}">Favoritos · ${favs.length}</button>
        <button class="chip" data-lib="recents" aria-pressed="${libState.tab === "recents"}">Recentes</button>
      </div>
      ${items.length ? `<div class="hero-actions">
        <button class="play-pill" data-playall>${I.play}<span>Tocar tudo</span></button>
        <button class="ghost-pill" data-shuffleall>${I.shuffle}<span>Aleatório</span></button>
        ${libState.tab === "recents" ? `<button class="icon-btn" data-clear-recents aria-label="Limpar recentes">${I.trash}</button>` : ""}
      </div>` : ""}
      <div id="lib-list">${rowsHTML(items, libState.tab === "favs" ? "Favoritos" : "Recentes", { empty: libState.tab === "favs" ? "Toque no coração de qualquer música ou rádio para guardar aqui." : "O que você ouvir aparece aqui." })}</div>
      <p class="muted" style="font-size:.8125rem;margin:0">Seus favoritos ficam salvos neste celular, neste navegador.</p>`;
  }

  function renderChart(token) {
    view.innerHTML = `<button class="back-btn" data-back>${I.back}<span>Voltar</span></button>
      <div class="page-head"><h1>Top 50 do momento</h1></div>
      <div id="c-list">${skRows(10)}</div>`;
    fill("c-list", token, async () => {
      const items = await api.chart();
      const k = reg(items);
      return `<div class="hero-actions" style="margin-bottom:16px"><button class="play-pill" data-play="${k}" data-i="0" data-ctx="Top 50">${I.play}<span>Tocar</span></button><button class="ghost-pill" data-shuffle-list="${k}" data-ctx="Top 50">${I.shuffle}<span>Aleatório</span></button></div>${rowsHTML(items, "Top 50", { numbered: true })}`;
    });
  }

  function renderArtist(token) {
    view.innerHTML = `<button class="back-btn" data-back>${I.back}<span>Voltar</span></button><div id="a-body"><div class="hero round"><div class="sk" style="width:200px;height:200px;border-radius:999px"></div><div class="sk" style="height:28px;width:50%"></div></div>${skRows(8)}</div>`;
    fill("a-body", token, async () => {
      const [a, top, albums] = await api.artist(route.id);
      const k = reg(top);
      return `<div class="hero round">
          <img src="${esc(a.picture_xl || a.picture_big || PLACEHOLDER)}" alt="" referrerpolicy="no-referrer">
          <h1>${esc(a.name)}</h1>
          <p>${a.nb_fan ? `${a.nb_fan.toLocaleString("pt-BR")} fãs no Deezer` : ""}</p>
          ${top.length ? `<div class="hero-actions"><button class="play-pill" data-play="${k}" data-i="0" data-ctx="${esc(a.name)}">${I.play}<span>Tocar</span></button><button class="ghost-pill" data-shuffle-list="${k}" data-ctx="${esc(a.name)}">${I.shuffle}<span>Aleatório</span></button></div>` : ""}
        </div>
        <section class="block"><div class="block-head"><h2>Populares</h2><span class="note">prévias de 30s</span></div>${rowsHTML(top, a.name, { numbered: true, empty: "Nenhuma música disponível." })}</section>
        ${albums.length ? `<section class="block"><div class="block-head"><h2>Discografia</h2></div>${albumShelfHTML(albums)}</section>` : ""}`;
    });
  }

  function renderAlbum(token) {
    view.innerHTML = `<button class="back-btn" data-back>${I.back}<span>Voltar</span></button><div id="al-body"><div class="hero"><div class="sk" style="width:200px;height:200px"></div><div class="sk" style="height:28px;width:50%"></div></div>${skRows(8)}</div>`;
    fill("al-body", token, async () => {
      const { album: a, tracks } = await api.album(route.id);
      const k = reg(tracks);
      return `<div class="hero">
          <img src="${esc(a.cover_xl || a.cover_big || PLACEHOLDER)}" alt="" referrerpolicy="no-referrer">
          <h1>${esc(a.title)}</h1>
          <p><button class="link-btn" style="display:inline;color:var(--fg);font-weight:600" data-artist="${a.artist?.id}">${esc(a.artist?.name)}</button> · ${esc((a.release_date || "").slice(0, 4))} · ${a.nb_tracks || tracks.length} músicas</p>
          ${tracks.length ? `<div class="hero-actions"><button class="play-pill" data-play="${k}" data-i="0" data-ctx="${esc(a.title)}">${I.play}<span>Tocar</span></button><button class="ghost-pill" data-shuffle-list="${k}" data-ctx="${esc(a.title)}">${I.shuffle}<span>Aleatório</span></button></div>` : ""}
        </div>
        ${rowsHTML(tracks, a.title, { numbered: true, empty: "Este álbum não tem prévias disponíveis." })}`;
    });
  }

  function refreshFavIcons() { /* menus mostram o estado na hora em que abrem */ }

  // ---------- Navegação ----------
  function go(r, push = true) {
    route = r;
    if (push) history.pushState({ route, overlays: [] }, "");
    else history.replaceState({ route, overlays: [] }, "");
    render();
    window.scrollTo(0, 0);
  }
  window.addEventListener("popstate", (e) => {
    const st = e.state || { route: { v: "home" }, overlays: [] };
    overlays = st.overlays || [];
    applyOverlays();
    if (JSON.stringify(st.route) !== JSON.stringify(route)) { route = st.route; render(); window.scrollTo(0, 0); }
  });

  document.querySelector(".tabbar").addEventListener("click", (e) => {
    const b = e.target.closest("[data-nav]");
    if (!b) return;
    const v = b.dataset.nav;
    if (route.v === v) { window.scrollTo({ top: 0, behavior: "smooth" }); if (v === "search") $("q")?.focus(); return; }
    go({ v });
  });

  view.addEventListener("click", (e) => {
    const t = e.target;
    let b;
    if ((b = t.closest("[data-play]"))) { const items = lists[b.dataset.play]; if (items) setQueue(items, +b.dataset.i, b.dataset.ctx); return; }
    if ((b = t.closest("[data-shuffle-list]"))) {
      const items = lists[b.dataset.shuffleList];
      if (items?.length) { settings.shuffle = true; saveSettings(); setQueue(items, Math.floor(Math.random() * items.length), b.dataset.ctx); }
      return;
    }
    if ((b = t.closest("[data-menu]"))) { const it = lists[b.dataset.menu]?.[+b.dataset.i]; if (it) itemMenu(it); return; }
    if ((b = t.closest("[data-artist]"))) { if (b.dataset.artist && b.dataset.artist !== "undefined") go({ v: "artist", id: b.dataset.artist, from: route.from || route.v }); return; }
    if ((b = t.closest("[data-album]"))) { go({ v: "album", id: b.dataset.album, from: route.from || route.v }); return; }
    if ((b = t.closest("[data-back]"))) { history.back(); return; }
    if ((b = t.closest("[data-go]"))) { go({ v: b.dataset.go }); return; }
    if ((b = t.closest("[data-install]"))) { install(); return; }
    if ((b = t.closest("[data-retry]"))) { render(); return; }
    if ((b = t.closest("[data-genre]"))) { searchState.q = b.dataset.genre; searchState.filter = "all"; render(); return; }
    if ((b = t.closest("[data-filter]"))) {
      searchState.filter = b.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
      runSearch(); return;
    }
    if ((b = t.closest("[data-rtag]"))) { radioState.tag = b.dataset.rtag; radioState.q = ""; render(); return; }
    if ((b = t.closest("[data-lib]"))) { libState.tab = b.dataset.lib; render(); return; }
    if ((b = t.closest("[data-playall]"))) { const items = libState.tab === "favs" ? favs : recents; settings.shuffle = false; saveSettings(); setQueue(items, 0, libState.tab === "favs" ? "Favoritos" : "Recentes"); return; }
    if ((b = t.closest("[data-shuffleall]"))) { const items = libState.tab === "favs" ? favs : recents; settings.shuffle = true; saveSettings(); setQueue(items, Math.floor(Math.random() * items.length), libState.tab === "favs" ? "Favoritos" : "Recentes"); return; }
    if ((b = t.closest("[data-clear-recents]"))) { recents = []; store.set("onda:recents", recents); render(); toast("Recentes apagadas"); }
  });

  // Teclado no computador
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input")) return;
    if (e.code === "Space") { e.preventDefault(); togglePlay(); }
    if (e.key === "Escape") { if (overlays.includes("sheet")) closeOverlay("sheet"); else if (overlays.includes("full")) closeOverlay("full"); }
  });

  history.replaceState({ route, overlays: [] }, "");
  render();
  updatePlayIcons();
  updateTimerLabel();
})();
