import { config } from "dotenv";
import { vi } from "vitest";

config({ path: ".env.local" });

// Mock server-only module for tests
// In production (Next.js), the bundler uses the "react-server" export condition
// which resolves to empty.js. In vitest, we need to mock it to avoid the error.
vi.mock("server-only", () => ({}));
