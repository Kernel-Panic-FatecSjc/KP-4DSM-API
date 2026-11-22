// Matchers do DOM (toBeInTheDocument, toHaveTextContent, toBeDisabled...).
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Sem os globals do Vitest a Testing Library não desmonta sozinha entre os testes.
afterEach(() => {
  cleanup();
});
