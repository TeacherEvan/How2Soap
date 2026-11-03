export interface ClosableOverlay {
  id?: string;
  close?: () => void;
  remove?: () => void;
}

export class OverlayStack {
  private stack: ClosableOverlay[] = [];

  push(overlay: ClosableOverlay): void {
    this.stack.push(overlay);
  }

  remove(overlay: ClosableOverlay): void {
    const idx = this.stack.indexOf(overlay);
    if (idx !== -1) {
      this.stack.splice(idx, 1);
    }
  }

  closeTop(): ClosableOverlay | undefined {
    const top = this.stack.pop();
    if (top) {
      if (typeof top.close === 'function') {
        top.close();
      } else if (typeof top.remove === 'function') {
        top.remove();
      }
    }
    return top;
  }

  size(): number {
    return this.stack.length;
  }
}

export const globalOverlayStack = new OverlayStack();
