import { TypedRoutes } from '../../layout';

const placeholder = () =>
  import('../shared/placeholder.component').then((m) => m.PlaceholderComponent);

/** The Account module (GASCO's `user` module): reached from the user menu, not the module rail. */
export const ACCOUNT_ROUTES: TypedRoutes = [
  { path: '', pathMatch: 'full', redirectTo: 'profile' },
  {
    path: 'profile',
    data: { isMenu: true, name: 'Profile', icon: 'person' },
    loadComponent: () => import('./profile.component').then((m) => m.ProfileComponent),
  },
  {
    path: 'security',
    data: { isMenu: true, name: 'Password & security', icon: 'lock' },
    loadComponent: placeholder,
  },
  {
    path: 'preferences',
    data: { isMenu: true, name: 'Preferences', icon: 'tune' },
    loadComponent: placeholder,
  },
];

export default ACCOUNT_ROUTES;
