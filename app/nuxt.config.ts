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
  ],

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
