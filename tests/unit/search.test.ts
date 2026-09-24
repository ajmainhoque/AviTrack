import { expect, it } from "vitest";
import { classifyIdentity } from "../../src/lib/search/classify";
it("recognizes alphabetic registrations, all-letter hex addresses, IATA flight numbers and type codes", () => {
  expect(classifyIdentity("G-XWBA")).toBe("registration");
  expect(classifyIdentity("N123AB")).toBe("registration");
  expect(classifyIdentity("ABCDEF")).toBe("hex");
  expect(classifyIdentity("~ABCDEF")).toBe("hex");
  expect(classifyIdentity("BA117")).toBe("callsign");
  expect(classifyIdentity("BAW117")).toBe("callsign");
  expect(classifyIdentity("A320")).toBe("type");
  expect(classifyIdentity("London")).toBeNull();
  expect(classifyIdentity("../../secret")).toBeNull();
});
