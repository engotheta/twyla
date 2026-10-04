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
    // a field's colour also tints its label, at 80%: blue-800 keeps that readable
    id: { label: 'User ID', class: '!text-blue-800' },
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
      // purple-700 for the same reason: a step lighter, and the faded label is under 4.5:1
      class: 'text-purple-700',
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

/** the same record with its groups as tabs — one group's sub-groups as tabs of their own, which
 *  that group restyles: an underline in place of the pill */
export const tabbedDetailsParameter: DetailsParameter = {
  ...detailsParameter,
  showGroupsInTabs: true,
  fieldGroups: [
    detailsParameter.fieldGroups![0],
    detailsParameter.fieldGroups![1],
    {
      label: 'More',
      icon: 'info',
      fields: ['reportFile', 'feedback'],
      tabsContainerClass: 'rounded-none border-0 border-b bg-transparent p-0',
      tabClass: 'rounded-none text-gray-700',
      activeTabClass: 'text-primary',
      tabIndicatorClass: 'top-auto bottom-0 h-0.5 rounded-none',
      groups: [
        { label: 'Address', icon: 'home', fields: ['address'] },
        { label: 'Settings', icon: 'settings', fields: ['settings'] },
        { label: 'Users', icon: 'group', fields: ['users'] },
      ],
    },
  ],
};
