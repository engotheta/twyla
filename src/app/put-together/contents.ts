import { applog } from '../app';
import { ActionButton } from '../components/action-buttons/action-button.interface';
import { ContentsParameter, ContentView } from '../components/contents-view';
import { gridParameter } from './data-grid';
import { gridParameterFetch } from './data-grid-fetch';
import { detailsParameter } from './details';
import { getFormParameter } from './form';

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

export const contentsParameter: ContentsParameter = {
  showContentsInTabs: false,

  // root-level cascade seed — combines with every nested level's own contentsClass
  // contentsClass: 'ring-1 ring-black/5',

  contents: [
    {
      type: 'group',
      slug: 'profile',

      contents: [
        {
          type: 'details',
          slug: 'profile',
          label: 'Profile',
          icon: 'person',
          badge: 3,

          actionButtons: profileActionButtons,
          detailsParams: detailsParameter,
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
          showFullHeaderInTabs: true,
        },
        {
          type: 'table',
          slug: 'contractors',
          label: 'Contractors',
          icon: 'list',
          gridParams: gridParameterFetch,
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
