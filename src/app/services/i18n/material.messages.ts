import { defineMessages } from './message-bundle';
import { MATERIAL_SW } from './material.messages.sw';

/** Angular Material's own labels — what its `…Intl` classes hold (`material-intl.ts`). */
export const MATERIAL_EN = {
  paginator: {
    itemsPerPage: 'Items per page:',
    nextPage: 'Next page',
    previousPage: 'Previous page',
    firstPage: 'First page',
    lastPage: 'Last page',
    /** "1 – 10 of 37"; `start` and `end` count from one */
    range: (start: number, end: number, length: number) => `${start} – ${end} of ${length}`,
    emptyRange: (length: number) => `0 of ${length}`,
  },
  datepicker: {
    calendar: 'Calendar',
    openCalendar: 'Open calendar',
    closeCalendar: 'Close calendar',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    previousYear: 'Previous year',
    nextYear: 'Next year',
    previousYears: 'Previous 24 years',
    nextYears: 'Next 24 years',
    chooseDate: 'Choose date',
    chooseMonthAndYear: 'Choose month and year',
    startDate: 'Start date',
    endDate: 'End date',
    comparisonDate: 'Comparison range',
  },
  stepper: {
    optional: 'Optional',
    completed: 'Completed',
    editable: 'Editable',
  },
};

export type MaterialMessages = typeof MATERIAL_EN;

export const MATERIAL_MESSAGES = defineMessages('material', MATERIAL_EN, { sw: MATERIAL_SW });
