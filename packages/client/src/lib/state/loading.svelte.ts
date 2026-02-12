export class GlobalLoadingState {
  count = $state(0);

  show() {
    this.count += 1;
  }

  hide() {
    this.count = Math.max(0, this.count - 1);
  }
}

export const globalLoading = new GlobalLoadingState();
