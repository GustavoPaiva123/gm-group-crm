import { supabase } from "./supabaseClient";

/* ------------------------------------------------------------------ */
/*  Helpers de formatação                                              */
/* ------------------------------------------------------------------ */

export function fmtData(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

export function fmtCidade(cidade, estado) {
  if (!cidade) return "—";
  return estado ? `${cidade}, ${estado}` : cidade;
}

const CLIENTE_STATUS_LABEL = {
  ativo: "Ativo",
  em_risco: "Em risco",
  inativo: "Inativo",
  cancelado: "Cancelado",
};

const PROPOSTA_STATUS_LABEL = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  negociacao: "Negociação",
  aprovada: "Aprovada",
  perdida: "Perdida",
};

/* ------------------------------------------------------------------ */
/*  LEADS                                                               */
/* ------------------------------------------------------------------ */

export async function fetchLeads() {
  const { data, error } = await supabase
    .from("leads")
    .select("*, usuarios(nome), lead_servicos(servicos(nome))")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    empresa: row.empresa,
    contato: row.contato,
    whatsapp: row.whatsapp,
    instagram: row.instagram,
    email: row.email,
    cidade: fmtCidade(row.cidade, row.estado),
    segmento: row.segmento,
    origem: row.origem,
    status: row.status,
    responsavel: row.usuarios?.nome ?? "—",
    responsavelId: row.responsavel_id,
    valor: Number(row.valor_estimado ?? 0),
    servicos: (row.lead_servicos ?? []).map((s) => s.servicos?.nome).filter(Boolean),
    ultimoContato: fmtData(row.ultimo_contato_em),
    obs: row.observacoes ?? "",
    convertidoEmClienteId: row.convertido_em_cliente_id,
    _raw: row,
  }));
}

/* ------------------------------------------------------------------ */
/*  CLIENTES                                                            */
/* ------------------------------------------------------------------ */

export async function fetchClientes() {
  const { data, error } = await supabase
    .from("clientes")
    .select("*, cliente_servicos(servicos(nome))")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    nome: row.nome,
    contato: row.contato_principal ?? "—",
    servicos: (row.cliente_servicos ?? []).map((s) => s.servicos?.nome).filter(Boolean),
    valorMensal: Number(row.valor_mensal ?? 0),
    status: CLIENTE_STATUS_LABEL[row.status] ?? row.status,
    inicio: fmtData(row.data_inicio),
    renovacao: fmtData(row.proxima_renovacao),
    leadOrigemId: row.lead_origem_id,
  }));
}

/* ------------------------------------------------------------------ */
/*  PROPOSTAS                                                           */
/* ------------------------------------------------------------------ */

export async function fetchPropostas() {
  const { data, error } = await supabase
    .from("propostas")
    .select("*, leads(empresa), clientes(nome)")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    empresa: row.leads?.empresa ?? row.clientes?.nome ?? "—",
    valor: Number(row.valor ?? 0),
    status: PROPOSTA_STATUS_LABEL[row.status] ?? row.status,
    data: fmtData(row.enviada_em ?? row.created_at),
  }));
}

/* ------------------------------------------------------------------ */
/*  FOLLOW-UPS                                                          */
/* ------------------------------------------------------------------ */

export async function fetchFollowUps() {
  const { data, error } = await supabase
    .from("follow_ups")
    .select("*, leads(id, empresa, contato, status), clientes(id, nome, contato_principal)")
    .order("data_hora", { ascending: true });

  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    titulo: row.titulo,
    dataHora: row.data_hora ? new Date(row.data_hora) : null,
    dataHoraFmt: fmtData(row.data_hora),
    status: row.status,
    empresa: row.leads?.empresa ?? row.clientes?.nome ?? "—",
    contato: row.leads?.contato ?? row.clientes?.contato_principal ?? "—",
    leadId: row.leads?.id ?? null,
    leadStatus: row.leads?.status ?? null,
    clienteId: row.clientes?.id ?? null,
  }));
}

export async function concluirFollowUp(id) {
  const { error } = await supabase.from("follow_ups").update({ status: "concluido" }).eq("id", id);
  if (error) throw error;
}

export async function reagendarFollowUp(id, novaDataHoraISO) {
  const { error } = await supabase
    .from("follow_ups")
    .update({ status: "pendente", data_hora: novaDataHoraISO })
    .eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  TIMELINE (carregada sob demanda, ao abrir um lead)                  */
/* ------------------------------------------------------------------ */

export async function fetchTimelineByLead(leadId) {
  const { data, error } = await supabase
    .from("timeline_eventos")
    .select("*")
    .eq("lead_id", leadId)
    .order("ocorrido_em", { ascending: true });

  if (error) throw error;

  return data.map((row) => ({
    tipo: row.tipo,
    desc: row.descricao ?? "",
    data: fmtData(row.ocorrido_em),
  }));
}

/* ------------------------------------------------------------------ */
/*  ATIVIDADE RECENTE (dashboard)                                       */
/* ------------------------------------------------------------------ */

export async function fetchAtividadeRecente(limit = 4) {
  const { data, error } = await supabase
    .from("timeline_eventos")
    .select("*, leads(empresa), clientes(nome)")
    .order("ocorrido_em", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return data.map((row) => ({
    empresa: row.leads?.empresa ?? row.clientes?.nome ?? "—",
    texto: row.descricao || row.tipo,
    tempo: fmtData(row.ocorrido_em),
  }));
}

/* ------------------------------------------------------------------ */
/*  CATÁLOGO DE SERVIÇOS (para o modal de conversão)                    */
/* ------------------------------------------------------------------ */

export async function fetchServicos() {
  const { data, error } = await supabase.from("servicos").select("*").order("nome");
  if (error) throw error;
  return data;
}

/* ------------------------------------------------------------------ */
/*  PERFIL DO USUÁRIO LOGADO                                            */
/* ------------------------------------------------------------------ */

export async function fetchPerfilPorEmail(email) {
  const { data, error } = await supabase
    .from("usuarios")
    .select("nome, papel")
    .eq("email", email)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/* ------------------------------------------------------------------ */
/*  CRIAR LEAD                                                          */
/* ------------------------------------------------------------------ */

export async function criarLead({
  empresa, contato, whatsapp, instagram, email, cidade, estado,
  segmento, origem, valorEstimado, observacoes, servicoIds,
}) {
  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      empresa, contato,
      whatsapp: whatsapp || null,
      instagram: instagram || null,
      email: email || null,
      cidade: cidade || null,
      estado: estado || null,
      segmento: segmento || null,
      origem: origem || null,
      valor_estimado: valorEstimado === "" || valorEstimado == null ? null : Number(valorEstimado),
      observacoes: observacoes || null,
      status: "novo",
    })
    .select()
    .single();

  if (error) throw error;

  if (servicoIds && servicoIds.length) {
    const { error: servErr } = await supabase
      .from("lead_servicos")
      .insert(servicoIds.map((servico_id) => ({ lead_id: lead.id, servico_id })));
    if (servErr) throw servErr;
  }

  await supabase.from("timeline_eventos").insert({
    lead_id: lead.id,
    tipo: "Lead criado",
    descricao: "Lead cadastrado manualmente no CRM.",
  });

  return lead.id;
}

/* ------------------------------------------------------------------ */
/*  BRIEFING DE DESCOBERTA                                              */
/* ------------------------------------------------------------------ */

export async function fetchBriefingsByLead(leadId) {
  const { data, error } = await supabase
    .from("briefings")
    .select("*, usuarios(nome)")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    contatoCargo: row.contato_cargo ?? "",
    linhaServico: row.linha_servico ?? [],
    problemaPrincipal: row.problema_principal ?? "",
    situacaoAtual: row.situacao_atual ?? "",
    objetivoEsperado: row.objetivo_esperado ?? "",
    quemVaiUsar: row.quem_vai_usar ?? "",
    integracoesCitadas: row.integracoes_citadas ?? "",
    referencias: row.referencias ?? "",
    prazoDesejado: row.prazo_desejado ?? "",
    orcamentoFaixa: row.orcamento_faixa ?? "",
    decisores: row.decisores ?? "",
    redFlags: row.red_flags ?? [],
    observacoesLivres: row.observacoes_livres ?? "",
    criadoPor: row.usuarios?.nome ?? null,
    criadoEm: fmtData(row.created_at),
  }));
}

export async function criarBriefing({ leadId, ...campos }) {
  const { data: userRes } = await supabase.auth.getUser();
  let criadoPorId = null;
  if (userRes?.user?.email) {
    const perfil = await supabase.from("usuarios").select("id").eq("email", userRes.user.email).maybeSingle();
    criadoPorId = perfil.data?.id ?? null;
  }

  const { error } = await supabase.from("briefings").insert({
    lead_id: leadId,
    contato_cargo: campos.contatoCargo || null,
    linha_servico: campos.linhaServico?.length ? campos.linhaServico : null,
    problema_principal: campos.problemaPrincipal || null,
    situacao_atual: campos.situacaoAtual || null,
    objetivo_esperado: campos.objetivoEsperado || null,
    quem_vai_usar: campos.quemVaiUsar || null,
    integracoes_citadas: campos.integracoesCitadas || null,
    referencias: campos.referencias || null,
    prazo_desejado: campos.prazoDesejado || null,
    orcamento_faixa: campos.orcamentoFaixa || null,
    decisores: campos.decisores || null,
    red_flags: campos.redFlags?.length ? campos.redFlags : null,
    observacoes_livres: campos.observacoesLivres || null,
    criado_por: criadoPorId,
  });
  if (error) throw error;

  await supabase.from("timeline_eventos").insert({
    lead_id: leadId,
    tipo: "Briefing de descoberta preenchido",
    descricao: campos.problemaPrincipal ? `Dor principal: ${campos.problemaPrincipal}` : "Briefing de descoberta registrado.",
  });
}

export async function converterLeadEmCliente({
  leadId,
  nome,
  contatoPrincipal,
  valorMensal,
  dataInicio,
  observacoes,
  servicoIds,
}) {
  const { data, error } = await supabase.rpc("converter_lead_em_cliente", {
    p_lead_id: leadId,
    p_nome: nome || null,
    p_contato_principal: contatoPrincipal || null,
    p_valor_mensal: valorMensal === "" || valorMensal == null ? null : Number(valorMensal),
    p_data_inicio: dataInicio || null,
    p_observacoes: observacoes || null,
    p_servico_ids: servicoIds && servicoIds.length ? servicoIds : null,
  });

  if (error) throw error;
  return data; // uuid do novo cliente
}
