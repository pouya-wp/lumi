import { Logger, OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { corsOrigin } from '../common/cors';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import * as Y from 'yjs';
import { DocsService } from './docs.service';

interface Room {
  doc: Y.Doc;
  /** True while a client that created a brand-new page still has to seed its starter content. */
  awaitingSeed: boolean;
  /** Socket that was asked to seed; if it leaves before sending anything, seeding is re-offered. */
  seeder?: string;
  dirty: boolean;
  timer?: NodeJS.Timeout;
  idle?: NodeJS.Timeout;
}

const toBytes = (data: unknown) => (data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer));

/**
 * Yjs relay for real-time co-editing. The server keeps one Y.Doc per open page, applies and
 * rebroadcasts updates, relays awareness (cursors), and persists the merged state (debounced).
 */
@WebSocketGateway({ namespace: '/collab', cors: { origin: corsOrigin() }, maxHttpBufferSize: 5e6 })
export class CollabGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer() server!: Namespace;
  private readonly logger = new Logger(CollabGateway.name);
  private readonly rooms = new Map<string, Room>();

  constructor(
    private readonly jwt: JwtService,
    private readonly docs: DocsService,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const { sub } = await this.jwt.verifyAsync<{ sub: string }>(String(socket.handshake.auth?.token ?? ''));
      socket.data.userId = sub;
      socket.data.docs = new Map<string, boolean>();
    } catch {
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    for (const docId of (socket.data.docs as Map<string, boolean> | undefined)?.keys() ?? []) {
      this.reofferSeed(docId, socket.id);
      this.release(docId);
    }
  }

  private reofferSeed(docId: string, socketId: string) {
    const room = this.rooms.get(docId);
    if (room?.seeder === socketId) {
      room.seeder = undefined;
      room.awaitingSeed = true;
    }
  }

  async onModuleDestroy() {
    await Promise.all([...this.rooms.keys()].map((id) => this.flush(id)));
  }

  @SubscribeMessage('join')
  async join(@ConnectedSocket() socket: Socket, @MessageBody() body: { docId: string }) {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return { error: 'unauthorized' };
    try {
      const { state, canEdit } = await this.docs.loadState(body.docId, userId);
      let room = this.rooms.get(body.docId);
      if (!room) {
        const doc = new Y.Doc();
        if (state) Y.applyUpdate(doc, new Uint8Array(state));
        room = { doc, awaitingSeed: !state, dirty: false };
        this.rooms.set(body.docId, room);
      }
      clearTimeout(room.idle);
      await socket.join(`doc:${body.docId}`);
      (socket.data.docs as Map<string, boolean>).set(body.docId, canEdit);
      // Exactly one editor seeds an empty page's template content.
      const seed = room.awaitingSeed && canEdit;
      if (seed) {
        room.awaitingSeed = false;
        room.seeder = socket.id;
      }
      return { state: Y.encodeStateAsUpdate(room.doc), seed, canEdit };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'join failed' };
    }
  }

  @SubscribeMessage('leave')
  leave(@ConnectedSocket() socket: Socket, @MessageBody() body: { docId: string }) {
    socket.leave(`doc:${body.docId}`);
    (socket.data.docs as Map<string, boolean>).delete(body.docId);
    this.reofferSeed(body.docId, socket.id);
    this.release(body.docId);
  }

  @SubscribeMessage('update')
  update(@ConnectedSocket() socket: Socket, @MessageBody() body: { docId: string; update: ArrayBuffer }) {
    const canEdit = (socket.data.docs as Map<string, boolean> | undefined)?.get(body.docId);
    const room = this.rooms.get(body.docId);
    if (!room || !canEdit) return;
    const update = toBytes(body.update);
    room.seeder = undefined;
    Y.applyUpdate(room.doc, update);
    socket.to(`doc:${body.docId}`).emit('update', { docId: body.docId, update });
    room.dirty = true;
    clearTimeout(room.timer);
    room.timer = setTimeout(() => this.flush(body.docId), 1500);
  }

  @SubscribeMessage('awareness')
  awareness(@ConnectedSocket() socket: Socket, @MessageBody() body: { docId: string; update: ArrayBuffer }) {
    if (!(socket.data.docs as Map<string, boolean> | undefined)?.has(body.docId)) return;
    socket.to(`doc:${body.docId}`).emit('awareness', { docId: body.docId, update: toBytes(body.update) });
  }

  private async flush(docId: string) {
    const room = this.rooms.get(docId);
    if (!room?.dirty) return;
    room.dirty = false;
    try {
      await this.docs.saveState(docId, Y.encodeStateAsUpdate(room.doc));
    } catch (e) {
      this.logger.error(`Failed to persist doc ${docId}: ${e}`);
    }
  }

  /** Unloads a room shortly after its last client leaves. */
  private release(docId: string) {
    const room = this.rooms.get(docId);
    if (!room) return;
    const size = this.server.adapter.rooms.get(`doc:${docId}`)?.size ?? 0;
    if (size > 0) return;
    clearTimeout(room.idle);
    room.idle = setTimeout(async () => {
      await this.flush(docId);
      if ((this.server.adapter.rooms.get(`doc:${docId}`)?.size ?? 0) === 0) this.rooms.delete(docId);
    }, 30_000);
  }
}
