import TcpSocket from "react-native-tcp-socket";

export type RawProbeResult = "connected" | "timeout" | "refused" | "error";
export type LpdProbeResult = RawProbeResult | "rejected";

/** Checks JetDirect with a real TCP connection without sending document data. */
export function probeRawPort(ip: string, port = 9100, timeoutMs = 4000): Promise<RawProbeResult> {
  return new Promise((resolve) => {
    let settled = false;
    let socket: ReturnType<typeof TcpSocket.createConnection> | null = null;
    const finish = (result: RawProbeResult) => {
      if (settled) return;
      settled = true;
      if (socket && !socket.destroyed) socket.destroy();
      resolve(result);
    };
    const timer = setTimeout(() => finish("timeout"), timeoutMs);
    try {
      socket = TcpSocket.createConnection({ host: ip, port, interface: "wifi", reuseAddress: true, connectTimeout: timeoutMs }, () => {
        clearTimeout(timer);
        finish("connected");
      });
      socket.on("error", (error: Error & { code?: string }) => {
        clearTimeout(timer);
        finish(error.code === "ECONNREFUSED" ? "refused" : "error");
      });
      socket.on("timeout", () => { clearTimeout(timer); finish("timeout"); });
    } catch {
      clearTimeout(timer);
      finish("error");
    }
  });
}

/** Performs the harmless first LPD handshake for a queue without sending a print file. */
export function probeLpd(ip: string, queue = "lp", timeoutMs = 5000): Promise<LpdProbeResult> {
  return new Promise((resolve) => {
    let settled = false;
    let socket: ReturnType<typeof TcpSocket.createConnection> | null = null;
    const finish = (result: LpdProbeResult) => {
      if (settled) return;
      settled = true;
      if (socket && !socket.destroyed) socket.destroy();
      resolve(result);
    };
    const timer = setTimeout(() => finish("timeout"), timeoutMs);
    try {
      socket = TcpSocket.createConnection({ host: ip, port: 515, interface: "wifi", reuseAddress: true, connectTimeout: timeoutMs }, () => {
        // RFC 1179: request a receive-print-job session without sending a file.
        socket?.write(`\x02${queue}\n`);
      });
      socket.on("data", (data: string | Uint8Array) => {
        clearTimeout(timer);
        const firstByte = typeof data === "string" ? data.charCodeAt(0) : data[0];
        finish(firstByte === 0 ? "connected" : "rejected");
      });
      socket.on("error", (error: Error & { code?: string }) => {
        clearTimeout(timer);
        finish(error.code === "ECONNREFUSED" ? "refused" : "error");
      });
      socket.on("timeout", () => { clearTimeout(timer); finish("timeout"); });
    } catch {
      clearTimeout(timer);
      finish("error");
    }
  });
}
