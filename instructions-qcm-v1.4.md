Tu vas m'aider à réviser mes cours de médecine (PASS/LAS, 2e année) en générant des QCM
au format JSON à partir des fichiers que je t'envoie.

## Fichiers fournis
- La version complète retravaillée du cours (PDF), dite « fichier 2 ». C'est la source
  principale, et c'est ce PDF que le site affiche : les questions y renvoient par page.
  Il porte un numéro de version au format "MAJEUR.MINEUR" (voir « Journal des
  versions »).
- Éventuellement, le livret d'annales (ou un extrait). Il est rangé par UE (« Sujet
  Appareil respiratoire 2024-2025 », « Sujet de Cardiologie »…) et, à l'intérieur de
  chaque sujet, par discipline (physiologie, histologie, sémiologie, biochimie,
  anatomie…). La discipline n'est pas indiquée toutes les années.

## Thème, section et cours
Chaque cours correspond à UN fichier JSON. Je t'indique au début de mon message :
« Thème : … — Section : … — Cours : … »
(ex : « Thème : Appareil cardio-vasculaire — Section : Physiologie — Cours : VO2 »).
- "theme" : le grand thème, qui regroupe plusieurs cours.
- "section" : la discipline ou le type de cours (Embryologie, Histologie, Physiologie,
  Anatomie, Sémiologie…).
- "cours" : un nom court qui distingue ce cours des autres cours du même thème et de
  la même section.
- Écris le thème exactement comme je te l'ai donné (mêmes accents, même apostrophe) :
  le site regroupe les fichiers qui ont le même thème.
- Si je ne te l'ai pas indiqué, déduis-les du PDF et dis-moi à la fin ce que tu as choisi.

## Nom de base
Le PDF du cours et le JSON partagent le même nom de base "<thème>-<section>-<cours>",
en abréviations courtes, en minuscules, sans accents ni espaces (ex : cardio-physio-vo2).
Reprends le nom du PDF fourni s'il suit déjà cette forme.
- Fichier JSON : "<nom de base>.json".
- "meta.cours.fichier" : le simple nom du PDF, "<nom de base>.pdf", SANS AUCUN DOSSIER
  (jamais "cours/…", "cours/cardio/…" ni "./…"). Le site retrouve lui-même le dossier
  où le PDF est rangé ; un nom qui contient "/" est pris pour un chemin complet et le
  lien vers le cours ne marche plus.
- Ids des questions : "<nom de base>-001", "-002", etc.
- Si je te demande de mettre à jour un JSON existant :
  - conserve les ids des questions qui existent toujours ; numérote les nouvelles
    questions à la suite ;
  - remplace "meta.version" par la version du cours retravaillé fourni ;
  - si la version MAJEURE du cours a changé depuis celle inscrite dans le JSON,
    revérifie un par un tous les renvois "cours" (page et extrait), car la pagination
    a pu changer ; si seule la version MINEURE a changé, la vérification par script
    habituelle suffit.

## Étiquettes du cours retravaillé
Le cours contient des étiquettes écrites. Respecte-les pour les questions générées :
- [Hors cours] et [Non abordé cette année] : ne génère aucune question dessus.
- [Incertain] : n'utilise pas l'information, ni comme bonne ni comme mauvaise réponse.
- [Correction] : utilise la version corrigée. L'erreur des notes peut servir de piège.
- [Insistance du professeur] et [Dit à l'oral] : priorité, couvre-les systématiquement.
- Si le cours signale un écart entre la version du professeur et celle des sources,
  ne fais pas de question sur ce point précis.
- Les valeurs que le professeur dit de ne pas apprendre : pas de question sur la valeur
  exacte, seulement sur l'ordre de grandeur.
Exception : un item d'annale qui porte sur une notion étiquetée [Hors cours] est
conservé (voir « Livret d'annales »), avec le tag "hors_cours".

## Format de sortie
Un fichier .json contenant UN objet avec des métadonnées et des chapitres, exactement
sous cette forme :

{
  "meta": {
    "theme": "Appareil respiratoire",
    "section": "Histologie",
    "titre": "Histologie de l'appareil respiratoire",
    "description": "Une phrase qui résume le cours.",
    "version": "1.2",
    "cours": { "fichier": "respi-histoembryo-histo.pdf" }
  },
  "chapitres": [
    {
      "meta": { "titre": "Le rhinopharynx et le larynx" },
      "questions": [
        {
          "id": "respi-histoembryo-histo-013",
          "type": "qcm",
          "source": {
            "type": "annale",
            "references": [
              { "sujet": "Appareil respiratoire", "discipline": "Histologie-Embryologie",
                "annee": "2024-2025", "qcm": 5 },
              { "sujet": "Appareil respiratoire", "discipline": "Histologie-Embryologie",
                "annee": "2018-2019", "qcm": 3 }
            ]
          },
          "question": "Concernant le larynx, quelles propositions sont exactes ?",
          "cours": { "page": 3, "surligner": "Le larynx est l'organe de la phonation" },
          "bonnes": [
            { "reponse": "C'est l'organe de la phonation.", "annale": true,
              "explication": "Description du cours. (réponse déduite du cours)" },
            { "reponse": "L'épiglotte ferme l'orifice du larynx lors de la déglutition.",
              "annale": true, "hors_cours": true,
              "explication": "Notion du cours d'anatomie. (hors cours : notion non abordée dans ce cours, réponse issue des connaissances générales)" },
            { "reponse": "Lors de la phonation, la glotte est fermée.",
              "annale": true, "a_verifier": true,
              "explication": "Les cordes vocales se rapprochent et vibrent. (à vérifier : réponse non trouvée dans le cours ni confirmée par une source fiable)" },
            { "reponse": "Les cordes vocales sont formées de fibres élastiques et de muscle strié.",
              "explication": "Description du cours." }
          ],
          "mauvaises": [
            { "reponse": "Ses muscles sont de type lisse.", "annale": true,
              "explication": "Ils sont striés. (réponse déduite du cours)" }
          ]
        },
        {
          "id": "respi-histoembryo-histo-012",
          "type": "qcm",
          "source": { "type": "generee" },
          "question": "Concernant le rhinopharynx, quelles propositions sont exactes ?",
          "cours": { "page": 3, "surligner": "qui forme l'amygdale pharyngée" },
          "bonnes": [ { "reponse": "…", "explication": "…" } ],
          "mauvaises": [ { "reponse": "…", "explication": "…" } ]
        }
      ]
    }
  ]
}

Règles de structure :
- "meta.titre" : le titre du cours. Il s'affiche sur le site pour distinguer les cours
  d'une même section : il doit être explicite. "meta.description" : une phrase.
- "meta.version" : la version du cours retravaillé (fichier 2) à partir duquel le JSON
  a été produit, en texte au format "MAJEUR.MINEUR" (ex : "1.1", jamais le nombre 1.1).
  Prends-la sur le PDF (page de titre, en-tête ou pied de page) ou dans mon message.
  Si tu ne la trouves pas, demande-la-moi : ne l'invente jamais. Ordre des champs de
  "meta" : theme, section, titre, description, version, cours.
- Un chapitre par grande partie du cours, dans l'ordre du cours. Le titre du chapitre
  reprend celui du cours (court, sans numérotation inutile).
- Ordre des champs d'une question : id, type, source, question, cours, bonnes,
  mauvaises.
- "type" : toujours "qcm" pour l'instant.
- "source" : obligatoire (voir « Origine des questions »).
- Chaque question a une ou plusieurs bonnes réponses et au moins 5 mauvaises réponses
  (5 à 7 en général pour une question générée), chacune avec une explication courte
  qui dit pourquoi c'est vrai ou faux.
- Toutes les réponses sont des objets { "reponse": "...", "explication": "..." } avec
  "reponse" en texte (jamais un nombre brut ni un objet imbriqué), et éventuellement
  les tags "annale", "hors_cours", "a_verifier" (placés entre "reponse" et
  "explication").

## Origine des questions
Chaque question porte un champ "source" :
- { "type": "generee" } : question créée à partir du cours seul. Aucune de ses
  propositions ne porte de tag.
- { "type": "annale", "references": [ … ] } : question qui reprend un QCM d'annale
  (voir « Livret d'annales »). Chaque référence contient :
  - "sujet" : l'UE telle qu'elle figure dans le livret (ex : "Appareil respiratoire",
    "Cardiologie") ;
  - "discipline" : la discipline du QCM dans le sujet (ex : "Physiologie",
    "Histologie-Embryologie", "Sémiologie"), indiquée par le livret ou déduite du
    thème quand le livret ne la précise pas ;
  - "annee" : l'année universitaire, au format "2024-2025" ;
  - "session" : 1 ou 2 si le livret le précise, sinon omets le champ ;
  - "qcm" : le numéro du QCM dans le sujet (nombre entier).
  Classe les références de la plus récente à la plus ancienne.

Tags des propositions :
- "annale": true : la proposition reprend un item d'annale (même reformulé).
- "hors_cours": true (toujours avec "annale": true) : la notion n'est pas abordée
  dans ce cours, mais la réponse est sûre. Explication terminée par « (hors cours :
  notion non abordée dans ce cours, réponse issue des connaissances générales) ».
- "a_verifier": true (toujours avec "annale": true) : la réponse n'a été trouvée ni
  dans le cours ni dans une source fiable. Place la proposition selon ta meilleure
  estimation et termine l'explication par « (à vérifier : réponse non trouvée dans le
  cours ni confirmée par une source fiable) ».
- Un item d'annale dont la réponse se déduit du cours porte seulement "annale": true,
  avec une explication terminée par « (réponse déduite du cours) », sauf si le livret
  fournit la correction officielle.
- Les propositions ajoutées à partir du cours ne portent aucun tag.

## Renvoi au cours (champ "cours" de chaque question)
Chaque question contient un champ "cours" qui renvoie au passage du PDF où la notion
est expliquée. Le site affiche ce PDF avec pdf.js et surligne le passage.
- "page" : numéro de la page dans le fichier PDF, en commençant à 1 (et non le numéro
  imprimé en bas de page). Nombre entier.
- "surligner" : un extrait COPIÉ À L'IDENTIQUE du texte de cette page, de 3 à 10 mots,
  qui résume la notion testée.
  - Extrait unique sur la page, jamais à cheval sur deux pages.
  - Évite les extraits qui commencent ou finissent par un chiffre ou un symbole seul.
- Pour une question de synthèse ou une question d'annale qui couvre plusieurs pages,
  choisis le passage le plus important.
- Méthode : extrais le texte du PDF page par page (pdftotext -f N -l N), choisis
  l'extrait dans ce texte, ne le reformule jamais.

## Particularités de mon site (important)
Le site tire au hasard 5 propositions parmi les bonnes et les mauvaises, et les
mélange. Donc :
- Chaque proposition doit être vraie ou fausse toute seule, sans dépendre des autres
  ni de l'énoncé. Complète-la si besoin (« Diastolique » devient « Le souffle de
  l'insuffisance aortique est diastolique. »).
  Interdit : « A et B », « Toutes les réponses », « Aucune de ces propositions »,
  « Les deux premières », « Les propositions ci-dessus ».
- N'écris jamais « Toutes les réponses précédentes sont fausses » : le site l'ajoute
  lui-même.
- Pas de réponse en double dans une même question.
- Le sens de "bonnes" doit toujours correspondre à l'énoncé : si la question demande
  les propositions fausses, ce sont elles qu'on met dans "bonnes".

## Contenu des questions générées
- Couvre tout le cours, partie par partie (définitions, seuils chiffrés,
  classifications, mécanismes, signes cliniques, conduites à tenir). Chaque notion
  importante doit être testée au moins une fois, par une question générée ou par une
  question d'annale. Ne crée pas de questions redondantes pour gonfler le nombre.
- Chaque chapitre compte au moins 5 questions (générées et annales confondues) ;
  sinon, complète-le avec des questions de synthèse (chiffres clés, comparaisons,
  « à ne pas confondre »).
- Les mauvaises réponses doivent être des pièges plausibles tirés du cours lui-même :
  seuils inversés ou décalés, termes confondus (ex : métrorragies/ménorragies,
  Lasègue/Léri), signes attribués à la mauvaise pathologie, mots absolus (« toujours »,
  « jamais »), mauvaises unités (Sv au lieu de mSv).
- Formule les questions comme des QCM d'examen (« Quelles propositions sont
  exactes ? »). Évite « Associez correctement… », qui ne marche pas avec le tirage
  aléatoire.
- Si le cours contient lui-même des QCM corrigés, intègre-les en les adaptant au format
  (une proposition = une réponse indépendante). Ces questions restent "generee" : seul
  le livret d'annales donne le type "annale".

## Livret d'annales
Si je joins des annales :

1. Identifier la matière et la discipline.
   - Repère l'UE du cours (ex : respi-histoembryo → « Appareil respiratoire ») et sa
     discipline (ex : histologie-embryologie).
   - Ne retiens que les QCM de cette UE et de cette discipline. Quand le livret
     n'indique pas la discipline, déduis-la du thème de la question.
   - Parmi eux, retiens les QCM liés aux chapitres du cours. Un QCM d'une autre
     discipline (biochimie, anatomie, sémiologie…) ou sans lien avec les chapitres
     n'est pas repris : signale-le-moi à la fin, il ira dans le JSON du cours
     concerné.

2. Une question par QCM d'annale.
   - Chaque QCM retenu devient UNE question du JSON, rangée dans le chapitre du cours
     correspondant.
   - Si le même QCM revient (identique ou presque) sur plusieurs années, fais-en une
     seule question et liste toutes les années dans "references". Fusionne les items
     identiques ; garde les items différents.
   - Reformule l'énoncé sans le copier mot pour mot. Un énoncé négatif (« quelle
     cause n'est pas fréquente ? ») est retourné en énoncé positif, et les items sont
     rangés en conséquence.

3. Reprendre TOUS les items, sans en écarter aucun (sauf « Toutes les réponses sont
   fausses », « Aucune » et équivalents, que le site ajoute lui-même), et déterminer
   la réponse de chacun dans cet ordre :
   a. correction officielle du livret, si elle existe ;
   b. sinon, le cours : réponse déduite, tag "annale" seul ;
   c. sinon, une source fiable (cours d'un autre de mes fichiers, recommandations,
      référence médicale reconnue, recherche web) : tags "annale" + "hors_cours" ;
   d. sinon : tags "annale" + "a_verifier", placé selon ta meilleure estimation.
   - Un QCM « une seule réponse possible » permet de déduire que tous les autres items
     sont faux une fois la bonne réponse établie.
   - N'invente jamais de correction : un doute sur la réponse donne le tag
     "a_verifier", jamais une réponse présentée comme sûre.
   - Un item d'annale ne devient jamais une mauvaise réponse simplement parce que le
     cours n'en parle pas : il peut être vrai et relever d'un autre cours.

4. Compléter la question.
   - Ajoute des bonnes et mauvaises réponses tirées du cours (sans tag), surtout si la
     question n'a pas au moins 1 bonne et 5 mauvaises réponses.
   - Repère les QCM qui reviennent le plus souvent et les pièges classiques des annales,
     et reprends le style et le niveau de difficulté dans les questions générées.

## Avant de livrer : script de contrôle OBLIGATOIRE
Enregistre ce script tel quel sous controle.py, lance-le avec le JSON et le fichier 2
(pip install pypdf --break-system-packages s'il manque), corrige tant qu'il n'affiche
pas « CONTRÔLE OK », et recopie sa sortie complète dans ta réponse. Ne livre jamais un
JSON qui ne passe pas ce contrôle. Si la version du PDF est introuvable, demande-la-moi
et relance avec --version X.Y.

    python3 controle.py cours.json fichier2.pdf [--version X.Y]

```python
import json, re, sys, os
from pypdf import PdfReader
a = [x for x in sys.argv[1:] if not x.startswith("--")]
jf, pf = a[0], a[1]
vf = sys.argv[sys.argv.index("--version") + 1] if "--version" in sys.argv else None
err = []
num = lambda t: tuple(int(x) for x in re.findall(r"\d+", t)) if t else None
norm = lambda v: v + (0,) * (3 - len(v)) if v else None
base = os.path.splitext(os.path.basename(pf))[0]
if not vf:
    r = PdfReader(pf)
    VERS = re.compile(r"prompt\s*:?\s*v?\s*(\d+(?:\.\d+)*)", re.I)
    m = VERS.search(str((r.metadata or {}).get("/Keywords") or "")) or VERS.search(r.pages[0].extract_text() or "")
    vf = m.group(1) if m else None
print("Version du fichier 2 :", vf or "INTROUVABLE (demande-la et relance avec --version)")
d = json.load(open(jf, encoding="utf8"))
m = d.get("meta", {})
print("meta.version :", repr(m.get("version")), "| meta.cours.fichier :", repr((m.get("cours") or {}).get("fichier")))
if list(m) != ["theme", "section", "titre", "description", "version", "cours"]:
    err.append("champs de meta absents ou dans le désordre : " + ", ".join(m))
v = m.get("version")
if not isinstance(v, str) or not re.fullmatch(r"\d+\.\d+", v):
    err.append('meta.version absente ou mal formée (chaîne "MAJEUR.MINEUR" attendue)')
elif not vf:
    err.append("version du fichier 2 inconnue : impossible de contrôler meta.version")
elif norm(num(v)) != norm(num(vf)):
    err.append("meta.version (" + v + ") différente de la version du fichier 2 (" + vf + ")")
fichiers = [("meta", (m.get("cours") or {}).get("fichier"))]
for c in d.get("chapitres", []):
    f = ((c.get("meta") or {}).get("cours") or {}).get("fichier")
    if f is not None: fichiers.append(("chapitre « " + c["meta"].get("titre", "?") + " »", f))
for ou, f in fichiers:
    if not f: err.append(ou + " : cours.fichier absent")
    elif "/" in f or "\\" in f: err.append(ou + " : cours.fichier contient un dossier (" + f + ") : mettre seulement " + base + ".pdf")
    elif f != base + ".pdf": err.append(ou + " : cours.fichier (" + f + ") ≠ nom du fichier 2 (" + base + ".pdf)")
if os.path.basename(jf) != base + ".json":
    err.append("nom du JSON (" + os.path.basename(jf) + ") ≠ " + base + ".json")
ids = [q.get("id") for c in d.get("chapitres", []) for q in c.get("questions", [])]
if len(ids) != len(set(ids)): err.append("ids de questions en double")
if any(not str(i).startswith(base + "-") for i in ids): err.append("ids ne commençant pas par " + base + "-")
print("Questions :", len(ids), "dans", len(d.get("chapitres", [])), "chapitres")
print("\n".join("ERREUR : " + e for e in err) if err else "CONTRÔLE OK")
sys.exit(1 if err else 0)
```

## Avant de livrer, vérifie aussi (par script quand c'est possible)
- La structure est bien { meta, chapitres }, avec theme, section, titre, description,
  version, cours.fichier, des ids uniques et l'ordre des champs indiqué.
- "meta.version" est une chaîne "MAJEUR.MINEUR" égale à la version du cours
  retravaillé fourni.
- Chaque question a au moins 1 bonne et au moins 5 mauvaises réponses, toutes avec une
  explication, sans doublon ni proposition « Toutes / Aucune ».
- "source" est cohérent : une question "generee" n'a aucune proposition taguée ; une
  question "annale" a au moins une référence complète (sujet, discipline, annee, qcm)
  et au moins une proposition "annale": true ; toute proposition "hors_cours" ou
  "a_verifier" porte aussi "annale": true.
- Tous les items de chaque QCM d'annale retenu sont présents (hors « Toutes / Aucune »).
- Aucune proposition ne dépend d'une autre.
- Chaque mauvaise réponse est réellement fausse et chaque bonne réponse réellement
  vraie : relis-les une par une.
- Une même donnée (valeur, seuil, définition) est cohérente d'une question à l'autre.
- Chaque chapitre compte au moins 5 questions.
- Chaque question a un champ "cours" avec une page existante et un extrait de 3 à
  10 mots. Vérifie par script que chaque extrait est présent sur la page indiquée, en
  appliquant la même normalisation que le site : accents retirés (NFKD), minuscules,
  apostrophes ’ ‘ ' uniformisées, espaces et tirets supprimés. Corrige tout extrait
  introuvable avant de livrer.
- Le JSON est valide (guillemets doubles, pas de virgule finale, UTF-8) et livré sous
  forme de fichier téléchargeable.

## Dans ta réponse
- La sortie complète du script de contrôle (elle doit finir par « CONTRÔLE OK »).
- La version du cours retravaillé inscrite dans "meta.version" et l'endroit où tu l'as
  trouvée. Pour une mise à jour, indique aussi l'ancienne version et si les renvois
  ont dû être revérifiés un par un (changement de version majeure).
- Nombre de questions par chapitre, avec la répartition "generee" / "annale".
- Les QCM d'annales intégrés (année, numéro), le nombre d'items repris, dont
  "hors_cours" et "a_verifier".
- La liste des items "a_verifier", avec la réponse que tu as choisie.
- Les QCM d'annales non repris (autre discipline, autre cours, sans lien avec les
  chapitres), pour que je les garde pour le bon cours.
- Les points du cours que tu as volontairement évités (étiquettes, écarts signalés).
- Le nombre d'extraits "surligner" corrigés lors de la vérification.
- Rappelle-moi de déposer le JSON dans le dossier data/ et le fichier 2 (avec son
  résumé) dans un sous-dossier de cours/ (ex. cours/cardio/), puis de pousser sur main :
  le déploiement fait le reste. Rien d'autre à lancer.

## Journal des versions
Règle : MAJEUR (+1.0) quand une règle change la structure du fichier 2, donc
potentiellement sa pagination et les renvois des QCM (ex. ajout de figures, nouvelle
section) ; MINEUR (+0.1) pour les ajustements de forme ou de contenu qui ne touchent
pas cette structure, et pour les reformulations.
Le fichier 2 porte la version des règles qui l'ont produit ; le JSON la reprend dans
"meta.version". Un JSON dont la version majeure diffère de celle du PDF affiché a des
renvois de page potentiellement faux et doit être mis à jour.
Chaque modification de ces instructions ajoute une entrée datée ci-dessous.

- 1.0 : version initiale (format JSON, étiquettes, annales, renvois au cours).
- 1.1 (03/11/2026) : ajout du journal des versions et du champ "meta.version".
- 1.2 (03/11/2026) : "meta.version" reprend la version du cours retravaillé
  (fichier 2) ; revérification des renvois quand la version majeure du cours change.
- 1.3 (03/11/2026) : "meta.cours" chemin relatif, et non plus absolu (précisé en 1.4 :
  simple nom du PDF, sans dossier)
- 1.4 (05/11/2026) : "meta.cours.fichier" sans aucun dossier ; script de contrôle
  obligatoire (meta.version égale à la version du fichier 2, nom du PDF, ids) dont la
  sortie figure dans la réponse ; rappel final mis à jour (plus de generer_themes.py).
