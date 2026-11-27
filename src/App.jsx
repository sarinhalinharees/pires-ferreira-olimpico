import React, { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { Award, CalendarDays, ChevronLeft, ChevronRight, ExternalLink, GraduationCap, Medal, Search, ShieldCheck, Trophy, ArrowRight, LogOut, Plus, Save, Trash2, Menu, X } from "lucide-react";
import { initialOlympiads, infoPending } from "./data/olympiads";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import CsvResultsImporter from "./components/CsvResultsImporter";
import ObmepApiImporter from "./components/ObmepApiImporter";

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
      <div className="chips">{olympiads.map(o => <Link key={o.id} to={`/olimpiadas/${encodeURIComponent(o.acronym)}`} aria-label={`Ver informações sobre ${o.name}`}>{o.acronym}</Link>)}</div>
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

  const dateAtNoon = (value) => value ? new Date(`${value}T12:00:00`) : null;
  const eventMatchesFilter = (event) => filter === "all" || String(event.olympiad_id) === String(filter);
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  const monthEvents = events.filter((event) => {
    const start = dateAtNoon(event.start_date);
    const end = dateAtNoon(event.end_date || event.start_date);
    return start && end && start <= monthEnd && end >= monthStart && eventMatchesFilter(event);
  });

  const days = new Date(year, month + 1, 0).getDate();
  const offset = new Date(year, month, 1).getDay();
  const monthName = new Date(year, month, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const shift = (amount) => {
    const next = new Date(year, month + amount, 1);
    setMonth(next.getMonth());
    setYear(next.getFullYear());
  };

  const list = events.filter(eventMatchesFilter).sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""));
  const visibleEvents = showAll ? list : monthEvents;
  const years = [...new Set([now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1, ...events.flatMap((event) => [dateAtNoon(event.start_date)?.getFullYear(), dateAtNoon(event.end_date)?.getFullYear()]).filter(Boolean)])].sort((a, b) => a - b);

  const olympiadAcronym = (event) => event.olympiads?.acronym || olympiads.find((item) => String(item.id) === String(event.olympiad_id))?.acronym || "Olimpíada";
  const eventOccursOnDay = (event, day) => {
    if (event.date_precision === "month") return false;
    const current = new Date(year, month, day, 12);
    const start = dateAtNoon(event.start_date);
    const end = dateAtNoon(event.end_date || event.start_date);
    return start && end && current >= start && current <= end;
  };
  const eventLink = (event) => `/olimpiadas/${encodeURIComponent(olympiadAcronym(event))}`;

  return <>
    <Hero title="Calendário" subtitle="Etapas e datas cadastradas das olimpíadas. Clique em um evento para ver os detalhes da competição."/>
    <main className="container page-content">
      <div className="filters">
        <label>Olimpíada<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Todas as olimpíadas</option>{olympiads.map((item) => <option value={item.id} key={item.id}>{item.acronym}</option>)}</select></label>
        <label>Mês<select value={month} onChange={(event) => setMonth(Number(event.target.value))}>{Array.from({ length: 12 }, (_, index) => <option value={index} key={index}>{new Date(year, index, 1).toLocaleDateString("pt-BR", { month: "long" })}</option>)}</select></label>
        <label>Ano<select value={year} onChange={(event) => setYear(Number(event.target.value))}>{years.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      </div>
      <div className="calendar-layout">
        <section className="calendar panel">
          <div className="calendar-head"><button onClick={() => shift(-1)} aria-label="Mês anterior"><ChevronLeft/></button><h2>{monthName}</h2><button onClick={() => shift(1)} aria-label="Próximo mês"><ChevronRight/></button></div>
          <div className="calendar-grid">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => <div className="weekday" key={day}>{day}</div>)}
            {Array.from({ length: offset }, (_, index) => <div className="day blank" key={`blank-${index}`}/>)}
            {Array.from({ length: days }, (_, index) => {
              const day = index + 1;
              const dayEvents = monthEvents.filter((event) => eventOccursOnDay(event, day));
              return <div className="day" key={day}><span>{day}</span>{dayEvents.slice(0, 3).map((event) => <Link key={event.id} to={eventLink(event)} className="day-event" title={event.title}>{olympiadAcronym(event)}</Link>)}{dayEvents.length > 3 && <small>+{dayEvents.length - 3} evento(s)</small>}</div>;
            })}
          </div>
        </section>
        <section className="events-column">
          <div className="events-title"><h2>Eventos</h2><div className="toggle"><button className={!showAll ? "active" : ""} onClick={() => setShowAll(false)}>Do mês</button><button className={showAll ? "active" : ""} onClick={() => setShowAll(true)}>Todos</button></div></div>
          {visibleEvents.map((event) => <Link className="event-card" key={event.id} to={eventLink(event)}><b>{event.date_precision === "month" ? (event.date_note || dateAtNoon(event.start_date)?.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })) : `${fmt(event.start_date)}${event.end_date && event.end_date !== event.start_date ? ` – ${fmt(event.end_date)}` : ""}`}</b><strong>{event.title}</strong><span>Olimpíada: {olympiadAcronym(event)} · Etapa: {event.stage || infoPending}</span>{event.description && <p>{event.description}</p>}</Link>)}
          {!visibleEvents.length && <p className="empty">Nenhum evento cadastrado para este período. Os eventos aparecerão aqui depois de serem registrados na Administração.</p>}
        </section>
      </div>
    </main>
  </>;
}

function ResultsPage({ results, olympiads }) {
  const [olympiad, setOlympiad] = useState("all");
  const [edition, setEdition] = useState("all");
  const [kind, setKind] = useState("all");
  const [municipality, setMunicipality] = useState("Pires Ferreira");
  const [school, setSchool] = useState("all");
  const [query, setQuery] = useState("");

  const municipalityOf = (r) => (r.municipality || r.schools?.municipality || "").trim();
  const municipalities = [...new Set(results.map(municipalityOf).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  const editions = [...new Set(results
    .filter(r => municipality === "all" || !municipalityOf(r) || municipalityOf(r).toLocaleLowerCase("pt-BR") === municipality.toLocaleLowerCase("pt-BR"))
    .map(r => r.edition).filter(Boolean))].sort().reverse();

  const municipalityResults = results.filter(r => {
    const city = municipalityOf(r);
    if (municipality === "all") return true;
    // Mantém registros antigos sem município junto aos resultados locais, como antes.
    return !city || city.toLocaleLowerCase("pt-BR") === municipality.toLocaleLowerCase("pt-BR");
  });

  const schools = [...new Set(municipalityResults
    .map(r => (r.school_name || r.schools?.name || "").trim())
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));

  const filtered = municipalityResults.filter(r =>
    (olympiad === "all" || r.olympiad_id === olympiad) &&
    (edition === "all" || r.edition === edition) &&
    (school === "all" || (r.school_name || r.schools?.name || "").trim() === school) &&
    (kind === "all" || (r.result_type || "official") === kind) &&
    `${r.participant_name} ${r.school_name || r.schools?.name || ""} ${r.award || ""} ${r.level || ""}`.toLowerCase().includes(query.toLowerCase())
  );

  return <>
    <Hero title="Resultados" subtitle="Consulte as premiações oficiais e as atividades de preparação dos estudantes."/>
    <main className="container page-content">
      <div className="notice-bar">
        <b>{municipality === "all" ? "Resultados de todos os municípios" : `Resultados de ${municipality}`}</b>
        <span>{municipality === "all" ? "A lista inclui todos os municípios disponíveis na base." : "A lista e o filtro de escolas mostram somente os registros deste município."}</span>
      </div>
      <div className="result-kind-tabs">
        <button className={kind === "all" ? "active" : ""} onClick={() => setKind("all")}>Todos</button>
        <button className={kind === "official" ? "active" : ""} onClick={() => setKind("official")}>Olimpíadas oficiais</button>
        <button className={kind === "simulado" ? "active" : ""} onClick={() => setKind("simulado")}>Simulados e atividades</button>
      </div>
      <div className="result-filters">
        <div className="municipality-filter-control" style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 190 }}>
          <label htmlFor="results-municipality" style={{ fontSize: 12, fontWeight: 700, color: "#526174" }}>Município</label>
          <div style={{ position: "relative" }}>
            <select
              id="results-municipality"
              value={municipality}
              onChange={e => { setMunicipality(e.target.value); setSchool("all"); setEdition("all"); }}
              style={{
                width: "100%",
                border: municipality === "Pires Ferreira" ? "2px solid #168653" : "1px solid var(--border, #d7dee7)",
                background: municipality === "Pires Ferreira" ? "#effaf4" : "var(--surface, #fff)",
                color: municipality === "Pires Ferreira" ? "#126b43" : "inherit",
                fontWeight: municipality === "Pires Ferreira" ? 700 : 500,
                borderRadius: 10,
                padding: "11px 38px 11px 12px",
                outline: "none",
                boxShadow: municipality === "Pires Ferreira" ? "0 0 0 3px rgba(22,134,83,.10)" : "none"
              }}
            >
              <option value="Pires Ferreira">★ Pires Ferreira</option>
              <option value="all">Todos os municípios</option>
              {municipalities.filter(m => m.toLocaleLowerCase("pt-BR") !== "pires ferreira").map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5, width: "fit-content",
            padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700,
            color: municipality === "Pires Ferreira" ? "#126b43" : "#526174",
            background: municipality === "Pires Ferreira" ? "#e1f5e9" : "#eef1f5"
          }}>
            {municipality === "Pires Ferreira" ? "✓ Município local selecionado" : "Visualização: " + (municipality === "all" ? "todos os municípios" : municipality)}
          </span>
        </div>
        <select value={olympiad} onChange={e => setOlympiad(e.target.value)}><option value="all">Todas as olimpíadas</option>{olympiads.map(o => <option value={o.id} key={o.id}>{o.acronym}</option>)}</select>
        <select value={edition} onChange={e => setEdition(e.target.value)}><option value="all">Todas as edições</option>{editions.map(e => <option key={e}>{e}</option>)}</select>
        <select value={school} onChange={e => setSchool(e.target.value)}><option value="all">Todas as escolas</option>{schools.map(name => <option key={name} value={name}>{name}</option>)}</select>
        <div className="searchbox"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar participante, escola ou premiação..."/></div>
      </div>
      {filtered.length ? <div className="table-wrap"><table><thead><tr><th>Participante</th><th>Escola</th><th>Olimpíada / atividade</th><th>Edição</th><th>Nota</th><th>Nível</th><th>Classificação</th></tr></thead><tbody>{filtered.map(r => <tr key={r.id}><td>{r.participant_name}</td><td>{r.school_name || r.schools?.name || infoPending}</td><td>{r.activity_name || r.olympiads?.acronym || olympiads.find(o => o.id === r.olympiad_id)?.acronym}</td><td>{r.edition}</td><td>{r.score ?? "—"}</td><td>{r.level || "—"}</td><td>{r.award || infoPending}</td></tr>)}</tbody></table></div> : <div className="empty-state"><Award size={30}/><b>Nenhum resultado encontrado</b><span>Os resultados aparecerão aqui depois de serem cadastrados ou importados no painel administrativo.</span></div>}
    </main>
  </>;
}

function Admin({ data }) {
  const { olympiads, events, results, refresh } = data;
  const [session, setSession] = useState(null);
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [inviteSecret,setInviteSecret]=useState("");
  const [newAdminEmail,setNewAdminEmail]=useState("");
  const [newAdminPassword,setNewAdminPassword]=useState("");
  const [error,setError]=useState("");
  const [tab,setTab]=useState("olympiads");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [showCreate,setShowCreate]=useState(false);
  const navigate=useNavigate();

  useEffect(()=>{
    if(!supabase){setChecking(false);return;}
    let mounted=true;
    const checkSession=async()=>{
      const {data:{session:current}}=await supabase.auth.getSession();
      if(!mounted)return;
      setSession(current);
      if(current?.user?.id){
        const {data:profile,error:profileError}=await supabase.from("admin_profiles").select("user_id,role").eq("user_id",current.user.id).maybeSingle();
        if(!mounted)return;
        if(profile && profile.role==="admin"){setAuthorized(true);}
        else {await supabase.auth.signOut();setSession(null);setAuthorized(false);setError("Esta conta não possui autorização administrativa.");}
      } else {setAuthorized(false);}
      setChecking(false);
    };
    checkSession();
    const {data:listener}=supabase.auth.onAuthStateChange(async(_event,current)=>{
      if(!mounted)return;
      setSession(current);
      if(!current){setAuthorized(false);setChecking(false);}
    });
    return ()=>{mounted=false;listener.subscription.unsubscribe();};
  },[]);

  async function login(e){
    e.preventDefault();setError("");setBusy(true);
    const {data,error:loginError}=await supabase.auth.signInWithPassword({email,password});
    if(loginError){setError(loginError.message);setBusy(false);return;}
    const {data:profile,error:profileError}=await supabase.from("admin_profiles").select("user_id,role").eq("user_id",data.user.id).maybeSingle();
    if(profileError || !profile || profile.role!=="admin"){
      await supabase.auth.signOut();setError("A conta foi autenticada, mas não está autorizada como administradora.");setBusy(false);return;
    }
    setSession(data.session);setAuthorized(true);setBusy(false);
  }

  async function createAdmin(e){
    e.preventDefault();setError("");setMessage("");setBusy(true);
    const {data,error:fnError}=await supabase.functions.invoke("create-admin",{body:{email:newAdminEmail,password:newAdminPassword,inviteSecret}});
    setBusy(false);
    if(fnError || data?.error){setError(data?.error || fnError.message || "Não foi possível criar o administrador.");return;}
    setMessage("Administrador criado. Agora entre com o e-mail e a senha cadastrados.");
    setShowCreate(false);setEmail(newAdminEmail);setPassword("");setNewAdminEmail("");setNewAdminPassword("");setInviteSecret("");
  }

  async function logout(){await supabase.auth.signOut();setSession(null);setAuthorized(false);navigate("/");}

  if(!isSupabaseConfigured) return <><Hero title="Administração" subtitle="Acesso restrito aos administradores autorizados."/><main className="container narrow page-content"><div className="empty-state"><ShieldCheck size={34}/><b>Banco de dados ainda não conectado</b><span>Configure o Supabase para ativar a administração.</span></div></main></>;
  if(checking) return <><Hero title="Administração" subtitle="Verificando acesso..."/><main className="container narrow page-content"><p>Carregando...</p></main></>;
  if(!session || !authorized) return <>
    <Hero title="Administração" subtitle="Entre com sua conta de administrador."/>
    <main className="container narrow page-content">
      <form className="login-card" onSubmit={login}>
        <span className="feature-icon"><ShieldCheck/></span><h2>Acesso administrativo</h2>
        <label>E-mail<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
        <label>Senha<input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
        {error&&<p className="error">{error}</p>}{message&&<p className="success">{message}</p>}
        <button className="primary-btn" disabled={busy}>{busy?"Entrando...":"Entrar"}</button>
        <p className="muted small">O cadastro é restrito e exige um convite privado validado no servidor.</p>
        <button type="button" className="text-button" onClick={()=>{setShowCreate(!showCreate);setError("");}}>{showCreate?"Cancelar criação":"Criar a primeira conta administrativa"}</button>
      </form>
      {showCreate&&<form className="login-card create-admin-card" onSubmit={createAdmin}>
        <h2>Criar administrador autorizado</h2>
        <p className="muted small">Use o segredo de convite configurado nos Secrets da função Supabase. Ele será enviado apenas nesta solicitação e não ficará salvo no site.</p>
        <label>E-mail do administrador<input type="email" required value={newAdminEmail} onChange={e=>setNewAdminEmail(e.target.value)}/></label>
        <label>Senha (mínimo 12 caracteres)<input type="password" minLength={12} required value={newAdminPassword} onChange={e=>setNewAdminPassword(e.target.value)}/></label>
        <label>Segredo privado de convite<input type="password" required value={inviteSecret} onChange={e=>setInviteSecret(e.target.value)}/></label>
        <button className="primary-btn" disabled={busy}>{busy?"Criando...":"Criar conta administrativa"}</button>
      </form>}
    </main>
  </>;
  return <><Hero title="Painel administrativo" subtitle="Gerencie o conteúdo publicado no Pires Ferreira Olímpico."><button className="hero-logout" onClick={logout}><LogOut size={15}/> Sair</button></Hero><main className="container page-content"><div className="admin-tabs"><button className={tab==="olympiads"?"active":""} onClick={()=>setTab("olympiads")}>Olimpíadas</button><button className={tab==="events"?"active":""} onClick={()=>setTab("events")}>Calendário</button><button className={tab==="results"?"active":""} onClick={()=>setTab("results")}>Resultados</button></div><AdminEditor tab={tab} olympiads={olympiads} events={events} results={results} refresh={refresh} setMessage={setMessage}/>{message&&<p className="success">{message}</p>}</main></>;
}

function AdminEditor({tab,olympiads,events,results,refresh,setMessage}) {
  const [selected,setSelected]=useState("");
  const [form,setForm]=useState({});
  const [busy,setBusy]=useState(false);
  const change=(k,v)=>setForm(p=>({...p,[k]:v}));
  const save=async(e)=>{
    e.preventDefault();setBusy(true);setMessage("");
    const table=tab==="olympiads"?"olympiads":tab==="events"?"events":"results";
    const payload={...form};
    if(tab==="olympiads")delete payload.id;
    if(tab!=="olympiads"&&!payload.olympiad_id){setMessage("Selecione uma olimpíada.");setBusy(false);return;}
    const result=selected?await supabase.from(table).update(payload).eq("id",selected):await supabase.from(table).insert(payload);
    setBusy(false);
    if(result.error)setMessage(result.error.message);
    else{setMessage("Registro salvo com sucesso.");setForm({});setSelected("");await refresh();}
  };
  const remove=async(id)=>{
    if(!confirm("Deseja realmente excluir este registro?"))return;
    const table=tab==="olympiads"?"olympiads":tab==="events"?"events":"results";
    const {error}=await supabase.from(table).delete().eq("id",id);
    setMessage(error?.message||"Registro excluído.");await refresh();
  };
  const records=tab==="olympiads"?olympiads:tab==="events"?events:results;
  const edit=(r)=>{setSelected(r.id);const f={...r};delete f.id;delete f.created_at;delete f.updated_at;delete f.olympiads;delete f.schools;setForm(f);};
  const input=(key,label,type="text",required=false)=><label>{label}<input type={type} required={required} value={form[key]??""} onChange={e=>change(key,e.target.value)}/></label>;
  const textarea=(key,label)=><label>{label}<textarea rows="3" value={form[key]||""} onChange={e=>change(key,e.target.value)}/></label>;
  return <div className="admin-editor">
    {tab==="results"&&<CsvResultsImporter olympiads={olympiads} refresh={refresh}/>}
    {tab==="results"&&<ObmepApiImporter olympiads={olympiads} refresh={refresh}/>}
    <form className="editor-form" onSubmit={save}><h2>{selected?"Editar registro":"Novo registro"}</h2>
    {tab==="olympiads" ? <>{input("acronym","Sigla","text",true)}{input("name","Nome da olimpíada","text",true)}{textarea("description","Descrição")}{input("audience","Público / nível")}{textarea("stages","Etapas")}{textarea("registration_info","Inscrições")}{textarea("notices","Avisos")}{input("regulation_url","Link do regulamento","url")}<label className="check"><input type="checkbox" checked={form.published??true} onChange={e=>change("published",e.target.checked)}/> Publicada</label></>
    : <><label>Olimpíada<select required value={form.olympiad_id||""} onChange={e=>change("olympiad_id",e.target.value)}><option value="">Selecione</option>{olympiads.map(o=><option value={o.id} key={o.id}>{o.acronym} — {o.name}</option>)}</select></label>{tab==="events"?<>{input("title","Título do evento","text",true)}{input("start_date","Data inicial","date",true)}{input("end_date","Data final","date")}{input("stage","Etapa")}{textarea("description","Informações")}</>:<>{input("participant_name","Nome do participante","text",true)}{input("school_name","Escola")}{input("municipality","Município")}{input("edition","Edição")}{input("award","Premiação / classificação")}{input("score","Nota / pontuação","number")}{input("level","Nível")}{input("activity_name","Nome da atividade") }<label>Tipo de resultado<select value={form.result_type||"official"} onChange={e=>change("result_type",e.target.value)}><option value="official">Olimpíada oficial</option><option value="simulado">Simulado / atividade</option></select></label></>}</>}
    <div className="form-actions"><button className="primary-btn" disabled={busy}><Save size={16}/>{busy?"Salvando...":"Salvar"}</button>{selected&&<button type="button" className="secondary-btn" onClick={()=>{setSelected("");setForm({});}}>Cancelar</button>}</div>
  </form>
  <div className="record-list"><h2>Registros ({records.length})</h2>{records.map(r=><div className="record" key={r.id}><div><b>{r.acronym||r.title||r.participant_name}</b><span>{r.name||r.start_date||r.edition||r.activity_name||""}</span></div><button onClick={()=>edit(r)} aria-label="Editar">Editar</button><button className="delete-btn" onClick={()=>remove(r.id)} aria-label="Excluir"><Trash2 size={16}/></button></div>)}</div>
  </div>;
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
