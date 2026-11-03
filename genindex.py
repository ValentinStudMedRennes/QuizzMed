#!/usr/bin/env python3
# Génère index.json : la liste de tous les PDF de cours/ et de tous les JSON de data/ (sous-dossiers compris).
# Le site s'en sert pour retrouver un PDF à partir de son seul nom, où qu'il soit rangé.
# Lancé automatiquement à chaque déploiement (.github/workflows/deploy.yml) ; à lancer à la main pour tester en local.
# Pour vérifier les fichiers et leurs versions : python3 diag.py
import json, os

def lister(dossier, ext, ignorer=()):
    out = []
    for racine, dirs, fichiers in os.walk(dossier):
        dirs.sort()
        for f in fichiers:
            if f.lower().endswith(ext) and f not in ignorer and not f.startswith("."):
                out.append(os.path.join(racine, f).replace(os.sep, "/"))
    return sorted(out)

def construire():
    return {"cours": lister("cours", ".pdf"), "data": lister("data", ".json", ignorer=("themes.json",))}

if __name__ == "__main__":
    index = construire()
    with open("index.json", "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
    # Deux PDF de même nom dans deux dossiers : le site ne saurait pas lequel ouvrir
    noms = {}
    for p in index["cours"]:
        noms.setdefault(os.path.basename(p).lower(), []).append(p)
    for l in noms.values():
        if len(l) > 1:
            print("⚠ PDF en double :", " et ".join(l))
    print(f"index.json : {len(index['cours'])} PDF, {len(index['data'])} JSON")
