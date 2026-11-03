#!/usr/bin/env python3
# Génère index.json : la liste de tous les PDF de cours/ et de tous les JSON de data/ (sous-dossiers compris).
# Le site s'en sert pour retrouver un PDF à partir de son seul nom, où qu'il soit rangé.
# Lancé automatiquement à chaque déploiement (.github/workflows/deploy.yml) ; à lancer à la main pour tester en local.
import json, os

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

# ----- Bilan : pour chaque JSON, son cours est-il trouvé ? a-t-il un résumé (même nom + "-resume.pdf") ? -----
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
lignes, n_cours, n_resumes = [], 0, 0
for chemin in index["data"]:
    nom = os.path.basename(chemin)
    try:
        with open(chemin, encoding="utf-8") as f:
            cites = fichiers_cours(json.load(f))
    except Exception as e:
        lignes.append((nom, f"✘ JSON illisible ({e})"))
        continue
    if not cites:
        lignes.append((nom, "cours — (aucun PDF indiqué)"))
        continue
    etats = []
    for f in cites:
        cle = f.lower() if "/" in f else os.path.basename(f).lower()
        trouve = [f] if "/" in f and os.path.isfile(f) else ([] if "/" in f else noms.get(cle, []))
        if len(trouve) != 1:
            etats.append(f"cours ✘ ({f} {'en double' if trouve else 'introuvable'})")
            continue
        n_cours += 1
        utilises.add(trouve[0])
        base = os.path.basename(trouve[0])
        resume = noms.get(base[:-4].lower() + "-resume.pdf", []) if base.lower().endswith(".pdf") else []
        if resume:
            n_resumes += 1
            utilises.update(resume)
        etats.append("cours ✔  résumé " + ("✔" if resume else "—") + (f"  [{base}]" if len(cites) > 1 else ""))
    lignes.append((nom, " | ".join(etats)))

large = max((len(n) for n, _ in lignes), default=0)
print()
for n, e in lignes:
    print(n.ljust(large), " ", e)
orphelins = [p for p in index["cours"] if p not in utilises]
if orphelins:
    print("\nPDF rattachés à aucun cours :")
    for p in orphelins:
        print("  ", p)
print(f"\nindex.json : {len(index['data'])} JSON · {n_cours} cours trouvés · {n_resumes} résumés · {len(index['cours'])} PDF au total")
