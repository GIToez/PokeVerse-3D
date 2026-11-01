/* Painel admin — Jogadores (Fase 1): buscar conta, ver quem está online e onde, mexer em bolsa e time, cargo, moderação e
 * código de recuperação. Tudo passa pelas rotas /admin/jogador* do servidor, que validam, gravam, registram no admin_log e
 * avisam o jogador online na hora (bolsa e time chegam sem ele reentrar). Senha e token nunca chegam aqui. */
import { t } from '/i18n.mjs';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dataHora = ms => new Date(ms).toLocaleString('en-US', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const NATUREZAS = ['Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty', 'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax', 'Timid', 'Hasty', 'Serious',
  'Jolly', 'Naive', 'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash', 'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky'];
const IVS = [['hp', 'HP'], ['atk', 'Atk'], ['def', 'Def'], ['spa', 'SpA'], ['spd', 'SpD'], ['vel', 'Spe']];
const ivsDe = p => Array.isArray(p?.ivs) ? p.ivs : IVS.map(([k]) => +p?.ivs?.[k] || 0);   // o jogo grava lista de 6; objeto {hp…} é o formato antigo do servidor
// Fase 3: destinos do "Levar" (as chaves são as do /tp do chat — server_moderation.mjs CIDADES)
const CIDADES = [['pallet', 'Pallet (lab)'], ['viridian', 'Viridian'], ['pewter', 'Pewter'], ['cerulean', 'Cerulean'], ['vermilion', 'Vermilion'],
  ['lavender', 'Lavender'], ['celadon', 'Celadon'], ['saffron', 'Saffron'], ['fuchsia', 'Fuchsia'], ['cinnabar', 'Cinnabar']];

/** `canal` = BroadcastChannel do painel (pra levar o seu personagem até o jogador); `resolverEspecie` vem do admin.mjs. */
export function instalarJogadores({ api, toast, canal, resolverEspecie }) {
  let sel = null, det = null, ref = null, edTime = null, sujoBolsa = false, sujoTime = false;

  async function referencia() {
    if (ref) return ref;
    const d = await fetch('/data/menu_data.json').then(r => r.json()).catch(() => ({}));
    const itens = d.itens || {};
    ref = { itens, tipos: d.tipos || {}, insignias: d.insignias || [],
      bolas: Object.entries(itens).filter(([, i]) => i.t === 7).map(([id, i]) => ({ id, nome: t(i.n) })).sort((a, b) => a.id - b.id) };
    $('dl-itens').innerHTML = Object.entries(itens).filter(([, i]) => i.t !== 7).map(([id, i]) => `<option value="${id} ${esc(t(i.n))}">`).join('');
    return ref;
  }
  const nomeItem = id => t(ref?.itens[id]?.n || ('item ' + id));

  // ── Lista ────────────────────────────────────────────────────────────────────
  async function renderLista() {
    const q = $('j-busca').value.trim(), online = $('j-online').checked;
    const r = await api('/admin/jogadores?q=' + encodeURIComponent(q) + (online ? '&online=1' : ''));
    if (!r.ok) { toast(r.erro || 'Failed to list players.', true); return; }
    $('j-qtd').textContent = `${r.total} account(s) · ${r.online} connection(s) now`;
    $('j-lista').innerHTML = r.jogadores.map(j => `<button data-u="${esc(j.usuario)}" class="${j.usuario === sel ? 'atual' : ''}">
        <span class="bola" style="background:${j.online ? '#3ecf8e' : '#3a4256'}" title="${j.online ? 'online' : 'offline'}"></span>
        <span style="flex:1;min-width:0"><b>${esc(j.nome || j.usuario)}</b> <span class="fraco">${esc(j.usuario)}</span>
          ${j.online ? `<br><small class="fraco">${esc(j.online.mapa)} · x ${j.online.x} z ${j.online.z}</small>` : ''}</span>
        ${j.gm ? '<span class="selo gm">GM</span>' : ''}${j.banidoAte ? '<span class="selo ban">banned</span>' : ''}${j.mudoAte ? '<span class="selo mudo">muted</span>' : ''}
      </button>`).join('')
      + (r.visitantes.length ? `<div class="fraco" style="margin-top:8px;font-size:12px">No account: ${r.visitantes.map(v => esc(v.usuario) + ' (' + esc(v.online.mapa) + ')').join(', ')}</div>` : '')
      || '<span class="fraco">No one found.</span>';
    for (const b of $('j-lista').querySelectorAll('button')) b.onclick = () => abrir(b.dataset.u);
  }

  // ── Ficha ────────────────────────────────────────────────────────────────────
  async function abrir(u) {
    if ((sujoBolsa || sujoTime) && u !== sel && !confirm('This player has unsaved bag/team changes. Discard them?')) return;
    const [r] = await Promise.all([api('/admin/jogador?u=' + encodeURIComponent(u)), referencia()]);
    if (!r.ok) { toast(r.erro || 'Failed to open.', true); return; }
    sel = u; aplicar(r); renderLista();
  }
  function aplicar(r) {                                                   // resposta do servidor (abrir ou depois de qualquer ação)
    det = r; sujoBolsa = sujoTime = false;
    edTime = { time: (r.save.time || []).map(p => ({ ...p })), caixa: (r.save.caixa || []).map(p => ({ ...p })) };
    renderFicha();
  }
  async function acao(nome, corpo, ok) {
    const r = await api('/admin/jogador/' + nome, 'POST', { u: sel, ...corpo });
    if (!r.ok) { toast(r.erro || 'That did not work.', true); return null; }
    aplicar(r); renderLista(); if (ok) toast(ok);
    return r;
  }

  function renderFicha() {
    const c = det.conta, s = det.save;
    const status = [c.online ? `🟢 online in <b>${esc(c.online.mapa)}</b> (x ${c.online.x}, z ${c.online.z})` : '⚪ offline',
      c.banidoAte ? `⛔ banned ${c.banidoAte === -1 ? 'forever' : 'until ' + dataHora(c.banidoAte)}${c.banMotivo ? ' — ' + esc(c.banMotivo) : ''}` : '',
      c.mudoAte ? `🔇 muted until ${dataHora(c.mudoAte)}` : ''].filter(Boolean).join(' · ');
    $('j-ficha').innerHTML = `
      <div class="topo-edit"><h2>${esc(c.nome || c.usuario)} <span class="fraco" style="font-size:14px">${esc(c.usuario)}</span></h2>
        <button id="j-atualizar">Refresh</button>
        ${c.online ? '<button id="j-ir" title="Takes YOUR character to them (the game must be open in another tab, on the same map)">Go there in game</button><button id="j-recado">Send message</button><button id="j-kick" class="perigo">Disconnect</button>' : ''}</div>
      <div class="fraco">${status}</div>
      <div class="j-grade">
        <div class="caixa"><h3>Account</h3>
          <div class="form">
            <label class="inteira">Email <input type="text" value="${esc(c.email)}" readonly></label>
            <label class="chk"><input type="checkbox" id="j-gm" ${c.gm ? 'checked' : ''}> GM (can open the panel)</label>
            <label>Chat role <select id="j-cargo"><option value="">none</option><option value="staff"${c.cargo === 'staff' ? ' selected' : ''}>[STAFF]</option><option value="mod"${c.cargo === 'mod' ? ' selected' : ''}>[MOD]</option></select></label>
          </div>
          <div class="acoes" style="margin-top:10px"><button id="j-cargo-ok">Save role</button><button id="j-codigo" title="Generates a new code for the player to reset their password (the old one stops working)">Generate recovery code</button></div>
          <div id="j-codigo-caixa"></div>
        </div>
        <div class="caixa"><h3>Moderation</h3>
          <div class="form">
            <label class="inteira">Reason (shown to the player) <input type="text" id="j-motivo" maxlength="120" placeholder="optional"></label>
            <label>Mute for <select id="j-mudo-min"><option value="5">5 min</option><option value="30">30 min</option><option value="60">1 hour</option><option value="1440">1 day</option></select></label>
            <label>Ban for <select id="j-ban-min"><option value="60">1 hour</option><option value="1440">1 day</option><option value="10080">7 days</option><option value="43200">30 days</option><option value="-1">forever</option></select></label>
          </div>
          <div class="acoes" style="margin-top:10px">
            ${c.mudoAte ? '<button id="j-desmutar">Unmute</button>' : '<button id="j-mudo">Mute</button>'}
            ${c.banidoAte ? '<button id="j-perdoar">Lift ban</button>' : '<button id="j-banir" class="perigo">Ban</button>'}
          </div>
          <div class="acoes" style="margin-top:8px" title="Same as /tp name city in chat: if online, their scene reloads there; if offline, they spawn there on next login">
            <select id="j-levar-cidade">${CIDADES.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select><button id="j-levar">Send to the Pokémon Center entrance</button>
          </div>
          <div class="fraco" style="font-size:11px;margin-top:6px">In the game chat (GM): /ver /mudo /kick /banir /perdoar /tp /ir /puxar /aviso — same result as these buttons.</div>
        </div>
        <div class="caixa j-larga"><h3>Bag <span class="sujo" id="j-sujo-bolsa" hidden>● unsaved</span></h3>
          <div class="form">
            <label>Money <input type="number" id="j-dinheiro" min="0" step="1" value="${s.dinheiro ?? ''}" placeholder="game default"></label>
          </div>
          <h4>Poké Balls</h4>
          <div class="j-bolas">${ref.bolas.map(b => `<label>${esc(b.nome)} <input type="number" min="0" max="999999" data-bola="${b.id}" value="${s.bolas?.[b.id] || 0}"></label>`).join('')}</div>
          <h4>Items</h4>
          <table class="esp"><thead><tr><th>Item</th><th>Qty</th><th></th></tr></thead><tbody id="j-itens">
            ${Object.entries(s.itens || {}).map(([id, q]) => linhaItem(id, q)).join('') || ''}</tbody></table>
          <div class="add-esp"><input type="text" list="dl-itens" id="j-item-add" placeholder="add item (name or no.)…"><button id="j-item-ok">Add</button></div>
          <h4>Badges</h4>
          <div class="j-insignias">${ref.insignias.map(i => `<label class="chk" title="generation ${i.gen}"><input type="checkbox" data-ins="${i.id}" ${(s.insignias || []).includes(i.id) ? 'checked' : ''}> ${esc(t(i.n))}</label>`).join('')}</div>
          <div class="acoes" style="margin-top:12px"><button class="prim" id="j-bolsa-ok">Save bag</button></div>
        </div>
        <div class="caixa j-larga"><h3>Team and box <span class="sujo" id="j-sujo-time" hidden>● unsaved</span></h3>
          <div id="j-time"></div>
          <h4>Give Pokémon</h4>
          <div class="add-esp" style="grid-template-columns:1fr 70px auto auto"><input type="text" list="dl-especies" id="j-dar-esp" placeholder="species (name or no.)…">
            <input type="number" id="j-dar-lv" min="1" max="100" value="5" title="level"><label class="chk"><input type="checkbox" id="j-dar-shiny"> shiny</label><button id="j-dar-ok">Give</button></div>
          <div class="fraco" style="font-size:12px;margin-top:6px">IVs and nature are rolled by the server, like a catch. Goes to the team (or to the box if the team is full).</div>
          <div class="acoes" style="margin-top:12px"><button class="prim" id="j-time-ok">Save team</button></div>
        </div>
        <div class="caixa j-larga"><h3>Panel history</h3>
          ${det.log.length ? `<table class="dados backups"><tbody>${det.log.map(e => `<tr><td>${esc(dataHora(e.quando))}</td><td>${esc(e.gm)}</td><td><b>${esc(e.acao)}</b> ${esc(resumoLog(e))}</td></tr>`).join('')}</tbody></table>` : '<span class="fraco">No panel actions on this account yet.</span>'}
        </div>
      </div>`;
    renderTime(); ligarFicha();
  }
  const linhaItem = (id, q) => `<tr data-item="${esc(id)}"><td>${esc(nomeItem(id))} <span class="fraco">${esc(id)}</span></td><td><input type="number" min="0" max="999999" value="${q}"></td><td><button class="perigo rem" title="Remove">✕</button></td></tr>`;
  function resumoLog(e) {
    const d = e.depois || {};
    if (e.acao === 'bolsa') return 'money ' + (e.antes?.dinheiro ?? '—') + ' → ' + (d.dinheiro ?? '—');
    if (e.acao === 'time') return (e.antes?.time?.length ?? 0) + '+' + (e.antes?.caixa?.length ?? 0) + ' → ' + (d.time?.length ?? 0) + '+' + (d.caixa?.length ?? 0) + ' (team+box)';
    if (e.acao === 'deu pokemon') return (d.nome || '#' + d.dex) + ' Lv ' + d.lv + (d.shiny ? ' ✨' : '') + ' → ' + d.lugar;
    if (e.acao === 'cargo') return (d.gm ? 'GM' : 'no GM') + (d.cargo ? ' · ' + d.cargo : '');
    if (e.acao === 'banir') return (d.banidoAte === -1 ? 'forever' : 'until ' + dataHora(d.banidoAte)) + (d.motivo ? ' — ' + d.motivo : '');
    if (e.acao === 'silenciar') return 'until ' + dataHora(d.mudoAte) + (d.motivo ? ' — ' + d.motivo : '');
    if (e.acao === 'recado') return '"' + (d.texto || '') + '"';
    if (/^(levar|tp|puxar|ir até)/.test(e.acao)) return (d.nome ? d.nome + ' · ' : '') + d.mapa + ' (' + d.x + ', ' + d.z + ')';   // Fase 3 (também os do chat)
    if (/^aviso/.test(e.acao)) return '"' + (d.texto || '') + '"';
    return '';
  }

  function renderTime() {
    const linha = (p, onde, i) => `<tr data-onde="${onde}" data-i="${i}">
      <td><b>${esc(p.nome || '#' + p.dex)}</b> <span class="fraco">${String(p.dex).padStart(4, '0')}</span>${p.inicial ? ' <span class="selo">starter</span>' : ''}</td>
      <td><input type="number" class="lv" min="1" max="100" value="${p.lv || 1}"></td>
      <td><label class="chk"><input type="checkbox" class="shiny" ${p.shiny ? 'checked' : ''}> ✨</label></td>
      <td><select class="nat">${NATUREZAS.map(n => `<option${n === p.natureza ? ' selected' : ''}>${n}</option>`).join('')}</select></td>
      <td class="j-ivs">${IVS.map(([k, r], i) => `<input type="number" min="0" max="31" data-iv="${i}" value="${ivsDe(p)[i]}" title="${r}">`).join('')}</td>
      <td><button class="mover" title="${onde === 'time' ? 'Send to box' : 'Bring to team'}">${onde === 'time' ? '↓' : '↑'}</button><button class="perigo rem" title="Release">✕</button></td></tr>`;
    const tabela = (lista, onde) => lista.length
      ? `<table class="esp j-mons"><thead><tr><th>${onde === 'time' ? 'Team' : 'Box'} (${lista.length})</th><th>Lv</th><th></th><th>Nature</th><th>IVs (HP Atk Def SpA SpD Spe)</th><th></th></tr></thead><tbody>${lista.map((p, i) => linha(p, onde, i)).join('')}</tbody></table>`
      : `<div class="fraco" style="margin:6px 0">${onde === 'time' ? 'Team is empty.' : 'Box is empty.'}</div>`;
    const el = $('j-time'); if (!el) return;
    el.innerHTML = tabela(edTime.time, 'time') + tabela(edTime.caixa, 'caixa');
    for (const tr of el.querySelectorAll('tr[data-onde]')) {
      const lista = edTime[tr.dataset.onde], p = lista[+tr.dataset.i];
      const mexeu = () => { sujoTime = true; $('j-sujo-time').hidden = false; };
      tr.querySelector('.lv').oninput = e => { p.lv = Math.round(+e.target.value); mexeu(); };
      tr.querySelector('.shiny').onchange = e => { p.shiny = e.target.checked; mexeu(); };
      tr.querySelector('.nat').onchange = e => { p.natureza = e.target.value; mexeu(); };
      for (const inp of tr.querySelectorAll('[data-iv]')) inp.oninput = () => { p.ivs = ivsDe(p).slice(); p.ivs[+inp.dataset.iv] = Math.round(+inp.value); mexeu(); };
      tr.querySelector('.mover').onclick = () => {
        const destino = tr.dataset.onde === 'time' ? 'caixa' : 'time';
        if (destino === 'time' && edTime.time.length >= 6) { toast('The team already has 6.', true); return; }
        lista.splice(+tr.dataset.i, 1); edTime[destino].push(p); mexeu(); renderTime(); $('j-sujo-time').hidden = false;
      };
      tr.querySelector('.rem').onclick = () => {
        if (!confirm(`Release ${p.nome || 'this Pokémon'} (Lv ${p.lv})? It is removed from the account when you save.`)) return;
        lista.splice(+tr.dataset.i, 1); mexeu(); renderTime(); $('j-sujo-time').hidden = false;
      };
    }
  }

  function ligarFicha() {
    const mexeuBolsa = () => { sujoBolsa = true; $('j-sujo-bolsa').hidden = false; };
    $('j-atualizar').onclick = () => abrir(sel);
    if ($('j-ir')) $('j-ir').onclick = () => { const o = det.conta.online; canal.postMessage({ t: 'tp', x: o.x, z: o.z, mapa: o.mapa }); toast('Request sent to your game (if it is open on map ' + o.mapa + ').'); };
    if ($('j-recado')) $('j-recado').onclick = () => { const texto = prompt('Message for the player (shows in their chat as a GM message):'); if (texto?.trim()) acao('moderar', { acao: 'recado', texto }, 'Message sent.'); };
    if ($('j-kick')) $('j-kick').onclick = () => { if (confirm('Disconnect ' + det.conta.usuario + ' now? (they can log in again)')) acao('moderar', { acao: 'desconectar', motivo: $('j-motivo').value }, 'Disconnected.'); };
    $('j-cargo-ok').onclick = () => acao('cargo', { gm: $('j-gm').checked, cargo: $('j-cargo').value || null }, 'Role saved.');
    $('j-codigo').onclick = async () => {
      if (!confirm('Generate a new password recovery code? The old code stops working.')) return;
      const r = await acao('codigo', {}, 'Code generated.');
      if (!r?.codigo) return;
      $('j-codigo-caixa').innerHTML = `<div class="j-codigo">Code: <code>${esc(r.codigo)}</code> <button id="j-copiar">Copy</button><div class="fraco" style="font-size:12px">Give it to the player: they use it in "Forgot password" with username <b>${esc(sel)}</b>. It is only shown now.</div></div>`;
      $('j-copiar').onclick = () => navigator.clipboard?.writeText(r.codigo).then(() => toast('Copied.'), () => toast('Could not copy.', true));
    };
    if ($('j-mudo')) $('j-mudo').onclick = () => acao('moderar', { acao: 'mudo', minutos: +$('j-mudo-min').value, motivo: $('j-motivo').value }, 'Muted.');
    if ($('j-desmutar')) $('j-desmutar').onclick = () => acao('moderar', { acao: 'desmutar' }, 'Can talk again.');
    if ($('j-banir')) $('j-banir').onclick = () => {
      const min = +$('j-ban-min').value, txt = min === -1 ? 'forever' : $('j-ban-min').selectedOptions[0].textContent;
      if (confirm(`Ban ${det.conta.usuario} for ${txt}? They are disconnected and cannot log in until then.`)) acao('moderar', { acao: 'banir', minutos: min, motivo: $('j-motivo').value }, 'Banned.');
    };
    if ($('j-perdoar')) $('j-perdoar').onclick = () => acao('moderar', { acao: 'perdoar' }, 'Ban lifted.');
    $('j-levar').onclick = () => {                                       // Fase 3: o mesmo do /tp nome cidade
      const cid = $('j-levar-cidade').value, nome = $('j-levar-cidade').selectedOptions[0].textContent;
      if (confirm(`Send ${det.conta.usuario} to ${nome}?` + (det.conta.online ? ' Their scene reloads now.' : ' They spawn there on next login.'))) acao('moderar', { acao: 'levar', cidade: cid }, 'Sent to ' + nome + '.');
    };
    // bolsa
    $('j-dinheiro').oninput = mexeuBolsa;
    for (const i of document.querySelectorAll('#j-ficha [data-bola], #j-ficha [data-ins]')) i.addEventListener(i.type === 'checkbox' ? 'change' : 'input', mexeuBolsa);
    const ligarItens = () => {
      for (const tr of $('j-itens').querySelectorAll('tr')) {
        tr.querySelector('input').oninput = mexeuBolsa;
        tr.querySelector('.rem').onclick = () => { tr.remove(); mexeuBolsa(); };
      }
    };
    ligarItens();
    const addItem = () => {
      const v = $('j-item-add').value.trim(), low = v.toLowerCase(), id = (v.match(/^(\d+)/) || [])[1] || Object.keys(ref.itens).find(k => {
        const n = ref.itens[k].n; return n.toLowerCase() === low || t(n).toLowerCase() === low;
      });
      if (!id || !ref.itens[id]) { toast('Item not found.', true); return; }
      if (ref.itens[id].t === 7) { toast('Poké Balls go in the Poké Balls list above.', true); return; }
      const tr = $('j-itens').querySelector(`tr[data-item="${id}"]`);
      if (tr) { const inp = tr.querySelector('input'); inp.value = +inp.value + 1; }
      else $('j-itens').insertAdjacentHTML('beforeend', linhaItem(id, 1));
      $('j-item-add').value = ''; ligarItens(); mexeuBolsa();
    };
    $('j-item-ok').onclick = addItem;
    $('j-item-add').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } };
    $('j-bolsa-ok').onclick = () => {
      const corpo = { bolas: {}, itens: {}, insignias: [] }, din = $('j-dinheiro').value.trim();
      if (din !== '') corpo.dinheiro = Number(din);
      for (const i of document.querySelectorAll('#j-ficha [data-bola]')) if (+i.value > 0) corpo.bolas[i.dataset.bola] = Number(i.value);
      for (const tr of $('j-itens').querySelectorAll('tr')) { const q = Number(tr.querySelector('input').value); if (q > 0) corpo.itens[tr.dataset.item] = q; }
      for (const i of document.querySelectorAll('#j-ficha [data-ins]:checked')) corpo.insignias.push(+i.dataset.ins);
      acao('bolsa', corpo, 'Bag saved' + (det.conta.online ? ' — it already reached their game.' : '.'));
    };
    // time
    $('j-time-ok').onclick = () => {
      const enx = p => ({ uid: p.uid, lv: p.lv, shiny: !!p.shiny, natureza: p.natureza, ivs: p.ivs });
      acao('time', { time: edTime.time.map(enx), caixa: edTime.caixa.map(enx) }, 'Team saved' + (det.conta.online ? ' — it already reached their game.' : '.'));
    };
    $('j-dar-ok').onclick = () => {
      const e = resolverEspecie($('j-dar-esp').value);
      if (!e) { toast('Species not found or has no model.', true); return; }
      if (sujoTime && !confirm('Giving the Pokémon now discards unsaved team changes. Continue?')) return;
      acao('pokemon', { dex: e.dex, glb: e.glb.replace(/\.glb$/, ''), nome: e.nome, lv: +$('j-dar-lv').value, shiny: $('j-dar-shiny').checked }, e.nome + ' given.');
    };
  }

  // ── Ligar a tela ─────────────────────────────────────────────────────────────
  $('j-busca').addEventListener('input', () => { clearTimeout(renderLista.t); renderLista.t = setTimeout(renderLista, 250); });
  $('j-online').addEventListener('change', renderLista);
  $('j-recarregar').addEventListener('click', renderLista);
  for (const b of document.querySelectorAll('#lado button[data-vista="jogadores"]')) b.addEventListener('click', () => { referencia(); renderLista(); });
  setInterval(() => { if (!$('v-jogadores').hidden) renderLista(); }, 15000);   // quem entrou/saiu, sem precisar clicar
  addEventListener('beforeunload', e => { if (sujoBolsa || sujoTime) { e.preventDefault(); e.returnValue = ''; } });
}
