import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  OnInit,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { combineLatest, isObservable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { resolveDynamicValue$ } from '../action-buttons/dynamic-value.util';
import { DataGridComponent } from '../data-grid';
import { DetailsComponent } from '../details/details.component';
import { GenericFormComponent } from '../generic-form';
import { MergeClassesPipe } from '../details/util/class-name/merge-classes.pipe';
import { mergeClasses } from '../details/util/class-name/class-name.helpers';
import { ContentsViewInstance, ContentsViewParameter, ContentView } from './contents.interface';

/** one resolved content, ready to render — `visible`/`disabled`/`badge`/`html`
 *  (DynamicValue/Observable-driven) already settled into plain current values */
interface ResolvedContent {
  content: ContentView;
  visible: boolean;
  disabled: boolean;
  badge: string | number | undefined;
  html: string | undefined;
}

/** Recursively flattens a ContentView tree (including every nested `.contents`) into a
 *  flat list — a pure structural walk over the input data, independent of what's
 *  actually mounted (see `ContentsViewInstance.contents`). */
function flattenContents(contents: ContentView[]): ContentView[] {
  const out: ContentView[] = [];
  for (const c of contents) {
    out.push(c);
    if (c.contents?.length) out.push(...flattenContents(c.contents));
  }
  return out;
}

/**
 * Renders a `ContentsViewParameter`: one or more content types (table/details/form/
 * html/component), shown as tabs or a list, recursively nestable via
 * `ContentView.contents` (this component lists itself in its own `imports`, same
 * self-recursion convention as `FieldGroupComponent`). See `contents.interface.ts` for
 * the full contract.
 */
@Component({
  selector: 'contents-view',
  imports: [
    NgComponentOutlet,
    NgTemplateOutlet,
    MatIconModule,
    MatTabsModule,
    DataGridComponent,
    DetailsComponent,
    GenericFormComponent,
    MergeClassesPipe,
    ContentsViewComponent,
  ],
  templateUrl: './contents-view.component.html',
  styleUrl: './contents-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentsViewComponent implements OnInit {
  readonly parameter = input.required<ContentsViewParameter>();
  readonly instanceChange = output<ContentsViewInstance>();

  private readonly activeSlugSig = signal<string | undefined>(undefined);

  /** per-content reactive resolution of visible/disabled/badge/html — mirrors
   *  grid-cell.component.ts's toObservable→switchMap→combineLatest→toSignal pattern,
   *  applied across the whole `contents` array via combineLatest(contents.map(...)) */
  protected readonly resolvedContents = toSignal(
    toObservable(computed(() => this.parameter().contents)).pipe(
      switchMap((contents) =>
        contents.length
          ? combineLatest(
              contents.map((c) =>
                combineLatest({
                  content: of(c),
                  visible: resolveDynamicValue$(c.visible, c).pipe(map((v) => v ?? true)),
                  disabled: resolveDynamicValue$(c.disabled, c).pipe(map((v) => v ?? false)),
                  badge: isObservable(c.badge) ? c.badge : of(c.badge),
                  html: of(c.type === 'html' ? c.html : undefined).pipe(
                    switchMap((h) => (isObservable(h) ? h : of(h))),
                  ),
                }),
              ),
            )
          : of([]),
      ),
    ),
    { initialValue: [] as ResolvedContent[] },
  );

  protected readonly visibleContents = computed(() => {
    const hasPermission = this.parameter().hasPermission;
    return this.resolvedContents().filter((rc) => {
      if (!rc.visible) return false;
      if (!hasPermission || !rc.content.permissions?.length) return true;
      return hasPermission(rc.content.permissions, rc.content);
    });
  });

  /** the EFFECTIVE active slug — falls back to the `initialActive`-marked content, then
   *  the first one, until the user (or `selectContent`) explicitly picks one. Backs
   *  both `activeIndex` (for the template) and the instance's `activeSlug()`/
   *  `activeContent()`, so they always agree with what's actually shown. */
  protected readonly effectiveActiveSlug = computed(() => {
    const list = this.visibleContents();
    return (
      this.activeSlugSig() ??
      list.find((rc) => rc.content.initialActive)?.content.slug ??
      list[0]?.content.slug
    );
  });

  protected readonly activeIndex = computed(() => {
    const slug = this.effectiveActiveSlug();
    return Math.max(
      0,
      this.visibleContents().findIndex((rc) => rc.content.slug === slug),
    );
  });

  protected readonly tabsContainerClass = computed(() =>
    mergeClasses(
      this.parameter().tabsOrientation === 'vertical' ? 'contents-view-tabs-vertical' : '',
      this.parameter().tabsContainerClass ?? '',
    ),
  );

  protected readonly contentsContainerClass = computed(
    () => this.parameter().contentsContainerClass ?? 'contents-view-default-grid',
  );

  // outputs wiring for dynamically-hosted `componentParams.component` instances —
  // NgComponentOutlet has no outputs binding or (created) event, only a
  // `componentInstance` getter, so we walk the live outlets ourselves. Correlated to
  // the filtered 'component'-type visible contents by array order (viewChildren
  // preserves template/DOM order).
  private readonly componentOutlets = viewChildren(NgComponentOutlet);
  private readonly wiredOutputInstances = new WeakSet<object>();

  constructor() {
    effect(() => {
      const componentContents = this.visibleContents().filter(
        (rc): rc is ResolvedContent & { content: ContentView & { type: 'component' } } =>
          rc.content.type === 'component',
      );
      this.componentOutlets().forEach((outlet, i) => {
        const instance = outlet.componentInstance;
        const outputs = componentContents[i]?.content.componentParams?.outputs;
        if (!instance || !outputs || this.wiredOutputInstances.has(instance)) return;
        this.wiredOutputInstances.add(instance);
        for (const [key, handler] of Object.entries(outputs)) {
          const emitter = (instance as Record<string, unknown>)[key];
          if (emitter && typeof (emitter as { subscribe?: unknown }).subscribe === 'function') {
            (emitter as { subscribe: (fn: (event: unknown) => void) => void }).subscribe(handler);
          }
        }
      });
    });
  }

  ngOnInit(): void {
    const getContents = () => flattenContents(this.parameter().contents);
    const instance: ContentsViewInstance = {
      get contents() {
        return getContents();
      },
      activeContent: () =>
        this.visibleContents().find((rc) => rc.content.slug === this.effectiveActiveSlug())
          ?.content,
      activeSlug: () => this.effectiveActiveSlug(),
      selectContent: (slug) => this.selectBySlug(slug),
    };
    this.instanceChange.emit(instance);
  }

  protected onTabIndexChange(index: number): void {
    const content = this.visibleContents()[index]?.content;
    if (!content) return;
    this.activateContent(content);
  }

  private selectBySlug(slug: string): void {
    const rc = this.visibleContents().find((rc) => rc.content.slug === slug && !rc.disabled);
    if (rc) this.activateContent(rc.content);
  }

  private activateContent(content: ContentView): void {
    this.activeSlugSig.set(content.slug);
    content.onActive?.(content, this.parameter().contents);
    this.parameter().onContentChange?.(content, this.parameter().contents);
  }

  protected nestedParameter(content: ContentView): ContentsViewParameter {
    return {
      contents: content.contents ?? [],
      contentsClass: content.contentsClass,
      contentsContainerClass: content.contentsContainerClass,
      tabsContainerClass: content.tabsContainerClass,
      tabsOrientation: content.tabsOrientation,
      showContentsInTabs: content.showContentsInTabs,
      fitContentsIntoView: content.fitContentsIntoView,
      preserveInactiveContent: content.preserveInactiveContent,
    };
  }

  protected readonly trackContent = (_: number, rc: ResolvedContent): string | number =>
    rc.content.slug ?? _;
}
