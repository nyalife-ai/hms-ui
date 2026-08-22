/**
 * Authenticated Socket.IO client for /realtime.
 * On reconnect, callers should re-sync from the notifications API.
 */

import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "./api";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:4000";

export type RealtimeEnvelope = {
  type?: string;
  payload?: Record<string, unknown>;
  eventId?: string;
};

type Handler = (type: string, payload: Record<string, unknown>) => void;

let socket: Socket | null = null;
const handlers = new Set<Handler>();

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

export function connectRealtime(opts: {
  role?: string;
  onEvent: Handler;
  onReconnect?: () => void;
}): () => void {
  handlers.add(opts.onEvent);

  if (!socket) {
    const token = getAccessToken();
    if (!token) {
      return () => {
        handlers.delete(opts.onEvent);
      };
    }

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
      for (const room of roleRooms(opts.role)) {
        socket?.emit("join", { room });
      }
    });

    socket.on("reconnect", () => {
      for (const room of roleRooms(opts.role)) {
        socket?.emit("join", { room });
      }
      // Notify all subscribers to re-sync from API (WS is not durable).
      for (const h of handlers) {
        // empty type signals sync request via onReconnect only
      }
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
  } else if (socket.connected) {
    for (const room of roleRooms(opts.role)) {
      socket.emit("join", { room });
    }
  }

  const reconnectListener = () => opts.onReconnect?.();
  socket.on("reconnect", reconnectListener);

  return () => {
    handlers.delete(opts.onEvent);
    socket?.off("reconnect", reconnectListener);
    if (handlers.size === 0 && socket) {
      socket.disconnect();
      socket = null;
    }
  };
}
