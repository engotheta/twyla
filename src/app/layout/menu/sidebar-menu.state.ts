import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { flattenMenu, searchMenu } from './menu.helpers';
import { MenuNode } from './menu.interface';
import { MenuService } from './menu.service';

/**
 * Which groups of the side menu are open, shared by every nesting level of one sidebar.
 * Accordion like GASCO's: opening a group closes its siblings, except `expanded` ones, which stay
 * open; each navigation re-opens just the branch leading to the current page.
 */
@Injectable()
export class SidebarMenuState {
  private readonly menuService = inject(MenuService);

  private readonly opened = signal<ReadonlySet<string>>(new Set());

  /** the filter box's text */
  readonly query = signal('');

  /** the side menu, narrowed by the filter */
  readonly items = computed(() => searchMenu(this.menuService.menu(), this.query()));

  readonly filtering = computed(() => this.query().trim().length > 0);

  constructor() {
    effect(() => {
      const pinned = flattenMenu(this.menuService.menu()).filter((node) => node.expanded);
      const branch = this.menuService.trail().filter((node) => node.type === 'sub');
      untracked(() => this.opened.set(new Set([...pinned, ...branch].map((node) => node.id))));
    });
  }

  /** while filtering every matching branch shows */
  isOpen(node: MenuNode): boolean {
    return this.filtering() || this.opened().has(node.id);
  }

  toggle(node: MenuNode, siblings: readonly MenuNode[]): void {
    this.opened.update((opened) => {
      const next = new Set(opened);
      if (next.has(node.id)) {
        next.delete(node.id);
        return next;
      }
      for (const sibling of siblings) {
        if (sibling !== node && !sibling.expanded) next.delete(sibling.id);
      }
      next.add(node.id);
      return next;
    });
  }
}
