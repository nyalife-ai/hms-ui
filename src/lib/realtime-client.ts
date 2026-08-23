/**
 * Authenticated Socket.IO client for /realtime.
 * On reconnect, callers should re-sync from the notifications API.
 * Conversation rooms are tracked and re-joined automatically after reconnect.
 */

import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "./api";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:4000";

export type RealtimeEnvelope = {
  type?: string;
  payload?: Record<string, unknown>;
  eventId?: string;
};

export type RealtimeConnectionStatus =
  | "connected"
  | "disconnected"
  | "reconnecting";

type Handler = (type: string, payload: Record<string, unknown>) => void;
type StatusHandler = (status: RealtimeConnectionStatus) => void;

let socket: Socket | null = null;
let lastRole: string | undefined;
const handlers = new Set<Handler>();
const statusHandlers = new Set<StatusHandler>();
/** Rooms the app explicitly joined (e.g. conversation:{id}) — re-joined on reconnect. */
const joinedRooms = new Set<string>();
let connectionStatus: RealtimeConnectionStatus = "disconnected";

function roleRooms(role: string | undefined): string[] {
  switch (role) {
    case "LAB_TECHNICIAN":
      return ["laboratory"];
    case "PHARMACIST":
      return ["pharmacy"];
    case "RADIOLOGIST":
      return ["radiology"];
    case "ACCOUNTANT":
    case "RECEPTIONIST":
      return ["billing"];
    case "NURSE":
      return ["ipd"];
    case "DOCTOR":
      return ["laboratory", "pharmacy", "radiology", "ipd"];
    case "ADMIN":
    case "SUPER_ADMIN":
      return ["laboratory", "pharmacy", "radiology", "billing", "ipd"];
    default:
      return [];
  }
}

function setStatus(status: RealtimeConnectionStatus) {
  if (connectionStatus === status) return;
  connectionStatus = status;
  for (const h of statusHandlers) h(status);
}

function rejoinTrackedRooms() {
  if (!socket?.connected) return;
  for (const room of roleRooms(lastRole)) {
    socket.emit("join", { room });
  }
  for (const room of joinedRooms) {
    socket.emit("join", { room });
  }
}

function ensureSocket(role?: string): Socket | null {
  if (role) lastRole = role;
  if (socket) return socket;

  const token = getAccessToken();
  if (!token) return null;

  socket = io(`${API_URL}/realtime`, {
    transports: ["websocket", "polling"],
    auth: { token },
    query: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });

  socket.on("connect", () => {
    setStatus("connected");
    rejoinTrackedRooms();
  });

  socket.on("disconnect", () => {
    setStatus("disconnected");
  });

  socket.io.on("reconnect_attempt", () => {
    setStatus("reconnecting");
  });

  socket.on("reconnect", () => {
    setStatus("connected");
    rejoinTrackedRooms();
  });

  socket.onAny((eventName: string, data: unknown) => {
    const envelope = (data ?? {}) as RealtimeEnvelope;
    const type =
      typeof envelope.type === "string" ? envelope.type : eventName;
    const payload =
      envelope.payload && typeof envelope.payload === "object"
        ? (envelope.payload as Record<string, unknown>)
        : typeof data === "object" && data
          ? (data as Record<string, unknown>)
          : {};
    for (const h of handlers) h(type, payload);
  });

  return socket;
}

export function getRealtimeSocket(): Socket | null {
  return socket;
}

export function getRealtimeConnectionStatus(): RealtimeConnectionStatus {
  return connectionStatus;
}

export function subscribeRealtimeStatus(handler: StatusHandler): () => void {
  statusHandlers.add(handler);
  handler(connectionStatus);
  return () => {
    statusHandlers.delete(handler);
  };
}

export function joinRealtimeRoom(room: string): void {
  const trimmed = room.trim();
  if (!trimmed) return;
  joinedRooms.add(trimmed);
  const s = ensureSocket(lastRole);
  if (s?.connected) s.emit("join", { room: trimmed });
}

export function leaveRealtimeRoom(room: string): void {
  const trimmed = room.trim();
  if (!trimmed) return;
  joinedRooms.delete(trimmed);
  if (socket?.connected) socket.emit("leave", { room: trimmed });
}

export function emitTyping(
  conversationId: string,
  state: "started" | "stopped",
): void {
  if (!socket?.connected || !conversationId) return;
  socket.emit("typing", { conversationId, state });
}

export function emitPresenceHeartbeat(): void {
  if (!socket?.connected) return;
  socket.emit("presence.heartbeat");
}

export function connectRealtime(opts: {
  role?: string;
  onEvent: Handler;
  onReconnect?: () => void;
  onStatus?: StatusHandler;
}): () => void {
  handlers.add(opts.onEvent);
  if (opts.onStatus) statusHandlers.add(opts.onStatus);

  const s = ensureSocket(opts.role);
  if (!s) {
    return () => {
      handlers.delete(opts.onEvent);
      if (opts.onStatus) statusHandlers.delete(opts.onStatus);
    };
  }

  if (s.connected) {
    for (const room of roleRooms(opts.role)) {
      s.emit("join", { room });
    }
  }

  const reconnectListener = () => opts.onReconnect?.();
  s.on("reconnect", reconnectListener);

  return () => {
    handlers.delete(opts.onEvent);
    if (opts.onStatus) statusHandlers.delete(opts.onStatus);
    s.off("reconnect", reconnectListener);
    if (handlers.size === 0 && socket) {
      socket.disconnect();
      socket = null;
      joinedRooms.clear();
      setStatus("disconnected");
    }
  };
}
