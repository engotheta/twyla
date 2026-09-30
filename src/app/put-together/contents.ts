import { applog } from '../app';
import { ActionButton } from '../components/action-buttons/action-button.interface';
import { ContentsParameter, ContentView } from '../components/contents-view';
import { gridParameter } from './data-grid';
import { getGridParameterFetch } from './data-grid-fetch';
import { detailsParameter } from './details';
import { getFormParameter } from './form';
import { userDetails } from './support/data';

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

/** Call from an injection context — the Contractors tab's grid fetches through FetchService. */
export function getContentsParameter(): ContentsParameter {
  return {
    showContentsInTabs: false,
    contentsFit: 'cover',
    // drag any gutter to retune the split — width between the two outer panes, height between the
    // stacked panels inside the left one; cascades to every nested level, persists across reloads
    resizable: true,

    // root-level cascade seed — combines with every nested level's own contentsClass
    // contentsClass: 'ring-1 ring-black/5',

    contents: [
      {
        type: 'group',
        slug: 'profile',
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
            header: 'none',
            class: 'bg-white rounded-lg',
            actionButtons: profileActionButtons,
            detailsParams: { entity: details },
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

        showContentsInTabs: true,
        tabsOrientation: 'horizontal',

        contents: [
          {
            type: 'table',
            slug: 'employees',
            label: 'Employees',
            icon: 'groups',
            badge: 'Live',
            gridParams: gridParameter,
            // keeps its icon/label/badge visible above the grid even while active as a tab
            header: 'full',
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
