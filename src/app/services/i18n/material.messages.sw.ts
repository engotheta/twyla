import type { MaterialMessages } from './material.messages';

export const MATERIAL_SW: MaterialMessages = {
  paginator: {
    itemsPerPage: 'Vipengee kwa ukurasa:',
    nextPage: 'Ukurasa unaofuata',
    previousPage: 'Ukurasa uliotangulia',
    firstPage: 'Ukurasa wa kwanza',
    lastPage: 'Ukurasa wa mwisho',
    range: (start, end, length) => `${start} – ${end} kati ya ${length}`,
    emptyRange: (length) => `0 kati ya ${length}`,
  },
  datepicker: {
    calendar: 'Kalenda',
    openCalendar: 'Fungua kalenda',
    closeCalendar: 'Funga kalenda',
    previousMonth: 'Mwezi uliopita',
    nextMonth: 'Mwezi ujao',
    previousYear: 'Mwaka uliopita',
    nextYear: 'Mwaka ujao',
    previousYears: 'Miaka 24 iliyopita',
    nextYears: 'Miaka 24 ijayo',
    chooseDate: 'Chagua tarehe',
    chooseMonthAndYear: 'Chagua mwezi na mwaka',
    startDate: 'Tarehe ya kuanza',
    endDate: 'Tarehe ya mwisho',
    comparisonDate: 'Kipindi cha kulinganisha',
  },
  stepper: {
    optional: 'Si lazima',
    completed: 'Imekamilika',
    editable: 'Inaweza kuhaririwa',
  },
};
