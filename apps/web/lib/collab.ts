'use client';

import { io, type Socket } from 'socket.io-client';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { API_URL, tokens } from './api';

/** Transaction origin for updates that came from the server, so they are not echoed or snapshotted. */
export const ORIGIN = Symbol('remote');

type Status = 'connecting' | 'synced' | 'offline';

/**
 * Yjs provider over the API's /collab Socket.IO namespace. Exposes `awareness` so TipTap's
 * collaboration caret can render live cursors. `onSeed` runs once when this client must
 * populate a brand-new page with its template content.
 */
export class SocketProvider {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  canEdit = true;
  status: Status = 'connecting';
  private socket: Socket;
  private listeners = new Set<(s: Status) => void>();

  constructor(
    private readonly docId: string,
    doc: Y.Doc,
    private readonly onSeed: () => void,
  ) {
    this.doc = doc;
    this.awareness = new Awareness(doc);
    this.socket = io(`${API_URL}/collab`, { auth: (cb) => cb({ token: tokens.access }), transports: ['websocket'] });

    this.socket.on('connect', () => this.join());
    this.socket.on('disconnect', () => this.setStatus('offline'));
    this.socket.on('update', ({ docId, update }: { docId: string; update: ArrayBuffer }) => {
      if (docId === this.docId) Y.applyUpdate(this.doc, new Uint8Array(update), ORIGIN);
    });
    this.socket.on('awareness', ({ docId, update }: { docId: string; update: ArrayBuffer }) => {
      if (docId === this.docId) applyAwarenessUpdate(this.awareness, new Uint8Array(update), ORIGIN);
    });

    this.doc.on('update', this.onDocUpdate);
    this.awareness.on('update', this.onAwarenessUpdate);
    window.addEventListener('beforeunload', this.onUnload);
  }

  private join() {
    this.socket.emit('join', { docId: this.docId }, (res: { state?: ArrayBuffer; seed?: boolean; canEdit?: boolean; error?: string }) => {
      if (res.error) {
        this.setStatus('offline');
        return;
      }
      if (res.state) Y.applyUpdate(this.doc, new Uint8Array(res.state), ORIGIN);
      // Push anything typed while offline, then share our presence.
      this.socket.emit('update', { docId: this.docId, update: Y.encodeStateAsUpdate(this.doc) });
      this.canEdit = res.canEdit !== false;
      if (res.seed) this.onSeed();
      this.socket.emit('awareness', { docId: this.docId, update: encodeAwarenessUpdate(this.awareness, [this.doc.clientID]) });
      this.setStatus('synced');
    });
  }

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin !== ORIGIN && this.socket.connected) this.socket.emit('update', { docId: this.docId, update });
  };

  private onAwarenessUpdate = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
    if (origin === ORIGIN || !this.socket.connected) return;
    const changed = [...added, ...updated, ...removed];
    this.socket.emit('awareness', { docId: this.docId, update: encodeAwarenessUpdate(this.awareness, changed) });
  };

  private onUnload = () => removeAwarenessStates(this.awareness, [this.doc.clientID], 'unload');

  onStatus(fn: (s: Status) => void) {
    this.listeners.add(fn);
    fn(this.status);
    return () => this.listeners.delete(fn);
  }

  private setStatus(s: Status) {
    this.status = s;
    this.listeners.forEach((fn) => fn(s));
  }

  destroy() {
    removeAwarenessStates(this.awareness, [this.doc.clientID], 'destroy');
    window.removeEventListener('beforeunload', this.onUnload);
    this.doc.off('update', this.onDocUpdate);
    this.awareness.off('update', this.onAwarenessUpdate);
    this.socket.emit('leave', { docId: this.docId });
    this.socket.close();
    this.awareness.destroy();
  }
}
