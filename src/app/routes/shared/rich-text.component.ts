import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface TextSegment {
  kind: 'text' | 'code' | 'strong';
  text: string;
}

/** Cuts a text at its marks: `code` between backticks, **strong** between pairs of asterisks. */
export function richTextSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(/`([^`]+)`|\*\*([^*]+)\*\*/g)) {
    if (match.index > last) segments.push({ kind: 'text', text: text.slice(last, match.index) });
    segments.push(
      match[1] !== undefined
        ? { kind: 'code', text: match[1] }
        : { kind: 'strong', text: match[2] ?? '' },
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ kind: 'text', text: text.slice(last) });
  return segments;
}

/**
 * A sentence from a messages file with its marks shown: `code` as code, **strong** as strong.
 * It keeps a translated sentence whole — cut up around its tags, the word order would be fixed
 * to English. For the app's own text only: marks aren't escaped, so not for what a user typed.
 */
@Component({
  selector: 'rich-text',
  template: `
    @for (segment of segments(); track $index) {
      @switch (segment.kind) {
        @case ('code') {
          <code class="text-gray-800">{{ segment.text }}</code>
        }
        @case ('strong') {
          <strong>{{ segment.text }}</strong>
        }
        @default {
          <span>{{ segment.text }}</span>
        }
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RichTextComponent {
  readonly text = input.required<string>();

  protected readonly segments = computed(() => richTextSegments(this.text()));
}
