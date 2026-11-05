/* "Start now" / "Stop now" on the event schedule (server_schedule.mjs /admin/agenda/agora). Run: node tools/test_schedule_now.mjs */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { criarAgenda } from '../server_schedule.mjs';
let pass = 0, fail = 0;
const ok = (l, c, x = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + l + (x ? '  ' + x : '')); };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agenda-'));
const raidCalls = [];
const A = criarAgenda({ dadosPub: dir, conexoes: new Map(), enviar() {}, logAdmin() {}, gravarComBackup: (f, v) => fs.writeFileSync(f, JSON.stringify(v)),
  raid: { anunciarAgendada: (t) => (raidCalls.push(['fila', t]), {}), comecarAgendada: () => raidCalls.push(['luta']), resumo: () => ({}) } });
const call = (r, m, d) => { let out; A.rota(r, m, d, 'gm', (c, j) => { out = { c, ...j }; }); return out; };
const far = new Date(Date.now() + 30 * 86400e3).toISOString(), far2 = new Date(Date.now() + 31 * 86400e3).toISOString();
let r = call('/admin/agenda', 'POST', { dados: { v: 1, eventos: [
  { id: 'xp', tipo: 'bonus', titulo: 'Double XP', quando: 'uma', inicio: far, fim: far2, bonus: { xp: 2, shiny: 1, densidade: 1 } },
  { id: 'art', tipo: 'raid', titulo: 'Articuno', quando: 'semana', dias: [0], horas: ['03:00'], duracaoMin: 30, raid: { filaMin: 5 } } ] } });
ok('schedule saved', r.ok, r.erro);
ok('no bonus before', A.bonusAgora() === null);
r = call('/admin/agenda/agora', 'POST', { id: 'xp', acao: 'iniciar', duracaoMin: 60 });
ok('start now works', r.ok && /started/.test(r.msg), r.erro || r.msg);
ok('the bonus runs right away', A.bonusAgora()?.xp === 2, JSON.stringify(A.bonusAgora()));
ok('the original event is untouched', r.dados.eventos.find(e => e.id === 'xp').inicio === far);
r = call('/admin/agenda/agora', 'POST', { id: 'xp', acao: 'parar' });
ok('stop now ends it', r.ok && A.bonusAgora() === null, JSON.stringify(A.bonusAgora()));
ok('the copy is removed', !r.dados.eventos.some(e => e.manual));
r = call('/admin/agenda/agora', 'POST', { id: 'art', acao: 'iniciar' });
ok('raid start now opens the queue at once', r.ok && raidCalls.some(c => c[0] === 'fila' && c[1] === 'Articuno'), JSON.stringify(raidCalls));
ok('the raid shows on the Events board as coming up', A.lista(Date.now() - 1, Date.now() + 86400e3).some(o => o.titulo === 'Articuno' && o.estado === 'breve'));
r = call('/admin/agenda/agora', 'POST', { id: 'nope', acao: 'iniciar' });
ok('unknown id is refused', r.c === 404);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
