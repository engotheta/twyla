import { JsonPipe } from '@angular/common';
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';

export const formResult = signal<{ mode: 'preview' | 'submitted'; value: unknown } | null>(null);

@Component({
  selector: 'form-results',
  imports: [JsonPipe],
  template: `
    @if (formResult(); as result) {
      <div class="w-full max-w-4xl rounded-lg bg-gray-900 p-4 text-xs text-green-400 shadow">
        <p class="mb-2 font-semibold text-white">
          {{
            result.mode === 'submitted'
              ? 'Submitted payload:'
              : 'Preview (current, unsubmitted) value:'
          }}
        </p>
        <pre class="overflow-x-auto whitespace-pre-wrap">{{ result.value | json }}</pre>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly formResult = formResult;
}
