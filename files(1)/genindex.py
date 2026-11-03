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

# Signale les PDF qui portent le même nom dans deux dossiers (le site ne saurait pas lequel ouvrir)
noms = {}
for p in index["cours"]:
    noms.setdefault(os.path.basename(p).lower(), []).append(p)
for n, l in noms.items():
    if len(l) > 1:
        print("⚠ PDF en double :", " et ".join(l))
print(f"index.json : {len(index['cours'])} PDF, {len(index['data'])} JSON")
