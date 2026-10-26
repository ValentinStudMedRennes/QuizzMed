const $=id=>document.getElementById(id);
const DATA_DIR="data/";
const NONE_TEXT="Toutes les réponses précédentes sont fausses";   // proposition ajoutée quand 0 bonne réponse est tirée
const NONE_WHY="Aucune des autres propositions n’est correcte.";
const NONE_WHY_FALSE="Faux : au moins une des propositions précédentes est correcte.";
const NONE_PROB=1/15;   // probabilité que « Toutes les réponses précédentes sont fausses » apparaisse (en mauvaise réponse) dans une question qui a au moins une bonne réponse
let themes=[],quiz=[],i=0;
const sel=new Set();   // chapitres cochés (tous thèmes confondus)
let current=[];         // chapitres du QCM en cours
let view=null;          // thème ouvert (null = liste des thèmes)
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
function clean(list,where,warns){
  if(!Array.isArray(list)){warns.push(where+" : « questions » doit être une liste [ … ]");return[]}
  const out=[];
  list.forEach((x,n)=>{
    const type=x&&x.type!==undefined?String(x.type).toLowerCase():"qcm";
    if(type!=="qcm"){warns.push(where+" : question n°"+(n+1)+" ignorée (type « "+type+" » pas encore pris en charge)");return}
    const ok=x&&typeof x.question==="string"&&Array.isArray(x.bonnes)&&Array.isArray(x.mauvaises);
    const b=ok?x.bonnes.map(ans):[],m=ok?x.mauvaises.map(ans):[];
    if(!ok||b.includes(null)||m.includes(null)||b.length+m.length===0){warns.push(where+" : question n°"+(n+1)+" ignorée (attendu : question, bonnes et mauvaises, avec « reponse » dans chaque réponse)");return}
    out.push({id:x.id!==undefined?String(x.id):null,type:"qcm",question:x.question,bonnes:uniq(b),mauvaises:uniq(m)});
  });
  return out;
}
// Format d’un fichier :
// { "meta": {theme, section, titre, description}, "chapitres": [ { "meta": {titre}, "questions": [ … ] } ] }
// Les fichiers qui ont le même "meta.theme" sont regroupés dans un même thème (une section par fichier).
function parseFile(raw,file,warns){
  if(!raw||typeof raw!=="object"||!Array.isArray(raw.chapitres))
    throw new Error("« "+file+" » : format non reconnu (attendu : { \"meta\": {…}, \"chapitres\": [ … ] })");
  const meta=raw.meta&&typeof raw.meta==="object"?raw.meta:{};
  const str=v=>typeof v==="string"&&v.trim()?v.trim():"";
  const f={titre:str(meta.titre)||String(file).replace(/\.json$/i,""),theme:str(meta.theme),section:str(meta.section),description:str(meta.description),chapitres:[]};
  raw.chapitres.forEach((c,n)=>{
    const titre=str(c&&c.meta&&c.meta.titre)||"Chapitre "+(n+1);
    const questions=clean(c&&c.questions,file+" › "+titre,warns);
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
  showHome();
}

// ----- Interface : liste des thèmes, puis chapitres d’un thème -----
const qcount=cs=>cs.reduce((n,c)=>n+c.questions.length,0);
const allChaps=()=>themes.flatMap(t=>t.chapitres);
const selected=()=>allChaps().filter(c=>sel.has(c));
function item(o){   // une ligne : case à cocher, titre cliquable, nombre de QCM, bouton Lancer
  const d=document.createElement("div");d.className="item"+(o.cls?" "+o.cls:"")+(o.checked||o.partial?" on":"");
  const c=document.createElement("input");c.type="checkbox";c.checked=!!o.checked;c.indeterminate=!!o.partial;c.onchange=o.onToggle;
  const m=document.createElement("div");m.className="main";m.onclick=o.onMain;
  const t=document.createElement("strong");t.textContent=o.title;m.append(t);
  if(o.sub){const x=document.createElement("small");x.textContent=o.sub;m.append(x)}
  const n=document.createElement("span");n.className="cnt";n.textContent=o.count+" QCM";
  const p=document.createElement("button");p.className="play";p.textContent="▶ Lancer";p.disabled=o.count===0;p.onclick=o.onPlay;
  if(o.chev){const v=document.createElement("button");v.className="chev";v.textContent=o.chev;v.setAttribute("aria-expanded",o.chev==="▾");v.onclick=e=>{e.stopPropagation();o.onChev()};d.append(v)}
  d.append(c,m,n,p);return d;
}
function refresh(){view?renderTheme():renderHome()}
function refreshInfo(){
  const cs=selected(),n=qcount(cs);
  $("selinfo").textContent=n?n+" QCM dans la sélection ("+cs.length+" chapitre(s))":"Aucune sélection : coche des thèmes, des sections ou des chapitres, ou utilise « ▶ Lancer » sur une ligne.";
  $("max").textContent=n?"(max. "+n+" dans la sélection)":"";
  $("start").disabled=n===0;
}
function setAll(chs,on){chs.forEach(c=>on?sel.add(c):sel.delete(c))}
function renderHome(){
  const L=$("themelist");L.innerHTML="";
  themes.forEach(t=>{
    const n=t.chapitres.filter(c=>sel.has(c)).length,tot=t.chapitres.length;
    L.append(item({
      checked:n===tot,partial:n>0&&n<tot,title:t.nom,
      sub:[t.description,t.sections.length>1?t.sections.length+" sections":"",tot+" chapitre(s)",n>0&&n<tot?n+" coché(s)":""].filter(Boolean).join(" · "),
      count:qcount(t.chapitres),
      onToggle:e=>{setAll(t.chapitres,e.target.checked);refresh()},
      onMain:()=>openTheme(t),onPlay:()=>launch(t.chapitres)
    }));
  });
  refreshInfo();
}
const open=new Set();   // sections dépliées (fermées par défaut)
function toggleOpen(sec){open.has(sec)?open.delete(sec):open.add(sec);renderTheme()}
function renderTheme(){
  const L=$("chaplist");L.innerHTML="";
  $("expbtns").classList.toggle("hidden",!view.sections.some(s=>s.show));
  view.sections.forEach(sec=>{
    const opened=!sec.show||open.has(sec);   // sans en-tête de section, les chapitres sont toujours visibles
    if(sec.show){
      const n=sec.chapitres.filter(c=>sel.has(c)).length,tot=sec.chapitres.length;
      L.append(item({cls:"sec",chev:opened?"▾":"▸",onChev:()=>toggleOpen(sec),checked:n===tot,partial:n>0&&n<tot,title:sec.nom,
        sub:[sec.description,tot+" chapitre(s)",n>0?n+" coché(s)":""].filter(Boolean).join(" · "),count:qcount(sec.chapitres),
        onToggle:e=>{setAll(sec.chapitres,e.target.checked);refresh()},
        onMain:()=>toggleOpen(sec),onPlay:()=>launch(sec.chapitres)}));
    }
    if(opened)sec.chapitres.forEach(c=>L.append(item({
      cls:sec.show?"indent":"",checked:sel.has(c),title:c.titre,count:c.questions.length,
      onToggle:e=>{setAll([c],e.target.checked);refresh()},
      onMain:()=>{setAll([c],!sel.has(c));refresh()},onPlay:()=>launch([c])
    })));
  });
  refreshInfo();
}
function showHome(){
  view=null;$("home").classList.remove("hidden");$("themeview").classList.add("hidden");
  $("curtheme").textContent="";$("curdesc").textContent="";$("err").textContent="";renderHome();
}
function openTheme(t){
  view=t;$("home").classList.add("hidden");$("themeview").classList.remove("hidden");
  $("curtheme").textContent="Thème : "+t.nom;$("curdesc").textContent=t.description;$("err").textContent="";renderTheme();
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
  return{question:q.question,path:q.path,opts,answered:false,skipped:false,sel:[],perfect:false};
}
function start(){
  const qs=current.flatMap(c=>c.questions);
  const o={total:Math.max(2,+$("total").value||5),kmax:Math.max(0,$("kmax").value===""?5:+$("kmax").value)};
  const nq=Math.max(1,Math.min(+$("nq").value||5,qs.length));
  quiz=shuffle(qs).slice(0,nq).map(q=>build(q,o));
  i=0;$("err").textContent="";
  $("curtheme").textContent=quizLabel(current);$("curdesc").textContent="";
  $("setup").classList.add("hidden");$("end").classList.add("hidden");$("quiz").classList.remove("hidden");
  show();
}
function renderNav(){
  $("nav").innerHTML="";
  quiz.forEach((q,n)=>{
    const b=document.createElement("button");
    b.className="sq"+(q.answered?(q.perfect?" ok":" ko"):"")+(q.skipped&&!q.answered?" skip":"")+(n===i?" cur":"");
    b.textContent=n+1;b.title="Question "+(n+1);b.onclick=()=>go(n);$("nav").append(b);
  });
}
function go(n){i=n;show()}
function show(){
  const q=quiz[i];
  $("count").textContent="Question "+(i+1)+" / "+quiz.length;
  $("q").textContent=q.question;$("qtags").textContent=q.path;$("fb").textContent="";$("opts").innerHTML="";
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
  $("quiz").classList.add("hidden");$("end").classList.remove("hidden");
  $("score").textContent="Score : "+ok+" / "+quiz.length+" ("+Math.round(ok/quiz.length*100)+" %)";
  $("unans").textContent=un?un+" question(s) sans réponse.":"";
  const ko=quiz.map((q,n)=>q.answered&&!q.perfect?"n°"+(n+1)+" "+q.question:null).filter(Boolean);
  $("miss").textContent=ko.length?"À revoir : "+ko.join(" · "):(un?"":"Sans faute, bravo !");
}
$("start").onclick=()=>launch(selected());$("valid").onclick=validate;$("next").onclick=next;
$("prev").onclick=()=>go(i-1);$("finish").onclick=finish;
$("review").onclick=()=>{$("end").classList.add("hidden");$("quiz").classList.remove("hidden");show()};
$("again").onclick=start;
$("back").onclick=()=>{$("end").classList.add("hidden");$("setup").classList.remove("hidden");view?openTheme(view):showHome()};
$("tback").onclick=showHome;
$("selall").onclick=()=>{setAll(allChaps(),true);refresh()};
$("selnone").onclick=()=>{sel.clear();refresh()};
$("expall").onclick=()=>{view.sections.forEach(s=>open.add(s));renderTheme()};
$("colall").onclick=()=>{view.sections.forEach(s=>open.delete(s));renderTheme()};
$("chall").onclick=()=>{setAll(view.chapitres,true);refresh()};
$("chnone").onclick=()=>{setAll(view.chapitres,false);refresh()};
init();
