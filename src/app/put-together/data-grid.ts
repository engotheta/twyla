import { applog } from './support/applog';
import { CellsProps, GridParameter, RowProps } from '../components/data-grid';
import { FieldType, obs } from '../components/generic-form';
import { employees, Employee } from './support/data';

export const gridParameter: GridParameter<Employee> = {
  label: 'Employees',
  icon: 'groups',
  identifierKey: ['id'],

  gridData: employees.map((item, index) => ({
    ...item,
    _cellsProps:
      index === 3
        ? <CellsProps>{ name: { rowspan: 3, colspan: 4, class: 'bg-red-300', click(row) {} } }
        : undefined,
    _rowProps: <RowProps>{ mergeConsecutive: true, class: index % 2 === 0 ? 'bg-gray-50' : '' },
  })),

  size: 10,

  sort: { key: 'salary', direction: 'asc' },

  columns: [
    'id label(ID) sortable(true) widthhh(70px)',
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      searchable: true,
      contentClass: 'flex gap-2',
      // action buttons hosted in this column's own body cells — row is passed as data
      buttons: [
        {
          type: 'icon',
          icon: 'visibility',
          tooltip: 'View',
          click: (row) => applog.set(`View clicked (column button) for ${row?.name}`),
        },
      ],
      // action buttons hosted in this column's header cell — GridState is passed as data
      headerButtons: [
        {
          type: 'icon',
          icon: 'refresh',
          tooltip: 'Refresh',
          click: (state) =>
            applog.set(
              `Header button clicked — page ${state?.gridData?.page},
              ${state?.gridData?.content?.length} row(s) on page`,
            ),
        },
      ],
    },

    // 'address.city label(City) searchable(true)',
    // 'address.zip label(Zip) type(number) width(80px) visible(false)',

    // 'address columns(address.city as City, address.zip as Zip, address.street as Street)',

    {
      key: 'address',
      visible: true,
      columns: [
        {
          key: 'address.city',
          label: 'City',
          searchable: true,
          sortable: true,

          // renders the mapped value as HTML (sanitized by Angular's default [innerHTML] binding)
          type: 'html',

          // a mapper function that takes a row and returns a value to be
          // displayed in the cell for this column.

          valueFn: (row: Employee) =>
            `${row.address?.city}
          ${row.address?.zip ? ` <span class="text-gray-600">(${row.address.zip})</span>` : ''}`,

          //a component or template that will be used to render the cell for this column.
          // template: '',

          // // a function or object to provide context for the template
          // // a row is always passed  to the templateContextFn,
          // // and the return value is passed to the template as context.
          // templateContext: (row: Employee) => ({ row, value: row.address?.city }),
        },
        { key: 'address.zip', label: 'Zip', type: 'number', width: '80px', visible: false },
        { key: 'address.street', label: 'Street' },
      ],
    },
    // {
    //   key: 'employment',
    //   visible: true,
    //   label: 'Employment',
    //   columns: [
    //     { key: 'department', label: 'Department', sortable: true },
    //     { key: 'region', label: 'Region', sortable: true },
    //   ],
    // },
    {
      key: 'salary',
      label: 'Salary',
      type: 'currency',
      sortable: true,
      mergeConsecutive: true,
      // align: 'right',
      editField: { type: FieldType.input, key: 'salary', inputType: 'decimal' },
    },
    { key: 'active', label: 'Active', type: 'boolean', align: 'center', searchable: true },
    { key: 'joinedAt', label: 'Joined', type: 'date', sortable: true },
  ],

  initialSelected: [employees[0], employees[1]],

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

  filterConfig: {
    filtersTrigger: 'live',
    filtersMode: 'inline',
  },

  searchConfig: {
    searchTypeChangeable: true,
    searchFieldsMode: 'modal',
  },

  // addIndexColumn: false,

  canAddColumns: true,

  selectionMode: 'multiple',
  onRowSelection: (rows) => applog.set(`Selected ${rows?.length ?? 0} employee(s)`),

  rowFormatter: { '!bg-red-50': (row) => !row.active },
  rowsDraggable: true,

  onRowDrag: (rowsInNewOrder, draggedRow) =>
    applog.set(
      `Dragged ${draggedRow?.name} — new page order: ${rowsInNewOrder.map((r) => r.name).join(', ')}`,
    ),

  rowButtons: [
    {
      type: 'icon',
      icon: 'visibility',
      tooltip: 'View',
      click: (row) => applog.set(`View ${row?.name}`),
    },
  ],

  editing: {
    editable: true,
    trigger: 'dblclick',
    onCellEdit: (row, key, value) => {
      applog.set(`Edited ${row?.name}.${key} to ${value}`);
      return true;
    },
  },

  renderMode: { modes: ['table', 'list', 'cards'] },
  export: { formats: ['csv', 'excel', 'pdf'], matchGridStyle: true },
};
