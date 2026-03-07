import { render, screen } from '@testing-library/react';
import App from './App';

test('renders IMSDesign header', () => {
  render(<App />);
  expect(screen.getByText(/IMS Design Pro 3\.0/i)).toBeInTheDocument();
});
