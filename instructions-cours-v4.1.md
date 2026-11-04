# Prompt de génération de cours — Version v4.1 (29/10/2026)
# Rappel : incrémenter la version à chaque modification de ce prompt (voir "Journal des versions").

Tu vas m'aider à retravailler des notes de cours en générant 2 fichiers PDF.

## Fichiers fournis
Je te joins toujours deux fichiers :
1. Les diapositives du professeur (PDF) = le "cours".
2. Une prise de notes réalisée par un élève.
Je t'indique au début de mon message le thème, la section et le nom court du cours
(ex : « Thème : Appareil cardio-vasculaire — Section : Physiologie — Cours : VO2 »).
Si je ne l'indique pas, choisis-les toi-même et précise-les dans ta réponse.
Si les diapositives couvrent plusieurs cours, génère une paire de fichiers par cours.
S'il manque les diapositives ou les notes, signale-le, travaille avec ce qui est
fourni et indique le manque dans la ligne "Sources" des métadonnées.

## Nom des fichiers
Les deux fichiers partagent un nom de base "<thème>-<section>-<cours>", en abréviations
courtes, en minuscules, sans accents ni espaces (ex : cardio-physio-vo2).
- Fichier 1 : "<nom de base>-resume.pdf".
- Fichier 2 : "<nom de base>.pdf".
Le fichier JSON de QCM généré ensuite portera le même nom de base.

## Version du prompt et métadonnées
- La version de ce prompt figure sur sa 1re ligne (format vMAJEUR.MINEUR).
- Chaque fichier commence, juste après le titre, par une rubrique "Métadonnées" (petit
  tableau en texte sélectionnable) contenant :
  - Version du prompt (celle de la 1re ligne),
  - Date de génération,
  - Sources : nature et nombre de pages de chaque source, sans aucun nom de
    personne, en écrivant explicitement ce qui manque
    (ex. « Prise de notes (2 parties, 21 pages) ; diapositives : non fournies »),
  - Périmètre (cours entier, ou limite demandée, ex. « s'arrête avant la partie X »),
  - Remarques : uniquement s'il y a quelque chose d'inhabituel qui ne relève pas des
    sources (ex. figures reprises des notes, métadonnées ajoutées après coup, règle
    du prompt non appliquée). Si tout est conforme, n'affiche pas cette ligne.
- Inscris aussi "prompt vX.X" dans les mots-clés des propriétés du PDF.
- Si ce prompt n'a pas de numéro de version, signale-le avant de générer.
- Si une régénération ne sert qu'à ajouter des métadonnées à un fichier 2 déjà
  utilisé pour des QCM, écris-les dans la marge haute de la page 1 (sans modifier
  le flux du texte) et vérifie que le texte de chaque page est inchangé.

## Fichier 1 : Résumé
- Format A4 paysage, texte réparti sur 3 colonnes.
- Commence par les métadonnées, puis le plan complet du cours (parties, sous-parties).
- Au début de chaque chapitre, un encadré "Mots-clés" liste tous les mots-clés
  du chapitre, séparés par des points-virgules.
- Reprend ensuite les notions clés de chaque chapitre, de façon concise.
- Notions importantes en gras et en couleur (bleu). Abréviations autorisées.
- Termine par un encadré "Pièges / points corrigés" et un encadré "À ne pas confondre".

## Fichier 2 : Version complète
C'est la version de référence : le site l'affiche avec pdf.js, et les QCM y renvoient
par numéro de page et par passage surligné.
- Format A4 portrait, une colonne, prose rédigée, dans l'ordre des diapositives.
- Commence par les métadonnées, puis la légende des couleurs.
- Toutes les notions expliquées en toutes lettres, sans abréviation.
- Garde tous les chiffres du cours, même ceux à ne pas apprendre (signale-les).
- Schémas et graphiques :
  - Intègre chaque schéma ou graphique cité, découpé dans la diapositive, lisible,
    avec une légende en texte "Figure — diapositive n°X", juste au-dessus de sa
    description ; image, légende, description et titre qui précède restent ensemble.
  - Pas d'image pour les diapositives purement textuelles : réécris leur contenu
    (formules, tableaux) en texte.
  - Description "Description du schéma (diapositive n°X) :" en texte noir normal,
    notions clés en bleu gras, étiquettes et couleurs habituelles si besoin.
  - Toute information utile aux QCM doit être dans le texte, jamais seulement
    dans l'image.
  - Schéma illisible : insère-le et écris [Schéma illisible : diapo n°X].
- Notion non expliquée dans les diapositives ou les notes : recherche web.
- À la fin : tableau récapitulatif des arbitrages, puis glossaire des abréviations.
- Tout le texte doit être sélectionnable (hors contenu des figures).
- Ne fais figurer ni le nom du professeur, ni celui des auteurs des notes, ni le
  numéro d'unité d'enseignement. Traite le document comme un cours tiré d'un livre.

## Règles communes aux deux fichiers
- Chiffres et nombres toujours en numérique ("99", "0,5") ; les unités peuvent
  rester en toutes lettres dans la version complète.
- Code couleur, avec légende : bleu gras (notions clés), orange gras (vigilance et
  corrections), violet (incertain), vert (compléments web).
- Chaque passage orange, violet ou vert commence par une étiquette écrite :
  [Correction], [Vigilance], [Incertain], [Hors cours].
- Conserve les indications de priorité des notes avec une étiquette :
  [Insistance d'un intervenant], [Non abordé cette année], [Dit à l'oral].

## Gestion des conflits et des incertitudes
- Notes et diapositives contradictoires : recherche web, version retenue indiquée,
  correction signalée ([Correction]).
- Affirmation du professeur inexacte selon les sources : garder la version du
  professeur, puis donner celle des sources en signalant l'écart (la version du
  professeur compte à l'examen).
- Impossible de trancher, ou affirmation seulement dans les notes et non
  confirmée : inclure avec [Incertain].

## Livraison
- Vérifie le rendu visuel (pas de titre orphelin, pas de caractère manquant,
  figures lisibles et non coupées) et l'extraction pdftotext du fichier 2.
- Dans ta réponse, résume : désaccords tranchés, points [Incertain], schémas
  illisibles, points à vérifier avec l'enseignant, version du prompt utilisée.
- Rappelle que le fichier 2 ne doit plus être régénéré une fois les QCM créés.

## Journal des versions
Règle : MAJEUR (+1.0) quand une règle change la structure du fichier 2, donc
potentiellement sa pagination et les renvois des QCM (ex. ajout de figures, nouvelle
section) ; MINEUR (+0.1) pour les ajustements de forme ou de contenu qui ne touchent
pas cette structure, et pour les reformulations.
- v4.1 (29/10/2026) : métadonnées simplifiées : suppression de la ligne "Fichier" ;
  "Écarts au prompt" remplacé par les manques écrits dans "Sources" et une ligne
  "Remarques" affichée seulement si nécessaire ; règle de versionnage précisée.
- v4.0 (29/10/2026) : rubrique "Métadonnées" en tête des 2 fichiers, version dans
  les propriétés du PDF, journal des versions, cas des sources manquantes.
- v3.0 (29/10/2026) : encadré "Mots-clés" par chapitre du résumé ; figures intégrées
  à la version complète ; descriptions de schémas en noir avec notions en bleu ;
  étiquette [Vigilance] formalisée ; cas multi-cours ; nom de base par défaut.
- v2.0 (29/10/2026) : suppression des noms (professeur, UE) ; étiquette
  [Insistance d'un intervenant].
- v1.0 (29/10/2026) : prompt initial.