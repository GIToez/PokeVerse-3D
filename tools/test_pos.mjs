import { aceitarPos, posDaConta, posLimpa, POS_PULO_M } from '../server_pos.mjs';

function ok(cond, msg){ if (!cond) throw new Error(msg); }

const kanto = { mapa: 'kanto', x: 10, y: 0, z: 20, giro: 1.2 };
const andar = aceitarPos(kanto, { ...kanto, x: 12, z: 21 }, {});
ok(andar.mudou && andar.pos.x === 12, 'walk on the same map is stored');

const salto = aceitarPos(kanto, { mapa: 'kanto', x: 10 + POS_PULO_M + 5, z: 20 }, {});
ok(!salto.mudou && salto.pos.x === 10, 'same-map jump without a door is ignored');

const porta = aceitarPos(kanto, { mapa: '4110002', x: 3, z: 4, chegada: 7110199 }, { porta: true });
ok(porta.mudou && porta.pos.mapa === '4110002' && porta.pos.chegada === 7110199, 'a real door may change map');

const longe = aceitarPos(kanto, { mapa: 'kanto', x: 400, z: 20, chegada: 7223601 }, { porta: true });
ok(longe.mudou && longe.pos.x === 400, 'a door may jump any distance on the same map');
const depois = aceitarPos(longe.pos, { mapa: 'kanto', x: 410, z: 22 }, {});
ok(depois.mudou && depois.pos.x === 410, 'a walk after the door is stored from the landing');
const outro = aceitarPos(longe.pos, { mapa: 'kanto', x: 400 + POS_PULO_M + 5, z: 20 }, {});
ok(!outro.mudou && outro.pos.x === 400, 'a later jump without a door is still ignored');

const url = aceitarPos(kanto, { mapa: '4120017', x: 0, z: 0 }, {});
ok(!url.mudou && url.pos.mapa === 'kanto', 'URL / relog cannot pick another map');

const centro = aceitarPos(kanto, { mapa: '4110001', x: 0, z: -2, chegada: 7140301 }, { porta: true }).pos;
const noBalcao = aceitarPos(centro, { mapa: '4110001', x: 4, z: -25 }, {});
ok(noBalcao.mudou && noBalcao.pos.chegada === 7140301, 'walking inside a shared Center keeps the town it was entered from');
const trocaCidade = aceitarPos(centro, { mapa: '4110001', x: 1, z: -3, chegada: 7140101 }, {});
ok(trocaCidade.pos.chegada === 7140301, 'without a door the client cannot change the arrival');

ok(!posLimpa({ mapa: 'kanto' }), 'position without x,z is rejected');
ok(posDaConta({ posGm: { mapa: 'kanto', x: 1, z: 2 }, pos: kanto }).x === 1, 'GM teleport wins spawn');
ok(posDaConta({ pos: kanto }).z === 20, 'walk position is what GET /save returns');

console.log('test_pos: ok');
