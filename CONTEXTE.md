# QuizzMed : note de passation (à coller au début d'une nouvelle conversation avec Claude)

Site de QCM de révision, front-end pur, en français.
Dépôt : https://github.com/ValentinStudMedRennes/QuizzMed

Contenu du dépôt : `index.html`, `script.js`, `style.css`, `data/` (un JSON par cours, sous-dossiers permis), `cours/` (les PDF, sous-dossiers permis : `cours/cardio/`, `cours/pneumo/`…), `genindex.py`, `serve.py`, `diag.py`, `.gitignore`, `.github/workflows/deploy.yml`, `programme/` (un JSON par UE : les cours prévus au planning), `README.md` (tutoriel) et les fichiers d'instructions (`instructions-cours-v….md`, `instructions-qcm-v….md`, `instructions-programme-v….md`).
Le site est statique, sans framework. Les données se chargent par `fetch` : il faut GitHub Pages ou, en local, `python3 serve.py` (pas `python3 -m http.server`, qui ne fabrique pas l'index, ni `file://`).

### Index et déploiement

- **Un seul mécanisme : l'index.** Un site statique ne peut pas lister un dossier ; `index.json` dit au site quels fichiers existent : tous les PDF de `cours/`, tous les JSON de `data/`, ceux de `programme/`, et la version de chaque cours. Sans lui, le site affiche une erreur (il n'y a plus de mode de secours ni de `themes.json`).
- **Déploiement automatique** : l'Action `.github/workflows/deploy.yml` installe `pypdf` puis lance `genindex.py` à chaque push sur `main`, puis déploie GitHub Pages (réglage Settings › Pages › Source : « GitHub Actions »). Un workflow placé ailleurs que dans `.github/workflows/` est ignoré par GitHub.
- **`index.json` n'est jamais dans le dépôt** (`.gitignore`) : il est toujours fabriqué à la demande, donc jamais périmé. En ligne, l'Action l'écrit dans le site publié à chaque push. En local, `python3 serve.py` (port 8000, ou `python3 serve.py 8080`) le fabrique à chaque chargement de la page sans rien écrire sur le disque, avec un cache des versions (seuls les PDF modifiés sont relus) et `Cache-Control: no-store`.
- `genindex.py` : `construire()` (les listes), `construire_tout(cache)` (listes + clé `versions` : chemin de chaque PDF de cours hors résumés → `"4.1"`, ou `null`), `avertissements()` (pypdf absent, PDF en double), `num()`, `version_pdf()`. Lancé seul, il écrit `index.json` (c'est ce que fait l'Action). `serve.py` et `diag.py` l'importent. Sans `pypdf` : avertissement et versions à `null`.
- **`diag.py`** (local, nécessite `pip install pypdf`) : une ligne par cours avec `Cours | v. cours | v. résumé | v. QCM | Avertissements`. Avertissement si une version manque ou si résumé / QCM ≠ cours (« version majeure, renvois à revérifier » quand le premier chiffre diffère) ; aussi : aucun QCM, PDF introuvable ou en double, résumé sans cours, JSON illisible. Il parcourt `cours/` et `data/` directement, sans `index.json`.
- **Versions** : celle de référence est **la version du cours** (PDF) : métadonnée « Keywords » (ex. « prompt v4.1 »), sinon en-tête de la 1re page (« Version du prompt v4.1 »). Le JSON porte dans **`meta.version`** la version du cours dont le QCM est tiré (`"4.1"`, `"v4.1"` ou `"prompt v4.1"`), ignorée par le site. Comparaison numérique (4.10 > 4.9, 4.1 = 4.1.0).
- **Programme** : `programme/ueNN-….json` liste les cours prévus au planning d'une UE (une entrée par cours, pas par créneau). Fichiers produits par une conversation Claude à part, selon `instructions-programme-v1.2.md` (lecture du planning PDF, règles de regroupement, format). Pas dans `data/`, sinon le site les prendrait pour des QCM.
- **Résumés** : `cours/…/X-resume.pdf` est le résumé du cours `X.pdf` (même nom + `-resume`, dossier libre). Ils figurent dans l'index mais **le site ne les utilise pas** pour l'instant.

> Mettre ce fichier à jour à chaque évolution notable (fonctions ajoutées, règles de filtrage, format des données).

### Fichiers d'instructions et tutoriel (`README.md`)

- `instructions-cours-v4_3.md` : consignes de la conversation « cours » (diapositives + notes → résumé et fichier 2). `instructions-qcm-v1.4.md` : consignes de la conversation « QCM » (fichier 2 + annales → JSON), avec un script de contrôle obligatoire (`meta.version` = version du PDF, `meta.cours.fichier` sans dossier) dont la sortie doit finir par « CONTRÔLE OK ». `instructions-programme-v1.2.md` : planning d'UE → `programme/`, et rattachement d'un nouveau PDF (§ 5). La version figure dans le nom du fichier et dans le « Journal des versions » en fin de fichier (aussi en 1re ligne pour le cours).
- `README.md` est le tutoriel pour ajouter un cours : deux conversations Claude, dépôt des fichiers, puis étape 4 (nom du PDF dans `fichiers` du programme de l'UE, à la main ou avec Claude). Il cite les fichiers d'instructions **par leur nom complet, version comprise** (tableau « Ce qu'il faut », étapes 1 et 2, messages types).
- Le README contient deux schémas Mermaid (blocs ```` ```mermaid ````, affichés par GitHub) qui citent eux aussi les noms des fichiers d'instructions.
- **Vérification par Claude, à chaque conversation sur le dépôt** (juste après le clone) : lancer les deux commandes ci-dessous. Si un nom ou une version ne correspond pas, corriger `README.md` (texte, messages types, schémas, et le rappel « son numéro (v4.3, v1.4) ») et le livrer avec les autres fichiers. Même chose après tout changement qui touche l'ajout d'un cours (dossiers, déploiement, format des données). Rien d'automatique : ni `diag.py` ni l'Action ne font ce contrôle, c'est voulu.

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
- À chaque livraison, **incrémenter `?v=N`** dans `index.html` (`style.css?v=` et `script.js?v=`), actuellement **20**, pour casser le cache.
- Ne rien implémenter qui n'a pas été demandé. En cas de choix de comportement, l'annoncer avant ou le dire clairement après.
- Messages à l'écran en français. L'interface doit rester utilisable sur téléphone (cibles tactiles d'au moins 44 px, thème clair et sombre via variables CSS).

## Format des données (`data/*.json`)

Chaque cours est un fichier de `data/` (tous sont chargés, par ordre alphabétique de chemin) :

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
- **`fichier` est un simple nom de PDF, sans dossier.** Le site retrouve son chemin grâce à `index.json`, où que le PDF soit rangé dans `cours/`. Deux PDF de même nom dans deux dossiers : erreur affichée, pas de lien vers le cours. Un `fichier` contenant `/` est utilisé tel quel.
- Hiérarchie affichée : **thème > section > cours (un fichier JSON) > chapitre**. Les fichiers ayant le même `theme` (puis la même `section`) sont regroupés.
- État des données réelles : 80 annales (avec références), 254 questions « generee » (sans références) et 73 questions avec `"source": {}` (fichier `cardio-physio-mecahemo.json`), affichées comme « Non précisée ».
- Le champ `annale` sur chaque réponse existe dans les données, mais **l'interface ne l'utilise pas**. Ce choix est volontaire : l'affichage sur chaque proposition a été refusé, le tag sur la question suffit.

## Architecture de `script.js` (par ordre du fichier)

- **Chargement et normalisation** : `getJSON(chemin, facultatif)`, `pdfPath` (nom de PDF → chemin via l'index `pdfByName`, avertissements dans `pathWarns`), `ans`, `asCours` / `coursOf`, `parseSource` (normalise la clé d'origine : `annale`, `genere`, `inconnue` ou autre ; remplit l'ensemble des années et les libellés), `clean`, `parseFile` (chaque chapitre porte `fichier` = son PDF), `groupFiles`, `init` (charge `index.json`, obligatoire, puis les programmes et tous les JSON de `data/`).
- **Filtres** : `passBy(q, skip)` applique l'origine (`srcFilter`), « tombée au moins N fois » (`minRefs`) et les années décochées (`yearsOff`). L'argument `skip` ignore un filtre, ce qui sert à compter les choix de chaque menu. `pass`, `qlist(c)`, `qcount(cs)` et `filtersOn()` en dérivent.
  - **Règle des années** : elle ne s'applique qu'aux questions qui ont des références. Une annale reste si au moins une de ses références tombe dans une année cochée. Les questions sans référence (générées, non précisées) ne sont jamais touchées.
  - Avec `minRefs` > 0, en revanche, les questions sans référence sont écartées (elles sont « tombées 0 fois »).
- **Programme** : `parseProg`, `progState` (calcule `ok` et `manque` pour chaque cours), `renderProg` (tableau Matière | Cours | État, un `tbody` par UE, matière en `rowspan`), `openProg` / `closeProg` (volet `#prog` à gauche, fond `#progbg`, fermeture par ×, clic sur le fond ou Échap), `showProgBtn` (bouton `#progbtn` sur l'accueil seulement, caché pendant le quiz et sans programme).
  - **Règle d'état** : ✓ « à jour » si `fichiers` n'est pas vide et que chaque PDF cité est rattaché à un chapitre chargé (donc présent dans `cours/` avec un QCM). Sinon ✗. Les versions ne comptent pas.
  - Colonnes « v. cours » (version du PDF, prise dans `index.json` › `versions`, map `pdfVer`) et « v. QCM » (`meta.version` du JSON, gardée sur chaque chapitre dans `version`), une sous-ligne par PDF quand un cours en a plusieurs. « — » absent, « v? » non indiquée, « ⚠ » si QCM ≠ cours (comparaison `vnum` / `veq` comme `diag.py`, 4.1 = 4.1.0 ; info-bulle « version majeure » si le 1er chiffre diffère). La version n'entre pas dans la règle ✓ / ✗.
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
- Volet « 📋 Programme des cours » (bouton sur l'accueil) : tableau des cours prévus par UE avec versions du cours et du QCM, ✓ / ✗ et le total « k / n à jour ».
- Les compteurs de tous les menus, de l'arbre, du bouton « Lancer le QCM » et des boutons « ▶ Lancer » tiennent compte des filtres actifs.

## Méthode de test (jsdom)

```bash
mkdir t && cd t
npm i jsdom
cp ../index.html ../script.js ../style.css .   # un par un, /bin/sh ne développe pas {a,b}
cp -r ../data ../cours ../programme ../genindex.py .
python3 genindex.py
```

`run.js` :

```js
const {JSDOM}=require("jsdom"),fs=require("fs");
const html=fs.readFileSync("index.html","utf8").replace(/<script src.*<\/script>/,"").replace(/<link.*>/,"");
const w=new JSDOM(html,{runScripts:"outside-only",pretendToBeVisual:true}).window;
w.fetch=async n=>fs.existsSync(n)?{ok:true,json:async()=>JSON.parse(fs.readFileSync(n,"utf8"))}:{ok:false,status:404};   // un fichier absent doit renvoyer 404, pas planter
w.matchMedia=()=>({matches:true});
w.eval(fs.readFileSync("script.js","utf8"));
const $=id=>w.document.getElementById(id);
setTimeout(()=>{
  $("selall").click();
  console.log($("selinfo").textContent);
  // simuler ensuite : #progbtn (puis lire #progbody tbody tr), #srcsel (puis onchange), #yrlist input (puis onchange), #yrnone, #start, #finish, .crs
  // et afficher #selinfo, les options des menus, #curtheme, #bysrc
},400);
```

## Pièges connus

- Pour tester à travers le vrai `serve.py`, le lancer depuis un script Python (`subprocess.Popen`, puis `kill`) et faire `w.fetch=n=>fetch("http://localhost:PORT/"+n)`. Ne pas utiliser `pkill -f serve.py` dans bash : la commande se tue elle-même.

- Les IDs HTML utilisés par le script (`#srcsel`, `#annset`, `#yrlist`, `#yrall`, `#yrnone`, `#minref`, `#favor`, `#bysrc`, `#qsrc`, `#course`, etc.) doivent exister dans `index.html`, sinon `$()` renvoie `null` et le script plante.
- Dans la grille mobile de `.item`, la règle `.crs` (bouton cours) doit rester déclarée **après** `.play` dans le CSS, car les deux partagent la classe de base.
- Dans le JSON, échapper les guillemets doubles à l'intérieur des textes.
- `/bin/sh` ne développe pas `{a,b}` : copier les fichiers un par un.
- Pour lire une variable `let` du script dans jsdom (ex. `themes`), l'exposer : `w.eval(script+"\nwindow.__t=()=>themes;")`.
- Les noms des fichiers d'instructions n'ont pas la même forme (`v4_3` avec tiret bas, `v1.4` avec point) : recopier le nom exact dans le README.
- Si le site en ligne ne voit pas un nouveau PDF ou cours : vérifier que l'Action « Déploiement » a réussi (onglet Actions).
