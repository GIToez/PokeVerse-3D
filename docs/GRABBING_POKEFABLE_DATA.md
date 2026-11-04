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

## What has been grabbed

| Route | Saved as | Notes |
|---|---|---|
| `/conta/conteudo?l=en` | `upcoming/data/pokefable_story_ch1-2.json` | Only chapters 1–2 are unlocked for the account; chapters 3–21 come back `trancado` (locked) until the account progresses. Grab again after progressing. |

Not served by their site at all (their client falls back to nothing): `data/catalogo_efeitos.json`,
`data/missoes_v2.json`, `data/npcs_falas.json`, `data/skins_jogador.json`.
