import { defineMessages } from '@services/i18n/message-bundle';
import { DETAILS_SW } from './details.messages.sw';

export const DETAILS_EN = {
  loading: 'Loading details',
  yes: 'Yes',
  no: 'No',
  viewPdf: 'View PDF',
  viewFile: 'View file',
  /** a thumbnail that opens its image: "View Photo" */
  view: (what: string) => `View ${what}`,
  /** what the thumbnail of a field with no label is called */
  image: 'image',
  /** the header of a list's buttons column */
  actions: 'Actions',
  /** the tab of a group that has no label: "Group 2" */
  group: (position: number) => `Group ${position}`,
  /** what a row of tabs is called when there is no heading to name it after */
  sections: 'Sections',

  /** the keyboard shortcuts (`details.shortcuts.ts`): what each key switches */
  shortcuts: {
    scope: 'Details',
    list: 'List layout',
    inlineList: 'Inline layout',
    table: 'Table layout',
    palettes: 'Card layout',
    expandLists: 'Lists expanded',
    tabs: 'Groups in tabs',
    undefinedValues: 'Fields with no value',
    emptyArrays: 'Empty lists',
    iconMarks: 'Background icons',
    reset: 'Back to how it was set up',
  },
};

export type DetailsMessages = typeof DETAILS_EN;

export const DETAILS_MESSAGES = defineMessages('details', DETAILS_EN, { sw: DETAILS_SW });
