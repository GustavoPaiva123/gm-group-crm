import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LayoutDashboard, Users, Rows3, Clock, FileText, Building2, Settings,
  Search, Bell, Plus, ChevronLeft, ChevronRight, Phone, AtSign, MapPin,
  Calendar, MessageCircle, CheckCircle2, AlertTriangle, TrendingUp,
  ArrowUpRight, X, Menu, ArrowLeft, Mail, Briefcase, Tag, MoreHorizontal,
  DollarSign, Sparkles, Loader2, LogOut, Lock
} from "lucide-react";
import {
  fetchLeads, fetchClientes, fetchPropostas, fetchFollowUps,
  fetchTimelineByLead, fetchAtividadeRecente, fetchServicos,
  concluirFollowUp, converterLeadEmCliente, fetchPerfilPorEmail,
} from "./lib/api";
import { useAuth } from "./lib/AuthContext";

/* ------------------------------------------------------------------ */
/*  CONFIGURAÇÃO DE UI (estático — não vem do banco)                    */
/* ------------------------------------------------------------------ */

const STAGES = [
  { key: "novo", label: "Novo lead" },
  { key: "primeiro_contato", label: "Primeiro contato" },
  { key: "respondeu", label: "Respondeu" },
  { key: "reuniao", label: "Reunião" },
  { key: "proposta", label: "Proposta enviada" },
  { key: "negociacao", label: "Negociação" },
  { key: "fechado", label: "Fechado" },
  { key: "perdido", label: "Perdido" },
];


const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "leads", label: "Leads", icon: Rows3 },
  { key: "followups", label: "Follow-ups", icon: Clock },
  { key: "propostas", label: "Propostas", icon: FileText },
  { key: "clientes", label: "Clientes", icon: Building2 },
  { key: "config", label: "Configurações", icon: Settings },
];

const fmtBRL = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/* ------------------------------------------------------------------ */
/*  STYLES                                                             */
/* ------------------------------------------------------------------ */

const CSS = `
.gm-crm {
  --ink: #0A1730;
  --navy: #0D2049;
  --blue: #1E4FE0;
  --blue-dim: #3E64E0;
  --blue-tint: #EBF0FE;
  --bg: #F5F7FB;
  --surface: #FFFFFF;
  --border: #E6EAF2;
  --text: #101828;
  --text-muted: #667085;
  --text-faint: #98A2B3;
  --success: #0F7A56;
  --success-tint: #E7F6EF;
  --warning: #B4590A;
  --warning-tint: #FDF0E4;
  --danger: #B3261E;
  --danger-tint: #FBEAE9;
  font-family: -apple-system, "SF Pro Text", "Segoe UI", Inter, Roboto, sans-serif;
  color: var(--text);
  background: var(--bg);
  min-height: 100vh;
  display: flex;
  position: relative;
  font-size: 14px;
}
.gm-crm * { box-sizing: border-box; }
.gm-crm h1, .gm-crm h2, .gm-crm h3 {
  font-family: -apple-system, "SF Pro Display", "Segoe UI", Inter, Roboto, sans-serif;
  letter-spacing: -0.02em;
  color: var(--ink);
  margin: 0;
}
.gm-eyebrow {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--text-faint);
}

/* ---------- Sidebar ---------- */
.gm-sidebar {
  width: 232px;
  flex-shrink: 0;
  background: var(--navy);
  color: #EAF0FF;
  display: flex;
  flex-direction: column;
  padding: 20px 14px;
  position: sticky;
  top: 0;
  height: 100vh;
}
.gm-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px 22px 8px;
  position: relative;
}
.gm-brand-mark {
  width: 36px; height: 36px; flex-shrink: 0;
}
.gm-brand-name { font-weight: 700; font-size: 15px; letter-spacing: -0.01em; color: #fff; line-height: 1.1;}
.gm-brand-sub { font-size: 10.5px; color: rgba(234,240,255,0.5); letter-spacing: 0.05em; text-transform: uppercase; margin-top: 2px;}
.gm-nav { display: flex; flex-direction: column; gap: 2px; margin-top: 6px; }
.gm-nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; border-radius: 8px;
  color: rgba(234,240,255,0.68);
  font-size: 13.5px; font-weight: 500;
  cursor: pointer; border: none; background: transparent; text-align: left; width: 100%;
  transition: background 0.15s ease, color 0.15s ease;
}
.gm-nav-item:hover { background: rgba(255,255,255,0.06); color: #fff; }
.gm-nav-item.active { background: var(--blue); color: #fff; }
.gm-nav-item svg { flex-shrink: 0; }
.gm-sidebar-footer {
  margin-top: auto; padding: 12px 10px; border-top: 1px solid rgba(255,255,255,0.08);
  display: flex; align-items: center; gap: 10px;
}
.gm-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--blue); color: #fff; display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 13px; flex-shrink: 0;
}
.gm-user-name { font-size: 13px; font-weight: 600; color: #fff; }
.gm-user-role { font-size: 11px; color: rgba(234,240,255,0.5); }

/* ---------- Main ---------- */
.gm-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.gm-topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 28px; background: var(--surface); border-bottom: 1px solid var(--border);
  position: sticky; top: 0; z-index: 5;
}
.gm-search {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg); border: 1px solid var(--border); border-radius: 8px;
  padding: 7px 12px; width: 280px; color: var(--text-faint); font-size: 13px;
}
.gm-topbar-actions { display: flex; align-items: center; gap: 14px; }
.gm-icon-btn {
  width: 34px; height: 34px; border-radius: 8px; border: 1px solid var(--border);
  background: var(--surface); display: flex; align-items: center; justify-content: center;
  color: var(--text-muted); cursor: pointer; position: relative;
}
.gm-icon-btn:hover { background: var(--bg); }
.gm-dot { position: absolute; top: 6px; right: 6px; width: 6px; height: 6px; border-radius: 50%; background: var(--blue); }
.gm-content { padding: 28px; flex: 1; }

.gm-btn {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
  cursor: pointer; border: 1px solid transparent; white-space: nowrap;
}
.gm-btn-primary { background: var(--blue); color: #fff; }
.gm-btn-primary:hover { background: #1A44C4; }
.gm-btn-ghost { background: var(--surface); color: var(--text); border-color: var(--border); }
.gm-btn-ghost:hover { background: var(--bg); }

/* ---------- Cards / grid ---------- */
.gm-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
}
.gm-stat-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 18px;
}
.gm-stat-card { padding: 18px; display: flex; flex-direction: column; gap: 10px; }
.gm-stat-top { display: flex; align-items: center; justify-content: space-between; }
.gm-stat-icon {
  width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
  background: var(--blue-tint); color: var(--blue);
}
.gm-stat-value { font-size: 26px; font-weight: 700; color: var(--ink); letter-spacing: -0.02em; }
.gm-stat-label { font-size: 12.5px; color: var(--text-muted); }
.gm-stat-delta { font-size: 11.5px; font-weight: 600; display: flex; align-items: center; gap: 3px; }
.gm-stat-delta.up { color: var(--success); }

.gm-section-title { display: flex; align-items: center; justify-content: space-between; margin: 30px 0 14px; }
.gm-two-col { display: grid; grid-template-columns: 1.6fr 1fr; gap: 16px; }

/* pipeline funnel */
.gm-funnel { padding: 20px; }
.gm-funnel-row { display: flex; align-items: center; gap: 12px; padding: 9px 0; border-bottom: 1px dashed var(--border); }
.gm-funnel-row:last-child { border-bottom: none; }
.gm-funnel-label { width: 130px; font-size: 12.5px; color: var(--text-muted); flex-shrink: 0; }
.gm-funnel-track { flex: 1; height: 8px; background: var(--bg); border-radius: 4px; overflow: hidden; }
.gm-funnel-fill { height: 100%; background: linear-gradient(90deg, var(--blue), var(--blue-dim)); border-radius: 4px; }
.gm-funnel-count { width: 30px; text-align: right; font-size: 12.5px; font-weight: 700; color: var(--ink); }

/* activity feed */
.gm-activity { padding: 20px; }
.gm-activity-item { display: flex; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border); }
.gm-activity-item:last-child { border-bottom: none; padding-bottom: 0; }
.gm-activity-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--blue); margin-top: 5px; flex-shrink: 0; }
.gm-activity-text { font-size: 12.5px; color: var(--text); line-height: 1.4; }
.gm-activity-company { font-weight: 600; }
.gm-activity-time { font-size: 11px; color: var(--text-faint); margin-top: 2px; }

/* badges */
.gm-badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 20px;
}
.gm-badge-blue { background: var(--blue-tint); color: var(--blue); }
.gm-badge-success { background: var(--success-tint); color: var(--success); }
.gm-badge-warning { background: var(--warning-tint); color: var(--warning); }
.gm-badge-danger { background: var(--danger-tint); color: var(--danger); }
.gm-badge-gray { background: var(--bg); color: var(--text-muted); }

/* ---------- Kanban ---------- */
.gm-kanban { display: flex; gap: 14px; overflow-x: auto; padding-bottom: 10px; margin-top: 18px; }
.gm-kanban-col { min-width: 250px; flex-shrink: 0; }
.gm-kanban-col-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 4px 4px 10px;
}
.gm-kanban-col-title { font-size: 12.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.gm-kanban-col-count {
  font-size: 11px; font-weight: 700; color: var(--text-faint); background: var(--surface);
  border: 1px solid var(--border); border-radius: 20px; padding: 1px 7px;
}
.gm-kanban-cards { display: flex; flex-direction: column; gap: 10px; }
.gm-lead-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 13px;
  cursor: pointer; transition: box-shadow 0.15s ease, border-color 0.15s ease;
}
.gm-lead-card:hover { box-shadow: 0 4px 14px rgba(13,32,73,0.08); border-color: #CBD6EE; }
.gm-lead-card-empresa { font-size: 13px; font-weight: 700; color: var(--ink); margin-bottom: 2px; }
.gm-lead-card-contato { font-size: 12px; color: var(--text-muted); margin-bottom: 10px; }
.gm-lead-card-meta { display: flex; align-items: center; justify-content: space-between; }
.gm-lead-card-valor { font-size: 12.5px; font-weight: 700; color: var(--blue); }

/* ---------- Table ---------- */
.gm-table { width: 100%; border-collapse: collapse; }
.gm-table th {
  text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--text-faint); padding: 10px 14px; border-bottom: 1px solid var(--border);
}
.gm-table td { padding: 13px 14px; border-bottom: 1px solid var(--border); font-size: 13px; }
.gm-table tr:last-child td { border-bottom: none; }
.gm-table tr:hover td { background: var(--bg); }

/* ---------- Lead detail ---------- */
.gm-detail-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.gm-back-btn {
  display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600;
  color: var(--text-muted); cursor: pointer; border: none; background: none; padding: 0; margin-bottom: 14px;
}
.gm-back-btn:hover { color: var(--ink); }
.gm-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 24px; margin-top: 20px; }
.gm-info-item { display: flex; gap: 10px; align-items: flex-start; }
.gm-info-icon { color: var(--text-faint); margin-top: 1px; flex-shrink: 0; }
.gm-info-label { font-size: 11px; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 2px; }
.gm-info-value { font-size: 13.5px; font-weight: 600; color: var(--text); }
.gm-timeline { padding: 20px; }
.gm-timeline-item { display: flex; gap: 12px; padding-bottom: 18px; position: relative; }
.gm-timeline-item:last-child { padding-bottom: 0; }
.gm-timeline-line { position: absolute; left: 5px; top: 16px; bottom: 0; width: 1px; background: var(--border); }
.gm-timeline-dot { width: 11px; height: 11px; border-radius: 50%; background: var(--blue-tint); border: 2px solid var(--blue); flex-shrink: 0; margin-top: 2px; z-index: 1; }
.gm-timeline-title { font-size: 13px; font-weight: 700; color: var(--ink); }
.gm-timeline-desc { font-size: 12.5px; color: var(--text-muted); margin-top: 1px; }
.gm-timeline-date { font-size: 11px; color: var(--text-faint); margin-top: 3px; }

/* ---------- Follow-ups ---------- */
.gm-fu-cols { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 18px; }
.gm-fu-col-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.gm-fu-item { padding: 14px; margin-bottom: 10px; }
.gm-fu-item-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
.gm-fu-actions { display: flex; gap: 6px; margin-top: 10px; }
.gm-fu-action {
  font-size: 11.5px; font-weight: 600; padding: 5px 10px; border-radius: 6px; cursor: pointer;
  border: 1px solid var(--border); background: var(--surface); color: var(--text-muted);
}
.gm-fu-action:hover { background: var(--bg); }
.gm-fu-action.primary { background: var(--blue); color: #fff; border-color: var(--blue); }
.gm-fu-action.primary:hover { background: #1A44C4; }

/* ---------- Empty / list generic ---------- */
.gm-list-card { padding: 16px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; gap: 14px; }

/* ---------- Config ---------- */
.gm-config-section { padding: 22px; margin-bottom: 16px; }
.gm-config-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border); }
.gm-config-row:last-child { border-bottom: none; }
.gm-config-label { font-size: 13.5px; font-weight: 600; color: var(--text); }
.gm-config-desc { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.gm-toggle { width: 38px; height: 22px; border-radius: 20px; background: var(--border); position: relative; cursor: pointer; flex-shrink: 0; }
.gm-toggle.on { background: var(--blue); }
.gm-toggle-dot { width: 18px; height: 18px; border-radius: 50%; background: #fff; position: absolute; top: 2px; left: 2px; transition: left 0.15s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
.gm-toggle.on .gm-toggle-dot { left: 18px; }
.gm-input {
  border: 1px solid var(--border); border-radius: 8px; padding: 9px 12px; font-size: 13px; width: 100%;
  background: var(--surface); color: var(--text);
}

/* ---------- Mobile ---------- */
.gm-mobile-topbar { display: none; }
.gm-bottom-nav { display: none; }

@media (max-width: 860px) {
  .gm-sidebar { display: none; }
  .gm-content { padding: 16px; padding-bottom: 84px; }
  .gm-topbar { padding: 14px 16px; }
  .gm-search { display: none; }
  .gm-stat-grid { grid-template-columns: 1fr 1fr; }
  .gm-two-col { grid-template-columns: 1fr; }
  .gm-info-grid { grid-template-columns: 1fr; }
  .gm-fu-cols { grid-template-columns: 1fr; }
  .gm-bottom-nav {
    display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 20;
    background: var(--navy); padding: 8px 6px calc(8px + env(safe-area-inset-bottom));
    justify-content: space-around;
  }
  .gm-bottom-nav-item {
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    color: rgba(234,240,255,0.55); font-size: 9.5px; font-weight: 600; background: none; border: none; padding: 4px 8px; cursor: pointer;
  }
  .gm-bottom-nav-item.active { color: #fff; }
}

.gm-spin { animation: gm-spin 0.8s linear infinite; }
@keyframes gm-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* ---------- Login ---------- */
.gm-login-page {
  min-height: 100vh; width: 100%;
  background: radial-gradient(circle at 20% 20%, #14306b 0%, var(--navy) 55%, #071026 100%);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.gm-login-card {
  width: 380px; max-width: 100%;
  background: var(--surface); border-radius: 16px; padding: 32px 30px;
  box-shadow: 0 20px 60px rgba(5,15,40,0.35);
}
.gm-login-brand { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 22px; }
.gm-login-brand-mark { width: 52px; height: 52px; }
.gm-login-title { font-size: 17px; font-weight: 700; color: var(--ink); text-align: center; }
.gm-login-subtitle { font-size: 12.5px; color: var(--text-muted); text-align: center; margin-top: 2px; }
.gm-login-field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
.gm-login-error {
  font-size: 12.5px; color: var(--danger); background: var(--danger-tint);
  padding: 9px 11px; border-radius: 8px; margin-bottom: 14px;
}
.gm-login-footer {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  margin-top: 18px; font-size: 11.5px; color: var(--text-faint);
}
`;

/* ------------------------------------------------------------------ */
/*  BRAND MARK (arc motif derived from the GM Group logo)              */
/* ------------------------------------------------------------------ */

function BrandMark({ light = true, className = "gm-brand-mark" }) {
  const textFill = light ? "#EAF0FF" : "#0D2049";
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none">
      <text x="6" y="66" fontFamily="-apple-system, sans-serif" fontWeight="800" fontSize="46" fill={textFill} letterSpacing="-2">GM</text>
      <path d="M60 22 C 84 32, 84 68, 60 78" stroke="#3E7BFF" strokeWidth="7" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  LOGIN                                                                */
/* ------------------------------------------------------------------ */

function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : signInError.message
      );
    }
  };

  return (
    <div className="gm-crm gm-login-page">
      <style>{CSS}</style>
      <div className="gm-login-card">
        <div className="gm-login-brand">
          <img src="/logo-gm-group.png" alt="GM Group" className="gm-login-brand-mark" />
          <div className="gm-login-title">GM Group — CRM</div>
          <div className="gm-login-subtitle">Acesso restrito à equipe comercial</div>
        </div>

        {error && <div className="gm-login-error">{error}</div>}

        <form onSubmit={handleSubmit} autoComplete="on">
          <div className="gm-login-field">
            <label className="gm-info-label" htmlFor="email">E-mail</label>
            <input
              id="email" type="email" required autoComplete="username"
              className="gm-input" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@gmgroup.com.br"
            />
          </div>
          <div className="gm-login-field">
            <label className="gm-info-label" htmlFor="password">Senha</label>
            <input
              id="password" type="password" required autoComplete="current-password"
              className="gm-input" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className="gm-btn gm-btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 6 }} disabled={submitting}>
            {submitting ? <Loader2 size={14} className="gm-spin" /> : <Lock size={14} />}
            {submitting ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="gm-login-footer">
          <Lock size={11} /> Não há cadastro público — contas são criadas pela administração do GM Group.
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SHARED BITS                                                        */
/* ------------------------------------------------------------------ */

function stageBadge(status) {
  const map = {
    novo: { cls: "gm-badge-blue", label: "Novo lead" },
    primeiro_contato: { cls: "gm-badge-blue", label: "Primeiro contato" },
    respondeu: { cls: "gm-badge-blue", label: "Respondeu" },
    reuniao: { cls: "gm-badge-warning", label: "Reunião" },
    proposta: { cls: "gm-badge-warning", label: "Proposta enviada" },
    negociacao: { cls: "gm-badge-warning", label: "Negociação" },
    fechado: { cls: "gm-badge-success", label: "Fechado" },
    perdido: { cls: "gm-badge-danger", label: "Perdido" },
  };
  const m = map[status] || { cls: "gm-badge-gray", label: status };
  return <span className={`gm-badge ${m.cls}`}>{m.label}</span>;
}

function Avatar({ name }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return <div className="gm-avatar">{initials}</div>;
}

/* ------------------------------------------------------------------ */
/*  DASHBOARD                                                           */
/* ------------------------------------------------------------------ */

function Dashboard({ leads, clientes, followUps, recentActivity, onOpenLead, goTo }) {
  const novos = leads.filter((l) => l.status === "novo").length;
  const negociacao = leads.filter((l) => l.status === "negociacao").length;
  const propostasEnviadas = leads.filter((l) => l.status === "proposta").length;
  const clientesAtivos = clientes.filter((c) => c.status === "Ativo").length;
  const clientesEmRisco = clientes.filter((c) => c.status === "Em risco").length;
  const valorTotalNegociacao = leads
    .filter((l) => !["fechado", "perdido"].includes(l.status))
    .reduce((sum, l) => sum + l.valor, 0);

  const funnel = STAGES.filter((s) => s.key !== "perdido").map((s) => ({
    ...s,
    count: leads.filter((l) => l.status === s.key).length,
  }));
  const maxCount = Math.max(...funnel.map((f) => f.count), 1);

  const pendentes = followUps
    .filter((f) => f.status === "pendente")
    .sort((a, b) => (a.dataHora?.getTime() ?? 0) - (b.dataHora?.getTime() ?? 0));

  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p className="gm-eyebrow">{hoje}</p>
          <h1 style={{ fontSize: 24, marginTop: 4 }}>Bom dia, Gustavo</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 4, fontSize: 13.5 }}>
            Aqui está o panorama comercial da GM Group hoje.
          </p>
        </div>
        <button className="gm-btn gm-btn-primary" onClick={() => goTo("leads")}>
          <Plus size={15} /> Novo lead
        </button>
      </div>

      <div className="gm-stat-grid">
        <StatCard icon={<Users size={16} />} label="Leads novos" value={novos} />
        <StatCard icon={<TrendingUp size={16} />} label="Em negociação" value={negociacao} />
        <StatCard icon={<FileText size={16} />} label="Propostas enviadas" value={propostasEnviadas} />
        <StatCard
          icon={<Building2 size={16} />}
          label="Clientes ativos"
          value={clientesAtivos}
          delta={clientesEmRisco > 0 ? `${clientesEmRisco} em risco de renovação` : undefined}
          warn={clientesEmRisco > 0}
        />
      </div>

      <div className="gm-two-col">
        <div>
          <div className="gm-section-title">
            <h2 style={{ fontSize: 15 }}>Pipeline comercial</h2>
            <span className="gm-eyebrow">{fmtBRL(valorTotalNegociacao)} em negociação</span>
          </div>
          <div className="gm-card gm-funnel">
            {funnel.map((f) => (
              <div className="gm-funnel-row" key={f.key}>
                <div className="gm-funnel-label">{f.label}</div>
                <div className="gm-funnel-track">
                  <div className="gm-funnel-fill" style={{ width: `${(f.count / maxCount) * 100}%` }} />
                </div>
                <div className="gm-funnel-count">{f.count}</div>
              </div>
            ))}
          </div>

          <div className="gm-section-title">
            <h2 style={{ fontSize: 15 }}>Follow-ups pendentes</h2>
            <span className="gm-eyebrow" style={{ cursor: "pointer" }} onClick={() => goTo("followups")}>ver todos</span>
          </div>
          <div className="gm-card" style={{ padding: 6 }}>
            {pendentes.length === 0 && (
              <div style={{ padding: 14, fontSize: 12.5, color: "var(--text-faint)" }}>Nenhum follow-up pendente.</div>
            )}
            {pendentes.slice(0, 3).map((f) => (
              <div
                key={f.id}
                className="gm-list-card"
                onClick={() => f.leadId && onOpenLead(f.leadId)}
                style={{ cursor: f.leadId ? "pointer" : "default" }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div className="gm-info-icon"><Clock size={15} /></div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{f.empresa}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Follow-up: {f.dataHoraFmt}</div>
                  </div>
                </div>
                {f.leadStatus ? stageBadge(f.leadStatus) : <span className="gm-badge gm-badge-gray">Cliente</span>}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="gm-section-title">
            <h2 style={{ fontSize: 15 }}>Atividade recente</h2>
          </div>
          <div className="gm-card gm-activity">
            {recentActivity.map((a, i) => (
              <div className="gm-activity-item" key={i}>
                <div className="gm-activity-dot" />
                <div>
                  <div className="gm-activity-text"><span className="gm-activity-company">{a.empresa}</span> {a.texto}</div>
                  <div className="gm-activity-time">{a.tempo}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, delta, warn }) {
  return (
    <div className="gm-card gm-stat-card">
      <div className="gm-stat-top">
        <div className="gm-stat-icon">{icon}</div>
        {delta && (
          <span className={`gm-stat-delta ${warn ? "" : "up"}`} style={{ color: warn ? "var(--warning)" : undefined }}>
            {warn ? <AlertTriangle size={12} /> : <ArrowUpRight size={12} />} {delta}
          </span>
        )}
      </div>
      <div className="gm-stat-value">{value}</div>
      <div className="gm-stat-label">{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LEADS (KANBAN)                                                      */
/* ------------------------------------------------------------------ */

function LeadsBoard({ leads, onOpenLead }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 22 }}>Leads</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 4, fontSize: 13.5 }}>{leads.length} leads no funil comercial</p>
        </div>
        <button className="gm-btn gm-btn-primary"><Plus size={15} /> Novo lead</button>
      </div>

      <div className="gm-kanban">
        {STAGES.map((stage) => {
          const items = leads.filter((l) => l.status === stage.key);
          return (
            <div className="gm-kanban-col" key={stage.key}>
              <div className="gm-kanban-col-head">
                <span className="gm-kanban-col-title">{stage.label}</span>
                <span className="gm-kanban-col-count">{items.length}</span>
              </div>
              <div className="gm-kanban-cards">
                {items.map((l) => (
                  <div className="gm-lead-card" key={l.id} onClick={() => onOpenLead(l.id)}>
                    <div className="gm-lead-card-empresa">{l.empresa}</div>
                    <div className="gm-lead-card-contato">{l.contato} · {l.cidade}</div>
                    <div className="gm-lead-card-meta">
                      <span className="gm-badge gm-badge-gray">{l.segmento}</span>
                      <span className="gm-lead-card-valor">{fmtBRL(l.valor)}</span>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div style={{ fontSize: 12, color: "var(--text-faint)", padding: "10px 4px" }}>Nenhum lead nesta etapa.</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LEAD DETAIL                                                         */
/* ------------------------------------------------------------------ */

function LeadDetail({ lead, timeline, timelineLoading, proximoFollowUp, servicosCatalog, onBack, onConverted }) {
  const [modalOpen, setModalOpen] = useState(false);

  if (!lead) return null;

  const jaConvertido = Boolean(lead.convertidoEmClienteId);
  const podeConverter = lead.status === "fechado";

  return (
    <div>
      <button className="gm-back-btn" onClick={onBack}><ArrowLeft size={15} /> Voltar para leads</button>

      <div className="gm-detail-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 21 }}>{lead.empresa}</h1>
            {stageBadge(lead.status)}
            {jaConvertido && <span className="gm-badge gm-badge-success"><CheckCircle2 size={11} /> Cliente criado</span>}
          </div>
          <p style={{ color: "var(--text-muted)", marginTop: 4, fontSize: 13.5 }}>{lead.contato} · {lead.segmento} · {lead.cidade}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="gm-btn gm-btn-ghost"><MessageCircle size={14} /> WhatsApp</button>
          {podeConverter && !jaConvertido && (
            <button className="gm-btn gm-btn-primary" onClick={() => setModalOpen(true)}>
              <Building2 size={14} /> Converter em cliente
            </button>
          )}
          {!podeConverter && <button className="gm-btn gm-btn-primary"><FileText size={14} /> Gerar proposta</button>}
        </div>
      </div>

      <div className="gm-two-col" style={{ marginTop: 22 }}>
        <div>
          <div className="gm-card" style={{ padding: 22 }}>
            <p className="gm-eyebrow" style={{ marginBottom: 4 }}>Informações do lead</p>
            <div className="gm-info-grid">
              <InfoItem icon={<Phone size={15} />} label="WhatsApp" value={lead.whatsapp} />
              <InfoItem icon={<AtSign size={15} />} label="Instagram" value={lead.instagram} />
              <InfoItem icon={<MapPin size={15} />} label="Cidade" value={lead.cidade} />
              <InfoItem icon={<Briefcase size={15} />} label="Segmento" value={lead.segmento} />
              <InfoItem icon={<Tag size={15} />} label="Origem do lead" value={lead.origem} />
              <InfoItem icon={<Users size={15} />} label="Responsável" value={lead.responsavel} />
              <InfoItem icon={<DollarSign size={15} />} label="Valor estimado" value={fmtBRL(lead.valor)} />
              <InfoItem icon={<Calendar size={15} />} label="Próximo follow-up" value={proximoFollowUp} />
              <InfoItem icon={<Calendar size={15} />} label="Último contato" value={lead.ultimoContato} />
              <InfoItem icon={<Sparkles size={15} />} label="Serviços de interesse" value={lead.servicos.join(", ") || "—"} />
            </div>
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <p className="gm-info-label">Observações</p>
              <p style={{ fontSize: 13, color: "var(--text)", marginTop: 4, lineHeight: 1.5 }}>{lead.obs || "—"}</p>
            </div>
          </div>
        </div>

        <div>
          <p className="gm-eyebrow" style={{ marginBottom: 8 }}>Linha do tempo de interações</p>
          <div className="gm-card gm-timeline">
            {timelineLoading && <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Carregando linha do tempo…</div>}
            {!timelineLoading && timeline.length === 0 && (
              <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Nenhum evento registrado ainda.</div>
            )}
            {!timelineLoading && timeline.map((t, i) => (
              <div className="gm-timeline-item" key={i}>
                {i !== timeline.length - 1 && <div className="gm-timeline-line" />}
                <div className="gm-timeline-dot" />
                <div>
                  <div className="gm-timeline-title">{t.tipo}</div>
                  <div className="gm-timeline-desc">{t.desc}</div>
                  <div className="gm-timeline-date">{t.data}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {modalOpen && (
        <ConverterEmClienteModal
          lead={lead}
          servicosCatalog={servicosCatalog}
          onClose={() => setModalOpen(false)}
          onConverted={(clienteId) => {
            setModalOpen(false);
            onConverted(clienteId);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MODAL — Converter lead em cliente (revisão e confirmação)           */
/* ------------------------------------------------------------------ */

function ConverterEmClienteModal({ lead, servicosCatalog, onClose, onConverted }) {
  const [form, setForm] = useState({
    nome: lead.empresa,
    contatoPrincipal: lead.contato,
    valorMensal: lead.valor || "",
    dataInicio: new Date().toISOString().slice(0, 10),
    observacoes: lead.obs || "",
    servicoIds: servicosCatalog.filter((s) => lead.servicos.includes(s.nome)).map((s) => s.id),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const toggleServico = (id) => {
    setForm((f) => ({
      ...f,
      servicoIds: f.servicoIds.includes(id) ? f.servicoIds.filter((s) => s !== id) : [...f.servicoIds, id],
    }));
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const clienteId = await converterLeadEmCliente({
        leadId: lead.id,
        nome: form.nome,
        contatoPrincipal: form.contatoPrincipal,
        valorMensal: form.valorMensal,
        dataInicio: form.dataInicio,
        observacoes: form.observacoes,
        servicoIds: form.servicoIds,
      });
      onConverted(clienteId);
    } catch (err) {
      setError(err.message || "Não foi possível converter o lead. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(10,23,48,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20,
    }}>
      <div className="gm-card" style={{ width: 520, maxWidth: "100%", maxHeight: "88vh", overflowY: "auto", padding: 26 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <p className="gm-eyebrow">Converter lead em cliente</p>
            <h2 style={{ fontSize: 18, marginTop: 4 }}>Revise os dados antes de confirmar</h2>
          </div>
          <button className="gm-icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 6, marginBottom: 18 }}>
          O lead <strong>{lead.empresa}</strong> permanece preservado no funil para histórico e métricas — esta ação só cria o registro de cliente.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div className="gm-info-label" style={{ marginBottom: 4 }}>Nome da empresa</div>
            <input className="gm-input" value={form.nome} onChange={set("nome")} />
          </div>
          <div>
            <div className="gm-info-label" style={{ marginBottom: 4 }}>Nome do contato</div>
            <input className="gm-input" value={form.contatoPrincipal} onChange={set("contatoPrincipal")} />
          </div>

          <div>
            <div className="gm-info-label" style={{ marginBottom: 6 }}>Serviços contratados</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {servicosCatalog.map((s) => {
                const active = form.servicoIds.includes(s.id);
                return (
                  <span
                    key={s.id}
                    onClick={() => toggleServico(s.id)}
                    className={`gm-badge ${active ? "gm-badge-blue" : "gm-badge-gray"}`}
                    style={{ cursor: "pointer", userSelect: "none" }}
                  >
                    {active && <CheckCircle2 size={11} />} {s.nome}
                  </span>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div className="gm-info-label" style={{ marginBottom: 4 }}>Valor mensal (R$)</div>
              <input className="gm-input" type="number" min="0" step="100" value={form.valorMensal} onChange={set("valorMensal")} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="gm-info-label" style={{ marginBottom: 4 }}>Data de início</div>
              <input className="gm-input" type="date" value={form.dataInicio} onChange={set("dataInicio")} />
            </div>
          </div>

          <div>
            <div className="gm-info-label" style={{ marginBottom: 4 }}>Observações</div>
            <textarea
              className="gm-input"
              rows={3}
              value={form.observacoes}
              onChange={set("observacoes")}
              style={{ resize: "vertical", fontFamily: "inherit" }}
            />
          </div>

          {error && (
            <div style={{ fontSize: 12.5, color: "var(--danger)", background: "var(--danger-tint)", padding: "8px 10px", borderRadius: 8 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
            <button className="gm-btn gm-btn-ghost" onClick={onClose} disabled={submitting}>Cancelar</button>
            <button className="gm-btn gm-btn-primary" onClick={handleConfirm} disabled={submitting}>
              {submitting ? <Loader2 size={14} className="gm-spin" /> : <CheckCircle2 size={14} />}
              {submitting ? "Convertendo..." : "Confirmar conversão"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ icon, label, value }) {
  return (
    <div className="gm-info-item">
      <div className="gm-info-icon">{icon}</div>
      <div>
        <div className="gm-info-label">{label}</div>
        <div className="gm-info-value">{value}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FOLLOW-UPS                                                          */
/* ------------------------------------------------------------------ */

function FollowUps({ followUps, onOpenLead, onConcluir }) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const pendentes = followUps.filter((f) => f.status === "pendente" && f.dataHora);
  const atrasados = pendentes.filter((f) => f.dataHora < startOfToday);
  const hoje = pendentes.filter((f) => f.dataHora >= startOfToday && f.dataHora < endOfToday);
  const proximos = pendentes.filter((f) => f.dataHora >= endOfToday);

  const [concluindo, setConcluindo] = useState(null);

  const handleConcluir = async (id) => {
    setConcluindo(id);
    try {
      await onConcluir(id);
    } finally {
      setConcluindo(null);
    }
  };

  const Column = ({ title, icon, items, tone }) => (
    <div>
      <div className="gm-fu-col-head">
        <span className={`gm-badge ${tone}`}>{icon} {title}</span>
        <span className="gm-eyebrow" style={{ marginLeft: "auto" }}>{items.length}</span>
      </div>
      {items.length === 0 && <p style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Nada por aqui.</p>}
      {items.map((f) => (
        <div className="gm-card gm-fu-item" key={f.id}>
          <div className="gm-fu-item-top">
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{f.empresa}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{f.contato}</div>
            </div>
            {f.leadStatus ? stageBadge(f.leadStatus) : <span className="gm-badge gm-badge-gray">Cliente</span>}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Follow-up: {f.dataHoraFmt}</div>
          <div className="gm-fu-actions">
            <button className="gm-fu-action primary" disabled={concluindo === f.id} onClick={() => handleConcluir(f.id)}>
              <CheckCircle2 size={12} /> {concluindo === f.id ? "Salvando..." : "Concluído"}
            </button>
            {f.leadId && <button className="gm-fu-action" onClick={() => onOpenLead(f.leadId)}>Abrir lead</button>}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <h1 style={{ fontSize: 22 }}>Follow-ups</h1>
      <p style={{ color: "var(--text-muted)", marginTop: 4, fontSize: 13.5 }}>Sua central de tarefas comerciais do dia.</p>
      <div className="gm-fu-cols">
        <Column title="Atrasados" icon={<AlertTriangle size={12} />} items={atrasados} tone="gm-badge-danger" />
        <Column title="Hoje" icon={<Clock size={12} />} items={hoje} tone="gm-badge-warning" />
        <Column title="Próximos dias" icon={<Calendar size={12} />} items={proximos} tone="gm-badge-blue" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PROPOSTAS                                                           */
/* ------------------------------------------------------------------ */

function Propostas({ propostas }) {
  const groups = ["Rascunho", "Enviada", "Negociação", "Aprovada", "Perdida"];
  const toneFor = (s) => ({
    Rascunho: "gm-badge-gray", Enviada: "gm-badge-blue", Negociação: "gm-badge-warning",
    Aprovada: "gm-badge-success", Perdida: "gm-badge-danger",
  }[s]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 22 }}>Propostas</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 4, fontSize: 13.5 }}>Acompanhe cada proposta comercial em andamento.</p>
        </div>
        <button className="gm-btn gm-btn-primary"><Plus size={15} /> Nova proposta</button>
      </div>

      {groups.map((g) => {
        const items = propostas.filter((p) => p.status === g);
        if (items.length === 0) return null;
        return (
          <div key={g} style={{ marginTop: 24 }}>
            <div className="gm-eyebrow" style={{ marginBottom: 8 }}>{g} · {items.length}</div>
            <div className="gm-card" style={{ padding: 6 }}>
              {items.map((p) => (
                <div className="gm-list-card" key={p.id}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div className="gm-info-icon"><FileText size={16} /></div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{p.empresa}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Enviada em {p.data}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>{fmtBRL(p.valor)}</span>
                    <span className={`gm-badge ${toneFor(p.status)}`}>{p.status}</span>
                    <MoreHorizontal size={16} color="var(--text-faint)" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CLIENTES                                                            */
/* ------------------------------------------------------------------ */

function Clientes({ clientes }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 22 }}>Clientes</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 4, fontSize: 13.5 }}>{clientes.length} clientes na base da GM Group</p>
        </div>
        <button className="gm-btn gm-btn-primary"><Plus size={15} /> Novo cliente</button>
      </div>

      <div className="gm-card" style={{ marginTop: 18, overflowX: "auto" }}>
        <table className="gm-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Serviços</th>
              <th>Valor mensal</th>
              <th>Status</th>
              <th>Início</th>
              <th>Renovação</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar name={c.nome} />
                    <div>
                      <div style={{ fontWeight: 700 }}>{c.nome}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.contato}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {c.servicos.map((s) => <span key={s} className="gm-badge gm-badge-gray">{s}</span>)}
                  </div>
                </td>
                <td style={{ fontWeight: 700 }}>{fmtBRL(c.valorMensal)}</td>
                <td>
                  <span className={`gm-badge ${
                    c.status === "Ativo" ? "gm-badge-success" :
                    c.status === "Em risco" ? "gm-badge-warning" : "gm-badge-danger"
                  }`}>{c.status}</span>
                </td>
                <td style={{ color: "var(--text-muted)" }}>{c.inicio}</td>
                <td style={{ color: "var(--text-muted)" }}>{c.renovacao}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CONFIGURAÇÕES                                                       */
/* ------------------------------------------------------------------ */

function Configuracoes() {
  const [toggles, setToggles] = useState({ notif: true, resumo: true, whatsapp: false });
  const toggle = (k) => setToggles((t) => ({ ...t, [k]: !t[k] }));

  return (
    <div>
      <h1 style={{ fontSize: 22 }}>Configurações</h1>
      <p style={{ color: "var(--text-muted)", marginTop: 4, fontSize: 13.5, marginBottom: 20 }}>Preferências gerais do CRM da GM Group.</p>

      <div className="gm-card gm-config-section">
        <p className="gm-eyebrow" style={{ marginBottom: 6 }}>Perfil</p>
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
          <div className="gm-avatar" style={{ width: 48, height: 48, fontSize: 16 }}>G</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Gustavo</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Responsável comercial · GM Group</div>
          </div>
        </div>
        <div className="gm-info-grid">
          <div>
            <div className="gm-info-label">Nome</div>
            <input className="gm-input" defaultValue="Gustavo" style={{ marginTop: 4 }} />
          </div>
          <div>
            <div className="gm-info-label">E-mail</div>
            <input className="gm-input" defaultValue="gustavo@gmgroup.com.br" style={{ marginTop: 4 }} />
          </div>
        </div>
      </div>

      <div className="gm-card gm-config-section">
        <p className="gm-eyebrow" style={{ marginBottom: 6 }}>Notificações</p>
        <div className="gm-config-row">
          <div>
            <div className="gm-config-label">Notificações de follow-up</div>
            <div className="gm-config-desc">Avisar quando um follow-up estiver atrasado ou for hoje.</div>
          </div>
          <div className={`gm-toggle ${toggles.notif ? "on" : ""}`} onClick={() => toggle("notif")}><div className="gm-toggle-dot" /></div>
        </div>
        <div className="gm-config-row">
          <div>
            <div className="gm-config-label">Resumo diário</div>
            <div className="gm-config-desc">Receber um resumo comercial todas as manhãs.</div>
          </div>
          <div className={`gm-toggle ${toggles.resumo ? "on" : ""}`} onClick={() => toggle("resumo")}><div className="gm-toggle-dot" /></div>
        </div>
        <div className="gm-config-row">
          <div>
            <div className="gm-config-label">Integração com WhatsApp</div>
            <div className="gm-config-desc">Registrar mensagens automaticamente na linha do tempo do lead.</div>
          </div>
          <div className={`gm-toggle ${toggles.whatsapp ? "on" : ""}`} onClick={() => toggle("whatsapp")}><div className="gm-toggle-dot" /></div>
        </div>
      </div>

      <div className="gm-card gm-config-section">
        <p className="gm-eyebrow" style={{ marginBottom: 6 }}>Pipeline</p>
        <div className="gm-config-row">
          <div>
            <div className="gm-config-label">Etapas do funil de leads</div>
            <div className="gm-config-desc">{STAGES.length} etapas configuradas, de "Novo lead" até "Fechado".</div>
          </div>
          <button className="gm-btn gm-btn-ghost">Editar etapas</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  APP SHELL                                                           */
/* ------------------------------------------------------------------ */

export default function App() {
  const { user, loading: authLoading, signOut } = useAuth();

  const [view, setView] = useState("dashboard");
  const [selectedLeadId, setSelectedLeadId] = useState(null);

  const [leads, setLeads] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [propostas, setPropostas] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [servicosCatalog, setServicosCatalog] = useState([]);
  const [perfil, setPerfil] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [timeline, setTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const loadAll = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [leadsData, clientesData, propostasData, followUpsData, atividade, servicos] = await Promise.all([
        fetchLeads(), fetchClientes(), fetchPropostas(), fetchFollowUps(), fetchAtividadeRecente(4), fetchServicos(),
      ]);
      setLeads(leadsData);
      setClientes(clientesData);
      setPropostas(propostasData);
      setFollowUps(followUpsData);
      setRecentActivity(atividade);
      setServicosCatalog(servicos);
    } catch (err) {
      setError(err.message || "Não foi possível carregar os dados do Supabase.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Só busca dados do CRM depois que existir uma sessão autenticada — antes
  // disso o RLS bloquearia tudo mesmo, então nem tenta.
  useEffect(() => {
    if (user) loadAll();
  }, [user, loadAll]);

  useEffect(() => {
    if (!user?.email) { setPerfil(null); return; }
    fetchPerfilPorEmail(user.email)
      .then(setPerfil)
      .catch(() => setPerfil(null));
  }, [user]);

  const selectedLead = useMemo(() => leads.find((l) => l.id === selectedLeadId), [leads, selectedLeadId]);

  const proximoFollowUpDoLead = useMemo(() => {
    if (!selectedLeadId) return "—";
    const pendentes = followUps
      .filter((f) => f.leadId === selectedLeadId && f.status === "pendente")
      .sort((a, b) => (a.dataHora?.getTime() ?? 0) - (b.dataHora?.getTime() ?? 0));
    return pendentes[0]?.dataHoraFmt ?? "—";
  }, [followUps, selectedLeadId]);

  useEffect(() => {
    if (view !== "leadDetail" || !selectedLeadId) return;
    let cancelled = false;
    setTimelineLoading(true);
    fetchTimelineByLead(selectedLeadId)
      .then((data) => { if (!cancelled) setTimeline(data); })
      .catch(() => { if (!cancelled) setTimeline([]); })
      .finally(() => { if (!cancelled) setTimelineLoading(false); });
    return () => { cancelled = true; };
  }, [view, selectedLeadId]);

  const openLead = (id) => { setSelectedLeadId(id); setView("leadDetail"); };
  const goTo = (v) => { setView(v); setSelectedLeadId(null); };

  const handleConcluirFollowUp = async (id) => {
    await concluirFollowUp(id);
    const followUpsData = await fetchFollowUps();
    setFollowUps(followUpsData);
  };

  const handleLeadConverted = async () => {
    // recarrega leads e clientes para refletir o novo cliente e o lead marcado como convertido
    const [leadsData, clientesData] = await Promise.all([fetchLeads(), fetchClientes()]);
    setLeads(leadsData);
    setClientes(clientesData);
  };

  const activeNavKey = view === "leadDetail" ? "leads" : view;

  if (authLoading) {
    return (
      <div className="gm-crm" style={{ alignItems: "center", justifyContent: "center" }}>
        <style>{CSS}</style>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: "var(--text-muted)" }}>
          <Loader2 size={22} className="gm-spin" />
          <span style={{ fontSize: 13 }}>Verificando sessão...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (loading) {
    return (
      <div className="gm-crm" style={{ alignItems: "center", justifyContent: "center" }}>
        <style>{CSS}</style>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: "var(--text-muted)" }}>
          <Loader2 size={22} className="gm-spin" />
          <span style={{ fontSize: 13 }}>Carregando dados do CRM...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="gm-crm" style={{ alignItems: "center", justifyContent: "center" }}>
        <style>{CSS}</style>
        <div className="gm-card" style={{ padding: 24, maxWidth: 420, textAlign: "center" }}>
          <AlertTriangle size={20} color="var(--danger)" />
          <h2 style={{ fontSize: 16, marginTop: 10 }}>Não foi possível conectar ao Supabase</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>{error}</p>
          <button className="gm-btn gm-btn-primary" style={{ marginTop: 14 }} onClick={loadAll}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="gm-crm">
      <style>{CSS}</style>

      <aside className="gm-sidebar">
        <div className="gm-brand">
          <BrandMark />
          <div>
            <div className="gm-brand-name">GM Group</div>
            <div className="gm-brand-sub">CRM Comercial</div>
          </div>
        </div>
        <nav className="gm-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={`gm-nav-item ${activeNavKey === item.key ? "active" : ""}`}
              onClick={() => goTo(item.key)}
            >
              <item.icon size={16} /> {item.label}
            </button>
          ))}
        </nav>
        <div className="gm-sidebar-footer">
          <Avatar name={perfil?.nome || user.email} />
          <div style={{ overflow: "hidden" }}>
            <div className="gm-user-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {perfil?.nome || user.email}
            </div>
            <div className="gm-user-role">{perfil?.papel || "Comercial"}</div>
          </div>
          <button
            className="gm-icon-btn"
            style={{ marginLeft: "auto", background: "transparent", borderColor: "rgba(255,255,255,0.15)", color: "rgba(234,240,255,0.7)" }}
            onClick={signOut}
            title="Sair"
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      <div className="gm-main">
        <header className="gm-topbar">
          <div className="gm-search"><Search size={14} /> Buscar leads, clientes...</div>
          <div className="gm-topbar-actions">
            <div className="gm-icon-btn"><Bell size={16} /><span className="gm-dot" /></div>
          </div>
        </header>

        <div className="gm-content">
          {view === "dashboard" && (
            <Dashboard leads={leads} clientes={clientes} followUps={followUps} recentActivity={recentActivity} onOpenLead={openLead} goTo={goTo} />
          )}
          {view === "leads" && <LeadsBoard leads={leads} onOpenLead={openLead} />}
          {view === "leadDetail" && (
            <LeadDetail
              lead={selectedLead}
              timeline={timeline}
              timelineLoading={timelineLoading}
              proximoFollowUp={proximoFollowUpDoLead}
              servicosCatalog={servicosCatalog}
              onBack={() => goTo("leads")}
              onConverted={handleLeadConverted}
            />
          )}
          {view === "followups" && <FollowUps followUps={followUps} onOpenLead={openLead} onConcluir={handleConcluirFollowUp} />}
          {view === "propostas" && <Propostas propostas={propostas} />}
          {view === "clientes" && <Clientes clientes={clientes} />}
          {view === "config" && <Configuracoes />}
        </div>
      </div>

      <nav className="gm-bottom-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            className={`gm-bottom-nav-item ${activeNavKey === item.key ? "active" : ""}`}
            onClick={() => goTo(item.key)}
          >
            <item.icon size={18} /> {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
