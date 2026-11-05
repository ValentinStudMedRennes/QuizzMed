# Instructions « programme » v1.2 : planning d'UE → `programme/ueXX-….json`

Tu reçois le **planning PDF d'une UE** (fac de médecine de Rennes, DFGSM2) pour le site QuizzMed (https://github.com/ValentinStudMedRennes/QuizzMed).
Tu en tires la liste des cours prévus dans un fichier JSON, que l'utilisateur dépose dans le dossier `programme/` du dépôt.
Le site affiche ces listes dans le volet « 📋 Programme des cours » : pour chaque cours, ✓ vert (à jour) ou ✗ rouge (pas à jour).

## 1. Avant de commencer

1. Cloner le dépôt : `git clone --depth 1 https://github.com/ValentinStudMedRennes/QuizzMed`.
2. Regarder si `programme/` contient déjà un fichier pour cette UE. Si oui, c'est une **mise à jour** (voir § 5) : partir de ce fichier.
3. Lire le PDF **en texte et en image** (`pdftoppm -r 80 -png`). L'extraction texte mélange l'ordre des cases : l'image sert à remettre chaque cours en face de sa date.

## 2. Lire le planning : une entrée par cours, pas par créneau

Un planning est un calendrier : le même cours revient sur plusieurs créneaux. **Le fichier contient une seule entrée par cours.**

- Si « Anatomie » apparaît 3 fois (3 dates), c'est **une** entrée « Anatomie » avec 3 dates et les heures additionnées.
- Deux lignes consécutives d'un même cours le même jour (ex. 14h-15h et 15h-16h) forment un seul créneau de 2 h.
- Un même intitulé avec deux enseignants différents qui font manifestement deux cours distincts reste en deux entrées. Dans le doute, une seule entrée, et le signaler.
- Un TD fait par demi-promo (groupe 1 puis groupe 2) est **une** entrée. Ses heures sont celles d'un étudiant (2 h, pas 4 h). Mettre les groupes dans `remarque`.
- Ignorer les créneaux vides, « Créneau de report possible », les mentions d'émargement (EDUSIGN) et les lieux.

### Tableau récapitulatif (souvent en bas à gauche)

Certains plannings (ex. UE19 cardio) ont un tableau « INTITULÉ / NOMBRE D'HEURES ». **Quand il existe, c'est lui qui fixe la liste des cours**, plus détaillée que le calendrier.

- Chaque ligne du tableau est une entrée, **même si les intitulés se ressemblent** : « Pharmacologie HTA », « Pharmacologie insuffisance cardiaque », « Pharmacologie anti-arythmie », « Pharmacologie insuffisance coronaire », « Pharmacologie hypolipémiant » font **5 entrées**, pas une seule « Pharmacologie ».
- Une ligne réduite à « Pharmacologie » suivie de lignes plus précises n'est qu'un titre de groupe : pas d'entrée pour elle.
- Les **initiales après l'intitulé** sont celles de l'enseignant (« ECG RM » = R. MARTINS, « Syncope CL » = C. LECLERCQ, « Valvulopathies ED » = E. DONAL). Les retirer du titre. Ne pas les confondre avec un type de séance.
- Une durée donnée pour un groupe de lignes (ex. 7 h pour les 5 pharmacologies) : répartir d'après le calendrier quand c'est possible, sinon `heures: null` et une `remarque`.
- Un cours présent dans le calendrier mais **absent du tableau** est ajouté quand même, avec une `remarque`. Un cours du tableau sans créneau dans le calendrier garde `dates: []` et une `remarque`.

Sans tableau récapitulatif, la liste est celle des intitulés distincts du calendrier.

## 3. Format du fichier

Nom : `programme/ueNN-matiere.json` en minuscules, sans accents (ex. `programme/ue13-respiratoire.json`).

```json
{
 "ue": "UE13",
 "matiere": "Appareil respiratoire",
 "niveau": "DFGSM2",
 "annee": "2026-2027",
 "planning": "PLANNING_UE_13 (6).pdf",
 "cours": [
  {
   "titre": "Anatomie",
   "type": "cours",
   "heures": 6,
   "dates": ["2026-10-26", "2026-11-04", "2026-11-06"],
   "fichiers": [],
   "remarque": "facultatif"
  }
 ]
}
```

- `ue` et `matiere` forment le nom affiché dans la colonne « Matière » (« UE13 · Appareil respiratoire »). `matiere` reprend le titre du planning, en minuscules sauf la 1re lettre.
- `titre` : l'intitulé du cours, propre et complet (« Pharmacologie de l'HTA » plutôt que « Pharmacologie HTA »), sans les initiales de l'enseignant ni la durée.
- Pas de champ pour les enseignants : le planning sert seulement à les distinguer (initiales, cours homonymes), ils ne figurent pas dans le fichier.
- `type` : `"cours"` ou `"TD"` (autre valeur possible, affichée en petite pastille à côté du titre ; rien n'est affiché pour `"cours"`).
- `heures` : nombre (1.5 pour 1h30) ou `null` si inconnu.
- `dates` : format `AAAA-MM-JJ`, dans l'ordre. L'année se déduit de l'année universitaire (septembre-décembre : 1re année ; janvier-août : 2e). Une date douteuse ne se met pas.
- `fichiers` : noms des PDF de cours du dépôt (simple nom, sans dossier) qui couvrent ce cours. Voir § 4.
- `remarque` : facultatif, pour tout ce qui a demandé une interprétation.
- Le site n'utilise que `ue`, `matiere`, `cours[].titre`, `cours[].type` et `cours[].fichiers`. Le reste sert de référence.
- Guillemets doubles à échapper dans les textes. Vérifier le fichier : `python3 -c "import json;json.load(open('programme/ue13-respiratoire.json'))"`.

## 4. État « à jour » : le champ `fichiers`

Le site met ✓ quand `fichiers` n'est pas vide **et** que chaque PDF cité est sur le site avec un QCM (un JSON de `data/` le cite dans son `meta.cours.fichier` ou dans celui d'un chapitre). Sinon ✗. Rien d'autre n'est calculé : pas de comparaison de versions.

Pour remplir `fichiers` :

1. Lister les cours existants : pour chaque `data/**/*.json`, lire `meta.theme`, `meta.section`, `meta.titre` et `meta.cours.fichier`.
2. Ne regarder que ceux dont `meta.theme` correspond à l'UE (« Appareil respiratoire », « Appareil cardio-vasculaire »…).
3. Rattacher un PDF à une entrée **seulement si c'est évident** (même sujet, même discipline). Ex. : `cardio-pharmaco-antiangineux.pdf` → « Pharmacologie de l'insuffisance coronaire ».
4. Un cours du planning peut avoir **plusieurs PDF** (« Physiologie » 5 h → `cardio-physio-mecahemo.pdf` et `cardio-physio-vo2.pdf`).
5. Un PDF peut servir à **plusieurs entrées** (`respi-histoembryo-appresp.pdf` couvre « Histologie » et « Embryologie »).
6. En cas de doute, laisser `fichiers: []` et poser la question à l'utilisateur.
7. Ne jamais citer un fichier `-resume.pdf` : ce sont des résumés, pas des cours.

## 5. Mise à jour d'un fichier existant

- Nouveau planning (version corrigée) : refaire la liste, mais **reprendre les `fichiers` déjà renseignés** des entrées qui existent toujours. Signaler les entrées ajoutées, supprimées ou renommées.
- Nouveau cours déposé sur le site : ajouter le nom de son PDF dans `fichiers` de l'entrée concernée. Rien d'autre à changer.

### Nouveau cours : rattacher son PDF

C'est l'étape 4 du tutoriel (`README.md`). Elle ne se fait pas toute seule : tant que `fichiers` est vide, le cours reste ✗ dans le volet Programme, même si son QCM est en ligne.

1. Vérifier que le PDF du cours et son JSON sont bien sur `main` (`cours/…/X.pdf` et un JSON de `data/` dont `meta.cours.fichier` vaut `X.pdf`). S'ils manquent, le dire à l'utilisateur : le rattachement ne suffira pas, il faut d'abord déposer le cours.
2. Trouver l'entrée du programme qui correspond (même sujet, même discipline). Si aucune ne correspond ou s'il y a un doute, poser la question.
3. Ajouter `"X.pdf"` dans son `fichiers`, sans dossier ni `-resume`, en recopiant le nom exact (accents, tirets, majuscules). Ne rien toucher d'autre dans le fichier.
4. Contrôler avec la commande du § 6, puis rendre le fichier complet.

L'utilisateur peut aussi faire cette modification lui-même sur GitHub (icône crayon sur le fichier) : il n'y a qu'une ligne à changer.

## 6. Livraison

- Rendre le fichier **complet**, prêt à déposer dans `programme/` (Claude ne peut pas pousser sur GitHub).
- Sous le fichier, un court tableau de contrôle : titre | heures | dates | fichiers, puis la liste des choix faits et des doutes (entrées fusionnées ou séparées, heures déduites, dates absentes).
- Avant de rendre le fichier, contrôler chaque nom de `fichiers` (à lancer à la racine du dépôt, en remplaçant le nom du programme). La commande ne doit rien afficher :

```bash
python3 - programme/ue19-cardiovasculaire.json <<'PY'
import json, sys, pathlib
pdfs = {p.name for p in pathlib.Path("cours").rglob("*.pdf")}
qcm = set()
for j in pathlib.Path("data").rglob("*.json"):
    d = json.load(open(j, encoding="utf8"))
    for m in [d.get("meta", {})] + [c.get("meta", {}) for c in d.get("chapitres", [])]:
        f = (m.get("cours") or {}).get("fichier")
        if f: qcm.add(f.split("/")[-1])
for c in json.load(open(sys.argv[1], encoding="utf8"))["cours"]:
    for f in c["fichiers"]:
        if f.endswith("-resume.pdf"): print(c["titre"], ":", f, "est un résumé")
        elif f not in pdfs: print(c["titre"], ":", f, "absent de cours/")
        elif f not in qcm: print(c["titre"], ":", f, "sans QCM dans data/")
PY
```

- Après le dépôt, l'Action de déploiement régénère `index.json` (`genindex.py` liste aussi `programme/`). En local : `python3 serve.py`, puis ouvrir http://localhost:8000 (l'index est fabriqué à chaque chargement ; `python3 -m http.server` ne le fabrique pas et le site affiche une erreur).

## Journal des versions

- v1.0 (2026-11-05) : création (plannings UE13 respiratoire et UE19 cardiovasculaire).
- v1.1 (2026-11-05) : suppression du champ `enseignants`.
- v1.2 (2026-11-05) : rattachement d'un nouveau cours détaillé (§ 5), commande de contrôle des `fichiers` (§ 6), test local avec `serve.py` au lieu de `http.server`.
