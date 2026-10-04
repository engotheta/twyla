import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { ActionButtonComponent } from '@components/action-buttons/action-button/action-button.component';
import { ActionButton } from '@components/action-buttons/action-button.interface';
import { injectMessages } from '@services/i18n/message-bundle';
import { LAYOUT_CONFIG, LayoutUser } from '../layout-config.token';
import { LAYOUT_MESSAGES } from '../layout.messages';
import { resolveMenu } from './menu.helpers';

/**
 * The signed-in user's button — their avatar (or initials) and, where there is room, their name
 * — opening their menu: who they are on top, then "All modules" and the configured `userMenu`
 * entries, then "Sign out". Shows a "Sign in" link when nobody is signed in.
 *
 * One action button, built from `LayoutConfig`: what it can't do, the user menu doesn't.
 */
@Component({
  selector: 'user-menu',
  imports: [RouterLink, MatButton, ActionButtonComponent],
  template: `
    @if (user(); as user) {
      <action-button [button]="button()" [parentData]="user" />
    } @else {
      <a mat-button [routerLink]="config.signInUrl">{{ t().user.signIn }}</a>
    }
  `,
  host: { class: 'inline-flex' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserMenuComponent {
  protected readonly config = inject(LAYOUT_CONFIG);
  protected readonly user = this.config.user;
  protected readonly t = injectMessages(LAYOUT_MESSAGES);

  private readonly items = resolveMenu(this.config.userMenu);

  /** rebuilt when the language changes: the names pass through `t` and `config.translate` */
  protected readonly button = computed<ActionButton<LayoutUser>>(() => {
    const t = this.t();
    const signOut = this.config.signOut;

    return {
      appearance: 'text',
      // a pill around the avatar: a button's own padding and least width are for a label
      class: 'min-w-0! rounded-full! ps-1! pe-1! md:pe-2!',
      avatar: (user) => ({ src: user.avatar, name: user.name }),
      label: (user) => user.name,
      labelConfig: { class: 'hidden max-w-40 truncate text-sm font-medium text-gray-800 md:block' },
      icon: 'expand_more',
      // `!`: an icon takes its button's colour (Material's own rule), which here is the primary
      iconConfig: { position: 'after', class: 'hidden! text-gray-500! md:inline-block!' },
      // the name is hidden on a narrow screen: the button is named either way
      ariaLabel: (user) => t.user.account(user.name),
      menuConfig: {
        title: (user) => user.name,
        subtitle: (user) => user.subtitle ?? user.email ?? '',
        xPosition: 'before',
      },
      buttons: [
        { label: t.allModules, icon: 'apps', link: this.config.homeUrl },
        ...this.items.map((item): ActionButton<LayoutUser> => ({
          label: this.config.translate(item.name),
          icon: item.icon,
          iconConfig: { type: item.iconType === 'svg' ? 'SVG' : 'material' },
          link: item.link,
        })),
        ...(signOut
          ? [{ divider: true }, { label: t.user.signOut, icon: 'logout', click: () => signOut() }]
          : []),
      ],
    };
  });
}
