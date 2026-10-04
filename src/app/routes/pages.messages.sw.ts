import type { PagesMessages } from './pages.messages';

export const PAGES_SW: PagesMessages = {
  home: {
    eyebrow: 'Kianzio cha Angular',
    heading: 'Jenga programu za usimamizi kwa vijenzi vinavyofanya kazi tayari',
    lead: 'Majedwali ya data, fomu zinazoendeshwa na usanidi, kitazamaji cha faili na mpangilio kamili wa programu — vinafikika kwa wote, vimejengwa kwa signals, na viko tayari kuunganishwa na API yako.',
    openModules: 'Fungua moduli',
    getStarted: 'Anza',
    signIn: 'Ingia',
    featuresHeading: 'Kilichomo ndani',
    features: {
      grid: {
        title: 'Jedwali la data',
        text: 'Safu za ndani au za seva zenye upangaji, vichujio, makundi, uhariri wa papo hapo na uhamishaji.',
      },
      forms: {
        title: 'Fomu zinazoendeshwa na usanidi',
        text: 'Sehemu, orodha, hatua na kanuni zinazohusisha sehemu kadhaa kutoka kwenye usanidi mmoja — pamoja na fomu za kuingia.',
      },
      details: {
        title: 'Maelezo',
        text: 'Rekodi za kusoma tu, zilizopangwa kwa makundi na kuumbizwa kulingana na aina, pamoja na vitendo.',
      },
      viewer: {
        title: 'Kitazamaji cha faili',
        text: 'PDF, Office, picha, maandishi na midia kutoka kwenye URL, base64, blob au mitiririko.',
      },
      contents: {
        title: 'Mwonekano wa maudhui',
        text: 'Majedwali, maelezo na fomu zilizounganishwa katika mionekano yenye vichupo inayoweza kubadilishwa ukubwa.',
      },
      layout: {
        title: 'Mpangilio na vipindi',
        text: 'Moduli, menyu zenye ngazi nyingi, vichwa vya kurasa, kuingia, kujisajili na kuweka nenosiri jipya.',
      },
    },
    ctaHeading: 'Anza ukiwa tayari',
    ctaText: 'Ingia kwa akaunti ya majaribio kisha ufungue moduli.',
  },

  modules: {
    welcome: (firstName) => (firstName ? `Karibu tena, ${firstName}` : 'Karibu tena'),
    lead: 'Chagua moduli ili kuanza.',
    empty: 'Bado huna ruhusa ya kufungua moduli yoyote.',
    gettingStarted: 'Kuanza',
    steps: {
      modules:
        '**Moduli** ni njia za `isMenu` zilizomo kwenye `app.routes.ts`: kila moja hupakia ganda lake (`*.module.ts`) na njia zake (`*.routes.ts`).',
      menus:
        "**Menyu za pembeni** hutokana na njia za kila moduli: `data: { isMenu, name, icon, permissions }` — njia ya `path: ''` yenye njia ndani yake ni kundi.",
      brand: '**Chapa, kichwa na kijachini**: `provideLayoutConfig()` kwenye `app.config.ts`.',
      signIn:
        '**Kuingia**: elekeza `provideSessionConfig({ api })` kwenye seva yako — walinzi wa njia na kipokezi cha tokeni vimeshaunganishwa.',
    },
  },

  notFound: {
    heading: 'Ukurasa haujapatikana',
    text: 'Ukurasa unaoutafuta haupo, au umehamishwa.',
    home: 'Rudi mwanzo',
    modules: 'Moduli zote',
  },

  placeholder: {
    heading: 'Bado hakuna kitu hapa',
    text: 'Ukurasa huu ni wa muda. Ipe njia yake `loadComponent` halisi ili kuujenga.',
  },
};
