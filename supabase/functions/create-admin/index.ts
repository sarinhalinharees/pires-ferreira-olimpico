// Deploy esta Edge Function e configure os secrets descritos no README.
// Não coloque ADMIN_INVITE_SECRET nem SERVICE_ROLE_KEY no frontend.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigins = new Set(["https://pires-ferreira-olimpico.pages.dev", "http://localhost:5173"]);
  const corsOrigin = allowedOrigins.has(origin) ? origin : "https://pires-ferreira-olimpico.pages.dev";
  const headers = {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json"
  };
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers });

  try {
    const { email, password, inviteSecret } = await req.json();
    const expected = Deno.env.get("ADMIN_INVITE_SECRET");
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!expected || !url || !serviceKey) throw new Error("Configuração segura da função incompleta.");
    if (typeof inviteSecret !== "string" || inviteSecret !== expected) {
      return new Response(JSON.stringify({ error: "Convite inválido." }), { status: 403, headers });
    }
    if (typeof email !== "string" || !email.includes("@") || typeof password !== "string" || password.length < 12) {
      return new Response(JSON.stringify({ error: "Informe um e-mail válido e uma senha com pelo menos 12 caracteres." }), { status: 400, headers });
    }

    const adminClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await adminClient.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true
    });
    if (error) throw error;

    const { error: profileError } = await adminClient.from("admin_profiles").insert({
      user_id: data.user.id,
      email: data.user.email,
      role: "admin"
    });
    if (profileError) {
      await adminClient.auth.admin.deleteUser(data.user.id);
      throw profileError;
    }
    return new Response(JSON.stringify({ ok: true, message: "Administrador criado. Já é possível entrar." }), { status: 200, headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message ?? "Não foi possível criar o administrador." }), { status: 400, headers });
  }
});
