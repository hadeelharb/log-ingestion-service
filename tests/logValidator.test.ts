import { describe, it, expect } from "vitest";
import { validateLog } from "../src/validators/logValidator.js";

describe("validateLog", () => {
  it("accepts a valid log", () => {
    const result = validateLog({
      timestamp: "2026-08-03T12:00:00Z",
      level: "info",
      service: "auth",
      message: "Login successful",
    });

    expect(result).toBeNull();
  });

  it("rejects an invalid level", () => {
    const result = validateLog({
      timestamp: "2026-08-03T12:00:00Z",
      level: "critical",
      service: "auth",
      message: "Test",
    });

    expect(result).toContain("invalid level");
  });

  it("requires a timestamp", () => {
    const result = validateLog({
      timestamp: "",
      level: "info",
      service: "auth",
      message: "Test",
    });

    expect(result).toBe("timestamp is required");
  });

  it("requires a service", () => {
    const result = validateLog({
      timestamp: "2026-08-03T12:00:00Z",
      level: "info",
      service: "",
      message: "Test",
    });

    expect(result).toBe("service is required");
  });

  it("requires a message", () => {
    const result = validateLog({
      timestamp: "2026-08-03T12:00:00Z",
      level: "info",
      service: "auth",
      message: "",
    });

    expect(result).toBe("message is required");
  });
});