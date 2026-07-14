import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ActionButtonsComponent } from './components/action-buttons/action-buttons.component';
import { ActionButton } from './components/action-buttons/action-button.interface';
import { BehaviorSubject, Subject } from 'rxjs';
import { getAllFields } from './components/details/field/fields.helper';
import { DetailsComponent } from './components/details/details.component';
import { DetailsParameter } from './components/details/detail.interface';

const entity = {
  id: 'usr_8f3a21',
  name: 'Jane Doe',
  active: true,
  score: 50,
  themeColor: '#4f46e5',
  createdAt: '2024-01-15T10:30:00Z',
  bio: undefined,
  permissions: ['read', 'write', 'delete'],
  tags: ['important', 'urgent', 'archived'],
  reportFile: 'reports/annual-2024.pdf',
  feedback: { comment: 'Great service, would recommend!', author: 'Alex' },
  address: { street: '123 Main', city: 'NYC', zip: '10001' },
  settings: {
    theme: 'dark',
    features: { api: { enabled: true, version: 'v2' } },
  },
  users: Array.from({ length: 9 }, (_, i) => ({
    id: i + 1,
    name: `User ${i + 1}`,
    role: i === 0 ? 'admin' : 'viewer',
  })),
};

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ActionButtonsComponent, DetailsComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly log = signal('');

  removeFile$ = new Subject<boolean>();

  data = true;

  protected readonly detailsParameter: DetailsParameter = {
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
          { label: 'Edit', icon: 'edit', click: (user) => this.log.set(`Edit user ${user.name}`) },
        ],
      },
      users: {
        label: 'Users Listo',
        class: 'text-purple-600',
        tabular: false,
        pageSize: 10,
        value: (entity: any) =>
          [{ id: 0, name: 'Default User', role: 'viewer' }]?.concat(entity?.users),
        buttons: [
          {
            label: 'Add User',
            icon: 'person_add',
            click: () => this.log.set('Add user clicked'),
          },
        ],
        itemButtons: [
          {
            label: 'View',
            icon: 'visibility',
            click: (user) => this.log.set(`View user ${user.name}`),
          },
        ],
      },
    },

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
    entity: entity,
  };

  protected readonly buttons: ActionButton[] = [
    {
      label: 'Save',
      icon: 'save',
      class: (data) => (!!data ? '!bg-blue-500 !text-white !hover:bg-blue-600' : ''),
      click: () => this.log.set('Save clicked'),
    },
    {
      label: 'Slow action',
      icon: 'hourglass_empty',
      // loading: true,
      click: () => [
        this.log.set('Slow clicked'),
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
      click: () => this.log.set('Add clicked'),
    },
    {
      type: 'icon',
      icon: 'delete',
      tooltip: 'Delete',
      confirmMessage: 'Are you sure you want to delete?',
      click: () => [
        this.log.set('Delete clicked'),
        this.removeFile$.next(true),
        (this.data = !this.data),
      ],
    },
    {
      label: 'Upload',
      icon: 'upload',
      fileConfig: { extensions: ['.png', '.jpg'], multiple: true },
      fileChange: (event) => this.log.set(`File selected: ${event.fileName}`),
    },
    {
      label: 'More',
      icon: 'more_horiz',
      buttons: [
        { label: 'Nested action', icon: 'star', click: () => this.log.set('Nested clicked') },
        {
          label: 'Nested upload',
          icon: 'upload_file',
          fileConfig: { updateLabel: true, removeFile$: this.removeFile$ },
          fileChange: (event) => this.log.set(`Nested file: ${event.fileName}`),
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
              click: () => this.log.set('Deep clicked'),
            },
          ],
        },
      ],
    },
  ];
}
