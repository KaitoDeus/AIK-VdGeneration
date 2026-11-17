import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

if (typeof window !== 'undefined') {
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();

  const createUrlMock = vi.fn(() => 'blob:http://localhost:3000/mock-media');
  const revokeUrlMock = vi.fn();
  Object.defineProperty(window.URL, 'createObjectURL', {
    writable: true,
    configurable: true,
    value: createUrlMock,
  });
  Object.defineProperty(window.URL, 'revokeObjectURL', {
    writable: true,
    configurable: true,
    value: revokeUrlMock,
  });
  if (globalThis.URL !== window.URL) {
    Object.defineProperty(globalThis.URL, 'createObjectURL', {
      writable: true,
      configurable: true,
      value: createUrlMock,
    });
    Object.defineProperty(globalThis.URL, 'revokeObjectURL', {
      writable: true,
      configurable: true,
      value: revokeUrlMock,
    });
  }
}
