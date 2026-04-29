import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EventDetail from '../EventDetail';

const mocks = vi.hoisted(() => ({
  getEvent: vi.fn(),
  registerForEvent: vi.fn(),
  priceBreakdown: vi.fn(),
  checkEventPayNowEmail: vi.fn(),
  uploadEventProof: vi.fn(),
  user: null,
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('../../services/misc', () => ({
  eventService: {
    getEvent: (...args) => mocks.getEvent(...args),
    registerForEvent: (...args) => mocks.registerForEvent(...args),
    priceBreakdown: (...args) => mocks.priceBreakdown(...args),
    checkEventPayNowEmail: (...args) => mocks.checkEventPayNowEmail(...args),
    uploadEventProof: (...args) => mocks.uploadEventProof(...args),
  },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('../../components/Loading', () => ({
  default: ({ text }) => <div>{text}</div>,
}));

vi.mock('../../components/Alert', () => ({
  default: ({ children, variant }) => <div role="alert" data-variant={variant}>{children}</div>,
}));

vi.mock('../../components/PayNowQR', () => ({
  default: () => <div data-testid="paynow-qr" />,
}));

vi.mock('../../utils/toast.jsx', () => ({
  showToast: {
    success: (...args) => mocks.toastSuccess(...args),
    error: (...args) => mocks.toastError(...args),
  },
}));

const freeEvent = {
  id: 42,
  title: 'Free Birdwatching Walk',
  description: 'A relaxed morning stroll.',
  start_date: '2026-06-15T07:00:00Z',
  end_date: null,
  location: 'Sungei Buloh',
  price_incl_tax: '0.00',
  currency: 'SGD',
  participant_count: 3,
  max_participants: 30,
  is_active: true,
  is_full: false,
  registration_required: true,
  global_registration_closed: false,
  json_schema: null,
  price_tiers: null,
  max_qty: 5,
  image_url: null,
};

const paidEvent = {
  ...freeEvent,
  id: 43,
  title: 'Photography Workshop',
  price_incl_tax: '25.00',
};

const renderDetail = (id = '42') =>
  render(
    <MemoryRouter
      initialEntries={[`/events/${id}`]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/events/:id" element={<EventDetail />} />
      </Routes>
    </MemoryRouter>
  );

describe('EventDetail', () => {
  beforeEach(() => {
    mocks.getEvent.mockReset();
    mocks.registerForEvent.mockReset();
    mocks.priceBreakdown.mockReset();
    mocks.user = null;
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
    mocks.priceBreakdown.mockResolvedValue({
      totals: { amount: '0.00', donation: '0', amount_with_donation: '0.00' },
      items: [{ unit_price: '0.00', line_total: '0.00', quantity: 1, tier: null }],
      requires_payment: false,
    });
  });

  it('shows a loading indicator while fetching', () => {
    mocks.getEvent.mockReturnValue(new Promise(() => {}));
    renderDetail();
    expect(screen.getByText('Loading event…')).toBeInTheDocument();
  });

  it('shows an error when the event cannot be loaded', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.getEvent.mockRejectedValue(new Error('not found'));
    renderDetail();
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load event.');
    consoleError.mockRestore();
  });

  it('renders event title, location, and free price', async () => {
    mocks.getEvent.mockResolvedValue(freeEvent);
    renderDetail();
    expect(await screen.findByText('Free Birdwatching Walk')).toBeInTheDocument();
    expect(screen.getByText('Sungei Buloh')).toBeInTheDocument();
    expect(screen.getAllByText('Free').length).toBeGreaterThan(0);
  });

  it('renders paid price per person', async () => {
    mocks.getEvent.mockResolvedValue(paidEvent);
    renderDetail('43');
    await screen.findByText('Photography Workshop');
    expect(screen.getByText((c) => c.includes('25.00') && c.includes('per person'))).toBeInTheDocument();
  });

  it('shows registration-closed alert when global_registration_closed is true', async () => {
    mocks.getEvent.mockResolvedValue({ ...freeEvent, global_registration_closed: true });
    renderDetail();
    await screen.findByText('Free Birdwatching Walk');
    expect(screen.getByRole('alert')).toHaveTextContent('Registrations are temporarily closed');
  });

  it('shows full alert when event is full', async () => {
    mocks.getEvent.mockResolvedValue({ ...freeEvent, is_full: true });
    renderDetail();
    await screen.findByText('Free Birdwatching Walk');
    const alerts = screen.getAllByRole('alert');
    expect(alerts.some((a) => a.textContent.includes('full'))).toBe(true);
  });

  it('shows info-only message when registration_required is false', async () => {
    mocks.getEvent.mockResolvedValue({ ...freeEvent, registration_required: false });
    renderDetail();
    await screen.findByText('Free Birdwatching Walk');
    expect(screen.getByText(/No registration needed/i)).toBeInTheDocument();
  });

  it('validates required fields before proceeding to review', async () => {
    mocks.getEvent.mockResolvedValue(freeEvent);
    renderDetail();
    await screen.findByText('Free Birdwatching Walk');
    fireEvent.click(screen.getByRole('button', { name: 'Review →' }));
    // Required field errors should appear
    expect(screen.getAllByText('Required').length).toBeGreaterThan(0);
  });

  it('pre-fills form from auth user', async () => {
    mocks.user = { first_name: 'Alice', last_name: 'Lee', email: 'alice@example.com' };
    mocks.getEvent.mockResolvedValue(freeEvent);
    renderDetail();
    await screen.findByText('Free Birdwatching Walk');
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
    expect(screen.getByDisplayValue('alice@example.com')).toBeInTheDocument();
  });

  it('submits free registration and shows confirmation', async () => {
    mocks.getEvent.mockResolvedValue(freeEvent);
    mocks.registerForEvent.mockResolvedValue({
      confirmed: true,
      participant: { first_name: 'Alice', last_name: 'Lee', email: 'alice@example.com', quantity: 1 },
    });
    renderDetail();
    await screen.findByText('Free Birdwatching Walk');

    // Form inputs: first_name[0], last_name[1], email[2], phone[3]
    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[0], { target: { value: 'Alice' } });
    fireEvent.change(textboxes[1], { target: { value: 'Lee' } });
    fireEvent.change(textboxes[2], { target: { value: 'alice@example.com' } });
    fireEvent.change(textboxes[3], { target: { value: '+6591234567' } });

    // Agree to PDPA
    fireEvent.click(screen.getByRole('checkbox'));

    // Proceed to review
    fireEvent.click(screen.getByRole('button', { name: 'Review →' }));
    await screen.findByText('Confirm registration');

    // Submit
    fireEvent.click(screen.getByRole('button', { name: 'Confirm registration' }));

    await waitFor(() => {
      expect(mocks.registerForEvent).toHaveBeenCalledWith(
        '42',
        expect.objectContaining({ first_name: 'Alice', email: 'alice@example.com' })
      );
    });

    expect(mocks.toastSuccess).toHaveBeenCalledWith('Registration confirmed!');
  });

  it('shows toast error when registration fails', async () => {
    mocks.getEvent.mockResolvedValue(freeEvent);
    mocks.registerForEvent.mockRejectedValue({
      response: { data: { detail: 'Event is full.' } },
    });
    renderDetail();
    await screen.findByText('Free Birdwatching Walk');

    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[0], { target: { value: 'Bob' } });
    fireEvent.change(textboxes[1], { target: { value: 'Smith' } });
    fireEvent.change(textboxes[2], { target: { value: 'bob@example.com' } });
    fireEvent.change(textboxes[3], { target: { value: '+6591234567' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Review →' }));
    await screen.findByText('Confirm registration');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm registration' }));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith('Event is full.');
    });
  });
});
