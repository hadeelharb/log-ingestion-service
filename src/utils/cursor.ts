export interface CursorData {
  timestamp: string;
  id: string;
}

export function encodeCursor(data: CursorData): string {
  return Buffer.from(
    JSON.stringify(data),
    "utf8",
  ).toString("base64url");
}

export function decodeCursor(cursor: string): CursorData {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString(
      "utf8",
    );

    const parsed = JSON.parse(decoded);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.timestamp !== "string" ||
      typeof parsed.id !== "string"
    ) {
      throw new Error("Invalid cursor");
    }

    const timestamp = new Date(parsed.timestamp);

    if (Number.isNaN(timestamp.getTime())) {
      throw new Error("Invalid cursor timestamp");
    }

    return {
      timestamp: timestamp.toISOString(),
      id: parsed.id,
    };
  } catch {
    throw new Error("Invalid cursor");
  }
}