# Pires Ferreira Olímpico

Aplicação independente do Lovable, construída com React + Vite + Supabase.

## O que já está nesta primeira entrega

- Página inicial com identidade visual azul-marinho, dourado e fundo claro.
- Página das 13 olimpíadas previstas no escopo.
- Página de detalhes de cada olimpíada.
- Calendário mensal com filtros por olimpíada.
- Página de resultados com filtros e exibição limitada a Pires Ferreira.
- Estrutura inicial do painel administrativo.
- Esquema SQL com RLS para dados públicos e operações administrativas.
- Edge Function para criação de administradores por segredo de convite, sem cadastro público.

**Importante:** nenhum resultado, data ou informação oficial fictícia foi incluído. Campos sem dados mostram “Informações em atualização”.

## 1. Criar o projeto Supabase

1. Acesse https://supabase.com/dashboard e crie um projeto.
2. Guarde a senha do banco em local seguro.
3. Em Project Settings > API, copie:
   - Project URL
   - anon / publishable key
4. No SQL Editor, abra `supabase/migrations/0001_initial_schema.sql`, copie todo o conteúdo e execute.
5. Em Authentication > Providers > Email, mantenha Email habilitado. A função de convite confirma o e-mail do administrador no servidor.

## 2. Configurar a criação segura de administradores

A função está em `supabase/functions/create-admin/index.ts`.

Para implantá-la, instale/abra o Supabase CLI e execute a partir da pasta do projeto:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase secrets set ADMIN_INVITE_SECRET="CRIE_UM_SEGREDO_NOVO_LONGO_E_ALEATORIO"
supabase functions deploy create-admin
```

A chave `SUPABASE_SERVICE_ROLE_KEY` já é disponibilizada às Edge Functions pelo ambiente Supabase. Não a coloque no `.env` do frontend.

Para criar o primeiro administrador, faça uma chamada POST para:

`https://SEU_PROJECT_REF.supabase.co/functions/v1/create-admin`

JSON:
```json
{
  "email": "email-do-administrador",
  "password": "uma-senha-forte-com-12-caracteres-ou-mais",
  "inviteSecret": "o-segredo-configurado-no-Supabase"
}
```

Faça essa chamada por ferramenta segura (por exemplo, painel/API client local) e nunca publique o segredo. A função não cria um cadastro público aberto.

## 3. Configurar o frontend

1. O arquivo `.env` já está incluído nesta cópia para testes locais, preenchido com a Project URL e a chave publicável fornecidas.
2. Para publicar, cadastre os mesmos dois valores nas variáveis de ambiente do Cloudflare Pages:
```env
VITE_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLICA
```
A chave anon/publishable é própria para frontend e está protegida pelas políticas RLS. Nunca use a service_role no navegador.

## 4. Rodar localmente e publicar

Requer Node.js LTS e Git.

```bash
npm install
npm run dev
```

Para gerar a versão de publicação:
```bash
npm run build
```

No GitHub, envie o repositório. No Cloudflare Pages:
- Connect to Git
- Framework preset: Vite
- Build command: `npm run build`
- Build output directory: `dist`
- Adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nas variáveis de ambiente do projeto.

## Limitações conhecidas desta primeira versão

- O painel administrativo permite CRUD básico de olimpíadas, eventos e resultados após autenticação.
- Ainda não há interface administrativa de gerenciamento de escolas nem upload de documentos; o link do regulamento é cadastrado como URL.
- A Edge Function de convite é fornecida, mas precisa ser implantada e configurada no projeto Supabase.
- O site deve ser testado depois de configurar as chaves e políticas RLS.
- Dados iniciais das 13 olimpíadas incluem apenas siglas e nomes; informações factuais devem ser preenchidas por administrador.
