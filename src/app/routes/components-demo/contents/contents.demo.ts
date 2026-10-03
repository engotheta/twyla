import { inject } from '@angular/core';
import { applog } from '../../shared/applog';
import { ActionButton } from '@components/action-buttons';
import { ContentsParameter, ContentView } from '@components/contents-view';
import { FetchService } from '@services/fetch';
import { NotificationService } from '@services/notification';
import { gridParameter } from '../data-grid/data-grid.demo';
import { getGridParameterFetch } from '../data-grid/data-grid-server.demo';
import { detailsParameter } from '../details/details.demo';
import { getFormParameter } from '../form/form.demo';
import { userDetails } from '../sample-data';

export interface StringQueryOperatorInput {
  eq?: string;
  ne?: string;
  in?: string[];
  nin?: string[];
  regex?: string;
}
export interface CountryFilterInput {
  code?: StringQueryOperatorInput;
  continent?: StringQueryOperatorInput;
  currency?: StringQueryOperatorInput;
  name?: StringQueryOperatorInput;
}

export const GET_COUNTRIES_QUERY = `
query countries($filter: CountryFilterInput) {
  countries(filter: $filter){
    capital
    name
    continent{
      name
      code
    }
  }
}`;

const profileActionButtons: ActionButton<ContentView>[] = [
  {
    type: 'icon',
    icon: 'edit',
    tooltip: 'Edit profile',
    click: () => applog.set('Edit profile clicked'),
  },
  {
    type: 'icon',
    icon: 'share',
    tooltip: 'Share profile',
    click: () => applog.set('Share profile clicked'),
  },
];

let { users, permissions, tags, ...details } = userDetails;

/** Call from an injection context (e.g. a field initializer) — it injects `FetchService` and
 *  `NotificationService`, and the Contractors tab's grid fetches through `FetchService` too. */
export function getContentsParameter(): ContentsParameter {
  const fs = inject(FetchService);
  const notify = inject(NotificationService);

  return {
    showContentsInTabs: false,
    // fits the viewport from lg up; below lg it flows and scrolls (`flowOnSmallerView` defaults on)
    contentsFit: 'cover',
    // drag any gutter to retune the split — width between the two outer panes, height between the
    // stacked panels inside the left one; cascades to every nested level, persists across reloads
    resizable: true,
    // collapse / restore on every pane, cascading like `resizable`: the two outer panes (side by
    // side on lg) collapse to column strips, the stacked panels to row strips
    collapsible: true,
    // a full-screen button on every pane (tab panels included), cascading the same way
    fullscreenable: true,

    // root-level cascade seed — combines with every nested level's own contentsClass
    // contentsClass: 'ring-1 ring-black/5',

    contents: [
      {
        type: 'group',
        slug: 'profile',
        // label/icon name its collapsed strip; `title` heads its header row
        label: 'Account',
        title: 'My account',
        icon: 'account_circle',
        header: 'auto',
        // a single vertical column — `resizable` (inherited from the root) puts a height gutter
        // between the two stacked panels; no width gutter, since there's only one column
        contentsContainerClass: 'grid grid-cols-1 lg:grid-cols-1 gap-3',
        contents: [
          // {
          //   type: 'details',
          //   slug: 'profile',
          //   label: 'Profile',
          //   icon: 'person',
          //   badge: 3,

          //   actionButtons: profileActionButtons,
          //   detailsParams: detailsParameter,
          // },
          {
            type: 'details',
            slug: 'profile',
            label: 'Profile',
            icon: 'person',
            badge: 3,
            // no heading — its action buttons and pane controls still get a header row
            header: 'none',

            class: 'bg-white rounded-lg',
            actionButtons: profileActionButtons,
            detailsParams: {
              entity: details,
              fieldsProperties: {
                name: { click: (user, field) => notify.info(`${field.label}: ${user.name}`) },
              },
            },
          },

          {
            type: 'details',
            slug: 'other',
            label: 'Other',
            icon: 'cart',
            header: 'none',
            class: 'bg-white rounded-lg',
            actionButtons: profileActionButtons,
            detailsParams: { entity: { users } },
          },
        ],
      },

      {
        type: 'group',
        slug: 'more',
        label: 'Workspace',
        icon: 'dashboard',
        // no `title` — 'full' heads the header with the label instead
        header: 'full',

        showContentsInTabs: true,
        tabsOrientation: 'horizontal',
        actionButtons: [
          { label: 'Add', icon: 'add', type: 'icon', click: () => console.log('Add clicked') },
        ],

        contents: [
          {
            type: 'table',
            slug: 'countries',
            label: 'countries',
            icon: 'map',

            // header: 'auto',
            collapsible: false,
            // title: 'Countries',
            // fullscreenable: false,
            actionButtons: [
              {
                label: 'Refresh',
                icon: 'refresh',
                type: 'icon',
                click: () => console.log('Refresh clicked'),
              },
            ],
            // class: 'bg-white rounded-lg',

            gridParams: {
              // countries carry no `id` — name is unique and keeps row identity across refetches
              identifierKey: ['name'],
              serverPaginated: true,
              fetchFn: (vars) => {
                let str = vars?.searchFields[0]?.value;

                let filter: CountryFilterInput | undefined = str
                  ? { name: { regex: str } }
                  : undefined;

                return fs.fetch$({
                  variables: { filter },
                  // fieldSelection: ['name', 'continent {code}'],
                  // loading: { on: 'users-card' },
                  query: GET_COUNTRIES_QUERY,
                });
              },
            },
          },
          {
            type: 'table',
            slug: 'employees',
            label: 'Employees',
            icon: 'groups',
            badge: 'Live',
            gridParams: gridParameter,
            // keeps its icon/label/badge visible above the grid even while active as a tab
            // header: 'full',
          },
          {
            type: 'table',
            slug: 'contractors',
            label: 'Contractors',
            icon: 'list',
            gridParams: getGridParameterFetch(),
          },
          {
            type: 'form',
            slug: 'speaker-form',
            label: 'Speaker Form',
            formParams: getFormParameter(),
          },
          {
            type: 'html',
            slug: 'about',
            label: 'About',
            html: '<p>A <b>nested</b> group tab.</p>',

            // a 3rd nesting level, under a non-'group' node — any content can carry its own
            // nested tabs, independently oriented from its parent, with classes still cascading
            contentsClass: 'border border-dashed border-black/20 p-2',
            tabsContainerClass: 'bg-gray-200',
            showContentsInTabs: true,
            tabsOrientation: 'vertical',
            contents: [
              {
                type: 'html',
                slug: 'about-details',
                label: 'Details',
                html: '<p>More about this section.</p>',
              },
              {
                type: 'html',
                slug: 'about-credits',
                label: 'Credits',
                html: '<p>Built with the contents-view component.</p>',
              },
            ],
          },
        ],
      },
    ],
  };
}
