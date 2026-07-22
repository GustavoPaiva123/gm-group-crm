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
    .select("*, usuarios(nome), lead_servicos(servicos(nome)), pipeline_stages(id, chave, nome, cor, e_fechamento, e_perda)")
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
    stageId: row.pipeline_stages?.id,
    stage: row.pipeline_stages ? {
      id: row.pipeline_stages.id,
      chave: row.pipeline_stages.chave,
      nome: row.pipeline_stages.nome,
      cor: row.pipeline_stages.cor,
      eFechamento: row.pipeline_stages.e_fechamento,
      ePerda: row.pipeline_stages.e_perda,
    } : null,
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
    statusChave: row.status,
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
    .select("*, leads(id, empresa, contato, pipeline_stages(nome, cor)), clientes(id, nome, contato_principal)")
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
    leadStage: row.leads?.pipeline_stages ? { nome: row.leads.pipeline_stages.nome, cor: row.leads.pipeline_stages.cor } : null,
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

export async function criarFollowUp({ leadId, clienteId, titulo, dataHoraISO, observacoes }) {
  const { error } = await supabase.from("follow_ups").insert({
    lead_id: leadId || null,
    cliente_id: clienteId || null,
    titulo,
    data_hora: dataHoraISO,
    observacoes: observacoes || null,
    status: "pendente",
  });
  if (error) throw error;

  const evento = { tipo: "Follow-up agendado", descricao: titulo };
  if (leadId) await supabase.from("timeline_eventos").insert({ lead_id: leadId, ...evento });
  else if (clienteId) await supabase.from("timeline_eventos").insert({ cliente_id: clienteId, ...evento });
}

export async function excluirFollowUp(id) {
  const { error } = await supabase.from("follow_ups").delete().eq("id", id);
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

export async function criarServico(nome) {
  const { data, error } = await supabase
    .from("servicos")
    .insert({ nome: nome.trim() })
    .select()
    .single();
  if (error) {
    // já existe um serviço com esse nome — reaproveita em vez de falhar
    if (error.code === "23505") {
      const existente = await supabase.from("servicos").select("*").eq("nome", nome.trim()).single();
      if (existente.data) return existente.data;
    }
    throw error;
  }
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
  const { data: stagePadrao, error: stageErr } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("e_padrao", true)
    .limit(1)
    .maybeSingle();
  if (stageErr) throw stageErr;
  if (!stagePadrao) throw new Error("Nenhuma etapa padrão configurada no funil. Configure uma em Configurações > Pipeline.");

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
      stage_id: stagePadrao.id,
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

export async function atualizarLead(leadId, {
  empresa, contato, whatsapp, instagram, email, cidade, estado,
  segmento, origem, valorEstimado, observacoes, servicoIds,
}) {
  const { error } = await supabase
    .from("leads")
    .update({
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
    })
    .eq("id", leadId);
  if (error) throw error;

  // Ressincroniza os serviços de interesse: apaga os vínculos antigos e
  // recria com a seleção atual — mais simples e confiável que comparar diffs.
  await supabase.from("lead_servicos").delete().eq("lead_id", leadId);
  if (servicoIds && servicoIds.length) {
    const { error: servErr } = await supabase
      .from("lead_servicos")
      .insert(servicoIds.map((servico_id) => ({ lead_id: leadId, servico_id })));
    if (servErr) throw servErr;
  }

  await supabase.from("timeline_eventos").insert({
    lead_id: leadId,
    tipo: "Lead atualizado",
    descricao: "Informações do lead editadas.",
  });
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

/* ------------------------------------------------------------------ */
/*  CRIAR CLIENTE (direto, sem passar pelo funil de leads)              */
/* ------------------------------------------------------------------ */

export async function criarCliente({
  nome, contatoPrincipal, whatsapp, instagram, email, cidade, estado,
  segmento, status, valorMensal, dataInicio, proximaRenovacao, observacoes, servicoIds,
}) {
  const { data: cliente, error } = await supabase
    .from("clientes")
    .insert({
      nome,
      contato_principal: contatoPrincipal || null,
      whatsapp: whatsapp || null,
      instagram: instagram || null,
      email: email || null,
      cidade: cidade || null,
      estado: estado || null,
      segmento: segmento || null,
      status: status || "ativo",
      valor_mensal: valorMensal === "" || valorMensal == null ? null : Number(valorMensal),
      data_inicio: dataInicio || null,
      proxima_renovacao: proximaRenovacao || null,
      observacoes: observacoes || null,
    })
    .select()
    .single();

  if (error) throw error;

  if (servicoIds && servicoIds.length) {
    const { error: servErr } = await supabase
      .from("cliente_servicos")
      .insert(servicoIds.map((servico_id) => ({ cliente_id: cliente.id, servico_id })));
    if (servErr) throw servErr;
  }

  await supabase.from("timeline_eventos").insert({
    cliente_id: cliente.id,
    tipo: "Cliente cadastrado",
    descricao: "Cliente cadastrado diretamente no CRM.",
  });

  return cliente.id;
}

/* ------------------------------------------------------------------ */
/*  CRIAR PROPOSTA                                                      */
/* ------------------------------------------------------------------ */

export async function criarProposta({ leadId, clienteId, titulo, valor, status, enviadaEm, observacoes }) {
  const { error } = await supabase.from("propostas").insert({
    lead_id: leadId || null,
    cliente_id: clienteId || null,
    titulo,
    valor: Number(valor),
    status: status || "rascunho",
    enviada_em: enviadaEm || null,
    observacoes: observacoes || null,
  });
  if (error) throw error;

  const eventoBase = { tipo: "Proposta enviada", descricao: titulo };
  if (leadId) await supabase.from("timeline_eventos").insert({ lead_id: leadId, ...eventoBase });
  else if (clienteId) await supabase.from("timeline_eventos").insert({ cliente_id: clienteId, ...eventoBase });
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

/* ------------------------------------------------------------------ */
/*  ETAPAS DO PIPELINE (funil de leads, editável)                       */
/* ------------------------------------------------------------------ */

export async function fetchStages() {
  const { data, error } = await supabase.from("pipeline_stages").select("*").order("ordem");
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    chave: row.chave,
    nome: row.nome,
    ordem: row.ordem,
    cor: row.cor,
    eFechamento: row.e_fechamento,
    ePerda: row.e_perda,
    ePadrao: row.e_padrao,
  }));
}

export async function criarStage({ nome, cor }) {
  const { data: max } = await supabase.from("pipeline_stages").select("ordem").order("ordem", { ascending: false }).limit(1).maybeSingle();
  const proximaOrdem = (max?.ordem ?? 0) + 1;
  const chave = `etapa_${Date.now()}`;
  const { error } = await supabase.from("pipeline_stages").insert({
    chave, nome, ordem: proximaOrdem, cor: cor || "gray",
  });
  if (error) throw error;
}

export async function atualizarStage(id, campos) {
  const payload = {};
  if (campos.nome !== undefined) payload.nome = campos.nome;
  if (campos.cor !== undefined) payload.cor = campos.cor;
  if (campos.eFechamento !== undefined) payload.e_fechamento = campos.eFechamento;
  if (campos.ePerda !== undefined) payload.e_perda = campos.ePerda;
  if (campos.ePadrao !== undefined) payload.e_padrao = campos.ePadrao;
  const { error } = await supabase.from("pipeline_stages").update(payload).eq("id", id);
  if (error) throw error;
}

export async function moverStage(id, direcao, todasEtapas) {
  const ordenadas = [...todasEtapas].sort((a, b) => a.ordem - b.ordem);
  const idx = ordenadas.findIndex((s) => s.id === id);
  const vizinhoIdx = direcao === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || vizinhoIdx < 0 || vizinhoIdx >= ordenadas.length) return;

  const atual = ordenadas[idx];
  const vizinho = ordenadas[vizinhoIdx];

  await supabase.from("pipeline_stages").update({ ordem: vizinho.ordem }).eq("id", atual.id);
  await supabase.from("pipeline_stages").update({ ordem: atual.ordem }).eq("id", vizinho.id);
}

export async function excluirStage(id) {
  const { count, error: countErr } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("stage_id", id);
  if (countErr) throw countErr;
  if (count > 0) {
    throw new Error(`Essa etapa tem ${count} lead(s) nela. Mova os leads para outra etapa antes de excluir.`);
  }
  const { error } = await supabase.from("pipeline_stages").delete().eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  MOVER / EXCLUIR LEAD                                                */
/* ------------------------------------------------------------------ */

export async function moverLeadParaEtapa(leadId, stageId) {
  const { error } = await supabase.from("leads").update({ stage_id: stageId }).eq("id", leadId);
  if (error) throw error;
}

export async function excluirLead(leadId) {
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("convertido_em_cliente_id, empresa")
    .eq("id", leadId)
    .single();
  if (leadErr) throw leadErr;

  if (lead.convertido_em_cliente_id) {
    throw new Error(`"${lead.empresa}" já foi convertido em cliente — não é possível excluir o lead (o histórico fica preservado). Para remover, exclua o cliente correspondente.`);
  }

  // lead_servicos e briefings têm ON DELETE CASCADE; follow_ups, propostas e
  // timeline_eventos não, então precisam ser apagados explicitamente antes.
  await supabase.from("timeline_eventos").delete().eq("lead_id", leadId);
  await supabase.from("follow_ups").delete().eq("lead_id", leadId);
  await supabase.from("propostas").delete().eq("lead_id", leadId);

  const { error } = await supabase.from("leads").delete().eq("id", leadId);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  GERENCIAR PROPOSTA (mudar status / excluir)                         */
/* ------------------------------------------------------------------ */

export async function atualizarStatusProposta(id, status) {
  const { error } = await supabase.from("propostas").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function excluirProposta(id) {
  const { error } = await supabase.from("propostas").delete().eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  ADMINISTRAÇÃO DE USUÁRIOS                                           */
/*  Operações que tocam a autenticação (criar login, excluir, resetar   */
/*  senha, ativar/desativar) passam pela Edge Function `admin-users`,   */
/*  que roda no servidor do Supabase com a chave mestra — nunca exposta */
/*  no navegador. A função em si confere que quem chama é administrador.*/
/* ------------------------------------------------------------------ */

const EDGE_FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function chamarAdminUsers(payload) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Sessão expirada — faça login novamente.");

  const res = await fetch(`${EDGE_FUNCTIONS_URL}/admin-users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Erro (${res.status})`);
  return body;
}

export async function fetchUsuariosAdmin() {
  const { usuarios } = await chamarAdminUsers({ action: "list" });
  return usuarios.map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    cargo: u.cargo || "",
    papel: u.papel,
    status: u.status,
    criadoEm: fmtData(u.created_at),
    ultimoAcesso: u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleString("pt-BR") : "Nunca acessou",
  }));
}

export async function criarUsuarioAdmin({ nome, email, cargo, papel, senha }) {
  return chamarAdminUsers({ action: "create", nome, email, cargo, papel, senha });
}

export async function excluirUsuarioAdmin(id) {
  return chamarAdminUsers({ action: "delete", id });
}

export async function alternarStatusUsuarioAdmin(id, ativo) {
  return chamarAdminUsers({ action: "toggle_status", id, ativo });
}

export async function resetarSenhaUsuarioAdmin(id) {
  const { senha_temporaria } = await chamarAdminUsers({ action: "reset_password", id });
  return senha_temporaria;
}

// Edição de nome/cargo/papel é um UPDATE simples na tabela — protegido
// diretamente por RLS (só administrador consegue), sem precisar da Edge Function.
export async function atualizarUsuario(id, { nome, cargo, papel }) {
  const { error } = await supabase.from("usuarios").update({ nome, cargo, papel }).eq("id", id);
  if (error) throw error;
}
