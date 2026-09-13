// Vitest 전역 셋업 — jest-dom 매처 등록 + 테스트 후 DOM 정리.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
