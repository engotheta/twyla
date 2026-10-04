import type { AuthMessages } from './auth.messages';

export const AUTH_SW: AuthMessages = {
  fields: {
    username: 'Jina la mtumiaji au barua pepe',
    password: 'Nenosiri',
    remember: 'Nibaki nimeingia',
    firstName: 'Jina la kwanza',
    lastName: 'Jina la mwisho',
    email: 'Barua pepe',
    newPassword: 'Nenosiri jipya',
    confirmPassword: 'Thibitisha nenosiri',
    acceptTerms: 'Ninakubali masharti ya huduma na sera ya faragha',
  },

  errors: {
    username: 'Weka jina lako la mtumiaji au barua pepe',
    password: 'Weka nenosiri lako',
    firstName: 'Weka jina lako la kwanza',
    lastName: 'Weka jina lako la mwisho',
    email: 'Weka barua pepe yako',
    acceptTerms: 'Kubali masharti ili kufungua akaunti',
    newPassword: 'Chagua nenosiri',
    weakPassword: 'Nenosiri hili bado halijatimiza masharti',
    confirmPassword: 'Weka nenosiri tena',
    mismatch: 'Manenosiri hayalingani',
  },

  backToSignIn: 'Rudi kwenye kuingia',
  requestNewLink: 'Omba kiungo kipya',

  login: {
    heading: 'Ingia',
    lead: 'Karibu tena — ingia ili kuendelea.',
    submit: 'Ingia',
    forgot: 'Umesahau nenosiri?',
    demoAccount: 'Akaunti ya majaribio:',
    useDemo: 'Tumia akaunti ya majaribio',
    newHere: 'Mgeni hapa?',
    createAccount: 'Fungua akaunti',
  },

  register: {
    heading: 'Fungua akaunti',
    lead: 'Inachukua dakika moja — utaingia mara baada ya hapo.',
    submit: 'Fungua akaunti',
    demoNote: 'Majaribio: akaunti hazihifadhiwi. Baadaye, ingia kwa akaunti ya majaribio.',
    haveAccount: 'Tayari una akaunti?',
    signIn: 'Ingia',
    ready: 'Akaunti yako iko tayari — ingia ili kuendelea.',
  },

  forgot: {
    heading: 'Umesahau nenosiri lako?',
    lead: 'Weka barua pepe uliyojisajili nayo, nasi tutakutumia kiungo cha kuweka nenosiri jipya.',
    submit: 'Tuma kiungo',
    sentHeading: 'Angalia barua pepe yako',
    sent: 'Ikiwa kuna akaunti ya {email}, kiungo cha kuweka nenosiri jipya kinakuja. Huenda ikachukua dakika chache.',
    demoLink: 'Majaribio: fungua kiungo cha nenosiri jipya',
    resend: 'Tuma kiungo tena',
    resendIn: (seconds) => `Tuma kiungo tena baada ya sekunde ${seconds}`,
  },

  reset: {
    heading: 'Chagua nenosiri jipya',
    lead: 'Tumia ambalo hulitumii mahali pengine.',
    submit: 'Weka nenosiri jipya',
    badLink:
      'Kiungo hiki hakijakamilika au muda wake umeisha. Viungo hufanya kazi mara moja tu, kwa muda mfupi.',
    done: 'Nenosiri lako limebadilishwa — ingia kwa nenosiri jipya.',
  },

  checklist: {
    label: 'Masharti ya nenosiri',
    met: '(limetimizwa)',
    unmet: '(bado)',
  },
};
