import { effect, Injectable, Provider } from '@angular/core';
import { MatDatepickerIntl } from '@angular/material/datepicker';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { MatStepperIntl } from '@angular/material/stepper';
import { MATERIAL_MESSAGES } from './material.messages';
import { injectMessages } from './message-bundle';

// ─────────────────────────────────────────────
// Angular Material keeps the labels of its paginator, date picker and stepper in `…Intl`
// services. These hold them in the user's language, and tell the components to redraw when
// that changes. A feature that renders one of the three adds `provideMaterialIntl()` to its own
// `providers`, so it reads right wherever it is used — no app-level set-up.
// ─────────────────────────────────────────────

@Injectable()
export class TranslatedPaginatorIntl extends MatPaginatorIntl {
  private readonly t = injectMessages(MATERIAL_MESSAGES);

  constructor() {
    super();
    effect(() => {
      const text = this.t().paginator;
      this.itemsPerPageLabel = text.itemsPerPage;
      this.nextPageLabel = text.nextPage;
      this.previousPageLabel = text.previousPage;
      this.firstPageLabel = text.firstPage;
      this.lastPageLabel = text.lastPage;
      this.changes.next();
    });
  }

  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    const text = this.t().paginator;
    const total = Math.max(length, 0);
    if (total === 0 || pageSize === 0) return text.emptyRange(total);
    const start = page * pageSize;
    // a start past the end of the list (a stale page index) still reads as a whole page
    const end = start < total ? Math.min(start + pageSize, total) : start + pageSize;
    return text.range(start + 1, end, total);
  };
}

@Injectable()
export class TranslatedDatepickerIntl extends MatDatepickerIntl {
  private readonly t = injectMessages(MATERIAL_MESSAGES);

  constructor() {
    super();
    effect(() => {
      const text = this.t().datepicker;
      this.calendarLabel = text.calendar;
      this.openCalendarLabel = text.openCalendar;
      this.closeCalendarLabel = text.closeCalendar;
      this.prevMonthLabel = text.previousMonth;
      this.nextMonthLabel = text.nextMonth;
      this.prevYearLabel = text.previousYear;
      this.nextYearLabel = text.nextYear;
      this.prevMultiYearLabel = text.previousYears;
      this.nextMultiYearLabel = text.nextYears;
      this.switchToMonthViewLabel = text.chooseDate;
      this.switchToMultiYearViewLabel = text.chooseMonthAndYear;
      this.startDateLabel = text.startDate;
      this.endDateLabel = text.endDate;
      this.comparisonDateLabel = text.comparisonDate;
      this.changes.next();
    });
  }
}

@Injectable()
export class TranslatedStepperIntl extends MatStepperIntl {
  private readonly t = injectMessages(MATERIAL_MESSAGES);

  constructor() {
    super();
    effect(() => {
      const text = this.t().stepper;
      this.optionalLabel = text.optional;
      this.completedLabel = text.completed;
      this.editableLabel = text.editable;
      this.changes.next();
    });
  }
}

/**
 * Angular Material's paginator, date picker and stepper labels in the user's language. For a
 * component's `providers` (or the app config): each `…Intl` is only created where its
 * component is used.
 */
export function provideMaterialIntl(): Provider[] {
  return [
    { provide: MatPaginatorIntl, useClass: TranslatedPaginatorIntl },
    { provide: MatDatepickerIntl, useClass: TranslatedDatepickerIntl },
    { provide: MatStepperIntl, useClass: TranslatedStepperIntl },
  ];
}
