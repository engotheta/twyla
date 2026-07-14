import { IconConfig } from '../action-button.interface';

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
