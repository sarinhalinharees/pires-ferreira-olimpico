import React, { useMemo, useState } from "react";
import { Search, DownloadCloud, CheckCircle2, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "../lib/supabase";

const API = "https://medalhas.online/api/v1";
const clean = (v) => String(v ?? "").trim();
const norm = (v) => clean(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ");

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ["premiacoes", "resultados", "data", "items", "results"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

function makeKey(row, year) {
  const sourceId = row.id ?? row.premiacao_id;
  if (sourceId !== undefined && sourceId !== null) return `medalhas:obmep:${year}:${sourceId}`;
  return ["medalhas", "obmep", year, row.nome_na_lista || row.aluno, row.escola, row.medalha || row.premio, row.nivel]
    .map(norm).join("|");
}

export default function ObmepApiImporter({ olympiads, refresh }) {
  const [year, setYear] = useState("2025");
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [searched, setSearched] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const obmep = olympiads.find(o => norm(o.acronym) === "obmep");
  const mapped = useMemo(() => rows.map((r, index) => {
    const name = clean(r.nome_na_lista || r.aluno || r.nome);
    const school = clean(r.escola || r.school);
    const award = clean(r.medalha || r.premio || r.premiacao);
    const scoreValue = r.nota ?? null;
    const score = scoreValue === null || scoreValue === "" ? null : Number(String(scoreValue).replace(",", "."));
    return {
      raw: r, index, participant_name: name, school_name: school,
      edition: String(r.ano || year), award,
      score: Number.isFinite(score) ? score : null,
      level: clean(r.nivel), municipality: clean(r.municipio || "Pires Ferreira"),
      import_key: makeKey(r, year),
      source: clean(r.fonte)
    };
  }), [rows, year]);

  const invalid = mapped.filter(r => !r.participant_name || !r.school_name || !r.award);
  const selectedRows = mapped.filter(r => selected[r.index]);
  const shown = showAll ? mapped : mapped.slice(0, 30);

  async function search() {
    setError(""); setMessage(""); setRows([]); setSelected({}); setSearched(false);
    if (!/^\d{4}$/.test(year)) { setError("Informe um ano válido."); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        competicao: "OBMEP", municipio: "Pires Ferreira", uf: "CE",
        ano: year, limite: "1000", offset: "0"
      });
      const response = await fetch(`${API}/premiacoes?${params.toString()}`, {
        headers: { Accept: "application/json" }
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.erro || `A API respondeu com status ${response.status}.`);
      const results = extractRows(payload).filter(r =>
        norm(r.olimpiada || r.competicao || "OBMEP").includes("obmep") &&
        norm(r.municipio).includes("pires ferreira") &&
        norm(r.uf) === "ce" &&
        String(r.ano || year) === year
      );
      setRows(results);
      setSelected(Object.fromEntries(results.map((_, i) => [i, true])));
      setSearched(true);
      if (!results.length) setMessage("A consulta foi concluída, mas a API não retornou premiações para Pires Ferreira nesta edição.");
    } catch (e) {
      setError(e.message || "Não foi possível consultar a API Medalhas.");
    } finally { setLoading(false); }
  }

  async function importSelected() {
    setError(""); setMessage("");
    if (!supabase) { setError("O Supabase não está configurado."); return; }
    if (!obmep) { setError("A olimpíada OBMEP não foi encontrada no cadastro do site."); return; }
    if (!selectedRows.length) { setError("Marque pelo menos um resultado para importar."); return; }
    if (selectedRows.some(r => !r.participant_name || !r.school_name || !r.award)) {
      setError("Há registros selecionados sem nome, escola ou premiação. Desmarque-os antes de continuar."); return;
    }
    setImporting(true);
    try {
      const keys = selectedRows.map(r => r.import_key);
      const existingKeys = new Set();
      for (let i = 0; i < keys.length; i += 100) {
        const { data, error: lookupError } = await supabase.from("results")
          .select("import_key").in("import_key", keys.slice(i, i + 100));
        if (lookupError) throw lookupError;
        (data || []).forEach(r => existingKeys.add(r.import_key));
      }
      const toInsert = selectedRows.filter(r => !existingKeys.has(r.import_key)).map(r => ({
        olympiad_id: obmep.id,
        participant_name: r.participant_name,
        school_name: r.school_name,
        municipality: "Pires Ferreira",
        edition: r.edition,
        award: r.award,
        score: r.score,
        level: r.level,
        result_type: "official",
        activity_name: "OBMEP",
        import_key: r.import_key
      }));
      if (toInsert.length) {
        const { error: insertError } = await supabase.from("results").insert(toInsert);
        if (insertError) throw insertError;
      }
      const skipped = selectedRows.length - toInsert.length;
      setMessage(`Importação concluída: ${toInsert.length} novo(s) resultado(s); ${skipped} já existente(s).`);
      await refresh();
    } catch (e) {
      setError(e.message || "Não foi possível importar os resultados.");
    } finally { setImporting(false); }
  }

  return <section className="csv-import-card obmep-api-card">
    <div className="csv-import-heading">
      <span className="csv-import-icon"><DownloadCloud size={22}/></span>
      <div><h2>Consultar resultados da OBMEP pela API</h2>
      <p>Busca independente na API Medalhas, filtrada para Pires Ferreira–CE. Confira os dados e escolha o que deseja importar.</p></div>
    </div>
    <div className="csv-import-controls">
      <label>Edição da OBMEP<input value={year} onChange={e => setYear(e.target.value)} inputMode="numeric" maxLength={4} placeholder="Ex.: 2025"/></label>
      <button className="primary-btn" onClick={search} disabled={loading || importing}>
        {loading ? <><Loader2 className="spin" size={17}/> Consultando...</> : <><Search size={17}/> Buscar resultados</>}
      </button>
    </div>
    {error && <div className="csv-alert error"><AlertCircle size={17}/>{error}</div>}
    {message && <div className="csv-alert success"><CheckCircle2 size={17}/>{message}</div>}
    {searched && <>
      <div className="csv-summary">
        <div><b>{mapped.length}</b><span>Encontrados</span></div>
        <div><b>{selectedRows.length}</b><span>Selecionados</span></div>
        <div><b>{invalid.length}</b><span>Incompletos</span></div>
      </div>
      {!!mapped.length && <>
        <div className="obmep-api-actions">
          <button type="button" className="secondary-btn" onClick={() => setSelected(Object.fromEntries(mapped.map(r => [r.index, true])))}>Selecionar todos</button>
          <button type="button" className="secondary-btn" onClick={() => setSelected({})}>Desmarcar todos</button>
        </div>
        <div className="csv-preview-wrap"><table className="csv-preview">
          <thead><tr><th>Importar</th><th>Estudante</th><th>Escola</th><th>Premiação</th><th>Nível</th><th>Edição</th><th>Fonte</th></tr></thead>
          <tbody>{shown.map(r => <tr key={r.index}>
            <td><input type="checkbox" checked={!!selected[r.index]} onChange={e => setSelected(p => ({...p, [r.index]: e.target.checked}))}/></td>
            <td>{r.participant_name || "Nome não informado"}</td><td>{r.school_name || "Escola não informada"}</td>
            <td>{r.award || "Premiação não informada"}</td><td>{r.level || "—"}</td><td>{r.edition}</td>
            <td>{r.source ? <a href={r.source} target="_blank" rel="noreferrer" aria-label="Consultar fonte oficial"><ExternalLink size={15}/></a> : "—"}</td>
          </tr>)}</tbody>
        </table></div>
        {mapped.length > 30 && <button className="secondary-btn" onClick={() => setShowAll(v => !v)}>{showAll ? "Mostrar menos" : `Mostrar todos (${mapped.length})`}</button>}
        <button className="primary-btn csv-import-button" onClick={importSelected} disabled={importing || loading || !selectedRows.length || invalid.some(r => selected[r.index])}>
          {importing ? <><Loader2 className="spin" size={17}/> Importando...</> : `Importar ${selectedRows.length} resultado(s) selecionado(s)`}
        </button>
      </>}
    </>}
    <p className="csv-muted">Fonte: Medalhas (medalhas.online), a partir das listas oficiais de cada olimpíada. Consulte a fonte oficial antes de confirmar. A utilização dos dados exige atribuição e cuidados com a LGPD.</p>
    <p className="csv-muted"><a href="https://medalhas.online/dados" target="_blank" rel="noreferrer">Documentação da API Medalhas</a></p>
  </section>;
}
