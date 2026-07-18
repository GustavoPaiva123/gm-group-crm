import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'autoUpdate' baixa a versão nova do service worker em segundo plano
      // e assume no próximo carregamento — sem prompts manuais de "atualizar".
      registerType: 'autoUpdate',

      // Arquivos estáticos de public/ que devem ser pré-cacheados junto do
      // app shell (o manifest.json e os ícones principais já entram
      // automaticamente; isso cobre os que faltam).
      includeAssets: ['favicon-32.png', 'favicon-64.png', 'apple-touch-icon.png'],

      manifest: {
        id: '/',
        name: 'GM Group CRM',
        short_name: 'GM CRM',
        description: 'CRM comercial interno do GM Group.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // Cor da barra de status/chrome do navegador — o marinho da identidade do GM Group.
        theme_color: '#0D2049',
        // Cor de fundo mostrada na splash screen antes do app carregar.
        background_color: '#F5F7FB',
        categories: ['business', 'productivity'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },

      workbox: {
        // Sem isso, um deploy novo fica "esperando" todas as abas do app
        // fecharem antes de assumir — na prática, parece que o app não
        // atualizou mesmo depois de publicado. Com isso, a versão nova
        // assume assim que a página é recarregada.
        skipWaiting: true,
        clientsClaim: true,

        // Pré-cacheia só o app shell (HTML/JS/CSS/ícones). As chamadas ao
        // Supabase (outra origem) NÃO são cacheadas — o CRM precisa sempre
        // de dados atuais, nunca de uma versão antiga guardada offline.
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        navigateFallback: '/index.html',
      },

      devOptions: {
        // Facilita testar o comportamento de PWA em npm run dev, se necessário.
        enabled: false,
      },
    }),
  ],
})
