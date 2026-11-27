import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Mantém a sessão ativa enquanto o site estiver aberto e encerra ao fechar a aba/navegador.
    // (Troque para window.localStorage se quiser que fique logado mesmo após fechar o navegador)
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    autoRefreshToken: true,   // Renova o token automaticamente em segundo plano antes de expirar
    persistSession: true,     // Mantém a conexão fixa ao recarregar a página (F5)
    detectSessionInUrl: true,
  },
})