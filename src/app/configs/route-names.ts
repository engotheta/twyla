import type { Phrases } from '@services/i18n/i18n.interface';

/**
 * The app's own names in its other languages. Routes, menus and the layout config are written
 * in English, where they are used (`title: 'Sign in'`, `data: { name: 'Data grid' }`); the
 * layout looks each one up here before showing it (`LayoutConfig.translate`, wired in
 * `app.config.ts`). A name with no entry is shown as written.
 *
 * `app.messages.spec.ts` checks that every route and menu name has an entry for each language.
 */
export const ROUTE_NAMES: Phrases = {
  sw: {
    // ── app.routes.ts ──
    Welcome: 'Karibu',
    Modules: 'Moduli',
    Components: 'Vijenzi',
    'The studio demos: grids, forms, viewers and more.':
      'Maonyesho ya studio: majedwali, fomu, vitazamaji na zaidi.',
    Layout: 'Mpangilio',
    'Page headers and menus nested to any depth.': 'Vichwa vya kurasa na menyu zenye ngazi nyingi.',
    Administration: 'Utawala',
    'Users, roles and settings — admins only.':
      'Watumiaji, majukumu na mipangilio — kwa wasimamizi tu.',
    Account: 'Akaunti',
    'Page not found': 'Ukurasa haujapatikana',

    // ── auth ──
    'Sign in': 'Ingia',
    'Create an account': 'Fungua akaunti',
    'Forgot password': 'Umesahau nenosiri',
    'Reset password': 'Weka nenosiri jipya',

    // ── account ──
    Profile: 'Wasifu',
    'Password & security': 'Nenosiri na usalama',
    Preferences: 'Mapendeleo',

    // ── admin ──
    Users: 'Watumiaji',
    'User details': 'Taarifa za mtumiaji',
    'Roles & permissions': 'Majukumu na ruhusa',
    Settings: 'Mipangilio',
    General: 'Jumla',
    Notifications: 'Arifa',
    'Audit log': 'Kumbukumbu za ukaguzi',
    Beta: 'Beta',

    // ── the components demos ──
    Data: 'Data',
    'Data grid': 'Jedwali la data',
    'Server-side grid': 'Jedwali la seva',
    Details: 'Maelezo',
    'Forms & actions': 'Fomu na vitendo',
    'Generic form': 'Fomu ya jumla',
    'Action buttons': 'Vitufe vya vitendo',
    'Contents view': 'Mwonekano wa maudhui',
    'File viewer': 'Kitazamaji cha faili',
    'Fetch & toasts': 'Maombi na arifa',

    // ── the layout demos ──
    'Page header': 'Kichwa cha ukurasa',
    'Menu levels': 'Ngazi za menyu',
    'Level one': 'Ngazi ya kwanza',
    'A page one level down': 'Ukurasa ulio ngazi moja chini',
    'Level two': 'Ngazi ya pili',
    'Level two overview': 'Muhtasari wa ngazi ya pili',
    'Level three': 'Ngazi ya tatu',
    'Level four': 'Ngazi ya nne',
    'Another level four': 'Ngazi nyingine ya nne',
    'Angular docs': 'Nyaraka za Angular',
    New: 'Mpya',

    // ── the layout config (app.config.ts) ──
    Home: 'Mwanzo',
    Angular: 'Angular',
    'An Angular starter built from reusable parts.':
      'Kianzio cha Angular kilichojengwa kwa vijenzi vinavyotumika tena.',
  },
};
