#!/usr/bin/env python3
# Fabrique l'index du site : la liste de tous les PDF de cours/, de tous les JSON de data/ et des programmes d'UE de programme/ (sous-dossiers compris),
# plus la version de chaque cours (PDF hors résumés), lue avec pypdf (pip install pypdf) ; sans pypdf, pas de versions.
# Le site s'en sert pour savoir quels cours existent et retrouver un PDF à partir de son seul nom, où qu'il soit rangé.
# En ligne : l'Action de déploiement lance ce script, qui écrit index.json dans le site publié (index.json n'est pas dans le dépôt).
# En local : python3 serve.py fabrique l'index à chaque chargement de la page, sans rien écrire. Pas besoin de lancer ce script à la main.
# Pour vérifier les fichiers et leurs versions : python3 diag.py
import json, os, re
try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

VERS = re.compile(r"prompt\s*:?\s*v?\s*(\d+(?:\.\d+)*)", re.I)

def num(txt):   # "prompt v4.1" → (4, 1) ; None si aucune version
    m = re.search(r"(\d+(?:\.\d+)*)", str(txt or ""))
    return tuple(int(x) for x in m.group(1).split(".")) if m else None

def version_pdf(chemin):   # métadonnée « Keywords », sinon en-tête de la 1re page ; None si introuvable (ou sans pypdf)
    if PdfReader is None:
        return None
    try:
        r = PdfReader(chemin)
        m = VERS.search(str((r.metadata or {}).get("/Keywords") or ""))
        if not m and r.pages:
            m = VERS.search(r.pages[0].extract_text() or "")
        return num(m.group(1)) if m else None
    except Exception:
        return None

def lister(dossier, ext, ignorer=()):
    out = []
    for racine, dirs, fichiers in os.walk(dossier):
        dirs.sort()
        for f in fichiers:
            if f.lower().endswith(ext) and f not in ignorer and not f.startswith("."):
                out.append(os.path.join(racine, f).replace(os.sep, "/"))
    return sorted(out)

def construire():   # les listes de fichiers seulement (sans les versions)
    return {"cours": lister("cours", ".pdf"), "data": lister("data", ".json"), "programme": lister("programme", ".json")}

def construire_tout(cache=None):   # l'index complet : listes + versions ("4.1", ou null si non indiquée). cache : {chemin: (date, taille, version)} pour ne relire que les PDF modifiés
    index = construire()
    index["versions"] = {}
    for p in index["cours"]:
        if p.lower().endswith("-resume.pdf"):
            continue
        st = os.stat(p)
        cle = (st.st_mtime_ns, st.st_size)
        if cache is None or p not in cache or cache[p][:2] != cle:
            v = version_pdf(p)
            if cache is not None:
                cache[p] = cle + (v,)
        else:
            v = cache[p][2]
        index["versions"][p] = ".".join(map(str, v)) if v else None
    return index

def avertissements(index):   # pypdf absent, PDF en double (le site ne saurait pas lequel ouvrir)
    out = [] if PdfReader else ["⚠ pypdf absent : versions des cours non lues (pip install pypdf)"]
    noms = {}
    for p in index["cours"]:
        noms.setdefault(os.path.basename(p).lower(), []).append(p)
    out += ["⚠ PDF en double : " + " et ".join(l) for l in noms.values() if len(l) > 1]
    return out

if __name__ == "__main__":
    index = construire_tout()
    with open("index.json", "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
    for a in avertissements(index):
        print(a)
    print(f"index.json : {len(index['cours'])} PDF, {len(index['data'])} JSON, {len(index['programme'])} programme(s)")
