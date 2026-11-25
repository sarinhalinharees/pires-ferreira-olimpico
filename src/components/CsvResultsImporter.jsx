import React, { useMemo, useState } from "react";
import { FileSpreadsheet, Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";

const clean = (value) => String(value ?? "").replace(/^\uFEFF/, "").trim();
const norm = (value) => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ");

function parseCsvText(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const delimiters = [";", ",", "\t"];
  const delimiter = delimiters.sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(field); field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some(cell => clean(cell))) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field);
  if (row.some(cell => clean(cell))) rows.push(row);
  if (!rows.length) throw new Error("O arquivo CSV está vazio.");
  const headers = rows.shift().map(clean);
  const required = ["Aluno", "Escola", "Olimpíada", "Nota", "Classificação", "Nível"];
  const missing = required.filter(name => !headers.some(h => norm(h) === norm(name)));
  if (missing.length) throw new Error(`Não encontrei as colunas obrigatórias: ${missing.join(", ")}.`);
  return rows.map((values, index) => {
    const item = {};
    headers.forEach((header, i) => item[header] = clean(values[i]));
    return { ...item, __line: index + 2 };
  });
}

function makeImportKey(row, olympiadId, edition, type) {
  return [olympiadId, row.Aluno, row.Escola, edition, type, row.Nota, row.Classificação, row.Nível]
    .map(norm).join("|");
}

export default function CsvResultsImporter({ olympiads, refresh }) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [edition, setEdition] = useState("2026.2");
  const [olympiadId, setOlympiadId] = useState(() => olympiads.find(o => norm(o.acronym) === "obli")?.id || "");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState(null);

  const obli = useMemo(() => olympiads.find(o => norm(o.acronym) === "obli"), [olympiads]);
  const preview = useMemo(() => rows.map(row => {
    const source = row.Olimpíada || "";
    const isSimulado = norm(source).includes("simulado");
    const scoreText = clean(row.Nota).replace(",", ".");
    const score = scoreText ? Number(scoreText) : null;
    return {
      raw: row,
      participant_name: clean(row.Aluno),
      school_name: clean(row.Escola),
      municipality: "Pires Ferreira",
      edition: clean(edition),
      award: clean(row.Classificação),
      score,
      level: clean(row.Nível),
      result_type: isSimulado ? "simulado" : "official",
      activity_name: isSimulado ? "Simulado Contínuo – OBLI" : "Olimpíada Brasileira de Língua Inglesa",
      import_key: makeImportKey(row, olympiadId, edition, isSimulado ? "simulado" : "official")
    };
  }), [rows, edition, olympiadId]);

  const invalidRows = preview.filter(r => !r.participant_name || !r.school_name || !r.award || (r.score !== null && !Number.isFinite(r.score)));
  const duplicatesInFile = useMemo(() => {
    const seen = new Set();
    const duplicates = new Set();
    preview.forEach((row, index) => {
      if (seen.has(row.import_key)) duplicates.add(index);
      seen.add(row.import_key);
    });
    return duplicates;
  }, [preview]);
  const officialCount = preview.filter(r => r.result_type === "official").length;
  const simulatedCount = preview.filter(r => r.result_type === "simulado").length;

  async function readFile(file) {
    setError(""); setNotice(""); setSummary(null); setRows([]); setFileName("");
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseCsvText(text);
      setRows(parsed);
      setFileName(file.name);
      const foundEdition = parsed.map(r => (r.Olimpíada || "").match(/20\d{2}(?:\.\d+)?/)?.[0]).find(Boolean);
      if (foundEdition) setEdition(foundEdition);
      if (parsed.some(r => norm(r.Olimpíada).includes("simulado"))) {
        setNotice("O Simulado Contínuo será importado como atividade separada, sem entrar na contagem de medalhas oficiais.");
      }
    } catch (e) { setError(e.message || "Não foi possível ler o CSV."); }
  }

  async function importRows() {
    setError(""); setNotice(""); setSummary(null);
    if (!supabase) { setError("O Supabase não está configurado."); return; }
    if (!olympiadId) { setError("Selecione a olimpíada correspondente."); return; }
    if (!preview.length) { setError("Selecione um arquivo CSV antes de importar."); return; }
    if (invalidRows.length) { setError(`Existem ${invalidRows.length} linha(s) com dados inválidos. Corrija o CSV e envie novamente.`); return; }
    if (duplicatesInFile.size) { setError(`O arquivo contém ${duplicatesInFile.size} linha(s) repetida(s). Remova as duplicatas do CSV antes de importar.`); return; }

    setBusy(true);
    try {
      const keys = preview.map(r => r.import_key);
      const { data: existing, error: lookupError } = await supabase.from("results").select("import_key").in("import_key", keys);
      if (lookupError) throw new Error(`Não foi possível verificar duplicidades. Confira se a migração SQL 0003 foi executada. Detalhe: ${lookupError.message}`);
      const existingKeys = new Set((existing || []).map(r => r.import_key));
      const toInsert = preview.filter(r => !existingKeys.has(r.import_key)).map(r => ({
        olympiad_id: olympiadId,
        participant_name: r.participant_name,
        school_name: r.school_name,
        municipality: r.municipality,
        edition: r.edition,
        award: r.award,
        score: r.score,
        level: r.level,
        result_type: r.result_type,
        activity_name: r.activity_name,
        import_key: r.import_key
      }));
      if (!toInsert.length) {
        setSummary({ imported: 0, skipped: preview.length });
        setNotice("Todos os registros deste arquivo já foram importados anteriormente.");
        setBusy(false);
        return;
      }
      const { error: insertError } = await supabase.from("results").insert(toInsert);
      if (insertError) throw insertError;
      const skipped = preview.length - toInsert.length;
      setSummary({ imported: toInsert.length, skipped });
      setNotice(`Importação concluída: ${toInsert.length} registro(s) novo(s) e ${skipped} já existente(s).`);
      await refresh();
    } catch (e) {
      setError(e.message || "Ocorreu um erro durante a importação.");
    } finally { setBusy(false); }
  }

  return <section className="csv-import-card">
    <div className="csv-import-heading"><span className="csv-import-icon"><FileSpreadsheet size={22}/></span><div><h2>Importar resultados por CSV</h2><p>Envie a planilha exportada pela plataforma da olimpíada. Os dados serão conferidos antes de entrar no banco.</p></div></div>
    <div className="csv-import-controls">
      <label>Olimpíada<select value={olympiadId} onChange={e => setOlympiadId(e.target.value)}><option value="">Selecione</option>{olympiads.map(o => <option key={o.id} value={o.id}>{o.acronym} — {o.name}</option>)}</select></label>
      <label>Edição<input value={edition} onChange={e => setEdition(e.target.value)} placeholder="Ex.: 2026.2"/></label>
    </div>
    <label className="csv-file-picker"><Upload size={19}/><span>{fileName || "Selecionar arquivo CSV"}</span><input type="file" accept=".csv,text/csv" onChange={e => readFile(e.target.files?.[0])}/></label>
    {error && <div className="csv-alert error"><AlertCircle size={17}/>{error}</div>}
    {notice && <div className="csv-alert success"><CheckCircle2 size={17}/>{notice}</div>}
    {preview.length > 0 && <>
      <div className="csv-summary">
        <div><b>{preview.length}</b><span>Registros lidos</span></div>
        <div><b>{officialCount}</b><span>Resultados oficiais</span></div>
        <div><b>{simulatedCount}</b><span>Simulados</span></div>
        <div><b>{invalidRows.length}</b><span>Linhas inválidas</span></div>
      </div>
      <div className="csv-preview-wrap"><table className="csv-preview"><thead><tr><th>Aluno</th><th>Atividade</th><th>Nota</th><th>Classificação</th><th>Tipo</th></tr></thead><tbody>{preview.slice(0, 10).map((r, i) => <tr key={`${r.raw.__line}-${i}`}><td>{r.participant_name}</td><td>{r.activity_name}</td><td>{r.score ?? "—"}</td><td>{r.award}</td><td><span className={`csv-type ${r.result_type}`}>{r.result_type === "simulado" ? "Simulado" : "Oficial"}</span></td></tr>)}</tbody></table></div>
      {preview.length > 10 && <p className="csv-muted">Exibindo os 10 primeiros de {preview.length} registros. Todos serão importados após a confirmação.</p>}
      <button className="primary-btn csv-import-button" onClick={importRows} disabled={busy || invalidRows.length > 0 || !olympiadId}>{busy ? <><Loader2 className="spin" size={17}/> Importando...</> : "Confirmar importação"}</button>
    </>}
    {summary && <p className="csv-muted">Resumo: {summary.imported} importado(s), {summary.skipped} ignorado(s) por já existir(em).</p>}
    <p className="csv-muted">A identificação de Simulado Contínuo é automática pelo nome da atividade no arquivo. O simulado fica separado dos resultados oficiais.</p>
  </section>;
}
