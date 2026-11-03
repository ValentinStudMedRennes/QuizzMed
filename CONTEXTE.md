# QuizzMed : note de passation (à coller au début d'une nouvelle conversation avec Claude)

Site de QCM de révision, front-end pur, en français.
Dépôt : https://github.com/ValentinStudMedRennes/QuizzMed

Contenu du dépôt : `index.html`, `script.js`, `style.css`, `data/` (un JSON par cours, plus `data/themes.json`) et `cours/` (les PDF).
Le site est statique, sans framework ni build. Les données se chargent par `fetch` : il faut un serveur HTTP (GitHub Pages ou `python3 -m http.server`), pas `file://`.

> Mettre ce fichier à jour à chaque évolution notable (fonctions ajoutées, règles de filtrage, format des données).

---

## Règles de travail

- Claude ne peut pas pousser sur GitHub : il modifie les fichiers et les rend complets, l'utilisateur les remplace dans le dépôt.
- Partir de la version à jour : cloner le dépôt (`git clone --depth 1`) ou, à défaut, lire `script.js` en entier avant de le modifier.
- Le code est volontairement compact (une fonction par ligne ou presque, commentaires en français). Garder ce style.
- Modifier par remplacements ciblés avec des `assert` (la chaîne doit apparaître une seule fois) plutôt que réécrire le fichier.
- Après chaque changement : vérifier la syntaxe (`node -e "new Function(require('fs').readFileSync('script.js','utf8'))"`), puis tester dans un navigateur simulé (**jsdom**) sur les vraies données du dépôt (voir « Méthode de test »).
- À chaque livraison, **incrémenter `?v=N`** dans `index.html` (`style.css?v=` et `script.js?v=`), actuellement **16**, pour casser le cache.
- Ne rien implémenter qui n'a pas été demandé. En cas de choix de comportement, l'annoncer avant ou le dire clairement après.
- Messages à l'écran en français. L'interface doit rester utilisable sur téléphone (cibles tactiles d'au moins 44 px, thème clair et sombre via variables CSS).

## Format des données (`data/*.json`)

`data/themes.json` est la liste des fichiers à charger, par exemple `["cardio-physio-vo2.json", ...]`.
Chaque cours est un fichier :

```json
{
  "meta": {
    "theme": "Appareil respiratoire",
    "section": "Physiologie",
    "titre": "...",
    "description": "...",
    "cours": { "fichier": "cours/xxx.pdf" }
  },
  "chapitres": [
    {
      "meta": { "titre": "...", "cours": { } },
      "questions": [
        {
          "id": "...",
          "type": "qcm",
          "source": {
            "type": "annale",
            "references": [ { "sujet": "...", "discipline": "...", "annee": "2023-2024", "qcm": 2 } ]
          },
          "question": "...",
          "cours": { "page": 1, "surligner": "texte à surligner dans le PDF" },
          "bonnes":    [ { "reponse": "...", "explication": "...", "annale": true } ],
          "mauvaises": [ { "reponse": "...", "explication": "...", "annale": true } ]
        }
      ]
    }
  ]
}
```

- `source.type` vaut `annale` ou `generee` (les variantes « généré », « générée » sont reconnues). `references` n'existe que pour les annales.
- `meta.cours` d'un chapitre est facultatif : il remplace celui du fichier.
- Hiérarchie affichée : **thème > section > cours (un fichier JSON) > chapitre**. Les fichiers ayant le même `theme` (puis la même `section`) sont regroupés.
- État des données réelles : 80 annales (avec références), 254 questions « generee » (sans références) et 73 questions avec `"source": {}` (fichier `cardio-physio-mecahemo.json`), affichées comme « Non précisée ».
- Le champ `annale` sur chaque réponse existe dans les données, mais **l'interface ne l'utilise pas**. Ce choix est volontaire : l'affichage sur chaque proposition a été refusé, le tag sur la question suffit.

## Architecture de `script.js` (par ordre du fichier)

- **Chargement et normalisation** : `getJSON`, `ans`, `asCours` / `coursOf`, `parseSource` (normalise la clé d'origine : `annale`, `genere`, `inconnue` ou autre ; remplit l'ensemble des années et les libellés), `clean`, `parseFile` (chaque chapitre porte `fichier` = son PDF), `groupFiles`, `init`.
- **Filtres** : `passBy(q, skip)` applique l'origine (`srcFilter`), « tombée au moins N fois » (`minRefs`) et les années décochées (`yearsOff`). L'argument `skip` ignore un filtre, ce qui sert à compter les choix de chaque menu. `pass`, `qlist(c)`, `qcount(cs)` et `filtersOn()` en dérivent.
  - **Règle des années** : elle ne s'applique qu'aux questions qui ont des références. Une annale reste si au moins une de ses références tombe dans une année cochée. Les questions sans référence (générées, non précisées) ne sont jamais touchées.
  - Avec `minRefs` > 0, en revanche, les questions sans référence sont écartées (elles sont « tombées 0 fois »).
- **Accueil** : `row`, `renderTree`, `chipGroups`, `renderPanel`, `renderSrc` (menu d'origine, cases d'années, visibilité du bloc `#annset`), `updateStart`, `courseOf` (le PDF d'un groupe, seulement s'il est unique et couvre tous ses chapitres ; sinon pas de bouton « 📖 Cours »).
- **Lancement** : `launch`, `start` (tirage via `shuffle`, ou `wshuffle` pondéré 1 + 2 × nombre de références si `favor`), `build`, `quizLabel` et `filterLabel` (titre du quiz).
- **Quiz** : `renderNav`, `show`, `renderSource` (pastille d'origine et références), `validate`, `next`, `finish` (score, bilan « Par origine » dans `#bysrc`, questions ratées).
- **Volet cours (PDF)** : pdf.js chargé à la demande ; `openCourse` (pendant le quiz), `openCourseMenu` (depuis l'accueil, plein écran, indicateur `cmenu`, fermeture par × ou Échap), `placeCourse` (déplace `#course` entre `main` et `.qlayout`), `closeCourse`, `setBig`, `zoomBy`, `showPage`, surlignage via `matchSpans`.

## Fonctions déjà en place (ne pas les redemander)

- Pastille d'origine et références d'annales sur chaque question.
- Menu « Origine des questions » avec compteurs (toutes / annales / générées / non précisée).
- Filtres d'annales : cases à cocher par année avec « Toutes / Aucune », champ « Tombée au moins … fois ».
- Case « Favoriser les questions les plus souvent tombées » (tirage pondéré).
- Bilan par origine en fin de quiz (score annale / généré).
- Bouton « 📖 Cours » dès l'accueil, qui ouvre le PDF en plein écran.
- Message « Aucun QCM ne correspond à ces filtres » quand les filtres ne laissent rien.
- Les compteurs de tous les menus, de l'arbre, du bouton « Lancer le QCM » et des boutons « ▶ Lancer » tiennent compte des filtres actifs.

## Méthode de test (jsdom)

```bash
mkdir t && cd t
npm i jsdom
cp ../index.html ../script.js ../style.css .   # un par un, /bin/sh ne développe pas {a,b}
cp -r ../data .
```

`run.js` :

```js
const {JSDOM}=require("jsdom"),fs=require("fs");
const html=fs.readFileSync("index.html","utf8").replace(/<script src.*<\/script>/,"").replace(/<link.*>/,"");
const w=new JSDOM(html,{runScripts:"outside-only",pretendToBeVisual:true}).window;
w.fetch=async n=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(n,"utf8"))});
w.matchMedia=()=>({matches:true});
w.eval(fs.readFileSync("script.js","utf8"));
const $=id=>w.document.getElementById(id);
setTimeout(()=>{
  $("selall").click();
  console.log($("selinfo").textContent);
  // simuler ensuite : #srcsel (puis onchange), #yrlist input (puis onchange), #yrnone, #start, #finish, .crs
  // et afficher #selinfo, les options des menus, #curtheme, #bysrc
},400);
```

## Pièges connus

- Les IDs HTML utilisés par le script (`#srcsel`, `#annset`, `#yrlist`, `#yrall`, `#yrnone`, `#minref`, `#favor`, `#bysrc`, `#qsrc`, `#course`, etc.) doivent exister dans `index.html`, sinon `$()` renvoie `null` et le script plante.
- Dans la grille mobile de `.item`, la règle `.crs` (bouton cours) doit rester déclarée **après** `.play` dans le CSS, car les deux partagent la classe de base.
- Dans le JSON, échapper les guillemets doubles à l'intérieur des textes.
- `/bin/sh` ne développe pas `{a,b}` : copier les fichiers un par un.
