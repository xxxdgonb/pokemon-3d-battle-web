export interface ShowdownProtocolMessage {
  readonly type: string;
  readonly args: readonly string[];
  readonly raw: string;
}

export function parseShowdownLine(line: string): ShowdownProtocolMessage | null {
  const raw = line.trimEnd();
  if (!raw.startsWith("|")) return null;

  const parts = raw.slice(1).split("|");
  const [type, ...args] = parts;
  if (!type) return null;

  return { type, args, raw };
}

export function parseShowdownBlock(block: string): readonly ShowdownProtocolMessage[] {
  const messages: ShowdownProtocolMessage[] = [];
  let lastRaw: string | null = null;
  for (const line of block.split(/\n+/)) {
    const message = parseShowdownLine(line);
    if (!message || message.raw === lastRaw) continue;
    messages.push(message);
    lastRaw = message.raw;
  }
  return messages;
}

export function encodeChoice(moveId: string): string {
  if (!/^[a-z0-9-]+$/i.test(moveId)) {
    throw new Error(`Invalid move identifier: ${moveId}`);
  }
  return `move ${moveId}`;
}
