#!/usr/bin/env python3
# Génère index.json : la liste de tous les PDF de cours/ et de tous les JSON de data/ (sous-dossiers compris).
# Le site s'en sert pour retrouver un PDF à partir de son seul nom, où qu'il soit rangé.
# Lancé automatiquement à chaque déploiement (.github/workflows/deploy.yml) ; à lancer à la main pour tester en local.
import json, os, re
try:
    from pypdf import PdfReader   # pour lire la version du prompt dans les PDF (pip install pypdf)
except ImportError:
    PdfReader = None

def lister(dossier, ext, ignorer=()):
    out = []
    for racine, dirs, fichiers in os.walk(dossier):
        dirs.sort()
        for f in fichiers:
            if f.lower().endswith(ext) and f not in ignorer and not f.startswith("."):
                out.append(os.path.join(racine, f).replace(os.sep, "/"))
    return sorted(out)

index = {"cours": lister("cours", ".pdf"), "data": lister("data", ".json", ignorer=("themes.json",))}
with open("index.json", "w", encoding="utf-8") as f:
    json.dump(index, f, ensure_ascii=False, indent=1)

# ----- Versions du prompt -----
# PDF : métadonnée « Keywords » (ex. « prompt v4.1 »), sinon en-tête de la 1re page (« Version du prompt v4.1 »).
# JSON : champ "meta.version" (ex. "4.1", "v4.1" ou "prompt v4.1").
def num(txt):   # "prompt v4.1" → (4, 1) ; None si aucune version
    m = re.search(r"(\d+(?:\.\d+)*)", str(txt or ""))
    return tuple(int(x) for x in m.group(1).split(".")) if m else None

def version_pdf(chemin):   # "-" : version non lue (pypdf absent), None : pas de version dans le PDF
    if PdfReader is None:
        return "-"
    try:
        r = PdfReader(chemin)
        kw = (r.metadata or {}).get("/Keywords") or ""
        m = re.search(r"prompt\s*:?\s*v?\s*(\d+(?:\.\d+)*)", str(kw), re.I)
        if not m and r.pages:
            m = re.search(r"prompt\s*:?\s*v?\s*(\d+(?:\.\d+)*)", r.pages[0].extract_text() or "", re.I)
        return num(m.group(1)) if m else None
    except Exception:
        return None

def texte_v(v):
    return "v" + ".".join(map(str, v)) if v else "v?"

# ----- Bilan : pour chaque JSON, son cours est-il trouvé ? a-t-il un résumé (même nom + "-resume.pdf") ? quelles versions ? -----
# Purement informatif : n'arrête jamais le déploiement.
noms = {}   # nom de PDF en minuscules → chemins
for p in index["cours"]:
    noms.setdefault(os.path.basename(p).lower(), []).append(p)
for l in noms.values():
    if len(l) > 1:
        print("⚠ PDF en double :", " et ".join(l))

def fichiers_cours(raw):   # tous les "fichier" cités : meta du cours, meta des chapitres, questions
    out = []
    def pris(c):
        f = c if isinstance(c, str) else c.get("fichier") if isinstance(c, dict) else None
        if isinstance(f, str) and f.strip() and f.strip() not in out:
            out.append(f.strip())
    meta = raw.get("meta") if isinstance(raw.get("meta"), dict) else {}
    pris(meta.get("cours"))
    for ch in raw.get("chapitres") or []:
        if isinstance(ch, dict):
            if isinstance(ch.get("meta"), dict):
                pris(ch["meta"].get("cours"))
            for q in ch.get("questions") or []:
                if isinstance(q, dict):
                    pris(q.get("cours"))
    return out

utilises = set()   # PDF rattachés à un cours (le cours lui-même ou son résumé)
lignes = []        # [nom JSON, (état cours, version), (état résumé, version), version JSON]
for chemin in index["data"]:
    nom = os.path.basename(chemin)
    try:
        with open(chemin, encoding="utf-8") as f:
            raw = json.load(f)
        cites = fichiers_cours(raw)
    except Exception as e:
        lignes.append([nom, f"✘ JSON illisible ({e})"])
        continue
    meta = raw.get("meta") if isinstance(raw.get("meta"), dict) else {}
    vj = num(meta.get("version"))
    if not cites:
        lignes.append([nom, "cours — (aucun PDF indiqué)"])
        continue
    for n, f in enumerate(cites):
        cle = f.lower() if "/" in f else os.path.basename(f).lower()
        trouve = [f] if "/" in f and os.path.isfile(f) else ([] if "/" in f else noms.get(cle, []))
        nom_l = nom if n == 0 else "  └ " + f   # un JSON qui cite plusieurs PDF : une ligne par PDF
        if len(trouve) != 1:
            lignes.append([nom_l, f"cours ✘ ({f} {'en double' if trouve else 'introuvable'})"])
            continue
        utilises.add(trouve[0])
        base = os.path.basename(trouve[0])
        resume = noms.get(base[:-4].lower() + "-resume.pdf", []) if base.lower().endswith(".pdf") else []
        utilises.update(resume)
        lignes.append([nom_l, ("cours ✔", version_pdf(trouve[0])),
                       ("résumé ✔", version_pdf(resume[0])) if len(resume) == 1 else ("résumé —", "-"),
                       vj if n == 0 else "-"])

# Version la plus récente, séparément pour les cours, les résumés et les JSON (ils peuvent venir de prompts différents)
def recente(col):
    vs = [l[col] if col == 3 else l[col][1] for l in lignes if len(l) == 4 and l[col] is not None]
    vs = [v for v in vs if isinstance(v, tuple)]
    return max(vs) if vs else None
maxi = {1: recente(1), 2: recente(2), 3: recente(3)}
compte = {c: {"ancienne": 0, "absente": 0} for c in (1, 2, 3)}

def cellule(l, col):   # texte d'une colonne, avec ⚠ si la version est plus ancienne que la plus récente
    x = l[col]
    if col == 3:
        etat, v = "json", x
    elif x is None:
        return ""
    else:
        etat, v = x
    if v == "-":
        return etat if col != 3 else ""
    if v is None:
        compte[col]["absente"] += 1
        return f"{etat} v?"
    if maxi[col] and v < maxi[col]:
        compte[col]["ancienne"] += 1
        return f"{etat} {texte_v(v)} ⚠"
    return f"{etat} {texte_v(v)}"

table = [[l[0]] + [cellule(l, c) for c in (1, 2, 3)] if len(l) == 4 else l for l in lignes]   # les lignes d'erreur n'ont que 2 cases
larg = [max([len(t[c]) for t in table if len(t) == 4] or [0]) for c in range(4)]
larg[0] = max(len(t[0]) for t in table) if table else 0
print()
if PdfReader is None:
    print("(pypdf absent : versions des PDF non lues — pip install pypdf)")
for t in table:
    print("   ".join(t[c].ljust(larg[c]) for c in range(len(t))).rstrip())
orphelins = [p for p in index["cours"] if p not in utilises]
if orphelins:
    print("\nPDF rattachés à aucun cours :")
    for p in orphelins:
        v = version_pdf(p)
        print("  ", p, "" if v == "-" else texte_v(v))
n_cours = sum(1 for l in lignes if len(l) == 4)
n_res = sum(1 for l in lignes if len(l) == 4 and l[2][0] == "résumé ✔")
print(f"\nindex.json : {len(index['data'])} JSON · {n_cours} cours trouvés · {n_res} résumés · {len(index['cours'])} PDF au total")
nomc = {1: "cours", 2: "résumés", 3: "JSON"}
print("Versions :", " · ".join(f"{nomc[c]} {texte_v(maxi[c]) if maxi[c] else '—'} (⚠ ancienne : {compte[c]['ancienne']}, v? non indiquée : {compte[c]['absente']})" for c in (1, 2, 3)))
