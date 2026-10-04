import { TestBed } from '@angular/core/testing';
import { RichTextComponent, richTextSegments } from './rich-text.component';

describe('rich text', () => {
  it('cuts a text at its marks', () => {
    expect(richTextSegments('**Modules** are the `isMenu` routes.')).toEqual([
      { kind: 'strong', text: 'Modules' },
      { kind: 'text', text: ' are the ' },
      { kind: 'code', text: 'isMenu' },
      { kind: 'text', text: ' routes.' },
    ]);
    expect(richTextSegments('No marks here.')).toEqual([{ kind: 'text', text: 'No marks here.' }]);
    expect(richTextSegments('')).toEqual([]);
  });

  it('leaves what is inside code as written', () => {
    expect(richTextSegments("a shell (`*.module.ts`), a `path: ''` route")).toEqual([
      { kind: 'text', text: 'a shell (' },
      { kind: 'code', text: '*.module.ts' },
      { kind: 'text', text: '), a ' },
      { kind: 'code', text: "path: ''" },
      { kind: 'text', text: ' route' },
    ]);
  });

  it('shows the sentence whole, its marks as elements', () => {
    const fixture = TestBed.createComponent(RichTextComponent);
    fixture.componentRef.setInput(
      'text',
      '**Sign-in**: point `provideSessionConfig({ api })` at your backend.',
    );
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toBe(
      'Sign-in: point provideSessionConfig({ api }) at your backend.',
    );
    expect(element.querySelector('strong')?.textContent).toBe('Sign-in');
    expect(element.querySelector('code')?.textContent).toBe('provideSessionConfig({ api })');
  });
});
