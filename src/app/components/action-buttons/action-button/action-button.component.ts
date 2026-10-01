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
import { combineLatest, EMPTY, map, Observable, Subscription, switchMap } from 'rxjs';
import {
  ActionButton,
  ButtonType,
  FileChangeEvent,
  FileConfig,
  IconPosition,
  IconType,
} from '../action-button.interface';
import { resolveDynamicValue$ } from '../dynamic-value.util';
import { ButtonLoadingDirective } from '../button-loading.directive';
import { ConfirmDialog } from '../confirm-dialogue/confirm-dialog.interface';
import { ViewService } from '../../view';

interface ActionButtonViewModel {
  label?: string;
  labelClass?: string;
  labelMaxLength?: number;
  icon?: string;
  iconType: IconType;
  iconClass?: string;
  iconPosition: IconPosition;
  tooltip?: string;
  tooltipPosition: 'above' | 'below' | 'left' | 'right';
  tooltipClass?: string;
  disabled: boolean;
  visible: boolean;
  loading: boolean;
  class?: string;
  childrenHolderClass?: string;
  fileConfig?: FileConfig;
  confirmMessage?: string;
  confirmConfig?: ConfirmDialog;
}

const DEFAULT_VIEW_MODEL: ActionButtonViewModel = {
  iconType: 'material',
  iconPosition: 'before',
  tooltipPosition: 'below',
  disabled: false,
  visible: true,
  loading: false,
};

const ICON_ONLY_TYPES: ReadonlySet<ButtonType> = new Set(['icon', 'mini-icon', 'mini-fab']);

@Component({
  selector: 'action-button',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    NgTemplateOutlet,
    ActionButtonComponent,
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

  protected readonly data = computed(() => (this.button().data ?? this.parentData()) as D);
  protected readonly type = computed<ButtonType>(() => this.button().type ?? 'button');
  protected readonly childButtons = computed(() => this.button().buttons ?? []);
  protected readonly hasChildren = computed(() => this.childButtons().length > 0);

  protected readonly isFileButton = computed(
    () => this.button().fileConfig !== undefined || this.button().fileChange !== undefined,
  );

  protected readonly selectedFileNames = signal<string[]>([]);
  protected readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  private readonly button$ = toObservable(this.button);
  private readonly data$ = toObservable(this.data);
  private readonly subs = new Subscription();

  protected readonly viewModel = toSignal(
    combineLatest([this.button$, this.data$]).pipe(
      switchMap(([button, data]) => this.buildViewModel$(button, data)),
    ),

    { initialValue: DEFAULT_VIEW_MODEL },
  );

  protected readonly displayLabel = computed(() => {
    const vm = this.viewModel();
    const updateLabel = vm.fileConfig?.updateLabel ?? true;
    const canUpdate = this.isFileButton() && updateLabel && this.selectedFileNames().length;

    if (canUpdate) return this.selectedFileNames().join(', ');
    return this.truncateLabel(vm.label, vm.labelMaxLength);
  });

  protected readonly showLabel = computed(
    () => !ICON_ONLY_TYPES.has(this.type()) && !!this.displayLabel(),
  );

  protected readonly isIconOnly = computed(
    () => ICON_ONLY_TYPES.has(this.type()) || (this.type() === 'fab' && !this.displayLabel()),
  );

  protected readonly ariaLabel = computed(() => {
    if (!this.isIconOnly()) return null;
    return this.viewModel().tooltip ?? this.displayLabel() ?? 'Action';
  });

  protected readonly acceptAttribute = computed(() => {
    const extensions = this.viewModel().fileConfig?.extensions;
    const extensions_ = () => extensions?.map((e) => (e.startsWith('.') ? e : `.${e}`)).join(',');
    return extensions?.length ? extensions_() : null;
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
    // Menu items are plain buttons (not `mat-menu-item`), so stop the click from
    // bubbling to the ancestor `mat-menu` overlay's outside-click detection, which
    // would otherwise close the menu whenever a nested action button is clicked.
    event.stopPropagation();

    const vm = this.viewModel();
    if (vm.disabled || vm.loading) return;

    if (this.isFileButton()) {
      this.fileInput()?.nativeElement.click();
      return;
    }

    if (vm.confirmMessage || vm.confirmConfig) {
      const config = { ...vm.confirmConfig, message: vm.confirmConfig?.message ?? vm.confirmMessage };
      void this.view.confirm(config).then((ok) => ok && this.button().click?.(this.data()));
      return;
    }

    this.button().click?.(this.data());
  }

  protected onFileSelected(event: Event): void {
    const fileInput = event.target as HTMLInputElement;
    const files = fileInput.files;
    if (!files?.length) return;

    const button = this.button();
    const fileConfig = this.viewModel().fileConfig;
    const fileNames: string[] = [];

    Array.from(files).forEach((file) => {
      fileNames.push(file.name);

      const fileChangeEvent: FileChangeEvent = {
        event: event as InputEvent,
        file,
        fileName: file.name,
        extension: file.name.includes('.') ? (file.name.split('.').pop() ?? '') : '',
      };

      (fileConfig?.change ?? button.fileChange)?.(fileChangeEvent);
    });

    if (fileConfig?.updateLabel ?? true) this.selectedFileNames.set(fileNames);

    fileInput.value = '';
  }

  private truncateLabel(label: string | undefined, maxLength: number | undefined): string {
    if (!label || !maxLength || label.length <= maxLength) return label ?? '';
    return `${label.slice(0, maxLength)}…`;
  }

  private buildViewModel$(button: ActionButton<D>, data: D): Observable<ActionButtonViewModel> {
    return combineLatest({
      label: this.resolveLabel$(button, data),
      icon: this.resolveIcon$(button, data),
      tooltip: this.resolveTooltip$(button, data),
      misc: this.resolveMisc$(button, data),
    }).pipe(map(({ label, icon, tooltip, misc }) => ({ ...label, ...icon, ...tooltip, ...misc })));
  }

  private resolveLabel$(button: ActionButton<D>, data: D) {
    return resolveDynamicValue$(button.labelConfig, data).pipe(
      switchMap((config) =>
        combineLatest({
          fromConfig: resolveDynamicValue$(config?.label, data),
          fallback: resolveDynamicValue$(button.label, data),
          labelClass: resolveDynamicValue$(config?.class, data),
        }).pipe(
          map(({ fromConfig, fallback, labelClass }) => ({
            label: fromConfig ?? fallback,
            labelClass,
            labelMaxLength: config?.maxLength,
          })),
        ),
      ),
    );
  }

  private resolveIcon$(button: ActionButton<D>, data: D) {
    return resolveDynamicValue$(button.iconConfig, data).pipe(
      switchMap((config) =>
        combineLatest({
          fallback: resolveDynamicValue$(button.icon, data),
          iconClass: resolveDynamicValue$(config?.class, data),
        }).pipe(
          map(({ fallback, iconClass }) => ({
            icon: config?.icon ?? fallback,
            iconType: config?.type ?? 'material',
            iconClass,
            iconPosition: config?.position ?? 'before',
          })),
        ),
      ),
    );
  }

  private resolveTooltip$(button: ActionButton<D>, data: D) {
    return resolveDynamicValue$(button.tooltipConfig, data).pipe(
      switchMap((config) =>
        combineLatest({
          fromConfig: resolveDynamicValue$(config?.tooltip, data),
          fallback: resolveDynamicValue$(button.tooltip, data),
          position: resolveDynamicValue$(config?.position, data),
          tooltipClass: resolveDynamicValue$(config?.class, data),
        }).pipe(
          map((x) => ({
            tooltip: x.fromConfig ?? x.fallback,
            tooltipPosition: x.position ?? 'below',
            tooltipClass: x.tooltipClass,
          })),
        ),
      ),
    );
  }

  private resolveMisc$(button: ActionButton<D>, data: D) {
    let fileConfigDef: FileConfig = { multiple: false, updateLabel: true };

    return combineLatest({
      disabled: resolveDynamicValue$(button.disabled, data),
      visible: resolveDynamicValue$(button.visible, data),
      loading: resolveDynamicValue$(button.loading, data),
      hostClass: resolveDynamicValue$(button.class, data),
      childrenHolderClass: resolveDynamicValue$(button.childrenHolderClass, data),
      fileConfig: resolveDynamicValue$(button.fileConfig, data),
      confirmMessage: resolveDynamicValue$(button.confirmMessage, data),
      confirmConfig: resolveDynamicValue$(button.confirmConfig, data),
    }).pipe(
      map((x) => ({
        disabled: x.disabled ?? false,
        visible: x.visible ?? true,
        loading: x.loading ?? false,
        class: x.hostClass,
        childrenHolderClass: x.childrenHolderClass,
        fileConfig: x.fileConfig ? { ...fileConfigDef, ...x.fileConfig } : undefined,
        confirmMessage: x.confirmMessage,
        confirmConfig: x.confirmConfig,
      })),
    );
  }
}
