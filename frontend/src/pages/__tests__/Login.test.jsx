import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Login from '../Login';

const authState = vi.hoisted(() => ({
  login: vi.fn(),
  user: null,
}));

const redirectMocks = vi.hoisted(() => ({
  redirectToPath: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('../../utils/authRedirect', async () => {
  const actual = await vi.importActual('../../utils/authRedirect');
  return {
    ...actual,
    redirectToPath: (...args) => redirectMocks.redirectToPath(...args),
  };
});

const renderLogin = (initialEntry = '/login') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/" element={<div>Home page</div>} />
        <Route path="/login" element={<Login />} />
        <Route path="/console" element={<div>Console page</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('Login', () => {
  beforeEach(() => {
    authState.login.mockReset();
    authState.user = null;
    redirectMocks.redirectToPath.mockReset();
  });

  it('redirects to the requested next path after a successful login', async () => {
    authState.login.mockResolvedValue({ success: true });

    renderLogin('/login?next=%2Fconsole');

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'staff@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(authState.login).toHaveBeenCalledWith('staff@example.com', 'password123');
      expect(redirectMocks.redirectToPath).toHaveBeenCalledWith('/console', { replace: true });
    });
  });

  it('falls back to home for unsafe next paths', async () => {
    authState.login.mockResolvedValue({ success: true });

    renderLogin('/login?next=https%3A%2F%2Fevil.example');

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'staff@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(redirectMocks.redirectToPath).toHaveBeenCalledWith('/', { replace: true });
    });
  });
});
