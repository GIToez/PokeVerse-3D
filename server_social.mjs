/* SOCIAL (Nov 6): friends, friend requests and direct messages between friends — what the Social window (menus.mjs) expects.
 *   GET  /social                         → { me, friends, requests, conversations }
 *   GET  /social/conversation?with=user  → { messages: [{ from, text, time }] } (marks them read)
 *   POST /social/request { to }          → { friends, nick }  (to: an account name or the trainer's name; a request both ways = friends)
 *   POST /social/accept|decline { from } · POST /social/remove { user } · POST /social/message { to, text } → { time }
 * Live notices over the game socket: { t: 'social', type: 'request' | 'accepted' | 'removed', from, nick } and { t: 'dm', from, nick, text }.
 * Stored on the accounts: c.social = { friends: [user], requests: [{ from, at }] }, c.dms = { other: { msgs: [...], unread } }.
 *   const social = createSocial({ accounts, send, socketsOf, saveAccounts, isMuted })
 *   social.route(rota, method, d, u, json, url) → true when it answered
 *   social.request(u, to) → the same as POST /social/request (the player card's "Add Friend") */
const MAX_FRIENDS = 100, MAX_REQUESTS = 50, MAX_MSGS = 100, MAX_TEXT = 300;

export function createSocial({ accounts, send, socketsOf, saveAccounts, isMuted = () => false }) {
  const S = (c) => { if (!c.social || typeof c.social !== 'object') c.social = {}; c.social.friends ||= []; c.social.requests ||= []; return c.social; };
  const nick = (u) => accounts[u]?.save?.nome || u;
  const online = (u) => socketsOf(u).length > 0;
  const lvOf = (u) => Math.max(0, ...((accounts[u]?.save?.time || []).filter(Boolean).map((p) => +p.lv || 0)));
  const dexOf = (u) => +(accounts[u]?.save?.time || []).find(Boolean)?.dex || null;
  const areaOf = (u) => { const w = socketsOf(u)[0]; return w?._info?.areaNome || null; };
  const notify = (u, m) => { for (const w of socketsOf(u)) send(w, m); };
  /** An account from an account name or a trainer's name (case doesn't matter). */
  function find(name) {
    const v = String(name || '').trim().toLowerCase();
    if (!v) return null;
    if (accounts[v]) return v;
    for (const [u, c] of Object.entries(accounts)) if (String(c?.save?.nome || '').toLowerCase() === v) return u;
    return null;
  }
  const areFriends = (a, b) => S(accounts[a]).friends.includes(b);
  function link(a, b) {
    for (const [x, y] of [[a, b], [b, a]]) {
      const s = S(accounts[x]);
      if (!s.friends.includes(y)) s.friends.push(y);
      s.requests = s.requests.filter((r) => r.from !== y);
    }
  }
  function request(u, to) {
    const t = find(to);
    if (!t) return { erro: 'No trainer with that name.' };
    if (t === u) return { erro: "That's you!" };
    const me = S(accounts[u]), them = S(accounts[t]);
    if (me.friends.includes(t)) return { erro: nick(t) + ' is already your friend.' };
    if (me.friends.length >= MAX_FRIENDS) return { erro: 'Your friends list is full (' + MAX_FRIENDS + ').' };
    if (me.requests.some((r) => r.from === t)) {   // they asked first: friends now
      link(u, t); saveAccounts();
      notify(t, { t: 'social', type: 'accepted', from: u, nick: nick(u) });
      return { ok: true, friends: true, nick: nick(t) };
    }
    if (them.requests.some((r) => r.from === u)) return { ok: true, friends: false, nick: nick(t), ja: true };
    if (them.requests.length >= MAX_REQUESTS) return { erro: nick(t) + ' has too many pending requests.' };
    them.requests.push({ from: u, at: Date.now() });
    saveAccounts();
    notify(t, { t: 'social', type: 'request', from: u, nick: nick(u) });
    return { ok: true, friends: false, nick: nick(t) };
  }
  function view(u) {
    const c = accounts[u], s = S(c), dms = c.dms || {};
    const convs = Object.entries(dms).map(([w, d]) => ({ with: w, nick: nick(w), last: d.msgs?.at(-1)?.text || '', at: d.msgs?.at(-1)?.time || 0, unread: d.unread | 0, dex: dexOf(w) }))
      .filter((v) => v.at).sort((a, b) => b.at - a.at);
    return {
      me: { user: u, nick: nick(u) },
      friends: s.friends.filter((f) => accounts[f]).map((f) => ({ user: f, nick: nick(f), online: online(f), lv: lvOf(f), dex: dexOf(f), area: online(f) ? areaOf(f) : null, seenAt: accounts[f].vistoEm || accounts[f].ultimoLogin || null }))
        .sort((a, b) => b.online - a.online || a.nick.localeCompare(b.nick)),
      requests: s.requests.filter((r) => accounts[r.from]).map((r) => ({ from: r.from, nick: nick(r.from), lv: lvOf(r.from), online: online(r.from), dex: dexOf(r.from), at: r.at })),
      conversations: convs,
    };
  }
  const nextAt = new Map();
  function message(u, to, text) {
    const t = find(to);
    if (!t || !areFriends(u, t)) return { erro: 'Direct messages are only between friends.' };
    const txt = String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
    if (!txt) return { erro: 'Write something first.' };
    if (isMuted(u)) return { erro: 'You are muted right now.' };
    const now = Date.now();
    if ((nextAt.get(u) || 0) > now) return { erro: 'Slow down a little.' };
    nextAt.set(u, now + 600);
    const m = { from: u, text: txt, time: now };
    for (const [x, y, unread] of [[u, t, false], [t, u, true]]) {
      const c = accounts[x]; c.dms ||= {};
      const d = (c.dms[y] ||= { msgs: [], unread: 0 });
      d.msgs.push(m); if (d.msgs.length > MAX_MSGS) d.msgs.splice(0, d.msgs.length - MAX_MSGS);
      if (unread) d.unread = (d.unread | 0) + 1;
    }
    saveAccounts();
    notify(t, { t: 'dm', from: u, nick: nick(u), text: txt });
    return { ok: true, time: now };
  }
  function route(rota, method, d, u, json, url) {
    if (rota !== '/social' && !rota.startsWith('/social/')) return false;
    if (!u || !accounts[u]) { json(401, { erro: 'Log in with an account to have friends and messages.' }); return true; }
    const done = (r) => (r?.erro ? json(400, r) : json(200, r));
    if (method === 'GET' && rota === '/social') { json(200, view(u)); return true; }
    if (method === 'GET' && rota === '/social/conversation') {
      const w = find(url?.searchParams.get('with'));
      const D = w && accounts[u].dms?.[w];
      if (D && D.unread) { D.unread = 0; saveAccounts(); }
      json(200, { messages: D?.msgs || [] }); return true;
    }
    if (method !== 'POST') { json(405, { erro: 'Use POST.' }); return true; }
    if (rota === '/social/request') { done(request(u, d.to)); return true; }
    if (rota === '/social/accept' || rota === '/social/decline') {
      const f = String(d.from || '').toLowerCase(), s = S(accounts[u]);
      if (!s.requests.some((r) => r.from === f)) { json(404, { erro: 'That request is gone.' }); return true; }
      if (rota === '/social/accept') {
        if (s.friends.length >= MAX_FRIENDS) { json(400, { erro: 'Your friends list is full.' }); return true; }
        link(u, f); notify(f, { t: 'social', type: 'accepted', from: u, nick: nick(u) });
      } else s.requests = s.requests.filter((r) => r.from !== f);
      saveAccounts(); json(200, { ok: true, nick: nick(f) }); return true;
    }
    if (rota === '/social/remove') {
      const f = String(d.user || '').toLowerCase();
      if (!areFriends(u, f)) { json(404, { erro: 'Not in your friends.' }); return true; }
      for (const [x, y] of [[u, f], [f, u]]) { const s = S(accounts[x]); s.friends = s.friends.filter((z) => z !== y); }
      saveAccounts(); notify(f, { t: 'social', type: 'removed', from: u, nick: nick(u) });
      json(200, { ok: true }); return true;
    }
    if (rota === '/social/message') { done(message(u, d.to, d.text)); return true; }
    json(404, { erro: 'Unknown social request.' }); return true;
  }
  return { route, request, areFriends, find, nick };
}
