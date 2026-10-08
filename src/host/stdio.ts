// Chrome's native messaging format: each message is a 32-bit little-endian length followed by
// that many bytes of JSON, in both directions. stdout carries nothing else, so a stray
// console.log would corrupt the stream.

export function send(message: unknown): void {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length);
  process.stdout.write(Buffer.concat([header, body]));
}

// Calls onMessage for each whole message; chunks can split or merge messages.
export function readMessages(onMessage: (message: unknown) => void, onEnd: () => void): void {
  let buffer = Buffer.alloc(0);
  process.stdin.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 4) {
      const length = buffer.readUInt32LE(0);
      if (buffer.length < 4 + length) return;
      const body = buffer.subarray(4, 4 + length).toString("utf8");
      buffer = buffer.subarray(4 + length);
      try {
        onMessage(JSON.parse(body));
      } catch {
        // A message that isn't JSON is dropped; the connection stays up.
      }
    }
  });
  process.stdin.on("end", onEnd);
}
