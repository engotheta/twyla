import type { IconConfig } from '@components/action-buttons/action-button.interface';

export interface ConfirmDialog {
  title?: string;
  subTitle?: string;
  message?: string;

  icon?: string;
  iconConfig?: IconConfig;

  cancelText?: string;
  cancelButtonClass?: string;

  confirmText?: string;
  confirmButtonClass?: string;
}
