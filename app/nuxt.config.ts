// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  // SSR habilitado. @nuxtjs/supabase necesita SSR para las cookies de sesión.
  ssr: true,

  modules: [
    '@nuxtjs/supabase',
    '@nuxtjs/tailwindcss',
    '@vueuse/nuxt',
    '@pinia/nuxt',
    '@nuxt/fonts',
    '@vite-pwa/nuxt',
  ],

  // PWA: la app se instala en home como "app nativa" (mobile + desktop).
  // Cache conservador: solo assets estáticos. Las rutas y datos de Supabase
  // pasan siempre por la red para no exponer data stale en una app financiera.
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'mis-finanzas',
      short_name: 'mis-finanzas',
      description: 'Gestión personal de finanzas',
      lang: 'es-AR',
      theme_color: '#1a1a1a',
      background_color: '#f5f5f0',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      scope: '/',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      // Solo cachear assets del shell (JS/CSS/fuentes/imágenes).
      // NO cacheamos rutas ni Supabase porque manejamos plata.
      globPatterns: ['**/*.{js,css,html,png,svg,woff2,ico}'],
      navigateFallback: null,
      cleanupOutdatedCaches: true,
    },
    client: {
      installPrompt: false,
    },
    devOptions: {
      enabled: false,
    },
  },

  fonts: {
    families: [
      { name: 'Inter', provider: 'google', weights: [400, 500, 600, 700], preload: true },
      { name: 'JetBrains Mono', provider: 'google', weights: [400, 500, 600] },
    ],
  },

  supabase: {
    redirect: true,
    redirectOptions: {
      login: '/login',
      callback: '/auth/callback',
      include: undefined,
      exclude: ['/login', '/signup', '/auth/*'],
      cookieRedirect: false,
    },
  },

  runtimeConfig: {
    public: {
      appName: 'mis-finanzas',
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },

  css: ['~/assets/css/main.css'],

  // Nitro: Vercel detecta automáticamente el preset. En local usa el default.
  nitro: {
    preset: process.env.VERCEL ? 'vercel' : undefined,
  },

  app: {
    head: {
      title: 'mis-finanzas',
      htmlAttrs: { lang: 'es-AR' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'Gestión de finanzas personales' },
        { name: 'theme-color', content: '#ffffff', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#111111', media: '(prefers-color-scheme: dark)' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
      // Script inline: aplica dark class ANTES del primer render para evitar flash de tema.
      script: [
        {
          innerHTML: `(function(){try{var m=localStorage.getItem('mis-finanzas-theme');var d=m==='dark'||(m==='auto'&&window.matchMedia('(prefers-color-scheme: dark)').matches)||(!m&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          type: 'text/javascript',
          tagPosition: 'head',
        },
      ],
    },
  },
})
