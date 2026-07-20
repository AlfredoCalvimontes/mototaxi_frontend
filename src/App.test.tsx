import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import App from '@/App';

test('renderiza el panel', () => {
  render(<App />);
  expect(screen.getByText(/Panel Mototaxis/i)).toBeInTheDocument();
});
