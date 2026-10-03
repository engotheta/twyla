import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

export const formResult = signal<{ mode: 'preview' | 'submitted'; value: unknown } | null>(null);

/** The form demo's output: what Preview or Submit produced, announced as it appears. */
@Component({
  selector: 'form-results',
  imports: [JsonPipe],
  template: `
    <p class="sr-only" role="status">{{ announcement() }}</p>
    @if (formResult(); as result) {
      <div class="w-full max-w-4xl rounded-lg bg-gray-900 p-4 text-xs text-green-400 shadow">
        <p class="mb-2 font-semibold text-white">
          {{
            result.mode === 'submitted'
              ? 'Submitted payload:'
              : 'Preview (current, unsubmitted) value:'
          }}
        </p>
        <pre class="wrap-anywhere whitespace-pre-wrap">{{ result.value | json }}</pre>
      </div>
    }
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormResultsComponent {
  protected readonly formResult = formResult;

  protected readonly announcement = computed(() => {
    const result = formResult();
    if (!result) return '';
    return result.mode === 'submitted'
      ? 'Form submitted. The payload is shown below the form.'
      : 'Preview shown below the form.';
  });
}
