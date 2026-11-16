import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GuideEventDetail from '../GuideEventDetail';

const mocks = vi.hoisted(() => ({ getEvent: vi.fn() }));

vi.mock('../../services/consoleEvents', () => ({
  guideService: {
    getEvent: (...args) => mocks.getEvent(...args),
    toggleAttendance: vi.fn(),
    updateNotes: vi.fn(),
    toggleCheckpoint: vi.fn(),
  },
}));

const booking = (id, first, last, attended) => ({
  ep_id: id, first_name: first, last_name: last, email: `${first.toLowerCase()}@x.com`,
  phone_number: '', quantity: 1, is_confirmed: true, is_cancelled: false, is_waitlisted: false,
  attended, notes: '', checkpoints: [],
});

const event = () => ({
  title: 'Walk',
  start_date: '2026-10-11T07:00:00+08:00',
  json_schema: null,
  bookings: [
    booking(1, 'Cara', 'Lim', true),
    booking(2, 'Abe', 'Tan', false),
    booking(3, 'Bea', 'Ong', false),
  ],
});

const renderPage = async () => {
  mocks.getEvent.mockResolvedValue(event());
  render(
    <MemoryRouter initialEntries={['/guide/tok']}>
      <Routes><Route path="/guide/:token" element={<GuideEventDetail />} /></Routes>
    </MemoryRouter>
  );
  await screen.findByText('Cara Lim');
};

// Participant names in row order (skips the header row).
const names = () => screen.getAllByRole('row').slice(1)
  .map(r => within(r).queryByText(/^(Cara Lim|Abe Tan|Bea Ong)$/)?.textContent);

describe('GuideEventDetail sorting', () => {
  it('keeps server order until a header is clicked, then sorts name A–Z, Z–A and back', async () => {
    await renderPage();
    expect(names()).toEqual(['Cara Lim', 'Abe Tan', 'Bea Ong']);
    const nameBtn = screen.getByRole('button', { name: /^Name/ });
    fireEvent.click(nameBtn);
    expect(names()).toEqual(['Abe Tan', 'Bea Ong', 'Cara Lim']);
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(nameBtn);
    expect(names()).toEqual(['Cara Lim', 'Bea Ong', 'Abe Tan']);
    fireEvent.click(nameBtn);
    expect(names()).toEqual(['Cara Lim', 'Abe Tan', 'Bea Ong']);
  });

  it('sorts unmarked first, then marked first', async () => {
    await renderPage();
    const btn = screen.getByRole('button', { name: /^Attended/ });
    fireEvent.click(btn);
    expect(names()).toEqual(['Abe Tan', 'Bea Ong', 'Cara Lim']);
    fireEvent.click(btn);
    expect(names()[0]).toBe('Cara Lim');
  });

  it('applies sorting to search results', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: /^Name/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Name/ }));
    // "e" matches Abe and Bea (name/email) but not Cara; server order is Abe, Bea.
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'e' } });
    expect(names()).toEqual(['Bea Ong', 'Abe Tan']);
  });
});
