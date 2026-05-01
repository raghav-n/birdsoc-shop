import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Events from '../Events';

const mocks = vi.hoisted(() => ({
  getEvents: vi.fn(),
  getPastEvents: vi.fn(),
}));

vi.mock('../../services/misc', () => ({
  eventService: {
    getEvents: (...args) => mocks.getEvents(...args),
    getPastEvents: (...args) => mocks.getPastEvents(...args),
  },
}));

vi.mock('../../components/Loading', () => ({
  default: ({ text }) => <div>{text}</div>,
}));

vi.mock('../../components/Alert', () => ({
  default: ({ children }) => <div role="alert">{children}</div>,
}));

vi.mock('../../components/BannerGrid', () => ({
  default: () => null,
}));

vi.mock('../../styles/GlobalStyles', () => ({
  Card: ({ children, ...props }) => <div {...props}>{children}</div>,
  Badge: ({ children, ...props }) => <span {...props}>{children}</span>,
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

const renderEvents = () =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Events />
    </MemoryRouter>
  );

const sampleEvent = {
  id: 1,
  title: 'Garden Walk',
  description: 'A lovely stroll through the gardens.',
  start_date: '2026-06-01T09:00:00Z',
  end_date: null,
  location: 'Botanic Gardens',
  price_incl_tax: '0.00',
  participant_count: 5,
  max_participants: 50,
  is_full: false,
  registration_required: true,
  image_url: null,
};

describe('Events', () => {
  beforeEach(() => {
    mocks.getEvents.mockReset();
    mocks.getPastEvents.mockReset();
    mocks.getPastEvents.mockResolvedValue([]);
  });

  it('shows a loading indicator while fetching', () => {
    mocks.getEvents.mockReturnValue(new Promise(() => {}));
    renderEvents();
    expect(screen.getByText('Loading events...')).toBeInTheDocument();
  });

  it('shows an error message when the fetch fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.getEvents.mockRejectedValue(new Error('network error'));
    renderEvents();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to load events. Please try again later.'
    );
    consoleError.mockRestore();
  });

  it('shows an empty state when there are no events', async () => {
    mocks.getEvents.mockResolvedValue([]);
    renderEvents();
    expect(await screen.findByText('No upcoming events')).toBeInTheDocument();
  });

  it('renders event cards with title, location, and price', async () => {
    mocks.getEvents.mockResolvedValue([sampleEvent]);
    renderEvents();
    expect(await screen.findByText('Garden Walk')).toBeInTheDocument();
    expect(screen.getByText('Botanic Gardens')).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  it('shows a paid price for non-free events', async () => {
    mocks.getEvents.mockResolvedValue([{ ...sampleEvent, price_incl_tax: '15.00' }]);
    renderEvents();
    await screen.findByText('Garden Walk');
    expect(screen.getByText((content) => content.includes('15.00'))).toBeInTheDocument();
  });

  it('shows a "Full" badge and "View Details" button for full events', async () => {
    mocks.getEvents.mockResolvedValue([{ ...sampleEvent, is_full: true }]);
    renderEvents();
    await screen.findByText('Garden Walk');
    expect(screen.getByText('Full')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Details' })).toBeInTheDocument();
  });

  it('shows "Register" button for open events', async () => {
    mocks.getEvents.mockResolvedValue([sampleEvent]);
    renderEvents();
    await screen.findByText('Garden Walk');
    expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();
  });

  it('shows remaining spots when event is not full', async () => {
    mocks.getEvents.mockResolvedValue([{ ...sampleEvent, max_participants: 20, participant_count: 15 }]);
    renderEvents();
    await screen.findByText('Garden Walk');
    expect(screen.getByText(/5 spots? left/)).toBeInTheDocument();
  });
});
