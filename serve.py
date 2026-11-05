#!/usr/bin/env python3
# Test en local : python3 serve.py (port 8000), ou python3 serve.py 8080 ; puis ouvrir http://localhost:8000
# Sert le site comme GitHub Pages, mais fabrique index.json à chaque chargement de la page (genindex.py, rien n'est écrit sur le disque) :
# un cours, un PDF ou un programme ajouté ou modifié apparaît en rechargeant la page, sans rien relancer.
# Pour voir les versions des cours : pip install pypdf
import http.server, json, os, sys
os.chdir(os.path.dirname(os.path.abspath(__file__)))   # marche lancé depuis n'importe quel dossier
from genindex import construire_tout, avertissements

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
cache = {}   # versions déjà lues : seuls les PDF modifiés sont relus

class Site(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?")[0] != "/index.json":
            return super().do_GET()
        index = construire_tout(cache)
        for a in avertissements(index):
            print(a)
        corps = json.dumps(index, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corps)))
        self.end_headers()
        self.wfile.write(corps)

    def end_headers(self):   # pas de cache du navigateur : on voit toujours les fichiers tels qu'ils sont sur le disque
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):   # n'affiche que les erreurs (fichier introuvable…)
        if len(args) > 2 and str(args[2])[:1] in "45":
            super().log_message(*args)

if __name__ == "__main__":
    for a in avertissements(construire_tout(cache)):
        print(a)
    print(f"QuizzMed : http://localhost:{PORT}  (Ctrl+C pour arrêter)")
    try:
        http.server.ThreadingHTTPServer(("", PORT), Site).serve_forever()
    except KeyboardInterrupt:
        pass
