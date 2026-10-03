import { applog } from '../../shared/applog';
import type { DetailsParameter } from '@components/details';
import { userDetails } from '../sample-data';

export const detailsParameter: DetailsParameter = {
  // header: { title: 'Sample Entity' },
  // animation: '',
  // autoMapValues: true,
  // showUndefined: true,
  // bg-icon-mark renders an SVG watermark icon; this app has no custom SVG icon set
  // registered yet, so it's left off here to avoid noisy "icon not found" errors.
  // showBgIconMark: false,
  // showGroupsInTabs: true,

  layout: 'list',

  fieldsStrings: ['users  icon(group)', 'createdAt type(date)'],
  fieldsProperties: {
    id: { label: 'User ID', class: '!text-blue-600' },
    name: {
      label: 'Full Name',
      value: (entity: any) => entity?.name?.toUpperCase(),
      class: 'text-green-600',
      buttons: [
        { label: 'Edit', icon: 'edit', click: (user) => applog.set(`Edit user ${user.name}`) },
      ],
    },
    users: {
      label: 'Users Listo',
      class: 'text-purple-600',
      tabular: true,
      pageSize: 10,
      value: (entity: any) =>
        [{ id: 0, name: 'Default User', role: 'viewer' }]?.concat(entity?.users),
      buttons: [
        {
          label: 'Add User',
          icon: 'person_add',
          click: () => applog.set('Add user clicked'),
        },
      ],
      itemButtons: [
        {
          label: 'View',
          icon: 'visibility',
          click: (user) => applog.set(`View user ${user.name}`),
        },
      ],
    },
  },

  groupConfig: {},

  fieldGroups: [
    {
      label: 'Profile',
      icon: 'person',
      fields: [
        'id',
        { key: 'name', class: (d) => (d.name?.includes('Jane') ? 'bg-gray-100' : '') },
        'active',
        'score icon(save) class(bg-green-100)',
        'themeColor',
        'createdAt',
        'bio',
      ],
    },

    { label: 'Access', icon: 'lock', fields: ['permissions', 'tags'] },
    { label: 'Details', icon: 'info', fields: ['...'] },
  ],
  entity: userDetails,
};
