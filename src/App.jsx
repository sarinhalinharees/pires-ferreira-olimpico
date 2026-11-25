import React, { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { Award, CalendarDays, ChevronLeft, ChevronRight, ExternalLink, GraduationCap, Medal, Search, ShieldCheck, Trophy, ArrowRight, LogOut, Plus, Save, Trash2, Menu, X } from "lucide-react";
import { initialOlympiads, infoPending } from "./data/olympiads";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

const nav = [["/", "Início"], ["/olimpiadas", "Olimpíadas"], ["/calendario", "Calendário"], ["/resultados", "Resultados"]];
const fmt = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "";

function Header() {
  const [open, setOpen] = useState(false);
  return <header className="topbar"><div className="nav-wrap">
    <Link to="/" className="brand"><span className="brand-mark"><Medal size={22}/></span><span>Pires Ferreira <b>Olímpico</b></span></Link>
    <button className="mobile-menu" onClick={() => setOpen(!open)} aria-label="Abrir menu">{open ? <X/> : <Menu/>}</button>
    <nav className={open ? "nav-links open" : "nav-links"}>{nav.map(([to, label]) => <NavLink key={to} to={to} end={to === "/"} onClick={() => setOpen(false)}>{label}</NavLink>)}</nav>
  </div></header>;
}

function Hero({ eyebrow, title, subtitle, children }) {
  return <section className="hero"><div className="container hero-inner">{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{subtitle && <p>{subtitle}</p>}{children}</div></section>;
}

function useContent() {
  const [olympiads, setOlympiads] = useState(initialOlympiads);
  const [events, setEvents] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    (async () => {
      const [o, e, r] = await Promise.all([
        supabase.from("olympiads").select("*").eq("published", true).order("name"),
        supabase.from("events").select("*, olympiads(acronym,name)").order("start_date"),
        supabase.from("results").select("*, olympiads(acronym,name), schools(name,municipality)").order("created_at", { ascending: false })
      ]);
      if (!alive) return;
      if (!o.error && o.data?.length) setOlympiads(o.data);
      if (!e.error && e.data) setEvents(e.data);
      if (!r.error && r.data) setResults(r.data);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  return { olympiads, setOlympiads, events, setEvents, results, setResults, loading, refresh: async () => {
    if (!supabase) return;
    const [o,e,r] = await Promise.all([
      supabase.from("olympiads").select("*").order("name"),
      supabase.from("events").select("*, olympiads(acronym,name)").order("start_date"),
      supabase.from("results").select("*, olympiads(acronym,name), schools(name,municipality)").order("created_at", {ascending:false})
    ]);
    if (!o.error) setOlympiads(o.data || []);
    if (!e.error) setEvents(e.data || []);
    if (!r.error) setResults(r.data || []);
  }};
}

function Home({ olympiads, events }) {
  return <>
    <Hero eyebrow="OLIMPÍADAS ACADÊMICAS" title={<>Pires Ferreira <em>Olímpico</em></>} subtitle="Tudo sobre as olimpíadas de conhecimento das quais os estudantes de Pires Ferreira participam.">
      <div className="chips">{olympiads.map(o => <span key={o.id}>{o.acronym}</span>)}</div>
    </Hero>
    <main className="container home-cards">
      <div className="feature-grid">
        <Link to="/olimpiadas" className="feature-card"><span className="feature-icon"><Trophy/></span><h2>Olimpíadas</h2><p>Conheça cada competição: etapas, inscrições, regulamentos e materiais.</p><strong>Acessar <ArrowRight size={16}/></strong></Link>
        <Link to="/calendario" className="feature-card"><span className="feature-icon"><CalendarDays/></span><h2>Calendário</h2><p>Datas e etapas organizadas em calendário mensal e lista cronológica.</p><strong>Acessar <ArrowRight size={16}/></strong></Link>
      </div>
      <Link to="/resultados" className="results-link"><Award/> Ver resultados por olimpíada e edição <ArrowRight className="push"/></Link>
      <div className="small-note">{events.length ? `${events.length} evento(s) cadastrado(s) no calendário.` : "Datas e resultados serão publicados conforme forem cadastrados."}</div>
    </main>
  </>;
}

function Olympiads({ olympiads }) {
  const [query, setQuery] = useState("");
  const filtered = olympiads.filter(o => `${o.acronym} ${o.name}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <Hero title="Olimpíadas" subtitle="Conheça as competições acadêmicas das quais estudantes de Pires Ferreira participam."/>
    <main className="container page-content">
      <div className="searchbox"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar olimpíada..."/></div>
      <div className="olympiad-grid">{filtered.map(o => <Link className="olympiad-card" to={`/olimpiadas/${encodeURIComponent(o.acronym)}`} key={o.id}><span className="mini-trophy"><Trophy size={19}/></span><h2>{o.acronym}</h2><p>{o.name}</p><span className="card-action">Ver detalhes <ArrowRight size={15}/></span></Link>)}</div>
      {!filtered.length && <p className="empty">Nenhuma olimpíada encontrada.</p>}
    </main>
  </>;
}

function Detail({ olympiads, events }) {
  const { acronym } = useParams();
  const item = olympiads.find(o => o.acronym.toLowerCase() === decodeURIComponent(acronym).toLowerCase());
  if (!item) return <main className="container page-content"><p>Olimpíada não encontrada.</p><Link to="/olimpiadas">Voltar</Link></main>;
  const dates = events.filter(e => e.olympiad_id === item.id || e.olympiads?.acronym === item.acronym);
  const field = (value) => value?.trim() || infoPending;
  return <>
    <section className="hero detail-hero"><div className="container hero-inner"><h1>{item.acronym}</h1><p>{item.name}</p><Link className="back-link" to="/olimpiadas"><ChevronLeft size={16}/> Todas as olimpíadas</Link></div></section>
    <main className="container detail-layout">
      <div className="detail-main">
        <InfoCard title="Descrição">{field(item.description)}</InfoCard>
        <InfoCard title="Público / nível">{field(item.audience)}</InfoCard>
        <InfoCard title="Etapas">{field(item.stages)}</InfoCard>
        <InfoCard title="Inscrições">{field(item.registration_info)}</InfoCard>
        <InfoCard title="Avisos">{field(item.notices)}</InfoCard>
      </div>
      <aside className="detail-side">
        <section className="panel"><h2><CalendarDays size={19}/> Datas</h2>{dates.length ? dates.map(e => <div className="date-item" key={e.id}><b>{fmt(e.start_date)}{e.end_date && e.end_date !== e.start_date ? ` – ${fmt(e.end_date)}` : ""}</b><strong>{e.title}</strong><span>{e.stage || infoPending}</span>{e.description && <p>{e.description}</p>}</div>) : <p className="muted">{infoPending}</p>}</section>
        <section className="panel"><h2>Regulamento</h2>{item.regulation_url ? <a className="external" href={item.regulation_url} target="_blank" rel="noreferrer"><ExternalLink size={16}/> Site oficial / regulamento</a> : <p className="muted">{infoPending}</p>}</section>
      </aside>
    </main>
  </>;
}

function InfoCard({ title, children }) { return <section className="info-card"><h2>{title}</h2><p>{children}</p></section>; }

function CalendarPage({ olympiads, events }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [filter, setFilter] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const monthEvents = events.filter(e => {
    const d = new Date(`${e.start_date}T12:00:00`);
    return d.getMonth() === month && d.getFullYear() === year && (filter === "all" || e.olympiad_id === filter);
  });
  const days = new Date(year, month + 1, 0).getDate();
  const offset = new Date(year, month, 1).getDay();
  const monthName = new Date(year, month, 1).toLocaleDateString("pt-BR", {month:"long",year:"numeric"});
  const shift = (n) => { const d = new Date(year, month + n, 1); setMonth(d.getMonth()); setYear(d.getFullYear()); };
  const list = events.filter(e => filter === "all" || e.olympiad_id === filter).sort((a,b) => a.start_date.localeCompare(b.start_date));
  return <>
    <Hero title="Calendário" subtitle="Etapas e datas cadastradas das olimpíadas. Clique em um evento para ver os detalhes da competição."/>
    <main className="container page-content">
      <div className="filters"><label>Olimpíada<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todas as olimpíadas</option>{olympiads.map(o => <option value={o.id} key={o.id}>{o.acronym}</option>)}</select></label><label>Mês<select value={month} onChange={e => setMonth(Number(e.target.value))}>{Array.from({length:12},(_,i)=><option value={i} key={i}>{new Date(2026,i,1).toLocaleDateString("pt-BR",{month:"long"})}</option>)}</select></label><label>Ano<select value={year} onChange={e => setYear(Number(e.target.value))}>{[2025,2026,2027,2028,2029].map(y=><option key={y}>{y}</option>)}</select></label></div>
      <div className="calendar-layout"><section className="calendar panel"><div className="calendar-head"><button onClick={()=>shift(-1)} aria-label="Mês anterior"><ChevronLeft/></button><h2>{monthName}</h2><button onClick={()=>shift(1)} aria-label="Próximo mês"><ChevronRight/></button></div><div className="calendar-grid">{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(d=><div className="weekday" key={d}>{d}</div>)}{Array.from({length:offset},(_,i)=><div className="day blank" key={`b${i}`}/>)}{Array.from({length:days},(_,i)=>{const day=i+1;const dayEvents=monthEvents.filter(e=>{const d=new Date(`${e.start_date}T12:00:00`);return d.getDate()===day});return <div className="day" key={day}><span>{day}</span>{dayEvents.slice(0,2).map(e=><Link key={e.id} to={`/olimpiadas/${encodeURIComponent(e.olympiads?.acronym || olympiads.find(o=>o.id===e.olympiad_id)?.acronym || "")}`} className="day-event">{e.olympiads?.acronym || olympiads.find(o=>o.id===e.olympiad_id)?.acronym || "Evento"}</Link>)}</div>})}</div></section>
      <section className="events-column"><div className="events-title"><h2>Eventos</h2><div className="toggle"><button className={!showAll?"active":""} onClick={()=>setShowAll(false)}>Do mês</button><button className={showAll?"active":""} onClick={()=>setShowAll(true)}>Todos</button></div></div>{(showAll?list:monthEvents).map(e=><Link className="event-card" key={e.id} to={`/olimpiadas/${encodeURIComponent(e.olympiads?.acronym || olympiads.find(o=>o.id===e.olympiad_id)?.acronym || "")}`}><b>{fmt(e.start_date)}{e.end_date && e.end_date!==e.start_date?` – ${fmt(e.end_date)}`:""}</b><strong>{e.title}</strong><span>Etapa: {e.stage || infoPending}</span>{e.description && <p>{e.description}</p>}</Link>)}{!(showAll?list:monthEvents).length && <p className="empty">{infoPending}. Nenhum evento cadastrado para este período.</p>}</section></div>
    </main>
  </>;
}

function ResultsPage({ results, olympiads }) {
  const [olympiad, setOlympiad] = useState("all");
  const [edition, setEdition] = useState("all");
  const [query, setQuery] = useState("");
  const editions = [...new Set(results.map(r=>r.edition).filter(Boolean))].sort().reverse();
  const filtered = results.filter(r => (olympiad==="all" || r.olympiad_id===olympiad) && (edition==="all" || r.edition===edition) && `${r.participant_name} ${r.school_name || r.schools?.name || ""} ${r.award || ""}`.toLowerCase().includes(query.toLowerCase()) && (!r.municipality && !r.schools?.municipality || (r.municipality || r.schools?.municipality).toLowerCase().includes("pires ferreira")));
  return <>
    <Hero title="Resultados" subtitle="Resultados oficiais cadastrados por olimpíada e edição."/>
    <main className="container page-content">
      <div className="notice-bar"><b>Somente estudantes de Pires Ferreira</b><span>Resultados de outros municípios não são exibidos.</span></div>
      <div className="result-filters"><select value={olympiad} onChange={e=>setOlympiad(e.target.value)}><option value="all">Todas as olimpíadas</option>{olympiads.map(o=><option value={o.id} key={o.id}>{o.acronym}</option>)}</select><select value={edition} onChange={e=>setEdition(e.target.value)}><option value="all">Todas as edições</option>{editions.map(e=><option key={e}>{e}</option>)}</select><div className="searchbox"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar participante, escola ou premiação..."/></div></div>
      {filtered.length ? <div className="table-wrap"><table><thead><tr><th>Participante</th><th>Escola</th><th>Olimpíada</th><th>Edição</th><th>Premiação</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td>{r.participant_name}</td><td>{r.school_name || r.schools?.name || infoPending}</td><td>{r.olympiads?.acronym || olympiads.find(o=>o.id===r.olympiad_id)?.acronym}</td><td>{r.edition}</td><td>{r.award || infoPending}</td></tr>)}</tbody></table></div> : <div className="empty-state"><Award size={30}/><b>Nenhum resultado publicado</b><span>Os resultados oficiais aparecerão aqui quando forem cadastrados pela administração.</span></div>}
    </main>
  </>;
}

function Admin({ data }) {
  const { olympiads, events, results, refresh } = data;
  const [session, setSession] = useState(null);
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [tab,setTab]=useState("olympiads");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const navigate=useNavigate();

  useEffect(()=>{ if(!supabase)return; supabase.auth.getSession().then(({data})=>setSession(data.session)); const {data:listener}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s)); return ()=>listener.subscription.unsubscribe(); },[]);
  async function login(e){e.preventDefault();setError("");setBusy(true);const {data,error}=await supabase.auth.signInWithPassword({email,password});setBusy(false);if(error)setError(error.message);else setSession(data.session);}
  async function logout(){await supabase.auth.signOut();setSession(null);navigate("/");}
  if(!isSupabaseConfigured) return <><Hero title="Administração" subtitle="Acesso restrito aos administradores autorizados."/><main className="container narrow page-content"><div className="empty-state"><ShieldCheck size={34}/><b>Banco de dados ainda não conectado</b><span>Configure o Supabase seguindo o README e execute o SQL incluído no projeto para ativar o login e a administração.</span></div></main></>;
  if(!session) return <><Hero title="Administração" subtitle="Entre com sua conta de administrador."/></> && <main className="container narrow page-content"><form className="login-card" onSubmit={login}><span className="feature-icon"><ShieldCheck/></span><h2>Acesso administrativo</h2><label>E-mail<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Senha<input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p className="error">{error}</p>}<button className="primary-btn" disabled={busy}>{busy?"Entrando...":"Entrar"}</button><p className="muted small">O cadastro de administradores é feito por convite seguro, não por inscrição pública.</p></form></main>;
  return <><Hero title="Painel administrativo" subtitle="Gerencie o conteúdo publicado no Pires Ferreira Olímpico."><button className="hero-logout" onClick={logout}><LogOut size={15}/> Sair</button></Hero><main className="container page-content"><div className="admin-tabs"><button className={tab==="olympiads"?"active":""} onClick={()=>setTab("olympiads")}>Olimpíadas</button><button className={tab==="events"?"active":""} onClick={()=>setTab("events")}>Calendário</button><button className={tab==="results"?"active":""} onClick={()=>setTab("results")}>Resultados</button></div><AdminEditor tab={tab} olympiads={olympiads} events={events} results={results} refresh={refresh} setMessage={setMessage}/>{message&&<p className="success">{message}</p>}</main></>;
}

function AdminEditor({tab,olympiads,events,results,refresh,setMessage}) {
  const [selected,setSelected]=useState("");
  const [form,setForm]=useState({});
  const [busy,setBusy]=useState(false);
  const change=(k,v)=>setForm(p=>({...p,[k]:v}));
  const save=async(e)=>{e.preventDefault();setBusy(true);setMessage("");let table=tab==="olympiads"?"olympiads":tab==="events"?"events":"results";let payload={...form};if(tab==="olympiads")delete payload.id;if(tab!=="olympiads"&&!payload.olympiad_id){setMessage("Selecione uma olimpíada.");setBusy(false);return;}const result=selected?await supabase.from(table).update(payload).eq("id",selected):await supabase.from(table).insert(payload);setBusy(false);if(result.error)setMessage(result.error.message);else{setMessage("Registro salvo com sucesso.");setForm({});setSelected("");await refresh();}};
  const remove=async(id)=>{if(!confirm("Deseja realmente excluir este registro?"))return;const table=tab==="olympiads"?"olympiads":tab==="events"?"events":"results";const {error}=await supabase.from(table).delete().eq("id",id);setMessage(error?.message||"Registro excluído.");await refresh();};
  const records=tab==="olympiads"?olympiads:tab==="events"?events:results;
  const edit=(r)=>{setSelected(r.id);const f={...r};delete f.id;delete f.created_at;delete f.updated_at;delete f.olympiads;delete f.schools;setForm(f);};
  const input=(key,label,type="text",required=false)=><label>{label}<input type={type} required={required} value={form[key]||""} onChange={e=>change(key,e.target.value)}/></label>;
  const textarea=(key,label)=><label>{label}<textarea rows="3" value={form[key]||""} onChange={e=>change(key,e.target.value)}/></label>;
  return <div className="admin-editor"><form className="editor-form" onSubmit={save}><h2>{selected?"Editar registro":"Novo registro"}</h2>
    {tab==="olympiads" ? <>{input("acronym","Sigla", "text",true)}{input("name","Nome da olimpíada","text",true)}{textarea("description","Descrição")}{input("audience","Público / nível")}{textarea("stages","Etapas")}{textarea("registration_info","Inscrições")}{textarea("notices","Avisos")}{input("regulation_url","Link do regulamento","url")}<label className="check"><input type="checkbox" checked={form.published??true} onChange={e=>change("published",e.target.checked)}/> Publicada</label></>
    : <><label>Olimpíada<select required value={form.olympiad_id||""} onChange={e=>change("olympiad_id",e.target.value)}><option value="">Selecione</option>{olympiads.map(o=><option value={o.id} key={o.id}>{o.acronym} — {o.name}</option>)}</select></label>{tab==="events"?<>{input("title","Título do evento","text",true)}{input("start_date","Data inicial","date",true)}{input("end_date","Data final","date")}{input("stage","Etapa")}{textarea("description","Informações")}</>:<>{input("participant_name","Nome do participante","text",true)}{input("school_name","Escola")}{input("municipality","Município")}{input("edition","Edição")}{input("award","Premiação / classificação")}</>}</>}
    <div className="form-actions"><button className="primary-btn" disabled={busy}><Save size={16}/>{busy?"Salvando...":"Salvar"}</button>{selected&&<button type="button" className="secondary-btn" onClick={()=>{setSelected("");setForm({});}}>Cancelar</button>}</div>
  </form><div className="record-list"><h2>Registros ({records.length})</h2>{records.map(r=><div className="record" key={r.id}><div><b>{r.acronym||r.title||r.participant_name}</b><span>{r.name||r.start_date||r.edition||""}</span></div><button onClick={()=>edit(r)} aria-label="Editar">Editar</button><button className="delete-btn" onClick={()=>remove(r.id)} aria-label="Excluir"><Trash2 size={16}/></button></div>)}</div></div>;
}

export default function App() {
  const data=useContent();
  return <><Header/><Routes>
    <Route path="/" element={<Home olympiads={data.olympiads} events={data.events}/>}/>
    <Route path="/olimpiadas" element={<Olympiads olympiads={data.olympiads}/>}/>
    <Route path="/olimpiadas/:acronym" element={<Detail olympiads={data.olympiads} events={data.events}/>}/>
    <Route path="/calendario" element={<CalendarPage olympiads={data.olympiads} events={data.events}/>}/>
    <Route path="/resultados" element={<ResultsPage results={data.results} olympiads={data.olympiads}/>}/>
    <Route path="/admin" element={<Admin data={data}/>}/>
    <Route path="*" element={<main className="container page-content"><h2>Página não encontrada</h2><Link to="/">Voltar ao início</Link></main>}/>
  </Routes><footer><div className="container footer-inner"><span>© {new Date().getFullYear()} Pires Ferreira Olímpico</span><Link to="/admin">Administração</Link></div></footer></>;
}
