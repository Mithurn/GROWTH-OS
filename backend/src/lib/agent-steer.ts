import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import { WebSocketServer, type WebSocket } from 'ws';
import { supabase } from './supabase';
import { prisma } from './prisma';
import { logger } from './logger';
import { emitActivity } from './activity-emitter';

/**
 * Bidirectional steer channel. JWT on the first message (EventSource cannot
 * send headers; WebSocket can). Records stop/steer as activity — it does not
 * inject a second planner. The running graph still stops on its own code edges.
 */
export function attachAgentSteer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const host = req.headers.host ?? 'localhost';
    const url = new URL(req.url ?? '/', `http://${host}`);
    if (url.pathname !== '/ws/agent') {
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    let companyId: string | null = null;
    let userId: string | null = null;

    ws.on('message', async (raw) => {
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(String(raw)) as Record<string, unknown>;
      } catch {
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON' }));
        return;
      }

      if (body.type === 'auth') {
        const token = typeof body.token === 'string' ? body.token : '';
        const { data, error } = await supabase.auth.getUser(token);
        if (error || !data.user) {
          ws.send(JSON.stringify({ type: 'error', error: 'Unauthorized' }));
          ws.close();
          return;
        }
        const profile = await prisma.profile.findUnique({
          where: { id: data.user.id },
          select: { companyId: true },
        });
        if (!profile?.companyId) {
          ws.send(JSON.stringify({ type: 'error', error: 'No company' }));
          ws.close();
          return;
        }
        userId = data.user.id;
        companyId = profile.companyId;
        ws.send(JSON.stringify({ type: 'ready', companyId }));
        return;
      }

      if (!companyId || !userId) {
        ws.send(JSON.stringify({ type: 'error', error: 'Authenticate first' }));
        return;
      }

      if (body.type === 'stop' || body.type === 'steer') {
        const agentId = typeof body.agentId === 'string' ? body.agentId : '';
        const text = typeof body.text === 'string' ? body.text : '';
        emitActivity({
          id: `steer:${companyId}:${Date.now()}`,
          companyId,
          agentId,
          actionType: body.type === 'stop' ? 'agent_stop' : 'agent_steer',
          description: text || body.type,
          details: { runId: body.runId, userId },
          createdAt: new Date(),
        });
        ws.send(JSON.stringify({ type: 'ack', command: body.type }));
        return;
      }

      ws.send(JSON.stringify({ type: 'error', error: 'Unknown command' }));
    });

    ws.on('error', (err) => {
      logger.warn({ err }, 'agent steer websocket error');
    });
  });

  return wss;
}
