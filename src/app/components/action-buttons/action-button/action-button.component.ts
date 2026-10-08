import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { combineLatest, EMPTY, Subscription, switchMap } from 'rxjs';
import { injectMessages } from '@services/i18n/message-bundle';
import { ViewService } from '@services/view';
import { ActionAvatarComponent } from '../action-avatar.component';
import {
  acceptAttribute,
  actionButtonViewModel$,
  DEFAULT_VIEW_MODEL,
  displayLabel,
  isFileButton,
  reportFiles,
} from '../action-button.helpers';
import { ActionButton, ButtonAppearance, ButtonType } from '../action-button.interface';
import { ACTION_BUTTONS_MESSAGES } from '../action-buttons.messages';
import { ActionMenuComponent } from '../action-menu/action-menu.component';
import { ButtonLoadingDirective } from '../button-loading.directive';

const ICON_ONLY_TYPES: ReadonlySet<ButtonType> = new Set(['icon', 'mini-icon', 'mini-fab']);

@Component({
  selector: 'action-button',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    NgTemplateOutlet,
    ActionAvatarComponent,
    ActionMenuComponent,
    ButtonLoadingDirective,
  ],
  templateUrl: './action-button.component.html',
  styleUrl: './action-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionButtonComponent<D = unknown> implements OnDestroy {
  readonly button = input.required<ActionButton<D>>();
  readonly parentData = input<D>();
  private readonly view = inject(ViewService);
  private readonly router = inject(Router);
  private readonly t = injectMessages(ACTION_BUTTONS_MESSAGES);

  protected readonly data = computed(() => (this.button().data ?? this.parentData()) as D);
  protected readonly type = computed<ButtonType>(() => this.button().type ?? 'button');
  protected readonly appearance = computed<ButtonAppearance>(
    () => this.button().appearance ?? 'outlined',
  );
  protected readonly childButtons = computed(() => this.button().buttons ?? []);
  protected readonly hasChildren = computed(() => this.childButtons().length > 0);

  protected readonly isFileButton = computed(() => isFileButton(this.button()));

  protected readonly selectedFileNames = signal<string[]>([]);
  protected readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  private readonly button$ = toObservable(this.button);
  private readonly data$ = toObservable(this.data);
  private readonly subs = new Subscription();

  protected readonly viewModel = toSignal(
    combineLatest([this.button$, this.data$]).pipe(
      switchMap(([button, data]) => actionButtonViewModel$(button, data)),
    ),

    { initialValue: DEFAULT_VIEW_MODEL },
  );

  protected readonly displayLabel = computed(() =>
    displayLabel(this.button(), this.viewModel(), this.selectedFileNames()),
  );

  protected readonly showLabel = computed(
    () => !ICON_ONLY_TYPES.has(this.type()) && !!this.displayLabel(),
  );

  protected readonly isIconOnly = computed(
    () => ICON_ONLY_TYPES.has(this.type()) || (this.type() === 'fab' && !this.displayLabel()),
  );

  /** `ariaLabel` when the button gives one; otherwise a button that is only an icon is named by
   *  its tooltip, else its label, and any other button by what it shows */
  protected readonly ariaLabel = computed(() => {
    const vm = this.viewModel();
    if (vm.ariaLabel) return vm.ariaLabel;
    if (!this.isIconOnly()) return null;
    return vm.tooltip || this.displayLabel() || this.t().action;
  });

  protected readonly acceptAttribute = computed(() =>
    acceptAttribute(this.viewModel().fileConfig?.extensions),
  );

  /** `ActionButton.shortcut`: the key this button has in the shortcuts of the component it sits
   *  in. `ShortcutsService` finds it by the attribute this becomes, and clicks the button. */
  protected readonly shortcutKey = computed(() => this.button().shortcut || null);
  /** …and the name it is listed under there */
  protected readonly shortcutLabel = computed(() => {
    if (!this.shortcutKey()) return null;
    const vm = this.viewModel();
    return vm.ariaLabel || this.displayLabel() || vm.tooltip || this.t().action;
  });

  constructor() {
    this.subs.add(
      toObservable(computed(() => this.viewModel().fileConfig?.removeFile$))
        .pipe(switchMap((rem$) => rem$ ?? EMPTY))
        .subscribe(() => this.selectedFileNames.set([])),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  protected handleClick(event: Event): void {
    // the button's own business: a click on it must not also count as a click on what it sits
    // in — a grid row that opens on click, say
    event.stopPropagation();

    const vm = this.viewModel();
    if (vm.disabled || vm.loading) return;

    if (this.isFileButton()) {
      this.fileInput()?.nativeElement.click();
      return;
    }

    if (vm.confirmMessage || vm.confirmConfig) {
      const config = {
        ...vm.confirmConfig,
        message: vm.confirmConfig?.message ?? vm.confirmMessage,
      };
      void this.view.confirm(config).then((ok) => ok && this.act());
      return;
    }

    this.act();
  }

  /** the button's `click`, then its `link` — a button with a menu only opens it */
  private act(): void {
    this.button().click?.(this.data());
    const link = this.viewModel().link;
    if (link === undefined || this.hasChildren()) return;
    void (typeof link === 'string'
      ? this.router.navigateByUrl(link)
      : this.router.navigate([...link]));
  }

  protected onFileSelected(event: Event): void {
    const fileInput = event.target as HTMLInputElement;
    const files = fileInput.files;
    if (!files?.length) return;

    const fileConfig = this.viewModel().fileConfig;
    const fileNames = reportFiles(this.button(), fileConfig, files, event);
    if (fileConfig?.updateLabel ?? true) this.selectedFileNames.set(fileNames);

    fileInput.value = '';
  }
}
