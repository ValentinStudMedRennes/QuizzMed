const $=id=>document.getElementById(id);
const DATA_DIR="data/";
const INDEX_FILE="index.json";   // fabriqué par genindex.py (Action de déploiement en ligne, serve.py en local) : chemins des PDF (cours/…), des JSON (data/…), des programmes, versions des cours
const pdfByName=new Map();       // nom de PDF (en minuscules) → chemins trouvés dans l’index
const pathWarns=new Set();       // PDF introuvables ou en double
const pdfVer=new Map();          // nom de PDF (en minuscules) → version du cours lue par genindex.py ("4.1", "" si non indiquée)
const baseName=p=>String(p).split("/").pop();
const NONE_TEXT="Toutes les réponses précédentes sont fausses";   // proposition ajoutée quand 0 bonne réponse est tirée
const NONE_WHY="Aucune des autres propositions n’est correcte.";
const NONE_WHY_FALSE="Faux : au moins une des propositions précédentes est correcte.";
const PROPS=5;          // nombre de propositions affichées par question (toutes s’il y en a moins)
const NONE_PROB=1/15;   // probabilité que « Toutes les réponses précédentes sont fausses » apparaisse (en mauvaise réponse) dans une question qui a au moins une bonne réponse
const PDFJS_VERSION="3.11.174";   // bibliothèque d’affichage des PDF (chargée seulement quand on ouvre un cours)
const PDFJS_CDN="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/"+PDFJS_VERSION+"/";
let themes=[],quiz=[],i=0;
let prog=[];                     // programme des UE (programme/*.json) : [{nom, cours:[{titre, type, fichiers, ok, manque}]}]
let minRefs=0,favor=false;              // tombée au moins N fois · tirage favorisant les plus tombées
const yearsOff=new Set();       // années d’annales décochées (par défaut toutes sont cochées)
let srcFilter="all";            // filtre d’origine des questions : "all", "annale", "genere"…
const years=new Set();          // années d’annales rencontrées dans les données (ex. « 2023-2024 »)
const yr=a=>{const m=/\d{4}/.exec(a||"");return m?+m[0]:0};
const srcLabels=new Map();      // clé d’origine → libellé affiché
const sel=new Set();             // chapitres cochés (tous thèmes confondus)
const openT=new Set(),openS=new Set(),openF=new Set();   // thèmes, sections et cours dépliés (fermés par défaut)
let current=[];                  // chapitres du QCM en cours
const rnd=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
function shuffle(a){a=a.slice();for(let j=a.length-1;j>0;j--){const k=rnd(0,j);[a[j],a[k]]=[a[k],a[j]]}return a}

async function getJSON(name,optional){   // optional : renvoie null si le fichier n’existe pas
  let r;
  try{r=await fetch(name,{cache:"no-store"})}catch(e){if(optional)return null;throw e}
  if(!r.ok&&optional)return null;
  if(!r.ok)throw new Error("fichier « "+name+" » introuvable ("+r.status+")");
  try{return await r.json()}catch(e){throw new Error("« "+name+" » n’est pas un JSON valide : "+e.message)}
}
// Une réponse : { "reponse": "…", "explication": "…" }
function ans(a){
  if(!a||typeof a!=="object"||Array.isArray(a))return null;
  if(typeof a.reponse!=="string"&&typeof a.reponse!=="number")return null;
  return{reponse:String(a.reponse),explication:typeof a.explication==="string"?a.explication:"",annale:a.annale===true};
}
function uniq(list){const seen=new Set();return list.filter(a=>!seen.has(a.reponse)&&seen.add(a.reponse))}
// Lien vers le cours : "cours": { "fichier": "cours/x.pdf", "page": 12, "surligner": "texte à retrouver sur la page" }
// "fichier" est un simple nom ("x.pdf") : son dossier (cours/, cours/cardio/…) est retrouvé grâce à index.json. Un chemin avec « / » est gardé tel quel.
function pdfPath(f){
  if(!f||f.includes("/"))return f;
  const l=pdfByName.get(f.toLowerCase())||[];
  if(l.length===1)return l[0];
  pathWarns.add(l.length?"PDF « "+f+" » en double : "+l.join(" et ")+" (renomme l’un des deux)":"PDF « "+f+" » introuvable dans cours/");
  return"";
}
// "fichier" (et "page") peuvent être donnés une fois pour tout le fichier ou pour un chapitre, dans leur "meta.cours".
function asCours(v){
  if(typeof v==="string")return{fichier:v};
  if(typeof v==="number")return{page:v};
  return v&&typeof v==="object"&&!Array.isArray(v)?v:{};
}
function coursOf(c,def){
  const x={...def,...asCours(c)};
  const fichier=pdfPath(typeof x.fichier==="string"?x.fichier.trim():"");
  const page=Math.round(+x.page||0);
  if(!fichier||page<1)return null;
  return{fichier,page,surligner:typeof x.surligner==="string"?x.surligner.trim():""};
}
// Origine de la question : "source": { "type": "annale" | "généré" | …, "references": [ { "sujet", "annee", "qcm" } ] }
function parseSource(s){
  const raw=s&&typeof s==="object"&&!Array.isArray(s)?s:(typeof s==="string"?{type:s}:{});
  const type=typeof raw.type==="string"?raw.type.trim():"";
  const n=type.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  let key=n,label=type?type.charAt(0).toUpperCase()+type.slice(1):"Non précisée";
  if(/^annales?$/.test(n)){key="annale";label="Annale"}
  else if(/^gener/.test(n)){key="genere";label="Généré"}
  else if(!n)key="inconnue";
  const refs=(Array.isArray(raw.references)?raw.references:[]).filter(r=>r&&typeof r==="object").map(r=>({
    sujet:typeof r.sujet==="string"?r.sujet.trim():"",
    annee:r.annee!==undefined&&r.annee!==null?String(r.annee).trim():"",
    qcm:r.qcm!==undefined&&r.qcm!==null?String(r.qcm).trim():""
  }));
  refs.forEach(r=>{if(r.annee)years.add(r.annee)});
  srcLabels.set(key,label);
  return{key,label,refs};
}
const yearList=()=>[...years].sort((a,b)=>yr(b)-yr(a)||b.localeCompare(a));   // du plus récent au plus ancien
const srcName=k=>k==="annale"?"Annales":k==="genere"?"Générées":(srcLabels.get(k)||k);
const SRC_ORDER=["annale","genere"];
const srcSort=(a,b)=>{const x=SRC_ORDER.indexOf(a),y=SRC_ORDER.indexOf(b);return(x<0?99:x)-(y<0?99:y)||(a==="inconnue")-(b==="inconnue")||a.localeCompare(b)};
function clean(list,where,warns,def){
  if(!Array.isArray(list)){warns.push(where+" : « questions » doit être une liste [ … ]");return[]}
  const out=[];
  list.forEach((x,n)=>{
    const type=x&&x.type!==undefined?String(x.type).toLowerCase():"qcm";
    if(!["qcm","qcu","qrp"].includes(type)){warns.push(where+" : question n°"+(n+1)+" ignorée (type « "+type+" » pas encore pris en charge)");return}   // qcm : choix multiple · qcu : choix unique · qrp : nombre de réponses précisé (champ nb_bonnes)
    const ok=x&&typeof x.question==="string"&&Array.isArray(x.bonnes)&&Array.isArray(x.mauvaises);
    const b=ok?x.bonnes.map(ans):[],m=ok?x.mauvaises.map(ans):[];
    if(!ok||b.includes(null)||m.includes(null)||b.length+m.length===0){warns.push(where+" : question n°"+(n+1)+" ignorée (attendu : question, bonnes et mauvaises, avec « reponse » dans chaque réponse)");return}
    if(type==="qcu"&&!b.length){warns.push(where+" : question n°"+(n+1)+" ignorée (choix unique sans bonne réponse)");return}
    const nb=x.nb_bonnes;   // QRP : nombre de bonnes réponses affichées, de 2 à 4, au plus le nombre de bonnes du fichier
    if(type==="qrp"&&!(Number.isInteger(nb)&&nb>=2&&nb<PROPS&&nb<=uniq(b).length)){warns.push(where+" : question n°"+(n+1)+" ignorée (QRP : « nb_bonnes » doit être un entier de 2 à "+(PROPS-1)+", sans dépasser le nombre de bonnes réponses)");return}
    out.push({id:x.id!==undefined?String(x.id):null,type,...(type==="qrp"?{n:nb}:{}),question:x.question,bonnes:uniq(b),mauvaises:uniq(m),cours:coursOf(x.cours,def),source:parseSource(x.source)});
  });
  return out;
}
// Format d’un fichier :
// { "meta": {theme, section, titre, description, cours}, "chapitres": [ { "meta": {titre, cours}, "questions": [ … ] } ] }
// Les fichiers qui ont le même "meta.theme" sont regroupés dans un même thème (une section par fichier).
function parseFile(raw,file,warns){
  if(!raw||typeof raw!=="object"||!Array.isArray(raw.chapitres))
    throw new Error("« "+file+" » : format non reconnu (attendu : { \"meta\": {…}, \"chapitres\": [ … ] })");
  const meta=raw.meta&&typeof raw.meta==="object"?raw.meta:{};
  const str=v=>typeof v==="string"&&v.trim()?v.trim():"";
  const f={titre:str(meta.titre)||String(file).replace(/\.json$/i,""),theme:str(meta.theme),section:str(meta.section),description:str(meta.description),chapitres:[]};
  const fdef=asCours(meta.cours),qv=meta.version!==undefined&&meta.version!==null?String(meta.version).trim():"";   // qv : version du cours dont le QCM est tiré
  raw.chapitres.forEach((c,n)=>{
    const titre=str(c&&c.meta&&c.meta.titre)||"Chapitre "+(n+1);
    const cc=asCours(c&&c.meta&&c.meta.cours);
    const questions=clean(c&&c.questions,file+" › "+titre,warns,{...fdef,...cc});
    questions.forEach(q=>{q.chapitre=titre});
    const fichier=[cc.fichier,fdef.fichier].find(x=>typeof x==="string"&&x.trim());   // PDF du chapitre (sinon celui du fichier)
    if(questions.length)f.chapitres.push({titre,questions,fichier:fichier?pdfPath(fichier.trim()):"",version:qv});
  });
  return f;
}
// Thème > section > cours (un fichier JSON chacun, affiché par son "titre") > chapitres
// Les fichiers qui ont le même "theme" sont regroupés dans un thème ; ceux qui ont aussi la même "section" sont regroupés dans une section.
function groupFiles(files){
  const out=[],byTheme=new Map();
  files.forEach(f=>{
    let t=f.theme?byTheme.get(f.theme.toLowerCase()):null;
    if(!t){t={nom:f.theme||f.titre,description:f.theme?"":f.description,grouped:!!f.theme,sections:[],chapitres:[],_sec:new Map()};out.push(t);if(f.theme)byTheme.set(f.theme.toLowerCase(),t)}
    const key=f.section?f.section.toLowerCase():"\u0000"+t.sections.length;   // sans "section", chaque fichier a sa propre section
    let sec=t._sec.get(key);
    if(!sec){sec={nom:f.section||f.titre,explicit:!!f.section,files:[],chapitres:[]};t._sec.set(key,sec);t.sections.push(sec)}
    if(f.chapitres.length)sec.files.push({titre:f.titre,description:f.description,chapitres:f.chapitres});
  });
  out.forEach(t=>{
    delete t._sec;
    t.sections=t.sections.filter(s=>s.files.length);
    t.sections.forEach(sec=>{
      sec.show=t.sections.length>1||sec.explicit;   // titre de section affiché s’il y en a plusieurs (ou si "section" est renseignée)
      sec.showFiles=sec.files.length>1;             // sous-groupes par titre de cours quand une section réunit plusieurs fichiers
      sec.description=sec.files.length===1&&t.grouped?sec.files[0].description:"";
      sec.chapitres=sec.files.flatMap(x=>x.chapitres);
      sec.files.forEach(fl=>fl.chapitres.forEach(c=>c.questions.forEach(q=>{
        q.theme=t.nom;q.path=[t.nom,...(sec.show?[sec.nom]:[]),...(sec.showFiles?[fl.titre]:[]),c.titre].join(" › ");
      })));
    });
    t.chapitres=t.sections.flatMap(s=>s.chapitres);
  });
  return out.filter(t=>t.chapitres.length);
}
async function init(){
  const warns=[],files=[];
  try{
    const idx=await getJSON(INDEX_FILE,true);   // tous les JSON de data/ (sous-dossiers compris) sont chargés, par ordre alphabétique de chemin
    if(!idx)throw new Error("index.json introuvable");
    if(!Array.isArray(idx.cours)||!Array.isArray(idx.data))throw new Error("« index.json » mal formé");
    idx.cours.forEach(p=>{const k=baseName(p).toLowerCase();pdfByName.set(k,[...(pdfByName.get(k)||[]),p])});
    if(idx.versions&&typeof idx.versions==="object")Object.entries(idx.versions).forEach(([p,v])=>pdfVer.set(baseName(p).toLowerCase(),v==null?"":String(v)));
    for(const f of Array.isArray(idx.programme)?idx.programme:[]){   // programmes d’UE (facultatifs)
      try{const p=parseProg(await getJSON(f),baseName(f),warns);if(p&&p.cours.length)prog.push(p)}catch(err){warns.push(err.message)}
    }
    for(const f of idx.data.filter(f=>typeof f==="string").sort((a,b)=>a.localeCompare(b))){
      try{files.push(parseFile(await getJSON(f),baseName(f),warns))}catch(err){warns.push(err.message)}
    }
    warns.push(...pathWarns);
  }catch(e){
    $("load").style.color="var(--ko)";
    $("load").textContent="Impossible de charger les données : "+e.message+". En local, lance python3 serve.py (pas python3 -m http.server, ni le fichier ouvert directement), puis ouvre http://localhost:8000.";
    return;
  }
  themes=groupFiles(files);progState();
  $("load").textContent=warns.length?"⚠ "+warns.join(" — "):"";
  $("load").style.color="var(--ko)";
  $("settings").open=$("annset").open=window.matchMedia?window.matchMedia("(min-width:861px)").matches:true;   // réglages repliés sur téléphone
  showSetup();
}

// ----- Programme : cours prévus au planning de chaque UE et leur état sur le site -----
// Format : { "ue": "UE13", "matiere": "…", "cours": [ { "titre": "…", "type": "cours" | "TD", "fichiers": ["x.pdf"], … } ] } (voir instructions-programme-v….md)
function parseProg(raw,file,warns){
  if(!raw||typeof raw!=="object"||!Array.isArray(raw.cours)){warns.push("« "+file+" » : programme non reconnu (attendu : { \"ue\", \"matiere\", \"cours\": [ … ] })");return null}
  const str=v=>typeof v==="string"&&v.trim()?v.trim():"";
  const cours=raw.cours.filter(c=>c&&str(c.titre)).map(c=>({titre:str(c.titre),type:str(c.type),fichiers:(Array.isArray(c.fichiers)?c.fichiers:[]).map(str).filter(Boolean).map(baseName)}));
  return{nom:[str(raw.ue),str(raw.matiere)].filter(Boolean).join(" · ")||file.replace(/\.json$/i,""),cours};
}
const vnum=v=>{const m=/(\d+(?:\.\d+)*)/.exec(v||"");return m?m[1].split(".").map(Number):null};   // "prompt v4.1" → [4, 1]
const veq=(a,b)=>{const n=Math.max(a.length,b.length);for(let k=0;k<n;k++)if((a[k]||0)!==(b[k]||0))return false;return true};   // 4.1 = 4.1.0
const tv=v=>{const n=vnum(v);return n?"v"+n.join("."):"v?"};
function progState(){   // pour chaque PDF d’un cours prévu : présent ? version du cours, versions des QCM. À jour = au moins un PDF indiqué, et chacun a un QCM chargé
  const qv=new Map();   // nom de PDF → versions des QCM qui le citent
  allChaps().forEach(c=>{const k=baseName(c.fichier||"").toLowerCase();if(k){if(!qv.has(k))qv.set(k,new Set());qv.get(k).add(c.version)}});
  prog.forEach(u=>u.cours.forEach(c=>{
    c.det=c.fichiers.map(f=>{const k=f.toLowerCase();return{f,pdf:(pdfByName.get(k)||[]).length===1,vc:pdfVer.get(k)||"",qcm:qv.has(k)?[...qv.get(k)]:null}});
    c.manque=c.det.filter(d=>!d.qcm).map(d=>d.f);c.ok=c.fichiers.length>0&&!c.manque.length;
  }));
}
function vcell(txt,title,cls){const td=document.createElement("td");td.className="v"+(cls?" "+cls:"");td.textContent=txt;if(title)td.title=title;return td}
function renderProg(){   // tableau : matière (UE) | cours | v. cours | v. QCM | état ; une sous-ligne par PDF quand un cours en a plusieurs
  const t=document.createElement("table");t.className="progtab";
  t.innerHTML='<thead><tr><th scope="col">Matière</th><th scope="col">Cours</th><th scope="col">v. cours</th><th scope="col">v. QCM</th><th scope="col">État</th></tr></thead>';
  const pname=f=>f.replace(/\.pdf$/i,"");
  prog.forEach(u=>{
    const tb=document.createElement("tbody"),span=c=>Math.max(1,c.det.length);
    u.cours.forEach((c,n)=>{
      for(let j=0;j<span(c);j++){
        const tr=document.createElement("tr"),d=c.det[j],multi=c.det.length>1;
        if(n===0&&j===0){const th=document.createElement("th");th.scope="rowgroup";th.rowSpan=u.cours.reduce((s,x)=>s+span(x),0);th.textContent=u.nom;
          const s=document.createElement("small");s.textContent=u.cours.filter(x=>x.ok).length+" / "+u.cours.length+" à jour";th.append(s);tr.append(th)}
        const td=document.createElement("td");
        if(j===0){td.textContent=c.titre;if(c.fichiers.length)td.title=c.fichiers.join(", ");
          if(c.type&&c.type.toLowerCase()!=="cours"){const b=document.createElement("span");b.className="badge mini";b.textContent=c.type;td.append(b)}}
        else td.className="more";
        if(multi){const p=document.createElement("small");p.className="pf";p.textContent=(j?"↳ ":"")+pname(d.f);td.append(p)}
        tr.append(td);
        // version du cours (PDF) : « — » s’il n’est pas dans cours/, « v? » si la version n’est pas indiquée
        tr.append(!d?vcell("—","Pas encore sur le site"):!d.pdf?vcell("—","PDF « "+d.f+" » absent de cours/ (ou en double)"):vcell(tv(d.vc),d.vc?"":"Version du cours non indiquée dans le PDF"));
        // version des QCM : alerte si elle diffère de celle du cours, comme diag.py
        if(!d||!d.qcm)tr.append(vcell("—",d?"Aucun QCM pour « "+d.f+" »":""));
        else{
          const cv=vnum(d.vc),bad=d.qcm.filter(v=>vnum(v)&&cv&&!veq(vnum(v),cv)),major=bad.some(v=>vnum(v)[0]!==cv[0]);
          const txt=d.qcm.map(tv).join(", ");
          tr.append(bad.length?vcell("⚠ "+txt,"QCM tiré d’une autre version du cours ("+tv(d.vc)+")"+(major?" : version majeure, renvois à revérifier":""),"warn")
            :vcell(txt,d.qcm.some(v=>!vnum(v))?"Version du QCM non indiquée (meta.version)":"",d.qcm.some(v=>!vnum(v))?"unk":""));
        }
        if(j===0){
          const st=document.createElement("td");st.className="st";st.rowSpan=span(c);
          const m=document.createElement("span");m.className=c.ok?"ok":"ko";m.textContent=c.ok?"✓":"✗";
          const why=c.ok?"À jour : "+c.fichiers.join(", "):c.fichiers.length?"Pas à jour : pas de QCM sur le site pour "+c.manque.join(", "):"Pas à jour : pas encore sur le site";
          m.setAttribute("aria-label",why);m.title=why;st.append(m);tr.append(st);
        }
        tb.append(tr);
      }
    });
    t.append(tb);
  });
  $("progbody").innerHTML="";$("progbody").append(t);
}
function openProg(){renderProg();$("prog").classList.remove("hidden");$("progbg").classList.remove("hidden");$("progclose").focus()}
function closeProg(){if($("prog").classList.contains("hidden"))return;$("prog").classList.add("hidden");$("progbg").classList.add("hidden");if(!$("progbtn").classList.contains("hidden"))$("progbtn").focus()}
function showProgBtn(on){   // le bouton n’apparaît que sur l’accueil, et seulement s’il y a un programme
  const all=prog.flatMap(u=>u.cours);
  $("progbtn").classList.toggle("hidden",!on||!all.length);
  $("progbtn").textContent="📋 Programme des cours · "+all.filter(c=>c.ok).length+" / "+all.length+" à jour";
}

// ----- Accueil : arbre thèmes › sections › chapitres + panneau « Ton QCM » -----
function passBy(q,skip){   // une question passe si elle respecte tous les filtres (sauf celui qu’on ignore, pour compter les choix d’un menu)
  if(skip!=="src"&&srcFilter!=="all"&&q.source.key!==srcFilter)return false;
  if(skip!=="refs"&&minRefs>0&&q.source.refs.length<minRefs)return false;
  if(skip!=="year"&&yearsOff.size>0&&q.source.refs.length&&!q.source.refs.some(r=>r.annee&&!yearsOff.has(r.annee)))return false;   // les années ne concernent que les annales (questions avec références) : il leur faut au moins une référence dans une année cochée ; les autres questions (générées…) ne sont pas touchées
  return true;
}
const pass=q=>passBy(q,"");
const filtersOn=()=>srcFilter!=="all"||minRefs>0||yearsOff.size>0;
const qlist=c=>c.questions.filter(pass);          // questions d’un chapitre qui respectent le filtre d’origine
const qcount=cs=>cs.reduce((n,c)=>n+qlist(c).length,0);
const allChaps=()=>themes.flatMap(t=>t.chapitres);
const selected=()=>allChaps().filter(c=>sel.has(c));
function setAll(chs,on){chs.forEach(c=>on?sel.add(c):sel.delete(c))}
function toggleSet(set,x){set.has(x)?set.delete(x):set.add(x);renderTree()}
const courseOf=chs=>{const f=[...new Set(chs.map(c=>c.fichier))];return f.length===1&&f[0]?f[0]:""};   // le PDF d’un groupe, s’il n’y en a qu’un et que tous ses chapitres y sont rattachés
const DOWN="m6 9 6 6 6-6",UP="m18 15-6-6-6 6";
function row(o){   // une ligne : flèche (ouvrir/fermer), case à cocher, titre, nombre de QCM, bouton Lancer
  const d=document.createElement("div");d.className="item lvl"+o.lvl+(o.checked||o.partial?" on":"");
  if(o.onChev){
    const v=document.createElement("button");v.className="chev";v.setAttribute("aria-expanded",String(o.open));
    v.setAttribute("aria-label",(o.open?"Fermer ":"Ouvrir ")+o.title);
    v.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(o.open?UP:DOWN)+'"/></svg>';
    v.onclick=o.onChev;d.append(v);
  }else{const s=document.createElement("span");s.className="sp";d.append(s)}
  const c=document.createElement("input");c.type="checkbox";c.checked=!!o.checked;c.indeterminate=!!o.partial;c.setAttribute("aria-label",o.title);c.onchange=o.onToggle;
  const m=document.createElement("div");m.className="main";m.onclick=o.onMain;
  const t=document.createElement("strong");t.textContent=o.title;m.append(t);
  if(o.sub){const x=document.createElement("small");x.textContent=o.sub;m.append(x)}
  const n=document.createElement("span");n.className="cnt";n.textContent=o.count+" QCM";
  const p=document.createElement("button");p.className="play";p.textContent="▶ Lancer";p.disabled=o.count===0;p.onclick=o.onPlay;
  let k=null;
  if(o.course){k=document.createElement("button");k.className="play crs";k.textContent="📖 Cours";k.title="Consulter le cours";k.setAttribute("aria-label","Ouvrir le cours : "+o.title);k.onclick=()=>openCourseMenu(o.course)}
  d.append(c,m,n,...(k?[k]:[]),p);return d;
}
function renderTree(){
  const L=$("treelist");L.innerHTML="";
  const ck=(chs)=>{const k=chs.filter(c=>sel.has(c)).length;return{k,all:chs.length>0&&k===chs.length,partial:k>0&&k<chs.length}};
  themes.forEach(t=>{
    const a=ck(t.chapitres),opened=openT.has(t);
    L.append(row({lvl:0,open:opened,onChev:()=>toggleSet(openT,t),checked:a.all,partial:a.partial,title:t.nom,course:courseOf(t.chapitres),
      sub:[t.description,t.sections.length>1?t.sections.length+" sections":"",t.chapitres.length+" chapitre(s)",a.partial?a.k+" coché(s)":""].filter(Boolean).join(" · "),
      count:qcount(t.chapitres),onToggle:e=>{setAll(t.chapitres,e.target.checked);renderTree()},
      onMain:()=>toggleSet(openT,t),onPlay:()=>launch(t.chapitres)}));
    if(!opened)return;
    t.sections.forEach(sec=>{
      const sOpen=!sec.show||openS.has(sec);   // sans en-tête de section, son contenu est directement visible
      if(sec.show){
        const b=ck(sec.chapitres);
        L.append(row({lvl:1,open:sOpen,onChev:()=>toggleSet(openS,sec),checked:b.all,partial:b.partial,title:sec.nom,course:courseOf(sec.chapitres),
          sub:[sec.description,sec.showFiles?sec.files.length+" cours":"",sec.chapitres.length+" chapitre(s)",b.k>0?b.k+" coché(s)":""].filter(Boolean).join(" · "),count:qcount(sec.chapitres),
          onToggle:e=>{setAll(sec.chapitres,e.target.checked);renderTree()},onMain:()=>toggleSet(openS,sec),onPlay:()=>launch(sec.chapitres)}));
      }
      if(!sOpen)return;
      const l=sec.show?2:1;
      sec.files.forEach(fl=>{
        let cl=l;
        if(sec.showFiles){   // plusieurs cours dans la même section : un sous-groupe par titre
          const c=ck(fl.chapitres),fOpen=openF.has(fl);
          L.append(row({lvl:l,open:fOpen,onChev:()=>toggleSet(openF,fl),checked:c.all,partial:c.partial,title:fl.titre,course:courseOf(fl.chapitres),
            sub:[fl.description,fl.chapitres.length+" chapitre(s)",c.k>0?c.k+" coché(s)":""].filter(Boolean).join(" · "),count:qcount(fl.chapitres),
            onToggle:e=>{setAll(fl.chapitres,e.target.checked);renderTree()},onMain:()=>toggleSet(openF,fl),onPlay:()=>launch(fl.chapitres)}));
          if(!fOpen)return;
          cl=l+1;
        }
        fl.chapitres.forEach(c=>L.append(row({lvl:cl,checked:sel.has(c),title:c.titre,count:qlist(c).length,
          onToggle:e=>{setAll([c],e.target.checked);renderTree()},onMain:()=>{setAll([c],!sel.has(c));renderTree()},onPlay:()=>launch([c])})));
      });
    });
  });
  renderPanel();
}
function chipGroups(){   // résumé de la sélection : un thème, une section ou un cours entier = une étiquette, sinon chapitre par chapitre
  const out=[];
  themes.forEach(t=>{
    const inc=t.chapitres.filter(c=>sel.has(c));
    if(!inc.length)return;
    if(inc.length===t.chapitres.length){out.push({label:t.nom,chs:inc});return}
    t.sections.forEach(s=>{
      const k=s.chapitres.filter(c=>sel.has(c));
      if(!k.length)return;
      if(s.show&&k.length===s.chapitres.length){out.push({label:t.nom+" › "+s.nom,chs:k});return}
      s.files.forEach(f=>{
        const kf=f.chapitres.filter(c=>sel.has(c));
        if(!kf.length)return;
        const base=[t.nom,...(s.show?[s.nom]:[]),...(s.showFiles?[f.titre]:[])];
        if(s.showFiles&&kf.length===f.chapitres.length)out.push({label:base.join(" › "),chs:kf});
        else kf.forEach(c=>out.push({label:[...base,c.titre].join(" › "),chs:[c]}));
      });
    });
  });
  return out;
}
function renderPanel(){
  const cs=selected(),n=qcount(cs);
  renderSrc(cs);
  $("selinfo").textContent=n?cs.length+" chapitre(s) · "+n+" QCM disponible(s)"+(filtersOn()?" · filtres actifs":""):cs.length?"Aucun QCM ne correspond à ces filtres.":"Rien de sélectionné : coche des thèmes, des sections ou des chapitres, ou utilise « ▶ Lancer » sur une ligne.";
  $("chips").innerHTML="";
  chipGroups().forEach(g=>{
    const c=document.createElement("span");c.className="chip";c.append(document.createTextNode(g.label));
    const b=document.createElement("button");b.textContent="×";b.setAttribute("aria-label","Retirer "+g.label);
    b.onclick=()=>{setAll(g.chs,false);renderTree()};c.append(b);$("chips").append(c);
  });
  updateStart();
}
function renderSrc(cs){   // menus de filtre : chaque choix affiche le nombre de QCM obtenu sur la sélection (ou sur tout si rien n’est coché), en tenant compte des autres filtres
  const all=allChaps().flatMap(c=>c.questions),allKeys=new Set(all.map(q=>q.source.key)),hasRefs=all.some(q=>q.source.refs.length);
  $("srcrow").classList.toggle("hidden",allKeys.size<2&&srcFilter==="all");   // inutile si toutes les questions ont la même origine
  $("annset").classList.toggle("hidden",!hasRefs&&!minRefs&&!yearsOff.size);      // filtres d’annales : seulement si les données ont des références
  const base=(cs.length?cs:allChaps()).flatMap(c=>c.questions);
  const fill=(el,items,cur)=>{el.innerHTML="";items.forEach(([v,t])=>{const o=document.createElement("option");o.value=v;o.textContent=t;el.append(o)});el.value=cur};
  const ps=base.filter(q=>passBy(q,"src")),cnt=new Map();
  ps.forEach(q=>cnt.set(q.source.key,(cnt.get(q.source.key)||0)+1));
  fill($("srcsel"),[["all","Toutes les origines · "+ps.length],...[...allKeys].sort(srcSort).map(k=>[k,srcName(k)+" uniquement · "+(cnt.get(k)||0)])],srcFilter);
  const py=base.filter(q=>passBy(q,"year")),box=$("yrlist"),fo=document.activeElement&&document.activeElement.dataset?document.activeElement.dataset.yr:undefined;
  box.innerHTML="";   // une case par année, avec le nombre de QCM concernés
  yearList().forEach(y=>{
    const n=py.filter(q=>q.source.refs.some(r=>r.annee===y)).length;
    const l=document.createElement("label");l.className="chk yr";
    const c=document.createElement("input");c.type="checkbox";c.checked=!yearsOff.has(y);c.dataset.yr=y;
    c.onchange=()=>{c.checked?yearsOff.delete(y):yearsOff.add(y);renderTree()};
    l.append(c,document.createTextNode(y+" · "+n));box.append(l);
    if(fo===y)c.focus();   // le clavier garde sa place après le rafraîchissement
  });
}
function updateStart(){
  const n=qcount(selected()),k=Math.min(Math.max(1,+$("nq").value||5),n);
  $("start").textContent=n?"Lancer le QCM · "+k+" question"+(k>1?"s":""):"Lancer le QCM";
  $("start").disabled=!n;
}
function showSetup(){
  $("setup").classList.remove("hidden");$("quiz").classList.add("hidden");$("end").classList.add("hidden");$("sub").classList.remove("hidden");
  $("curtheme").textContent="";$("curdesc").textContent="";$("err").textContent="";showProgBtn(true);renderTree();
}
function quizLabel(cs){   // ex. « Thème : Appareil respiratoire (Histologie) » ou « Thèmes : A · B »
  const parts=[];
  themes.forEach(t=>{
    const inc=t.chapitres.filter(c=>cs.includes(c));
    if(!inc.length)return;
    if(inc.length===t.chapitres.length){parts.push(t.nom);return}
    const names=[];
    t.sections.forEach(sec=>{
      const k=sec.chapitres.filter(c=>cs.includes(c));
      if(!k.length)return;
      if(sec.show&&k.length===sec.chapitres.length){names.push(sec.nom);return}
      sec.files.forEach(f=>{
        const kf=f.chapitres.filter(c=>cs.includes(c));
        if(!kf.length)return;
        if(sec.showFiles&&kf.length===f.chapitres.length)names.push(f.titre);else names.push(...kf.map(c=>c.titre));
      });
    });
    parts.push(t.nom+" ("+names.join(", ")+")");
  });
  return(parts.length>1?"Thèmes : ":"Thème : ")+parts.join(" · ");
}
function launch(cs){
  if(!qcount(cs)){$("err").textContent="Aucune question dans cette sélection.";return}
  current=cs;start();
}

function build(q,o){
  const G=q.bonnes.length,M=q.mauvaises.length,qrp=q.type==="qrp";
  const multi=q.type==="qcm";               // qcu et qrp : nombre de bonnes réponses fixé, jamais « Toutes les réponses précédentes sont fausses »
  const total=Math.min(PROPS,(qrp?q.n:multi?G:1)+M);   // nombre de propositions affichées
  const lo=Math.max(0,total-M);             // il faut assez de mauvaises pour compléter
  const hi=Math.min(o.kmax,G,total);
  const k=qrp?q.n:!multi?1:lo<=hi?rnd(lo,hi):hi;   // nombre de bonnes réponses : nb_bonnes tirées au hasard (qrp), une (qcu), nombre tiré au hasard (qcm)
  const m=Math.min(M,total-k);              // le reste : mauvaises réponses
  const mk=v=>a=>({t:a.reponse,why:a.explication,ok:v,annale:a.annale});
  const good=shuffle(q.bonnes).slice(0,k).map(mk(true));
  const telQuel=q.source.key==="annale"&&[...q.bonnes,...q.mauvaises].every(a=>a.annale);   // QCM d’annale repris tel quel : tous ses items restent affichés
  let opts;
  if(multi&&G===0){
    // Aucune bonne réponse dans le fichier (QCM d’annale dont tous les items sont faux) : « Toutes les réponses précédentes sont fausses » s’ajoute en dernier (4 items + elle ; au-delà de 4 items, l’un d’eux, tiré au hasard, n’est pas affiché)
    opts=[...shuffle(q.mauvaises).slice(0,PROPS-1).map(mk(false)),{t:NONE_TEXT,why:NONE_WHY,ok:true}];
  }else if(multi&&k===0&&m>=2){
    // Aucune bonne réponse tirée : la dernière proposition devient « Toutes les réponses précédentes sont fausses » (qui est alors la bonne réponse)
    const bad=shuffle(q.mauvaises).slice(0,m-1).map(mk(false));
    opts=[...bad,{t:NONE_TEXT,why:NONE_WHY,ok:true}];
  }else{
    const bad=shuffle(q.mauvaises).slice(0,m).map(mk(false));
    opts=shuffle([...good,...bad]);
    if(multi&&!telQuel&&k>=1&&m>=1&&Math.random()<NONE_PROB){
      // Au moins une bonne réponse : « Toutes les réponses précédentes sont fausses » est un piège, placé en dernier à la place d’une mauvaise réponse
      const drop=bad[rnd(0,bad.length-1)];
      opts=opts.filter(x=>x!==drop);
      opts.push({t:NONE_TEXT,why:NONE_WHY_FALSE,ok:false});
    }
  }
  return{type:q.type,n:k,question:q.question,path:q.path,cours:q.cours,source:q.source,opts,answered:false,skipped:false,sel:[],perfect:false};
}
function wshuffle(a){   // tirage au hasard favorisant les questions les plus souvent tombées (poids = 1 + 2 × nombre de références)
  return a.map(q=>({q,k:Math.pow(Math.random(),1/(1+2*q.source.refs.length))})).sort((x,y)=>y.k-x.k).map(x=>x.q);
}
function filterLabel(){
  const p=[];
  if(srcFilter!=="all")p.push(srcName(srcFilter)+" uniquement");
  if(yearsOff.size){const on=yearList().filter(y=>!yearsOff.has(y));p.push("annales "+(on.length===0?"(aucune année cochée)":on.length>3?on.length+" années":on.join(", ")))}
  if(minRefs)p.push("tombées au moins "+minRefs+" fois");
  if(favor)p.push("favorise les plus tombées");
  return p.length?" · "+p.join(" · "):"";
}
function start(){
  const qs=current.flatMap(qlist);
  const o={kmax:Math.max(0,$("kmax").value===""?5:+$("kmax").value)};
  const nq=Math.max(1,Math.min(+$("nq").value||5,qs.length));
  quiz=(favor?wshuffle(qs):shuffle(qs)).slice(0,nq).map(q=>build(q,o));
  i=0;$("err").textContent="";closeCourse();closeProg();showProgBtn(false);
  $("curtheme").textContent=quizLabel(current)+filterLabel();$("curdesc").textContent="";$("sub").classList.add("hidden");
  $("setup").classList.add("hidden");$("end").classList.add("hidden");$("quiz").classList.remove("hidden");
  show();
}
function renderNav(){
  $("nav").innerHTML="";
  quiz.forEach((q,n)=>{
    const b=document.createElement("button");
    b.className="sq"+(q.answered?(q.perfect?" ok":" ko"):"")+(q.skipped&&!q.answered?" skip":"")+(n===i?" cur":"");
    b.textContent=n+1;b.title="Question "+(n+1)+(q.answered?(q.perfect?" : juste":" : fausse"):q.skipped?" : passée":"");b.onclick=()=>go(n);$("nav").append(b);
  });
}
function go(n){i=n;show()}
function show(){
  const q=quiz[i];
  $("count").textContent="Question "+(i+1)+" / "+quiz.length;
  $("q").textContent=q.question;$("qtags").textContent=q.path;renderSource(q.source);$("fb").textContent="";$("opts").innerHTML="";
  if(q.type==="qrp"){const t=document.createElement("span");t.className="badge qrp";t.textContent="QRP";t.title=q.n+" réponses attendues";$("qsrc").prepend(t);$("qsrc").classList.remove("hidden")}
  const cb=$("seecourse");cb.classList.toggle("hidden",!q.cours);if(q.cours)cb.textContent="Voir dans le cours · p. "+q.cours.page;
  if(q.cours&&!$("course").classList.contains("hidden"))openCourse(q.cours);   // volet déjà ouvert : il suit la question
  q.opts.forEach((o,n)=>{
    const l=document.createElement("label");l.className="opt";
    const c=document.createElement("input");c.type="checkbox";
    const d=document.createElement("div");
    const s=document.createElement("span");s.textContent=o.t;d.append(s);
    if(q.answered){
      c.checked=q.sel[n];c.disabled=true;l.classList.add("locked");
      if(c.checked&&o.ok)l.classList.add("good");
      else if(c.checked&&!o.ok)l.classList.add("bad");
      else if(!c.checked&&o.ok)l.classList.add("missed");
      if(o.why){const w=document.createElement("div");w.className="why";w.textContent=(o.ok?"✓ Bonne réponse : ":"✗ Mauvaise réponse : ")+o.why;d.append(w)}
    }
    if(q.type==="qrp"&&!q.answered)c.onchange=()=>qrpLimit(q.n);
    l.append(c,d);$("opts").append(l);
  });
  if(q.type==="qrp"&&!q.answered)qrpLimit(q.n);
  if(q.answered){
    const nb=q.opts.filter(o=>o.ok).length;
    $("fb").style.color=q.perfect?"var(--ok)":"var(--ko)";
    $("fb").textContent=(q.perfect?"✓ Correct !":"✗ Incorrect.")+" "+(nb===0?"Il n’y avait aucune bonne réponse.":nb+" bonne(s) réponse(s) attendue(s).");
  }
  $("valid").classList.toggle("hidden",q.answered);
  $("next").textContent=q.answered?"Suivante →":"Passer →";
  $("prev").disabled=i===0;
  renderNav();
}
function qrpLimit(n){   // QRP : une fois n cases cochées, les autres sont grisées (décocher les libère)
  const cs=[...$("opts").querySelectorAll("input")],full=cs.filter(c=>c.checked).length>=n;
  cs.forEach(c=>{c.disabled=full&&!c.checked;c.closest("label").classList.toggle("full",c.disabled)});
}
function renderSource(s){   // pastille d’origine + références d’annales
  const b=$("qsrc");b.innerHTML="";
  if(!s||s.key==="inconnue"){b.classList.add("hidden");return}
  b.classList.remove("hidden");
  const t=document.createElement("span");t.className="badge "+s.key;t.textContent=(s.key==="annale"?"📚 ":s.key==="genere"?"✨ ":"")+s.label;b.append(t);
  if(s.refs.length){
    const r=document.createElement("span");r.className="refs";
    r.textContent=s.refs.map(x=>[x.sujet,x.annee,x.qcm?"QCM "+x.qcm:""].filter(Boolean).join(" ")).join(" · ");b.append(r);
  }
}
function validate(){
  const q=quiz[i];if(q.answered)return;
  q.sel=[...$("opts").querySelectorAll("input")].map(c=>c.checked);
  q.perfect=q.opts.every((o,n)=>o.ok===q.sel[n]);
  q.answered=true;show();
}
function nextTarget(){
  for(let d=1;d<quiz.length;d++){const j=(i+d)%quiz.length;if(!quiz[j].answered)return j}
  return -1;
}
function next(){
  const q=quiz[i];
  if(!q.answered)q.skipped=true;
  const t=nextTarget();
  if(t>=0)go(t);
  else if(q.answered)finish();
  else{renderNav();$("fb").style.color="var(--muted)";$("fb").textContent="C’est la dernière question sans réponse : réponds-y, ou clique sur « Terminer »."}
}
function finish(){
  const ok=quiz.filter(q=>q.perfect).length,un=quiz.filter(q=>!q.answered).length;
  closeCourse();$("quiz").classList.add("hidden");$("end").classList.remove("hidden");
  $("score").textContent="Score : "+ok+" / "+quiz.length+" ("+Math.round(ok/quiz.length*100)+" %)";
  $("unans").textContent=un?un+" question(s) sans réponse.":"";
  const g=new Map();   // résultats par origine (annale / généré…)
  quiz.forEach(q=>{const x=g.get(q.source.key)||{n:0,ok:0,un:0};x.n++;if(q.perfect)x.ok++;if(!q.answered)x.un++;g.set(q.source.key,x)});
  const bs=$("bysrc");bs.innerHTML="";
  if(g.size>1){
    const h=document.createElement("strong");h.textContent="Par origine";bs.append(h);
    [...g.keys()].sort(srcSort).forEach(k=>{const x=g.get(k),d=document.createElement("div");
      d.textContent=(srcLabels.get(k)||k)+" : "+x.ok+" / "+x.n+" juste(s)"+(x.n-x.un?" ("+Math.round(x.ok/(x.n-x.un)*100)+" % des questions répondues)":"")+(x.un?" · "+x.un+" sans réponse":"");bs.append(d)});
  }
  const ko=quiz.map((q,n)=>q.answered&&!q.perfect?"n°"+(n+1)+" "+q.question:null).filter(Boolean);
  $("miss").textContent=ko.length?"À revoir : "+ko.join(" · "):(un?"":"Sans faute, bravo !");
}

// ----- Volet « Cours » : le PDF s’ouvre à la bonne page, le passage est surligné -----
// Recherche d’un texte dans les éléments de texte d’une page PDF (accents, majuscules, espaces et césures ignorés).
// Renvoie les morceaux à surligner : [{i: numéro de l’élément, k0, k1: positions des caractères}]
function normChars(s){
  return[...s.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[’‘ʼ´`]/g,"'").replace(/[‐‑–—−]/g,"-")].filter(c=>!/\s/.test(c)&&c!=="\u00ad");
}
function matchSpans(items,term){
  const t=normChars(term);if(!t.length)return[];
  const text=[],src=[];
  items.forEach((it,idx)=>{
    if(typeof it.str!=="string")return;
    const s=it.str,hyph=it.hasEOL&&s.length>1&&/[-\u00ad]$/.test(s);   // mot coupé en fin de ligne : on ignore le tiret
    for(let k=0;k<s.length;k++){
      if(hyph&&k===s.length-1)break;
      normChars(s[k]).forEach(c=>{text.push(c);src.push({i:idx,k})});
    }
  });
  const hay=text.join(""),needle=t.join(""),found=[];
  let from=0;
  while(true){
    const p=hay.indexOf(needle,from);if(p<0)break;
    const byItem=new Map();
    for(let j=p;j<p+needle.length;j++){
      const {i:ii,k}=src[j],cur=byItem.get(ii);
      byItem.set(ii,cur?{k0:Math.min(cur.k0,k),k1:Math.max(cur.k1,k)}:{k0:k,k1:k});
    }
    byItem.forEach((v,ii)=>found.push({i:ii,k0:v.k0,k1:v.k1}));
    from=p+needle.length;
  }
  return found;
}
let pdfLibP=null;
const pdfDocs=new Map();
let cv={file:"",page:1,target:1,term:"",token:0,zoom:1};   // zoom : 1 = largeur du volet
let big=false;                                            // volet agrandi (plein écran sur ordinateur)
function loadPdfJs(){
  if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);
  if(!pdfLibP)pdfLibP=new Promise((res,rej)=>{
    const s=document.createElement("script");s.src=PDFJS_CDN+"pdf.min.js";
    s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_CDN+"pdf.worker.min.js";res(window.pdfjsLib)};
    s.onerror=()=>{pdfLibP=null;rej(new Error("la bibliothèque d’affichage des PDF n’a pas pu être chargée"))};
    document.head.append(s);
  });
  return pdfLibP;
}
function openCourse(c){
  $("course").classList.remove("hidden");$("quiz").classList.add("course-open");
  cv.file=c.fichier;cv.target=c.page;cv.term=c.surligner||"";
  $("cname").textContent=c.fichier.split("/").pop();
  showPage(c.page);
}
let cmenu=false;   // cours ouvert depuis l’accueil (en plein écran par-dessus la page) et non pendant un QCM
function placeCourse(inQuiz){const c=$("course"),t=document.querySelector(inQuiz?".qlayout":"main");if(c.parentNode!==t)t.append(c)}
function openCourseMenu(f){cv.zoom=1;placeCourse(false);cmenu=true;$("course").classList.add("menu");setBig(true,true);openCourse({fichier:f,page:1})}
function closeCourse(){cv.token++;setBig(false,true);cmenu=false;$("course").classList.remove("menu");$("course").classList.add("hidden");$("quiz").classList.remove("course-open");placeCourse(true)}
const isNarrow=()=>window.matchMedia&&window.matchMedia("(max-width:860px)").matches;
function setBig(on,quiet){   // agrandir / réduire le volet (le zoom revient à « ajusté à la largeur »)
  big=on;$("course").classList.toggle("big",on);$("cbig").textContent=on?"Réduire":"Agrandir";
  if(quiet)return;cv.zoom=1;showPage(cv.page);
}
function zoomBy(d){cv.zoom=Math.min(4,Math.max(0.5,Math.round((cv.zoom+d)*100)/100));showPage(cv.page,true)}
async function showPage(n,keep){
  const token=++cv.token,box=$("pdfpage");
  $("cnote").textContent="Chargement du cours…";
  try{
    const lib=await loadPdfJs();
    let doc=pdfDocs.get(cv.file);
    if(!doc){doc=await lib.getDocument(encodeURI(cv.file)).promise;pdfDocs.set(cv.file,doc)}
    if(token!==cv.token)return;
    n=Math.min(Math.max(1,n),doc.numPages);cv.page=n;
    $("cnum").value=n;$("cnum").max=doc.numPages;$("ctotal").textContent=doc.numPages;$("cfit").textContent=Math.round(cv.zoom*100)+" %";
    $("cprev").disabled=n<=1;$("cnext").disabled=n>=doc.numPages;
    const page=await doc.getPage(n);
    const width=Math.max(280,$("pdfbody").clientWidth-24),base=page.getViewport({scale:1});
    const vp=page.getViewport({scale:Math.min(6,Math.min(3,width/base.width)*cv.zoom)}),ratio=window.devicePixelRatio||1;
    const canvas=document.createElement("canvas");
    canvas.width=Math.floor(vp.width*ratio);canvas.height=Math.floor(vp.height*ratio);
    canvas.style.width=vp.width+"px";canvas.style.height=vp.height+"px";
    await page.render({canvasContext:canvas.getContext("2d"),viewport:vp,transform:ratio!==1?[ratio,0,0,ratio,0,0]:null}).promise;
    if(token!==cv.token)return;
    box.innerHTML="";box.append(canvas);$("cnote").textContent="";if(!keep)$("pdfbody").scrollTop=0;
    if(cv.term&&n===cv.target){
      const items=(await page.getTextContent()).items,rects=[];
      matchSpans(items,cv.term).forEach(sp=>{
        const it=items[sp.i],len=it.str.length||1,tr=it.transform,h=it.height||Math.hypot(tr[2],tr[3]);
        const x0=tr[4]+it.width*(sp.k0/len),x1=tr[4]+it.width*((sp.k1+1)/len);
        const a=vp.convertToViewportPoint(x0,tr[5]-h*0.2),b=vp.convertToViewportPoint(x1,tr[5]+h*0.85);
        rects.push({l:Math.min(a[0],b[0]),t:Math.min(a[1],b[1]),w:Math.abs(b[0]-a[0]),h:Math.abs(b[1]-a[1])});
      });
      rects.forEach(r=>{const d=document.createElement("div");d.className="hl";
        d.style.cssText="left:"+(r.l-2)+"px;top:"+(r.t-1)+"px;width:"+(r.w+4)+"px;height:"+(r.h+2)+"px";box.append(d)});
      if(rects.length){if(!keep)box.querySelector(".hl").scrollIntoView({block:"center",inline:"center"})}
      else $("cnote").textContent="Passage « "+cv.term+" » introuvable sur cette page (le PDF contient-il du texte sélectionnable ?).";
    }
  }catch(e){
    if(token!==cv.token)return;
    $("pdfpage").innerHTML="";$("cnote").textContent="";
    const msg=document.createElement("span");msg.textContent="Impossible d’afficher le cours ici ("+e.message+"). ";
    const a=document.createElement("a");a.href=encodeURI(cv.file)+"#page="+cv.target;a.target="_blank";a.rel="noopener";a.textContent="Ouvrir le PDF dans un nouvel onglet";
    $("cnote").append(msg,a);
  }
}

$("start").onclick=()=>launch(selected());$("valid").onclick=validate;$("next").onclick=next;
$("prev").onclick=()=>go(i-1);$("finish").onclick=finish;
$("review").onclick=()=>{$("end").classList.add("hidden");$("quiz").classList.remove("hidden");show()};
$("again").onclick=start;
$("back").onclick=showSetup;
$("selall").onclick=()=>{setAll(allChaps(),true);renderTree()};
$("selnone").onclick=()=>{sel.clear();renderTree()};
$("expall").onclick=()=>{themes.forEach(t=>{openT.add(t);t.sections.forEach(s=>{openS.add(s);s.files.forEach(f=>openF.add(f))})});renderTree()};
$("colall").onclick=()=>{openT.clear();openS.clear();openF.clear();renderTree()};
document.querySelectorAll(".step").forEach(b=>b.onclick=()=>{
  const inp=$(b.dataset.for);inp.value=Math.max(+inp.min||0,(+inp.value||0)+(+b.dataset.d));inp.dispatchEvent(new Event("input"));
});
["nq","kmax"].forEach(id=>$(id).oninput=updateStart);
$("srcsel").onchange=e=>{srcFilter=e.target.value;renderTree()};
$("yrall").onclick=()=>{yearsOff.clear();renderTree()};
$("yrnone").onclick=()=>{years.forEach(y=>yearsOff.add(y));renderTree()};
$("minref").oninput=e=>{minRefs=Math.max(0,Math.floor(+e.target.value||0));renderTree()};
$("favor").onchange=e=>{favor=e.target.checked};
$("seecourse").onclick=()=>{const q=quiz[i];if(q&&q.cours)openCourse(q.cours)};
$("cclose").onclick=closeCourse;
$("cbig").onclick=()=>setBig(!big);
$("cminus").onclick=()=>zoomBy(-0.25);$("cplus").onclick=()=>zoomBy(0.25);
$("cfit").onclick=()=>{cv.zoom=1;showPage(cv.page,true)};
$("cnum").onchange=()=>showPage(Math.round(+$("cnum").value)||cv.page);
$("pdfpage").onclick=()=>{if(!big&&!isNarrow())setBig(true)};   // un clic sur la page agrandit le volet
document.addEventListener("keydown",e=>{   // clavier : ← → pages, + − zoom, Échap réduit
  if($("course").classList.contains("hidden"))return;
  const t=e.target,tag=t&&t.tagName;if(tag==="INPUT"||tag==="TEXTAREA"||(t&&t.isContentEditable))return;
  if(e.key==="Escape"){if(cmenu)closeCourse();else if(big)setBig(false)}
  else if(e.key==="ArrowLeft"){e.preventDefault();showPage(cv.page-1)}
  else if(e.key==="ArrowRight"){e.preventDefault();showPage(cv.page+1)}
  else if(e.key==="+"||e.key==="="){zoomBy(0.25)}
  else if(e.key==="-"){zoomBy(-0.25)}
});
$("progbtn").onclick=openProg;$("progclose").onclick=closeProg;$("progbg").onclick=closeProg;
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeProg()});
$("cprev").onclick=()=>showPage(cv.page-1);
$("cnext").onclick=()=>showPage(cv.page+1);
init();
