"use client";
export async function workerMessage<T = { ok: boolean }>(
  message: unknown,
): Promise<T> {
  if (!("serviceWorker" in navigator))
    throw new Error("Offline reading is not supported in this browser.");
  const r = await navigator.serviceWorker.ready;
  const worker = navigator.serviceWorker.controller || r.active;
  if (!worker)
    throw new Error("Offline reading is still preparing. Try again shortly.");
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => {
      channel.port1.close();
      reject(
        new Error(
          "Offline storage did not respond. Try again while connected.",
        ),
      );
    }, 15000);
    channel.port1.onmessage = (e) => {
      clearTimeout(timeout);
      channel.port1.close();
      resolve(e.data);
    };
    worker.postMessage(message, [channel.port2]);
  });
}
