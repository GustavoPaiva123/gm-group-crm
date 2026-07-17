# GM Group — CRM

CRM comercial interno do GM Group. Aplicação Vite + React, independente do Claude.

## Rodando localmente

Pré-requisito: Node.js 18+ instalado.

```bash
npm install
npm run dev
```

Acesse http://localhost:5173 no navegador.

## Build de produção

```bash
npm run build
npm run preview   # para testar o build localmente antes de publicar
```

O resultado do build fica na pasta `dist/`.

## Estrutura do projeto

```
gm-group-crm/
├── index.html          # ponto de entrada HTML
├── package.json         # dependências e scripts
├── vite.config.js       # configuração do Vite
├── public/              # arquivos estáticos (ícones, favicon — serão adicionados na etapa de PWA)
└── src/
    ├── main.jsx          # bootstrap do React
    ├── index.css         # reset mínimo (o visual do CRM vive dentro de App.jsx)
    └── App.jsx            # aplicação completa do CRM (dashboard, leads, follow-ups, propostas, clientes, configurações)
```

## Configuração do Supabase

Este projeto usa Supabase como backend. As credenciais ficam em `.env.local`
(já preenchido neste pacote com as credenciais do projeto do GM Group —
**nunca commitar esse arquivo**; `.env.example` mostra o formato esperado).

O schema do banco (tabelas, relações, função de conversão de lead em
cliente) está documentado em `supabase/schema.sql`.

## Autenticação

Login por e-mail/senha via Supabase Auth (`src/lib/AuthContext.jsx`). Não há
cadastro público — contas são criadas manualmente no painel do Supabase
(Authentication → Users). Sem sessão válida, o app mostra a tela de login;
o banco também rejeita qualquer leitura/escrita sem autenticação (RLS).

## PWA (instalável)

O app é uma PWA completa: `manifest.webmanifest` + service worker (gerados
automaticamente no build pelo `vite-plugin-pwa`), ícones em `public/`
(gerados a partir da identidade visual do GM Group) e meta tags de iOS em
`index.html`. Funciona em `npm run build && npm run preview` — no `npm run
dev` o service worker fica desativado de propósito (evita cache
atrapalhando o desenvolvimento).

## Status atual

- [x] Etapa 1 — Estrutura real do projeto (Vite + React)
- [x] Etapa 2 — Banco de dados (Supabase) — schema, relações e dados de demonstração criados
- [x] Etapa 3 — Frontend conectado aos dados reais, incluindo o fluxo "Converter em cliente" com modal de revisão
- [x] Etapa 4 — Autenticação (Supabase Auth) e RLS habilitado em todas as tabelas
- [x] Etapa 5 — PWA instalável (manifest, ícones, service worker, meta tags iOS)
- [ ] Etapa 6 — Publicação (Cloudflare Pages) e domínio próprio
