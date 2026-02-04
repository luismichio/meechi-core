declare module 'y-indexeddb' {
  import * as Y from 'yjs';

  export class IndexeddbPersistence {
    constructor(name: string, doc: Y.Doc);
    on(event: 'synced', listener: () => void): void;
    off(event: 'synced', listener: () => void): void;
    synced: boolean;
    destroy(): void;
    doc: Y.Doc;
  }
}
