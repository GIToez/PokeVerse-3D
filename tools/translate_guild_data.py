# One-off (Nov 7): guilda.json and colocacao.json user-facing text → English (Portuguese lives in ui_pt.json).
import json, sys
T = {
 'Líder':'Leader','Vice':'Deputy','Oficial':'Officer','Membro':'Member','Recruta':'Recruit',
 'Convidar jogadores':'Invite players','Aceitar pedidos de entrada':'Accept join requests','Expulsar membros':'Kick members',
 'Editar o aviso do líder':"Edit the leader's notice",'Iniciar evento de guilda':'Start a guild event','Usar o baú da guilda':'Use the guild treasury',
 'Escudo':'Shield','Medalhão':'Medallion','Estandarte':'Banner','Cristal':'Crystal','Escudo alado':'Winged shield','Sol':'Sun','Elementos':'Elements',
 'Treinador':'Trainer','Brasão':'Crest','Fogueira':'Campfire','Gota':'Drop','Ramo':'Branch','Tempestade':'Storm','Gelo eterno':'Eternal ice','Vórtice':'Vortex',
 'Lua':'Moon','Pokébola':'Poké Ball','Ovo':'Egg','Insígnia':'Badge','Baga':'Berry','Pegada':'Footprint','Asa':'Wing','Troféu':'Trophy','Estrela':'Star',
 'Coroa':'Crown','Espadas':'Swords','Punho':'Fist','Estrela ninja':'Shuriken','Coração':'Heart','Azul':'Blue','Verde':'Green','Laranja':'Orange','Rosa':'Pink',
 'Vinho':'Wine','Arco-íris':'Rainbow','Roxo':'Purple','Amarelo':'Yellow','Grafite':'Graphite',
 'Raid da agenda concluída':'Scheduled raid cleared','cada membro que bateu o bastante':'each member who dealt enough damage',
 'Selvagem derrotado (KO válido)':'Wild Pokémon defeated (valid KO)','Selvagem derrotado com 2+ da guilda no mesmo alvo':'Wild Pokémon defeated with 2+ guildmates on it',
 'Captura':'Catch','Missão da história concluída':'Story mission completed','Insígnia conquistada (1ª vitória)':'Badge earned (first win)',
 'Revanche de ginásio vencida':'Gym rematch won','Elite dos Quatro vencida':'Elite Four beaten','Troca com outro jogador':'Trade with another player','Evolução':'Evolution',
 'Dano no chefe de guilda (por 1.000 de dano)':'Damage to the guild boss (per 1,000)','Meta do dia do chefe batida (× degrau)':"Boss's daily goal reached (× tier)",
 'Doação pro baú (por 10.000 ₽) — fase 3':'Treasury donation (per 10,000 Coins) — later',
 'Base: Salão da guilda':'Base: Guild Hall','Base: área de descanso dos pokémon':'Base: Pokémon rest area','Base: cozinha ao ar livre':'Base: outdoor kitchen',
 'Chefe da guilda todo dia, na base (contribuição → fragmentos → loja da guilda)':'A guild boss every day at the base (damage → shards → guild shop)',
 '+5% de XP quando 2+ da guilda batem no mesmo selvagem':'+5% XP when 2+ guildmates fight the same wild Pokémon',
 'Base: Salão da guilda 2':'Base: Guild Hall 2','Base: bancada de síntese':'Base: crafting bench','Base: Salão da guilda 3':'Base: Guild Hall 3','Base: mina':'Base: mine',
 'Base: horta grande':'Base: large garden','+10% de XP em grupo de guilda':'+10% guild group XP','Base: alimentador automático':'Base: auto-feeder',
 'Base: máquina de decoração':'Base: decoration machine','Base: Salão da guilda 4':'Base: Guild Hall 4','Base: serraria':'Base: sawmill','+12% de XP em grupo de guilda':'+12% guild group XP',
 'Base: Salão da guilda 5':'Base: Guild Hall 5','+15% de XP em grupo de guilda':'+15% guild group XP','Título "Guilda Mestra" pra todos os membros':'"Master Guild" title for every member',
 'Guilda Mestra':'Master Guild','Guilda da Semana':'Guild of the Week','todos os membros da 1ª do ranking, na virada da semana':'every member of the #1 guild when the week turns',
 'na BASE da guilda (o platô, regiao r5) — a arena (Campo) fica aberta a todos pra eventos e chefe mundial':"at the guild BASE (the plateau, region r5)",
 'participou':'took part','bronze':'bronze','prata':'silver','ouro':'gold','lenda':'legend','Mineral Evolutivo':'Eviolite',
 'Só em quem ainda evolui: Defesa e Defesa Especial ×1,5 (dano recebido ×0,67).':'Only on a Pokémon that can still evolve: Defense and Sp. Def ×1.5 (damage taken ×0.67).',
 'fica no Pokémon (não se gasta) e é dos held mais fortes da loja; vai com o Beedrill (Weedle → Kakuna → Beedrill), o 1º chefe da escada':'stays on the Pokémon (not used up), one of the strongest held items in the shop; comes with Beedrill, the first boss',
 'Balão de Ar':'Air Balloon','Golpes do tipo Terra não acertam quem segura. Estoura no primeiro golpe recebido.':"Ground-type moves miss the holder. Pops at the first hit taken.",
 'uso único: estoura no 1º golpe recebido e some; vai com o Pidgeot, a ave de Kanto (o balão dá a imunidade a Terra que o tipo Voador já tem)':'single use: pops at the first hit; comes with Pidgeot',
 'A fazenda':'The farm','A ilha do meio':'The middle island','A ilha leste':'The east island','O bosque':'The grove','O platô':'The plateau','o degrau':'the ledge',
 'Salão da guilda':'Guild Hall','a casa da guilda: cresce com o nível; baú e loja moram aqui (fase 3)':"the guild's house: grows with the guild level; the treasury and shop live here",
 'Área de descanso dos Pokémon':'Pokémon rest area','onde os Pokémon emprestados pelos membros ficam à mostra (fase 3: trabalhando)':"where members' Pokémon are on show",
 'Cozinha ao ar livre':'Outdoor kitchen','comida pros Pokémon da base (fase 3)':"food for the base's Pokémon",'Bancada de síntese':'Crafting bench',
 'transforma o que a base produz em itens presos à conta (fase 3)':'turns what the base produces into account-bound items','Mina':'Mine',
 'pedra que renasce por hora; rende pelo número de membros que mineram (fase 3)':'ore that grows back every hour; yields more the more members mine',
 'Horta grande':'Large garden','20 canteiros; o Pokémon que rega passa pelos corredores':'20 plots; the watering Pokémon walks the rows','Alimentador automático':'Auto-feeder',
 'os Pokémon da base comem sozinhos (fase 3)':"the base's Pokémon feed themselves",'Máquina de decoração':'Decoration machine','enfeites da base (fase 3)':'decorations for the base',
 'Serraria':'Sawmill','madeira que renasce por hora, entre as árvores do bosque (fase 3)':'wood that grows back every hour among the grove trees','Moeda de guilda':'Guild coin',
 'vitória sobre o chefe (100 × degrau)':'beating the boss (100 × tier)','marco de 50.000 de dano (50)':'every 50,000 damage (50)','fase 3: doação pro baú':'later: treasury donations',
 'Ninho dos companheiros':'Companion nest','onde os seus Pokémon ficam à mostra e descansam (fase 3: fadiga e humor)':'where your Pokémon show off and rest',
 'Horta de bagas':'Berry garden','6 canteiros: regar, capinar, colher (fase 3)':'6 plots: water, weed, harvest','comida pros companheiros (fase 3)':'food for your companions',
 'os companheiros comem sozinhos (fase 3)':'your companions feed themselves','enfeites da casa (fase 3)':'decorations for your home','Mesa de alquimia':'Alchemy table',
 'síntese pessoal, na frente do laboratório (fase 3)':'personal crafting, in front of the lab','Incubadora':'Incubator',
 'item da bolsa: o jogador coloca no terreno; choca o ovo da criação (lab-ovo)':'a Bag item you place on your plot: it hatches an Egg',
 'Casa do treinador':"Trainer's home",'o dono da casa':'the owner','O gramado':'The lawn','água (sem chão)':'water (no ground)','obstáculo da cena':'scenery obstacle',
 'passagem (cais, ponte, escada)':'passage (pier, bridge, stairs)','beira de o gramado':'edge of the lawn','a chegada':'the arrival','a praça da chegada':'the arrival square',
 'porta da casa (o prédio amarelo)':'the house door (yellow building)','porta da oficina (o laboratório)':'the workshop door (the lab)','o cais':'the pier',
 'Base da guilda':'Guild base','o Líder, um Vice ou um Oficial':'the Leader, a Deputy or an Officer',
 'beira de a fazenda':'edge of the farm','beira de a ilha do meio':'edge of the middle island','beira de a ilha leste':'edge of the east island','beira de o bosque':'edge of the grove',
 'beira de o platô':'edge of the plateau','beira de o degrau':'edge of the ledge','a arena do chefe do dia':"the daily boss's arena",'a chegada do chefe':"the boss's arrival",
 'o cais (a fazenda ↔ o bosque)':'the pier (farm ↔ grove)','a escada (o bosque ↔ o degrau)':'the stairs (grove ↔ ledge)','a ponte (a ilha do meio ↔ a ilha leste)':'the bridge (middle island ↔ east island)',
 'a escada (a ilha leste ↔ o platô)':'the stairs (east island ↔ plateau)','a escada (a ilha do meio ↔ o degrau)':'the stairs (middle island ↔ ledge)',
 'o laboratório (a oficina)':'the lab (workshop)','o prédio amarelo (a casa)':'the yellow building (home)','um monte de carvão':'a coal pile','uma pilha de troncos':'a log pile','uma árvore':'a tree','uma pedra':'a rock',
}
HELD = json.loads(sys.argv[1])
KEYS = {'nome','texto','descricao','quem','vem','porque','onde','titulo'}
miss = set()
def walk(v, k=None, path=''):
    if isinstance(v, dict):
        for kk in list(v):
            x = v[kk]
            if path.endswith('heldNomes') and isinstance(x, str) and HELD.get(kk): v[kk] = HELD[kk]; continue
            if isinstance(x, str) and (kk in KEYS or kk == 'tiposObstaculo'):
                if x in T: v[kk] = T[x]
                elif any(c in x for c in 'ãçéáíóúêõâà'): miss.add(x)
            else: walk(x, kk, path + '.' + kk)
    elif isinstance(v, list):
        for i, x in enumerate(v):
            if isinstance(x, str) and k == 'tiposObstaculo': v[i] = T.get(x, x)
            else: walk(x, k, path)
for f in ['public/data/guilda.json', 'public/data/colocacao.json']:
    raw = open(f, encoding='utf-8', newline='').read()
    d = json.loads(raw); walk(d)
    ind = 1 if raw.startswith('{\n "') else (2 if raw.startswith('{\n  "') else None)
    out = json.dumps(d, ensure_ascii=False, indent=ind)
    if '\r\n' in raw: out = out.replace('\n', '\r\n')
    open(f, 'w', encoding='utf-8', newline='').write(out + ('\r\n' if '\r\n' in raw else '\n'))
print('untranslated:', sorted(miss))
