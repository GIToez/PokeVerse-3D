# Grabbing data from PokeFable's server

Some PokeFable content is not a plain file on their site: their game server only hands it to a
logged-in player. Opening the address directly fails (401) because the request carries no login.

The workaround is a bookmarklet run from a logged-in PokeFable tab. It reuses the login token the
game keeps in `localStorage['conta.token']` and saves the reply as a file.

1. Log in at `pokefableonline.com` and let the game load.
2. Save a bookmark whose address is the line below (change the path and the file name per grab).
3. With the game tab open, run the bookmark (on a phone: type its name in the address bar and tap it).

```
javascript:fetch('/servidor/conta/conteudo?l=en',{headers:{Authorization:'Bearer '+localStorage.getItem('conta.token')}}).then(r=>r.ok?r.blob():Promise.reject(r.status)).then(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='missions.json';a.click()}).catch(e=>alert('Failed: '+e))
```

The server base is `https://pokefableonline.com/servidor` (see `baseHttp` in `upcoming/account.mjs`).
Routes the client calls, all under `/conta/`: `conteudo` (story, side quests, NPC lines, translations),
`estado`, `config`, `passe`, `personagem`, `idioma`, `nome`, `email`, `senha`, `termos`, `relato`.

Several routes in one file (Battle Pass season with its challenges, shop catalog, shop state):

```
javascript:(async()=>{const h={Authorization:'Bearer '+localStorage.getItem('conta.token')};const o={};for(const p of ['/temporada','/loja/catalogo?l=en','/loja']){try{const r=await fetch('/servidor'+p,{headers:h});o[p]={status:r.status,data:r.ok?await r.json():await r.text()}}catch(e){o[p]={erro:String(e)}}}const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(o)],{type:'application/json'}));a.download='shop_pass.json';a.click()})()
```

Other HTTP routes their client calls: `/temporada` (Battle Pass), `/loja`, `/loja/catalogo?l=`, `/loja/checkout` (POST, real money),
`/ranking/eu`. The Battle Pass actions (`ver`, `pegar`) go over the WebSocket as `{ t: 'temporada', op }`.

## What has been grabbed

| Route | Saved as | Notes |
|---|---|---|
| `/conta/conteudo?l=en` | `upcoming/data/pokefable_story_ch1-2.json` | Only chapters 1–2 are unlocked for the account; chapters 3–21 come back `trancado` (locked) until the account progresses. Grab again after progressing. |

Not served by their site at all (their client falls back to nothing): `data/catalogo_efeitos.json`,
`data/missoes_v2.json`, `data/npcs_falas.json`, `data/skins_jogador.json`.
| `/temporada`, `/loja`, `/loja/catalogo?l=en` | `upcoming/data/pokefable_shop_pass.json` | Battle Pass season 1 (missions, reward tracks, prices), shop packs and founder packs, 68 cosmetic pieces. Their Stripe key is stripped. |
