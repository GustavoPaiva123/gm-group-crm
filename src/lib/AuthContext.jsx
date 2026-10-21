import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const AuthContext = createContext(null);

// O e-mail de "Esqueci minha senha" volta para o app com ?recuperar=1 na URL.
// Usamos esse marcador (em vez de só o evento PASSWORD_RECOVERY) porque ele
// funciona igual no fluxo implícito e no PKCE do supabase-js.
const PARAM_RECUPERACAO = "recuperar";

function urlEhDeRecuperacao() {
  return new URLSearchParams(window.location.search).get(PARAM_RECUPERACAO) === "1";
}

function limparParamRecuperacao() {
  const url = new URL(window.location.href);
  url.searchParams.delete(PARAM_RECUPERACAO);
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recuperandoSenha, setRecuperandoSenha] = useState(urlEhDeRecuperacao);

  useEffect(() => {
    // Sessão persistida pelo próprio supabase-js (localStorage) — isso é o
    // que garante "continuar logado" ao recarregar a página ou reabrir o app.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === "PASSWORD_RECOVERY") setRecuperandoSenha(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    recuperandoSenha,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
    enviarEmailRecuperacao: (email) =>
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/?${PARAM_RECUPERACAO}=1`,
      }),
    definirNovaSenha: async (password) => {
      const res = await supabase.auth.updateUser({ password });
      if (!res.error) {
        limparParamRecuperacao();
        setRecuperandoSenha(false);
      }
      return res;
    },
    cancelarRecuperacao: () => {
      limparParamRecuperacao();
      setRecuperandoSenha(false);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa ser usado dentro de um <AuthProvider>.");
  return ctx;
}
