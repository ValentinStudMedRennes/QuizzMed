const $=id=>document.getElementById(id);
const DATA_DIR="data/";
const NONE_TEXT="Toutes les réponses précédentes sont fausses";   // proposition ajoutée quand 0 bonne réponse est tirée
const NONE_WHY="Aucune des autres propositions n’est correcte.";
const NONE_WHY_FALSE="Faux : au moins une des propositions précédentes est correcte.";
const NONE_PROB=1/15;   // probabilité que « Toutes les réponses précédentes sont fausses » apparaisse (en mauvaise réponse) dans une question qui a au moins une bonne réponse
const PDFJS_VERSION="3.11.174";   // bibliothèque d’affichage des PDF (chargée seulement quand on ouvre un cours)
const PDFJS_CDN="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/"+PDFJS_VERSION+"/";
let themes=[],quiz=[],i=0;
const sel=new Set();             // chapitres cochés (tous thèmes confondus)
const openT=new Set(),openS=new Set();   // thèmes et sections dépliés (fermés par défaut)
let current=[];                  // chapitres du QCM en cours
const rnd=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
function shuffle(a){a=a.slice();for(let j=a.length-1;j>0;j--){const k=rnd(0,j);[a[j],a[k]]=[a[k],a[j]]}return a}

async function getJSON(name){
  const r=await fetch(DATA_DIR+name,{cache:"no-store"});
  if(!r.ok)throw new Error("fichier « "+name+" » introuvable ("+r.status+")");
  try{return await r.json()}catch(e){throw new Error("« "+name+" » n’est pas un JSON valide : "+e.message)}
}
// Une réponse : { "reponse": "…", "explication": "…" }
function ans(a){
  if(!a||typeof a!=="object"||Array.isArray(a))return null;
  if(typeof a.reponse!=="string"&&typeof a.reponse!=="number")return null;
  return{reponse:String(a.reponse),explication:typeof a.explication==="string"?a.explication:""};
}
function uniq(list){const seen=new Set();return list.filter(a=>!seen.has(a.reponse)&&seen.add(a.reponse))}
// Lien vers le cours : "cours": { "fichier": "cours/x.pdf", "page": 12, "surligner": "texte à retrouver sur la page" }
// "fichier" (et "page") peuvent être donnés une fois pour tout le fichier ou pour un chapitre, dans leur "meta.cours".
function asCours(v){
  if(typeof v==="string")return{fichier:v};
  if(typeof v==="number")return{page:v};
  return v&&typeof v==="object"&&!Array.isArray(v)?v:{};
}
function coursOf(c,def){
  const x={...def,...asCours(c)};
  const fichier=typeof x.fichier==="string"?x.fichier.trim():"";
  const page=Math.round(+x.page||0);
  if(!fichier||page<1)return null;
  return{fichier,page,surligner:typeof x.surligner==="string"?x.surligner.trim():""};
}
function clean(list,where,warns,def){
  if(!Array.isArray(list)){warns.push(where+" : « questions » doit être une liste [ … ]");return[]}
  const out=[];
  list.forEach((x,n)=>{
    const type=x&&x.type!==undefined?String(x.type).toLowerCase():"qcm";
    if(type!=="qcm"){warns.push(where+" : question n°"+(n+1)+" ignorée (type « "+type+" » pas encore pris en charge)");return}
    const ok=x&&typeof x.question==="string"&&Array.isArray(x.bonnes)&&Array.isArray(x.mauvaises);
    const b=ok?x.bonnes.map(ans):[],m=ok?x.mauvaises.map(ans):[];
    if(!ok||b.includes(null)||m.includes(null)||b.length+m.length===0){warns.push(where+" : question n°"+(n+1)+" ignorée (attendu : question, bonnes et mauvaises, avec « reponse » dans chaque réponse)");return}
    out.push({id:x.id!==undefined?String(x.id):null,type:"qcm",question:x.question,bonnes:uniq(b),mauvaises:uniq(m),cours:coursOf(x.cours,def)});
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
  const fdef=asCours(meta.cours);
  raw.chapitres.forEach((c,n)=>{
    const titre=str(c&&c.meta&&c.meta.titre)||"Chapitre "+(n+1);
    const questions=clean(c&&c.questions,file+" › "+titre,warns,{...fdef,...asCours(c&&c.meta&&c.meta.cours)});
    questions.forEach(q=>{q.chapitre=titre});
    if(questions.length)f.chapitres.push({titre,questions});
  });
  return f;
}
// Thème > sections (un fichier chacune) > chapitres
function groupFiles(files){
  const out=[],byKey=new Map();
  files.forEach(f=>{
    let t=f.theme?byKey.get(f.theme.toLowerCase()):null;
    if(!t){t={nom:f.theme||f.titre,description:f.theme?"":f.description,sections:[],chapitres:[]};out.push(t);if(f.theme)byKey.set(f.theme.toLowerCase(),t)}
    const sec={nom:f.section||f.titre,description:f.theme?f.description:"",explicit:!!f.section,chapitres:[]};
    f.chapitres.forEach(c=>{sec.chapitres.push(c)});
    if(sec.chapitres.length)t.sections.push(sec);
  });
  out.forEach(t=>{
    t.sections.forEach(sec=>{
      sec.show=t.sections.length>1||sec.explicit;   // titre de section affiché seulement s’il y en a plusieurs (ou si "section" est renseignée)
      sec.chapitres.forEach(c=>c.questions.forEach(q=>{q.theme=t.nom;q.path=[t.nom,...(sec.show?[sec.nom]:[]),c.titre].join(" › ")}));
    });
    t.chapitres=t.sections.flatMap(sec=>sec.chapitres);
  });
  return out.filter(t=>t.chapitres.length);
}
async function init(){
  const warns=[],files=[];
  try{
    const list=await getJSON("themes.json");
    if(!Array.isArray(list))throw new Error("« themes.json » doit être une liste de noms de fichiers");
    for(const f of list){
      try{
        if(typeof f!=="string")throw new Error("themes.json : chaque entrée doit être un nom de fichier, par exemple \"cardiologie.json\"");
        files.push(parseFile(await getJSON(f),f,warns));
      }catch(err){warns.push(err.message)}
    }
  }catch(e){
    $("load").style.color="var(--ko)";
    $("load").textContent="Impossible de charger les données : "+e.message+". Si tu ouvres le fichier directement depuis ton disque, lance un petit serveur local (python3 -m http.server) ou héberge le dossier en ligne.";
    return;
  }
  themes=groupFiles(files);
  $("load").textContent=warns.length?"⚠ "+warns.join(" — "):"";
  $("load").style.color="var(--ko)";
  $("settings").open=window.matchMedia?window.matchMedia("(min-width:861px)").matches:true;   // réglages repliés sur téléphone
  showSetup();
}

// ----- Accueil : arbre thèmes › sections › chapitres + panneau « Ton QCM » -----
const qcount=cs=>cs.reduce((n,c)=>n+c.questions.length,0);
const allChaps=()=>themes.flatMap(t=>t.chapitres);
const selected=()=>allChaps().filter(c=>sel.has(c));
function setAll(chs,on){chs.forEach(c=>on?sel.add(c):sel.delete(c))}
function toggleSet(set,x){set.has(x)?set.delete(x):set.add(x);renderTree()}
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
  d.append(c,m,n,p);return d;
}
function renderTree(){
  const L=$("treelist");L.innerHTML="";
  themes.forEach(t=>{
    const n=t.chapitres.filter(c=>sel.has(c)).length,tot=t.chapitres.length,opened=openT.has(t);
    L.append(row({lvl:0,open:opened,onChev:()=>toggleSet(openT,t),checked:n===tot,partial:n>0&&n<tot,title:t.nom,
      sub:[t.description,t.sections.length>1?t.sections.length+" sections":"",tot+" chapitre(s)",n>0&&n<tot?n+" coché(s)":""].filter(Boolean).join(" · "),
      count:qcount(t.chapitres),onToggle:e=>{setAll(t.chapitres,e.target.checked);renderTree()},
      onMain:()=>toggleSet(openT,t),onPlay:()=>launch(t.chapitres)}));
    if(!opened)return;
    t.sections.forEach(sec=>{
      const sOpen=!sec.show||openS.has(sec);   // sans en-tête de section, les chapitres sont directement visibles
      if(sec.show){
        const k=sec.chapitres.filter(c=>sel.has(c)).length,st=sec.chapitres.length;
        L.append(row({lvl:1,open:sOpen,onChev:()=>toggleSet(openS,sec),checked:k===st,partial:k>0&&k<st,title:sec.nom,
          sub:[sec.description,st+" chapitre(s)",k>0?k+" coché(s)":""].filter(Boolean).join(" · "),count:qcount(sec.chapitres),
          onToggle:e=>{setAll(sec.chapitres,e.target.checked);renderTree()},onMain:()=>toggleSet(openS,sec),onPlay:()=>launch(sec.chapitres)}));
      }
      if(sOpen)sec.chapitres.forEach(c=>L.append(row({lvl:sec.show?2:1,checked:sel.has(c),title:c.titre,count:c.questions.length,
        onToggle:e=>{setAll([c],e.target.checked);renderTree()},onMain:()=>{setAll([c],!sel.has(c));renderTree()},onPlay:()=>launch([c])})));
    });
  });
  renderPanel();
}
function chipGroups(){   // résumé de la sélection : un thème entier = une étiquette, sinon section entière ou chapitre
  const out=[];
  themes.forEach(t=>{
    const inc=t.chapitres.filter(c=>sel.has(c));
    if(!inc.length)return;
    if(inc.length===t.chapitres.length){out.push({label:t.nom,chs:inc});return}
    t.sections.forEach(s=>{
      const k=s.chapitres.filter(c=>sel.has(c));
      if(!k.length)return;
      if(s.show&&k.length===s.chapitres.length)out.push({label:t.nom+" › "+s.nom,chs:k});
      else k.forEach(c=>out.push({label:[t.nom,...(s.show?[s.nom]:[]),c.titre].join(" › "),chs:[c]}));
    });
  });
  return out;
}
function renderPanel(){
  const cs=selected(),n=qcount(cs);
  $("selinfo").textContent=n?cs.length+" chapitre(s) · "+n+" QCM disponible(s)":"Rien de sélectionné : coche des thèmes, des sections ou des chapitres, ou utilise « ▶ Lancer » sur une ligne.";
  $("chips").innerHTML="";
  chipGroups().forEach(g=>{
    const c=document.createElement("span");c.className="chip";c.append(document.createTextNode(g.label));
    const b=document.createElement("button");b.textContent="×";b.setAttribute("aria-label","Retirer "+g.label);
    b.onclick=()=>{setAll(g.chs,false);renderTree()};c.append(b);$("chips").append(c);
  });
  updateStart();
}
function updateStart(){
  const n=qcount(selected()),k=Math.min(Math.max(1,+$("nq").value||5),n);
  $("start").textContent=n?"Lancer le QCM · "+k+" question"+(k>1?"s":""):"Lancer le QCM";
  $("start").disabled=!n;
}
function showSetup(){
  $("setup").classList.remove("hidden");$("quiz").classList.add("hidden");$("end").classList.add("hidden");$("sub").classList.remove("hidden");
  $("curtheme").textContent="";$("curdesc").textContent="";$("err").textContent="";renderTree();
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
      if(sec.show&&k.length===sec.chapitres.length)names.push(sec.nom);else names.push(...k.map(c=>c.titre));
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
  const G=q.bonnes.length,M=q.mauvaises.length;
  const total=Math.min(o.total,G+M);        // nombre de propositions affichées
  const lo=Math.max(0,total-M);             // il faut assez de mauvaises pour compléter
  const hi=Math.min(o.kmax,G,total);
  const k=lo<=hi?rnd(lo,hi):hi;             // nombre de bonnes réponses tiré au hasard
  const m=Math.min(M,total-k);              // le reste : mauvaises réponses
  const mk=v=>a=>({t:a.reponse,why:a.explication,ok:v});
  const good=shuffle(q.bonnes).slice(0,k).map(mk(true));
  let opts;
  if(k===0&&m>=2){
    // Aucune bonne réponse tirée : la dernière proposition devient « Toutes les réponses précédentes sont fausses » (qui est alors la bonne réponse)
    const bad=shuffle(q.mauvaises).slice(0,m-1).map(mk(false));
    opts=[...bad,{t:NONE_TEXT,why:NONE_WHY,ok:true}];
  }else{
    const bad=shuffle(q.mauvaises).slice(0,m).map(mk(false));
    opts=shuffle([...good,...bad]);
    if(k>=1&&m>=1&&Math.random()<NONE_PROB){
      // Au moins une bonne réponse : « Toutes les réponses précédentes sont fausses » est un piège, placé en dernier à la place d’une mauvaise réponse
      const drop=bad[rnd(0,bad.length-1)];
      opts=opts.filter(x=>x!==drop);
      opts.push({t:NONE_TEXT,why:NONE_WHY_FALSE,ok:false});
    }
  }
  return{question:q.question,path:q.path,cours:q.cours,opts,answered:false,skipped:false,sel:[],perfect:false};
}
function start(){
  const qs=current.flatMap(c=>c.questions);
  const o={total:Math.max(2,+$("total").value||5),kmax:Math.max(0,$("kmax").value===""?5:+$("kmax").value)};
  const nq=Math.max(1,Math.min(+$("nq").value||5,qs.length));
  quiz=shuffle(qs).slice(0,nq).map(q=>build(q,o));
  i=0;$("err").textContent="";closeCourse();
  $("curtheme").textContent=quizLabel(current);$("curdesc").textContent="";$("sub").classList.add("hidden");
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
  $("q").textContent=q.question;$("qtags").textContent=q.path;$("fb").textContent="";$("opts").innerHTML="";
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
    l.append(c,d);$("opts").append(l);
  });
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
function closeCourse(){cv.token++;setBig(false,true);$("course").classList.add("hidden");$("quiz").classList.remove("course-open")}
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
$("expall").onclick=()=>{themes.forEach(t=>{openT.add(t);t.sections.forEach(s=>openS.add(s))});renderTree()};
$("colall").onclick=()=>{openT.clear();openS.clear();renderTree()};
document.querySelectorAll(".step").forEach(b=>b.onclick=()=>{
  const inp=$(b.dataset.for);inp.value=Math.max(+inp.min||0,(+inp.value||0)+(+b.dataset.d));updateStart();
});
["nq","total","kmax"].forEach(id=>$(id).oninput=updateStart);
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
  if(e.key==="Escape"&&big)setBig(false);
  else if(e.key==="ArrowLeft"){e.preventDefault();showPage(cv.page-1)}
  else if(e.key==="ArrowRight"){e.preventDefault();showPage(cv.page+1)}
  else if(e.key==="+"||e.key==="="){zoomBy(0.25)}
  else if(e.key==="-"){zoomBy(-0.25)}
});
$("cprev").onclick=()=>showPage(cv.page-1);
$("cnext").onclick=()=>showPage(cv.page+1);
init();
