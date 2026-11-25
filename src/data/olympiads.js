export const initialOlympiads = [
  ["OBMEP", "Olimpíada Brasileira de Matemática das Escolas Públicas"],
  ["OP", "Olimpíada de Português"],
  ["OBA", "Olimpíada Brasileira de Astronomia e Astronáutica"],
  ["OBLI", "OBLI"],
  ["OMIFICE", "OMIFICE"],
  ["ONC", "Olimpíada Nacional de Ciências"],
  ["Canguru", "Canguru de Matemática"],
  ["Mandacaru", "Olimpíada Mandacaru de Matemática"],
  ["Cactus", "Olimpíada Cactus"],
  ["Maratona Tech", "Maratona Tech"],
  ["ONEE", "ONEE"],
  ["OLITEF", "Olimpíada do Tesouro Direto de Educação Financeira"],
  ["OCHE", "OCHE"]
].map(([acronym, name], index) => ({
  id: `seed-${index + 1}`,
  acronym,
  name,
  description: "",
  audience: "",
  stages: "",
  registration_info: "",
  notices: "",
  regulation_url: "",
  published: true
}));

export const infoPending = "Informações em atualização";
