const $=id=>document.getElementById(id);
const DATA_DIR="data/";
const NONE_TEXT="Toutes les réponses précédentes sont fausses";   // proposition ajoutée quand 0 bonne réponse est tirée
const NONE_WHY="Aucune des autres propositions n’est correcte.";
const NONE_WHY_FALSE="Faux : au moins une des propositions précédentes est correcte.";
const NONE_PROB=1/15;   // probabilité que « Toutes les réponses précédentes sont fausses » apparaisse (en mauvaise réponse) dans une question qui a au moins une bonne réponse
let themes=[],theme=null,quiz=[],i=0;
const rnd=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
function shuffle(a){a=a.slice();for(let j=a.length-1;j>0;j--){const k=rnd(0,j);[a[j],a[k]]=[a[k],a[j]]}return a}

async function getJSON(name){
  const r=await fetch(DATA_DIR+name,{cache:"no-store"});
  if(!r.ok)throw new Error("fichier « "+name+" » introuvable ("+r.status+")");
  try{return await r.json()}catch(e){throw new Error("« "+name+" » n’est pas un JSON valide : "+e.message)}
}
// Une réponse : { "reponse": "…", "explication": "…" } (ou ["réponse","explication"], ou un simple texte)
function txt(v){
  if(typeof v==="string")return v;
  if(typeof v==="number"||typeof v==="boolean")return String(v);
  if(v&&typeof v==="object"&&!Array.isArray(v))return txt(first(v,["reponse","réponse","texte","text","answer","label","valeur"]));
  return null;
}
function first(o,keys){for(const k of keys)if(o[k]!==undefined)return o[k]}
function ans(a){
  if(Array.isArray(a)){const r=txt(a[0]);return r===null?null:{reponse:r,explication:txt(a[1])||""}}
  if(a&&typeof a==="object"){
    const rv=first(a,["reponse","réponse","texte","text","answer"]);
    const r=txt(rv);if(r===null)return null;
    let e=first(a,["explication","explanation","pourquoi","justification"]);
    if(e===undefined&&rv&&typeof rv==="object")e=first(rv,["explication","explanation","pourquoi","justification"]);
    return{reponse:r,explication:txt(e)||""};
  }
  const r=txt(a);return r===null?null:{reponse:r,explication:""};
}
function uniq(list){const seen=new Set();return list.filter(a=>!seen.has(a.reponse)&&seen.add(a.reponse))}
function clean(list,file,warns){
  if(!Array.isArray(list)){warns.push(file+" : doit contenir une liste [ … ]");return[]}
  const out=[];
  list.forEach((x,n)=>{
    const qt=x?txt(x.question):null;const ok=qt!==null&&Array.isArray(x.bonnes)&&Array.isArray(x.mauvaises);
    const b=ok?x.bonnes.map(ans):[],m=ok?x.mauvaises.map(ans):[];
    if(!ok||b.includes(null)||m.includes(null)||b.length+m.length===0){warns.push(file+" : question n°"+(n+1)+" ignorée (vérifie question / bonnes / mauvaises, et « reponse » dans chaque réponse)");return}
    out.push({question:qt,bonnes:uniq(b),mauvaises:uniq(m)});
  });
  return out;
}
async function init(){
  const warns=[];
  try{
    const list=await getJSON("themes.json");
    for(const t of list){
      try{themes.push({nom:t.nom,questions:clean(await getJSON(t.fichier),t.fichier,warns)})}
      catch(e){warns.push(e.message)}
    }
  }catch(e){
    $("load").style.color="var(--ko)";
    $("load").textContent="Impossible de charger les données : "+e.message+". Si tu ouvres le fichier directement depuis ton disque, lance un petit serveur local (python3 -m http.server) ou héberge le dossier en ligne.";
    return;
  }
  if(themes.length>1)themes.push({nom:"Tous les thèmes",questions:themes.flatMap(t=>t.questions)});
  themes.forEach(t=>{
    const b=document.createElement("button");b.className="theme";
    const n=document.createElement("strong");n.textContent=txt(t.nom)||"(sans nom)";
    const s=document.createElement("small");s.textContent=t.questions.length+" question(s)";
    b.append(n,s);b.onclick=()=>pick(t);t.el=b;$("themes").append(b);
  });
  $("load").textContent=warns.length?"⚠ "+warns.join(" — "):"";
  $("load").style.color="var(--ko)";
  if(themes.length)pick(themes[0]);
}
function pick(t){
  theme=t;
  themes.forEach(x=>x.el.classList.toggle("sel",x===t));
  $("curtheme").textContent="Thème : "+(txt(t.nom)||"(sans nom)");
  $("max").textContent="(max. "+t.questions.length+" pour ce thème)";
  $("err").textContent="";
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
  return{question:q.question,opts,answered:false,skipped:false,sel:[],perfect:false};
}
function start(){
  if(!theme||!theme.questions.length){$("err").textContent="Choisis un thème contenant des questions.";return}
  const o={total:Math.max(2,+$("total").value||5),kmax:Math.max(0,$("kmax").value===""?5:+$("kmax").value)};
  const nq=Math.max(1,Math.min(+$("nq").value||5,theme.questions.length));
  quiz=shuffle(theme.questions).slice(0,nq).map(q=>build(q,o));
  i=0;
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
  $("q").textContent=q.question;$("fb").textContent="";$("opts").innerHTML="";
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
$("start").onclick=start;$("valid").onclick=validate;$("next").onclick=next;
$("prev").onclick=()=>go(i-1);$("finish").onclick=finish;
$("review").onclick=()=>{$("end").classList.add("hidden");$("quiz").classList.remove("hidden");show()};
$("again").onclick=start;
$("back").onclick=()=>{$("end").classList.add("hidden");$("setup").classList.remove("hidden")};
init();
