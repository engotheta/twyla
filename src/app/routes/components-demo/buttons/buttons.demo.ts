import { Subject } from 'rxjs';
import { getAllFields } from '@components/details';
import { ActionButton } from '@components/action-buttons';
import { applog } from '../../shared/applog';

export const removeFile$ = new Subject<boolean>();

export let data = true;

export const actionButtons: ActionButton[] = [
  {
    label: 'Save',
    icon: 'save',
    class: (data) => (!!data ? '!bg-blue-500 !text-white !hover:bg-blue-600' : ''),
    click: () => applog.set('Save clicked'),
  },
  {
    label: 'Slow action',
    icon: 'hourglass_empty',
    // loading: true,
    click: () => [
      applog.set('Slow clicked'),
      console.log(
        getAllFields({
          a: 1,
          b: { c: 2, d: { e: 3, f: { g: 4, h: 5 } } },
          users: [
            { id: 1, name: 'John', address: { street: '123 Main', city: 'NYC', zip: '10001' } },
            { id: 2, name: 'Jane', address: { street: '456 Oak', city: 'LA', zip: '90001' } },
          ],
          settings: {
            theme: 'dark',
            permissions: ['read', 'write', 'delete'],
            features: {
              api: { enabled: true, version: 'v2', endpoints: ['users', 'posts', 'comments'] },
              cache: { ttl: 3600, strategy: 'lru' },
            },
          },
          tags: ['important', 'urgent', 'archived'],
          metadata: {
            created: '2024-01-01',
            modified: '2024-01-15',
            nested: { deep: { deeper: { deepest: 'value' } } },
          },
        }),
      ),
    ],
  },
  {
    type: 'fab',
    label: 'Add',
    icon: 'add',
    confirmMessage: 'Are you sure you want to perform this deep action?',
    confirmConfig: { confirmText: 'Yes', cancelText: 'No', icon: 'warning' },
    click: () => applog.set('Add clicked'),
  },
  {
    type: 'icon',
    icon: 'delete',
    tooltip: 'Delete',
    confirmMessage: 'Are you sure you want to delete?',
    click: () => [applog.set('Delete clicked'), removeFile$.next(true), (data = !data)],
  },
  {
    label: 'Upload',
    icon: 'upload',
    fileConfig: { extensions: ['.png', '.jpg'], multiple: true },
    fileChange: (event) => applog.set(`File selected: ${event.fileName}`),
  },
  {
    label: 'More',
    icon: 'more_horiz',
    buttons: [
      { label: 'Nested action', icon: 'star', click: () => applog.set('Nested clicked') },
      {
        label: 'Nested upload',
        icon: 'upload_file',
        fileConfig: { updateLabel: true, removeFile$: removeFile$ },
        fileChange: (event) => applog.set(`Nested file: ${event.fileName}`),
      },
      {
        label: 'Deeper',
        icon: 'more_vert',
        buttons: [
          {
            label: 'Deep action',
            icon: 'bolt',
            confirmMessage: 'Are you sure you want to perform this deep action?',
            confirmConfig: { confirmText: 'Yes', cancelText: 'No' },
            click: () => applog.set('Deep clicked'),
          },
        ],
      },
    ],
  },
];

/** what the second row of buttons acts on */
export interface DemoPerson {
  name: string;
  email: string;
}

export const person: DemoPerson = { name: 'Ada Lovelace', email: 'ada@example.com' };

/** a row in groups: the appearances, a button that is a link, and a person's button — an avatar
 *  opening a menu with a heading, links, groups of its own and a confirmation */
export const personButtons: ActionButton<DemoPerson>[] = [
  { label: 'Text', appearance: 'text', click: () => applog.set('Text clicked') },
  { label: 'Tonal', appearance: 'tonal', click: () => applog.set('Tonal clicked') },
  { label: 'Filled', appearance: 'filled', click: () => applog.set('Filled clicked') },
  { divider: true },
  {
    label: 'Data grid',
    icon: 'table_view',
    link: '/components/data-grid',
    click: () => applog.set('Going to the data grid'),
  },
  { divider: true },
  {
    appearance: 'text',
    avatar: (person) => ({ name: person.name }),
    label: (person) => person.name,
    icon: 'expand_more',
    iconConfig: { position: 'after' },
    menuConfig: { title: (person) => person.name, subtitle: (person) => person.email },
    buttons: [
      { label: 'Profile', icon: 'person', link: '/account/profile' },
      { divider: true, label: 'Records' },
      { label: 'Export', icon: 'download', click: () => applog.set('Export clicked') },
      { label: 'Archive', icon: 'archive', click: () => applog.set('Archive clicked') },
      { divider: true },
      {
        label: 'Remove',
        icon: 'delete',
        confirmMessage: (person) => `Remove ${person.name}?`,
        click: (person) => applog.set(`Removed ${person?.name}`),
      },
    ],
  },
];
