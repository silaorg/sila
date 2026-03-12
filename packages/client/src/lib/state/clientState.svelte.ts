export class ClientState {

  private _init = $state(false);
  private _startedInit = false;

  isLoading = $derived(!this._init);

  async init() {
    if (this._init) return;

    if (this._startedInit) {
      throw new Error('ClientState is already initializing');
    }
    this._startedInit = true;

    this._init = true;
  }

}
