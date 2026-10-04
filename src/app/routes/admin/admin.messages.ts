import { defineMessages } from '@services/i18n';
import { ADMIN_SW } from './admin.messages.sw';

/** The administration pages' text. The rows of the users table are sample data. */
export const ADMIN_EN = {
  users: {
    subtitle: "Detail pages aren't in the menu; their breadcrumbs still find their way",
    /** the table's caption, for a screen reader */
    caption: 'Users',
    name: 'Name',
    email: 'Email',
    role: 'Role',
  },
};

export type AdminMessages = typeof ADMIN_EN;

export const ADMIN_MESSAGES = defineMessages('admin', ADMIN_EN, { sw: ADMIN_SW });
