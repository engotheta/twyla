import type { SessionMessages } from './session.messages';

export const SESSION_SW: SessionMessages = {
  signedOut: 'Umetoka kwenye akaunti.',
  expired: 'Muda wa kipindi chako umeisha. Tafadhali ingia tena.',
  noAccess: 'Huna ruhusa ya kufungua ukurasa huo.',
  errors: {
    offline: 'Imeshindikana kuifikia seva. Angalia muunganisho wako kisha ujaribu tena.',
    server: 'Seva imepata tatizo. Tafadhali jaribu tena baada ya muda mfupi.',
    unknown: 'Hitilafu imetokea. Tafadhali jaribu tena.',
    incorrectCredentials: 'Jina la mtumiaji au nenosiri si sahihi.',
    invalidResetLink: 'Kiungo hiki cha kuweka upya nenosiri si sahihi au muda wake umeisha.',
  },
};
