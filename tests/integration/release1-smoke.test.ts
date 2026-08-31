/**
 * Environment-dependent smoke tests.
 * Execute only against a disposable staging project.
 *
 * Expected flow:
 * 1 client -> proposal -> revision -> send -> view -> accept -> project
 * 2 time/expense -> receipt
 * 3 additional service -> accept
 * 4 invoice -> issue -> PDF -> send -> payment
 */

describe("HASA Release 1 staging smoke", () => {
  test.todo("creates client/contact");
  test.todo("creates proposal revision with fee and travel estimates");
  test.todo("sends hash-tokenized proposal link");
  test.todo("accepts proposal and creates project exactly once");
  test.todo("records time and enforces one active timer");
  test.todo("records expense and private receipt attachment");
  test.todo("accepts additional service and increases authorized fee");
  test.todo("issues branded invoice with receipt appendix");
  test.todo("records partial and final payment");
});
import { describe, test } from "vitest";
