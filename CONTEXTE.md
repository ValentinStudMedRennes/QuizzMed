# QuizzMed : note de passation (à coller au début d'une nouvelle conversation avec Claude)

Site de QCM de révision, front-end pur, en français.
Dépôt : https://github.com/ValentinStudMedRennes/QuizzMed

Contenu du dépôt : `index.html`, `script.js`, `style.css`, `data/` (un JSON par cours, sous-dossiers permis, plus `data/themes.json` facultatif), `cours/` (les PDF, sous-dossiers permis : `cours/cardio/`, `cours/pneumo/`…), `genindex.py`, `diag.py`, `.github/workflows/deploy.yml`, `README.md` (tutoriel) et les deux fichiers d'instructions (`instructions-cours-v….md`, `instructions-qcm-v….md`).
Le site est statique, sans framework. Les données se chargent par `fetch` : il faut un serveur HTTP (GitHub Pages ou `python3 -m http.server`), pas `file://`.

### Index et déploiement

- `genindex.py` écrit `index.json` : la liste de tous les PDF de `cours/` et de tous les JSON de `data/`. Le site s'en sert pour retrouver un PDF à partir de son seul nom.
- **Déploiement automatique** : l'Action `.github/workflows/deploy.yml` lance `genindex.py` à chaque push sur `main`, puis déploie GitHub Pages (réglage Settings › Pages › Source : « GitHub Actions »). Un workflow placé ailleurs que dans `.github/workflows/` est ignoré par GitHub.
- `index.json` est aussi versionné dans le dépôt, pour les tests locaux ; l'Action le régénère et l'écrase au déploiement. En local, lancer `python3 genindex.py` avant `python3 -m http.server`.
- `genindex.py` ne fait que l'index (plus un avertissement si deux PDF portent le même nom). Il expose `lister()` et `construire()`, réutilisés par `diag.py`.
- **`diag.py`** (local, nécessite `pip install pypdf`) : une ligne par cours avec `Cours | v. cours | v. résumé | v. QCM | Avertissements`. Avertissement si une version manque ou si résumé / QCM ≠ cours (« version majeure, renvois à revérifier » quand le premier chiffre diffère) ; aussi : aucun QCM, PDF introuvable ou en double, résumé sans cours, JSON illisible. Il parcourt `cours/` et `data/` directement, sans `index.json`.
- **Versions** : celle de référence est **la version du cours** (PDF) : métadonnée « Keywords » (ex. « prompt v4.1 »), sinon en-tête de la 1re page (« Version du prompt v4.1 »). Le JSON porte dans **`meta.version`** la version du cours dont le QCM est tiré (`"4.1"`, `"v4.1"` ou `"prompt v4.1"`), ignorée par le site. Comparaison numérique (4.10 > 4.9, 4.1 = 4.1.0).
- **Résumés** : `cours/…/X-resume.pdf` est le résumé du cours `X.pdf` (même nom + `-resume`, dossier libre). Ils figurent dans `index.json` mais **le site ne les utilise pas** pour l'instant.

> Mettre ce fichier à jour à chaque évolution notable (fonctions ajoutées, règles de filtrage, format des données).

### Fichiers d'instructions et tutoriel (`README.md`)

- `instructions-cours-v4_3.md` : consignes de la conversation « cours » (diapositives + notes → résumé et fichier 2). `instructions-qcm-v1.3.md` : consignes de la conversation « QCM » (fichier 2 + annales → JSON). La version figure dans le nom du fichier et dans le « Journal des versions » en fin de fichier (aussi en 1re ligne pour le cours).
- `README.md` est le tutoriel pour ajouter un cours : deux conversations Claude, puis dépôt des fichiers. Il cite les fichiers d'instructions **par leur nom complet, version comprise** (tableau « Ce qu'il faut », étapes 1 et 2, messages types).
- Le README contient deux schémas Mermaid (blocs ```` ```mermaid ````, affichés par GitHub) qui citent eux aussi les noms des fichiers d'instructions.
- **Vérification par Claude, à chaque conversation sur le dépôt** (juste après le clone) : lancer les deux commandes ci-dessous. Si un nom ou une version ne correspond pas, corriger `README.md` (texte, messages types, schémas, et le rappel « son numéro (v4.3, v1.3) ») et le livrer avec les autres fichiers. Même chose après tout changement qui touche l'ajout d'un cours (dossiers, déploiement, format des données). Rien d'automatique : ni `diag.py` ni l'Action ne font ce contrôle, c'est voulu.

```bash
for n in $(grep -oE 'instructions-[a-z]+-v[0-9._]*[0-9]\.md' README.md | sort -u); do [ -f "$n" ] || echo "README cite $n, absent du dépôt"; done
for f in instructions-*.md; do echo "$f : journal $(grep -oE '^- v?[0-9]+\.[0-9]+ \(' "$f" | grep -oE '[0-9]+\.[0-9]+' | sort -V | tail -1)"; done
```

  La 1re commande ne doit rien afficher. La 2e doit donner, pour chaque fichier, la version de son nom (dernière entrée du journal).
  Après une modification des schémas, vérifier leur syntaxe avec le paquet npm `mermaid` (fonction `parse`, sous jsdom).

---

## Règles de travail

- Claude ne peut pas pousser sur GitHub : il modifie les fichiers et les rend complets, l'utilisateur les remplace dans le dépôt.
- Partir de la version à jour : cloner le dépôt (`git clone --depth 1`) ou, à défaut, lire `script.js` en entier avant de le modifier.
- Le code est volontairement compact (une fonction par ligne ou presque, commentaires en français). Garder ce style.
- Modifier par remplacements ciblés avec des `assert` (la chaîne doit apparaître une seule fois) plutôt que réécrire le fichier.
- Après chaque changement : vérifier la syntaxe (`node -e "new Function(require('fs').readFileSync('script.js','utf8'))"`), puis tester dans un navigateur simulé (**jsdom**) sur les vraies données du dépôt (voir « Méthode de test »).
- À chaque livraison, **incrémenter `?v=N`** dans `index.html` (`style.css?v=` et `script.js?v=`), actuellement **17**, pour casser le cache.
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
    "version": "4.1",
    "cours": { "fichier": "xxx.pdf" }
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
- **`fichier` est un simple nom de PDF, sans dossier.** Le site retrouve son chemin grâce à `index.json`, où que le PDF soit rangé dans `cours/`. Deux PDF de même nom dans deux dossiers : erreur affichée, pas de lien vers le cours. Un `fichier` contenant `/` est utilisé tel quel (ancien format, toujours accepté).
- Avec `index.json`, tous les JSON de `data/` sont chargés. `data/themes.json` (liste de noms) ne sert plus qu'à l'ordre d'affichage ; les cours absents de la liste viennent après, par ordre alphabétique de chemin. Sans `index.json`, ancien fonctionnement (liste `themes.json`, PDF cherchés dans `cours/` à plat) avec un avertissement.
- Hiérarchie affichée : **thème > section > cours (un fichier JSON) > chapitre**. Les fichiers ayant le même `theme` (puis la même `section`) sont regroupés.
- État des données réelles : 80 annales (avec références), 254 questions « generee » (sans références) et 73 questions avec `"source": {}` (fichier `cardio-physio-mecahemo.json`), affichées comme « Non précisée ».
- Le champ `annale` sur chaque réponse existe dans les données, mais **l'interface ne l'utilise pas**. Ce choix est volontaire : l'affichage sur chaque proposition a été refusé, le tag sur la question suffit.

## Architecture de `script.js` (par ordre du fichier)

- **Chargement et normalisation** : `getJSON(chemin, facultatif)`, `pdfPath` (nom de PDF → chemin via l'index `pdfByName`, avertissements dans `pathWarns`), `ans`, `asCours` / `coursOf`, `parseSource` (normalise la clé d'origine : `annale`, `genere`, `inconnue` ou autre ; remplit l'ensemble des années et les libellés), `clean`, `parseFile` (chaque chapitre porte `fichier` = son PDF), `groupFiles`, `init` (charge `index.json`, sinon se replie sur `themes.json`).
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
cp -r ../data ../cours ../genindex.py .
python3 genindex.py
```

`run.js` :

```js
const {JSDOM}=require("jsdom"),fs=require("fs");
const html=fs.readFileSync("index.html","utf8").replace(/<script src.*<\/script>/,"").replace(/<link.*>/,"");
const w=new JSDOM(html,{runScripts:"outside-only",pretendToBeVisual:true}).window;
w.fetch=async n=>fs.existsSync(n)?{ok:true,json:async()=>JSON.parse(fs.readFileSync(n,"utf8"))}:{ok:false,status:404};   // les fichiers facultatifs (index.json, themes.json) doivent pouvoir manquer
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
- Pour lire une variable `let` du script dans jsdom (ex. `themes`), l'exposer : `w.eval(script+"\nwindow.__t=()=>themes;")`.
- Les noms des fichiers d'instructions n'ont pas la même forme (`v4_3` avec tiret bas, `v1.3` avec point) : recopier le nom exact dans le README.
- Si le site en ligne ne voit pas un nouveau PDF ou cours : vérifier que l'Action « Déploiement » a réussi (onglet Actions).
