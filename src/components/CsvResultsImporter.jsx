import React, { useMemo, useState } from "react";
import { FileSpreadsheet, Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";

const clean = (value) => String(value ?? "").replace(/^\uFEFF/, "").trim();
const norm = (value) => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ");
const pick = (row, aliases) => {
  const key = Object.keys(row).find((name) => aliases.includes(norm(name)));
  return key ? clean(row[key]) : "";
};

function parseCsvMatrix(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) throw new Error("O arquivo CSV está vazio.");
  const delimiters = [";", ",", "\t"];
  const delimiter = delimiters
    .map((candidate) => ({ candidate, score: Math.max(...lines.slice(0, 12).map((line) => line.split(candidate).length)) }))
    .sort((a, b) => b.score - a.score)[0].candidate;

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
      if (row.some((cell) => clean(cell))) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field);
  if (row.some((cell) => clean(cell))) rows.push(row);
  return rows;
}

function parseCsvText(text) {
  const matrix = parseCsvMatrix(text);
  const headerIndex = matrix.findIndex((cells) => {
    const headers = cells.map(norm);
    const hasName = headers.some((h) => ["aluno", "aluno(a)", "nome", "nome do aluno", "nome do estudante", "nome completo", "estudante", "participante"].includes(h));
    const hasSchool = headers.some((h) => ["escola", "nome da escola", "instituicao", "instituicao de ensino", "unidade escolar"].includes(h));
    return hasName && hasSchool;
  });
  if (headerIndex < 0) {
    throw new Error("Não encontrei o cabeçalho. O arquivo precisa ter pelo menos as colunas Nome/Aluno e Escola.");
  }

  const headers = matrix[headerIndex].map(clean);
  const dataRows = matrix.slice(headerIndex + 1);
  return dataRows.map((values, index) => {
    const item = {};
    headers.forEach((header, i) => { item[header] = clean(values[i]); });
    return { ...item, __line: headerIndex + index + 2 };
  }).filter((row) => Object.values(row).some((value) => clean(value) && !String(value).startsWith("__")));
}

function makeImportKey(row, olympiadId, edition, type) {
  return [
    olympiadId, row.participant_name, row.school_name, row.municipality,
    edition, type, row.award, row.level
  ].map(norm).join("|");
}

export default function CsvResultsImporter({ olympiads, refresh }) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [edition, setEdition] = useState("2025");
  const [olympiadId, setOlympiadId] = useState(() =>
    olympiads.find((o) => norm(o.acronym) === "obmep")?.id ||
    olympiads.find((o) => norm(o.acronym) === "obli")?.id || ""
  );
  const [officialAward, setOfficialAward] = useState("Menção Honrosa");
  const [officialLevel, setOfficialLevel] = useState("2");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState(null);
  const [format, setFormat] = useState("standard");
  const [municipalityFilter, setMunicipalityFilter] = useState("all");

  const preview = useMemo(() => rows.map((row) => {
    const source = pick(row, ["olimpiada", "atividade", "competicao"]);
    const isSimulado = norm(source).includes("simulado");
    const participantName = pick(row, ["aluno", "aluno(a)", "nome", "nome do aluno", "nome do estudante", "nome completo", "estudante", "participante"]);
    const schoolName = pick(row, ["escola", "nome da escola", "instituicao", "instituicao de ensino", "unidade escolar"]);
    const municipalityFromFile = pick(row, ["municipio", "municipio de origem", "cidade", "localidade"]);
    // Só aplica o município padrão ao formato antigo, que não traz essa coluna.
    // No relatório OBMEP, município ausente deve ser tratado como dado incompleto.
    const municipality = municipalityFromFile || (format === "obmep" ? "" : "Pires Ferreira");
    const explicitAward = pick(row, ["classificacao", "classificacao final", "premiacao", "mencao", "distincao", "resultado", "resultado final", "medalha", "premio", "categoria"]);
    const explicitLevel = pick(row, ["nivel", "nivel de ensino", "nivel da olimpíada"]);
    const scoreText = pick(row, ["nota", "pontuacao", "pontos"]).replace(",", ".");
    const score = scoreText ? Number(scoreText) : null;
    // Nos relatórios oficiais da OBMEP, a coluna "Menção" contém "Sim/Não"
    // (indica se recebeu a menção), não o nome da premiação.
    // O tipo da premiação vem do relatório selecionado pelo administrador.
    const award = format === "obmep" ? officialAward : explicitAward;
    const level = explicitLevel || (format === "obmep" ? officialLevel : "");
    const result = {
      raw: row,
      participant_name: participantName,
      school_name: schoolName,
      municipality,
      edition: clean(edition),
      award,
      score,
      level,
      result_type: isSimulado ? "simulado" : "official",
      activity_name: isSimulado ? "Simulado Contínuo – OBLI" : (format === "obmep" ? "OBMEP" : (source || "Olimpíada oficial"))
    };
    result.import_key = makeImportKey(result, olympiadId, edition, result.result_type);
    return result;
  }), [rows, edition, olympiadId, format, officialAward, officialLevel]);

  const selectedRows = municipalityFilter === "pires"
    ? preview.filter((r) => norm(r.municipality) === "pires ferreira")
    : preview;
  const invalidRows = selectedRows.filter((r) =>
    !r.participant_name || !r.school_name || !r.municipality || !r.award ||
    (r.score !== null && !Number.isFinite(r.score))
  );
  const duplicatesInFile = useMemo(() => {
    const seen = new Set();
    const duplicates = new Set();
    selectedRows.forEach((row, index) => {
      if (seen.has(row.import_key)) duplicates.add(index);
      seen.add(row.import_key);
    });
    return duplicates;
  }, [selectedRows]);
  const localCount = preview.filter((r) => norm(r.municipality) === "pires ferreira").length;
  const otherMunicipalityCount = preview.length - localCount;
  const officialCount = preview.filter((r) => r.result_type === "official").length;
  const simulatedCount = preview.filter((r) => r.result_type === "simulado").length;

  async function readFile(file) {
    setError(""); setNotice(""); setSummary(null); setRows([]); setFileName("");
    if (!file) return;
    try {
      // Os relatórios da OBMEP podem vir em Windows-1252/ANSI, não em UTF-8.
      // Primeiro tentamos UTF-8 estrito; se falhar, usamos Windows-1252.
      const bytes = await file.arrayBuffer();
      let decoded;
      try {
        decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        decoded = new TextDecoder("windows-1252").decode(bytes);
      }
      const parsed = parseCsvText(decoded);
      // Só trata como relatório OBMEP quando encontra a combinação característica
      // de UF + Menção. Uma tabela de outra olimpíada com Município e Premiação
      // deve seguir o formato universal, sem receber Menção Honrosa por engano.
      const isObmep = parsed.some((row) => {
        const headers = Object.keys(row).map(norm);
        return headers.includes("uf") && headers.includes("mencao");
      });
      setFormat(isObmep ? "obmep" : "standard");
      setRows(parsed);
      setFileName(file.name);
      if (isObmep) {
        const obmep = olympiads.find((o) => norm(o.acronym) === "obmep");
        if (obmep) setOlympiadId(obmep.id);
        const yearFromFile = `${file.name} ${parsed.map((r) => Object.values(r).join(" ")).join(" ")}`.match(/20\d{2}/)?.[0];
        if (yearFromFile) setEdition(yearFromFile);
        setNotice("Relatório oficial da OBMEP identificado. Confira a edição, o nível e a premiação antes de importar. Os municípios serão preservados conforme o arquivo.");
      } else {
        const hasAwardColumn = parsed.some((row) => !!pick(row, ["classificacao", "classificacao final", "premiacao", "mencao", "distincao", "resultado", "resultado final", "medalha", "premio", "categoria"]));
        if (hasAwardColumn) setNotice("Formato de resultados reconhecido. Nome, escola, município e premiação serão convertidos automaticamente; colunas adicionais serão ignoradas.");
        const foundEdition = parsed.map((r) => pick(r, ["olimpiada", "atividade"])?.match(/20\d{2}(?:\.\d+)?/)?.[0]).find(Boolean);
        if (foundEdition) setEdition(foundEdition);
        if (parsed.some((r) => norm(pick(r, ["olimpiada", "atividade"])).includes("simulado"))) {
          setNotice("O Simulado Contínuo será importado como atividade separada, sem entrar na contagem de resultados oficiais.");
        }
      }
    } catch (e) {
      setError(e.message || "Não foi possível ler o CSV.");
    }
  }

  async function importRows() {
    setError(""); setNotice(""); setSummary(null);
    if (!supabase) { setError("O Supabase não está configurado."); return; }
    if (!olympiadId) { setError("Selecione a olimpíada correspondente."); return; }
    if (!selectedRows.length) { setError("Não há registros para importar com o filtro selecionado."); return; }
    if (invalidRows.length) { setError(`Existem ${invalidRows.length} linha(s) com dados incompletos. Confira nome, escola, município e premiação.`); return; }
    if (duplicatesInFile.size) { setError(`O arquivo contém ${duplicatesInFile.size} linha(s) repetida(s). Remova as duplicatas antes de importar.`); return; }

    setBusy(true);
    try {
      // Consultas em lotes pequenos evitam URLs muito longas no PostgREST.
      const chunks = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
      const existingKeys = new Set();
      for (const keyBatch of chunks(selectedRows.map((r) => r.import_key), 100)) {
        const { data: existing, error: lookupError } = await supabase
          .from("results").select("import_key").in("import_key", keyBatch);
        if (lookupError) throw new Error(`Falha ao consultar registros existentes: ${lookupError.message}`);
        (existing || []).forEach((r) => existingKeys.add(r.import_key));
      }
      const toInsert = selectedRows.filter((r) => !existingKeys.has(r.import_key)).map((r) => ({
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
        setSummary({ imported: 0, skipped: selectedRows.length });
        setNotice("Todos os registros deste arquivo já foram importados anteriormente.");
        return;
      }
      // Inserção em lotes para evitar payloads grandes e facilitar a recuperação de erros.
      let insertedCount = 0;
      for (const insertBatch of chunks(toInsert, 100)) {
        const { error: insertError } = await supabase.from("results").insert(insertBatch);
        if (insertError) throw new Error(`Falha ao inserir o lote ${Math.floor(insertedCount / 100) + 1}: ${insertError.message}. ${insertedCount} registro(s) já foram inseridos; os demais podem ser reenviados com segurança após verificar duplicidades.`);
        insertedCount += insertBatch.length;
      }
      const skipped = selectedRows.length - toInsert.length;
      setSummary({ imported: insertedCount, skipped });
      setNotice(`Importação concluída: ${insertedCount} registro(s) novo(s) e ${skipped} já existente(s).`);
      await refresh();
    } catch (e) {
      setError(e.message || "Ocorreu um erro durante a importação.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="csv-import-card">
    <div className="csv-import-heading">
      <span className="csv-import-icon"><FileSpreadsheet size={22}/></span>
      <div><h2>Importar resultados por CSV</h2><p>Envie a planilha de resultados. O sistema identifica o formato e apresenta uma prévia antes de gravar os dados.</p></div>
    </div>
    <div className="csv-import-controls">
      <label>Olimpíada<select value={olympiadId} onChange={(e) => setOlympiadId(e.target.value)}><option value="">Selecione</option>{olympiads.map((o) => <option key={o.id} value={o.id}>{o.acronym} — {o.name}</option>)}</select></label>
      <label>Edição<input value={edition} onChange={(e) => setEdition(e.target.value)} placeholder="Ex.: 2025"/></label>
    </div>
    <label className="csv-file-picker"><Upload size={19}/><span>{fileName || "Selecionar arquivo CSV"}</span><input type="file" accept=".csv,text/csv" onChange={(e) => readFile(e.target.files?.[0])}/></label>

    {format === "obmep" && rows.length > 0 && <div className="csv-import-controls">
      <label>Premiação do relatório<select value={officialAward} onChange={(e) => setOfficialAward(e.target.value)}><option>Menção Honrosa</option><option>Medalha de Ouro</option><option>Medalha de Prata</option><option>Medalha de Bronze</option></select></label>
      <label>Nível<select value={officialLevel} onChange={(e) => setOfficialLevel(e.target.value)}><option value="1">Nível 1</option><option value="2">Nível 2</option><option value="3">Nível 3</option></select></label>
    </div>}

    {error && <div className="csv-alert error"><AlertCircle size={17}/>{error}</div>}
    {notice && <div className="csv-alert success"><CheckCircle2 size={17}/>{notice}</div>}

    {preview.length > 0 && <>
      <div className="csv-summary">
        <div><b>{preview.length}</b><span>Registros lidos</span></div>
        <div><b>{localCount}</b><span>Pires Ferreira</span></div>
        <div><b>{otherMunicipalityCount}</b><span>Outros municípios</span></div>
        <div><b>{invalidRows.length}</b><span>Linhas incompletas</span></div>
      </div>
      <div className="csv-filter-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
        <button type="button" className={municipalityFilter === "all" ? "primary-btn" : "secondary-btn"} onClick={() => setMunicipalityFilter("all")}>Todos os municípios ({preview.length})</button>
        <button type="button" className={municipalityFilter === "pires" ? "primary-btn" : "secondary-btn"} onClick={() => setMunicipalityFilter("pires")}>Somente Pires Ferreira ({localCount})</button>
      </div>
      <p className="csv-muted">Filtro atual: {municipalityFilter === "pires" ? "somente Pires Ferreira" : "todos os municípios"}. Serão importados {selectedRows.length} registro(s).</p>
      <div className="csv-preview-wrap"><table className="csv-preview"><thead><tr><th>Estudante</th><th>Escola</th><th>Município</th><th>Edição</th><th>Nível</th><th>Premiação</th></tr></thead>
        <tbody>{selectedRows.slice(0, 15).map((r, i) => <tr key={`${r.raw.__line}-${i}`}><td>{r.participant_name || "—"}</td><td>{r.school_name || "—"}</td><td>{r.municipality || "—"}</td><td>{r.edition}</td><td>{r.level || "—"}</td><td>{r.award || "—"}</td></tr>)}</tbody>
      </table></div>
      {selectedRows.length > 15 && <p className="csv-muted">Exibindo os 15 primeiros de {selectedRows.length} registros selecionados.</p>}
      {otherMunicipalityCount > 0 && <p className="csv-muted">O arquivo contém registros de outros municípios. Escolha acima se deseja importar todos ou somente os estudantes de Pires Ferreira.</p>}
      <button className="primary-btn csv-import-button" onClick={importRows} disabled={busy || !selectedRows.length || invalidRows.length > 0 || duplicatesInFile.size > 0 || !olympiadId}>
        {busy ? <><Loader2 className="spin" size={17}/> Importando...</> : `Confirmar importação de ${selectedRows.length} resultado(s)`}
      </button>
    </>}
    {summary && <p className="csv-muted">Resumo: {summary.imported} importado(s), {summary.skipped} ignorado(s) por já existir(em).</p>}
    <p className="csv-muted">Os municípios são preservados conforme o arquivo. A conferência de duplicidades considera estudante, escola, município, edição, nível e premiação.</p>
  </section>;
}
