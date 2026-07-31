import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { ActionButtonsComponent } from './components/action-buttons/action-buttons.component';
import { ActionButton } from './components/action-buttons/action-button.interface';
import { BehaviorSubject, Subject } from 'rxjs';
import { getAllFields } from './components/details/field/fields.helper';
import { DetailsComponent } from './components/details/details.component';
import { DetailsParameter } from './components/details/detail.interface';
import { FieldType, GenericFormComponent, obs } from './components/generic-form';
import { createSpeakerFormParams } from './conference-speaker-form.params';
import { DataGridComponent, GridParameter } from './components/data-grid';

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

const employees = Array.from({ length: 37 }, (_, i) => ({
  id: i + 1,
  name: `Employee ${i + 1}`,
  address: {
    street: `${100 + i} Elm St`,
    city: ['NYC', 'LA', 'Chicago', 'Houston'][i % 4],
    zip: `${10000 + i}`,
  },
  department: ['Engineering', 'Sales', 'Support'][i % 3],
  region: ['North', 'South', 'East', 'West'][i % 4],
  salary: 40000 + (i % 10) * 5000,
  active: i % 5 !== 0,
  joinedAt: new Date(2024, i % 12, (i % 27) + 1).toISOString(),
}));
type Employee = (typeof employees)[number];

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    ActionButtonsComponent,
    DetailsComponent,
    GenericFormComponent,
    DataGridComponent,
    JsonPipe,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly log = signal('');

  removeFile$ = new Subject<boolean>();

  data = true;

  protected readonly formResult = signal<{ mode: 'preview' | 'submitted'; value: unknown } | null>(
    null,
  );

  protected readonly gridParameter: GridParameter<Employee> = {
    label: 'Employees',
    icon: 'groups',
    identifierKey: ['id'],
    gridData: employees,
    size: 10,

    columns: [
      'id label(ID) sortable(true) width(70px)',
      'name label(Name) sortable(true) searchable(true)',
      'address.city label(City)',
      {
        key: 'employment',
        label: 'Employment',
        columns: [
          { key: 'department', label: 'Department', sortable: true },
          { key: 'region', label: 'Region', sortable: true },
        ],
      },
      {
        key: 'salary',
        label: 'Salary',
        type: 'currency',
        sortable: true,
        // align: 'right',
        editField: { type: FieldType.input, key: 'salary', inputType: 'decimal' },
      },
      { key: 'active', label: 'Active', type: 'boolean', align: 'center', searchable: true },
      { key: 'joinedAt', label: 'Joined', type: 'date', sortable: true },
    ],

    gridFilters: [
      {
        type: FieldType.select,
        key: 'department',
        hasNoneOption: true,
        options: [
          { value: 'Engineering', label: 'Engineering' },
          { value: 'Sales', label: 'Sales' },
          { value: 'Support', label: 'Support' },
        ],
      },
      {
        type: FieldType.toggle,
        visible: obs('department', (d) => !!d),
        key: 'active',
      },
    ],
    searchConfig: {
      allowSearchTypeOverride: true,
      searchFieldsMode: 'modal',
    },

    // addIndexColumn: false,

    selectionMode: 'multiple',
    onRowSelection: (rows) => this.log.set(`Selected ${rows?.length ?? 0} employee(s)`),

    conditionalRowFormat: { '!bg-red-50': (row) => !row.active },

    rowsDraggable: true,
    onRowDrag: (rowsInNewOrder, draggedRow) =>
      this.log.set(
        `Dragged ${draggedRow?.name} — new page order: ${rowsInNewOrder.map((r) => r.name).join(', ')}`,
      ),

    rowButtons: [
      {
        type: 'icon',
        icon: 'visibility',
        tooltip: 'View',
        click: (row) => this.log.set(`View ${row?.name}`),
      },
    ],

    editing: {
      editable: true,
      trigger: 'dblclick',
      onCellEdit: (row, key, value) => {
        this.log.set(`Edited ${row?.name}.${key} to ${value}`);
        return true;
      },
    },

    renderMode: { modes: ['table', 'list', 'cards'] },
    export: { formats: ['csv', 'excel', 'pdf'], matchGridStyle: true },
  };

  protected readonly speakerFormParams = createSpeakerFormParams(
    (value) => this.formResult.set({ mode: 'submitted', value }),
    (value) => this.formResult.set({ mode: 'preview', value }),
  );

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
