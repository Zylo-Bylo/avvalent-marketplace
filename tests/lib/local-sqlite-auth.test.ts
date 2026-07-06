import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const database = {
    close: vi.fn(),
    prepare: vi.fn(() => ({
      get: vi.fn(() => undefined),
    })),
  };

  return {
    Database: vi.fn(function Database() {
      return database;
    }),
    database,
  };
});

vi.mock("better-sqlite3", () => ({
  default: mocks.Database,
}));

import { findLocalUserByEmail } from "@/lib/local-sqlite-auth";

describe("local sqlite auth", () => {
  it("opens the local database read-write so SQLite can clear rollback journals", () => {
    findLocalUserByEmail("missing-local-auth-user@example.invalid");

    expect(mocks.Database).toHaveBeenCalledWith("./dev.db", {
      fileMustExist: true,
    });
    expect(mocks.Database).not.toHaveBeenCalledWith(
      "./dev.db",
      expect.objectContaining({ readonly: true }),
    );
    expect(mocks.database.close).toHaveBeenCalled();
  });
});
