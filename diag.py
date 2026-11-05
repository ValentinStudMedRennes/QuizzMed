#!/usr/bin/env python3
# Diagnostic local des cours : version du cours (PDF), de son résumé et du QCM (JSON), et concordance.
# Usage : python3 diag.py   (depuis la racine du dépôt ; nécessite pypdf : pip install pypdf)
# Version d'un PDF : métadonnée « Keywords » (ex. « prompt v4.1 »), sinon en-tête de la 1re page (« Version du prompt v4.1 »).
# Version d'un JSON : "meta.version" = version du cours dont le QCM est tiré. Résumé de X.pdf : X-resume.pdf.
import json, os, re, sys
from genindex import construire, num, version_pdf, PdfReader
if PdfReader is None:
    sys.exit("pypdf est nécessaire pour lire les versions des PDF : pip install pypdf")

def egal(a, b):   # 4.1 = 4.1.0
    n = max(len(a), len(b))
    return a + (0,) * (n - len(a)) == b + (0,) * (n - len(b))

def tv(v):
    return "v" + ".".join(map(str, v)) if v else "v?"

def fichiers_cites(raw):   # tous les "fichier" cités : meta du cours, meta des chapitres, questions
    out = []
    def pris(c):
        f = c if isinstance(c, str) else c.get("fichier") if isinstance(c, dict) else None
        if isinstance(f, str) and f.strip() and os.path.basename(f.strip()) not in out:
            out.append(os.path.basename(f.strip()))
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

index = construire()
pdfs = {}   # nom en minuscules → chemins
for p in index["cours"]:
    pdfs.setdefault(os.path.basename(p).lower(), []).append(p)
est_resume = lambda n: n.lower().endswith("-resume.pdf")

# QCM rattachés à chaque cours : nom du PDF (minuscules) → [(nom du JSON, version)]
qcm, lignes = {}, []
for chemin in index["data"]:
    nom = os.path.basename(chemin)
    try:
        with open(chemin, encoding="utf-8") as f:
            raw = json.load(f)
    except Exception:
        lignes.append([nom, "", "", "", "⚠ JSON illisible"])
        continue
    meta = raw.get("meta") if isinstance(raw.get("meta"), dict) else {}
    cites = fichiers_cites(raw)
    if not cites:
        lignes.append([nom, "", "", "", "⚠ aucun PDF indiqué dans le JSON"])
    for c in cites:
        qcm.setdefault(c.lower(), []).append((nom, num(meta.get("version"))))

# Une ligne par cours : les PDF qui ne sont pas des résumés, plus ceux cités par un JSON mais absents
cours = sorted({n for n in pdfs if not est_resume(n)} | set(qcm), key=lambda n: (pdfs.get(n, ["~"])[0], n))
for n in cours:
    alertes = []
    chemins = pdfs.get(n, [])
    if not chemins:
        alertes.append("PDF du cours introuvable")
    if len(chemins) > 1:
        alertes.append("PDF en double : " + " et ".join(chemins))
    vc = version_pdf(chemins[0]) if len(chemins) == 1 else None
    if len(chemins) == 1 and vc is None:
        alertes.append("version du cours non indiquée")
    res = pdfs.get(n[:-4] + "-resume.pdf", [])
    vr = version_pdf(res[0]) if res else None
    if res and vr is None:
        alertes.append("version du résumé non indiquée")
    elif res and vc and not egal(vr, vc):
        alertes.append(f"résumé {tv(vr)} ≠ cours")
    jsons = qcm.get(n, [])
    if not jsons and chemins:
        alertes.append("aucun QCM")
    for nj, vj in jsons:
        nomj = f" ({nj})" if len(jsons) > 1 else ""
        if vj is None:
            alertes.append("version du QCM non indiquée" + nomj)
        elif vc and not egal(vj, vc):
            alertes.append(f"QCM {tv(vj)} ≠ cours{nomj}" + (" : version majeure, renvois à revérifier" if vj[0] != vc[0] else ""))
    nom = os.path.basename(chemins[0]) if chemins else n
    lignes.append([nom[:-4] if nom.lower().endswith(".pdf") else nom,
                   tv(vc) if len(chemins) == 1 else "—",
                   tv(vr) if res else "—",
                   ", ".join(tv(v) for _, v in jsons) or "—",
                   "⚠ " + " · ".join(alertes) if alertes else "✔"])

# Résumés sans cours
for n, chemins in pdfs.items():
    if est_resume(n) and n[:-11] + ".pdf" not in pdfs:
        lignes.append([os.path.basename(chemins[0])[:-4], "—", tv(version_pdf(chemins[0])), "—", "⚠ résumé sans cours"])

entete = ["Cours", "v. cours", "v. résumé", "v. QCM", "Avertissements"]
larg = [max(len(l[c]) for l in lignes + [entete]) for c in range(4)]
for l in [entete] + lignes:
    print("   ".join(l[c].ljust(larg[c]) for c in range(4)) + "   " + l[4])
ok = sum(1 for l in lignes if l[4] == "✔")
print(f"\n{ok} cours sur {len(lignes)} lignes sans avertissement")
