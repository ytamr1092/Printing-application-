import TcpSocket from "react-native-tcp-socket";

/**
 * Sends printer-ready bytes over Kyocera/JetDirect RAW TCP (port 9100).
 * This is LAN-only by nature and does not require Android's system print UI,
 * an internet connection, or a computer TWAIN/WIA driver.
 */
export function sendRawPrintJob(
  ip: string,
  document: Uint8Array,
  port = 9100,
  timeoutMs = 30000,
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let socket: ReturnType<typeof TcpSocket.createConnection> | null = null;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (socket && !socket.destroyed) socket.destroy();
      resolve(ok);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);
    const complete = (ok: boolean) => {
      clearTimeout(timer);
      finish(ok);
    };

    try {
      socket = TcpSocket.createConnection(
        { host: ip, port, interface: "wifi", reuseAddress: true, connectTimeout: 8000 },
        () => {
          try {
            socket?.setNoDelay(true);
            socket?.end(document);
            // RAW printers usually acknowledge acceptance by closing the socket.
            // Give the native stream a short flush window when they keep it open.
            setTimeout(() => complete(true), 1200);
          } catch {
            complete(false);
          }
        },
      );
      socket.on("error", () => complete(false));
      socket.on("close", (hadError: boolean) => complete(!hadError));
      socket.on("timeout", () => complete(false));
    } catch {
      complete(false);
    }
  });
}
