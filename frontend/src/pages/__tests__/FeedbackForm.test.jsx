import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import FeedbackForm from '../FeedbackForm';

const mocks = vi.hoisted(() => ({
  getForm: vi.fn(),
  submit: vi.fn(),
}));

vi.mock('../../services/forms', () => ({
  formService: {
    getForm: (...args) => mocks.getForm(...args),
    submit: (...args) => mocks.submit(...args),
  },
}));

vi.mock('../../components/Loading', () => ({
  default: ({ text }) => <div>{text}</div>,
}));

const FORM = {
  slug: 'obd-feedback',
  name: 'October Big Day feedback',
  description: 'Tell us how it went.',
  accept_submissions: true,
  allow_anonymous: true,
  success_message: 'Thanks!',
  fields: [
    { key: 'overall', label: 'Overall rating', type: 'rating', required: true, display: true },
    { key: 'recommend', label: 'Recommend?', type: 'scale', required: false, display: true },
    { key: 'again', label: 'Join again?', type: 'select', required: false, display: true, choices: ['Yes', 'No'] },
    { key: 'comments', label: 'Comments', type: 'textarea', required: false, display: true },
  ],
  respondent: null,
  existing_response: null,
};

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/forms/:slug" element={<FeedbackForm />} />
        <Route path="/forms/:slug/:token" element={<FeedbackForm />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('FeedbackForm', () => {
  beforeEach(() => {
    mocks.getForm.mockReset();
    mocks.submit.mockReset();
    window.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('blocks submit until required rating is answered, then submits answers', async () => {
    mocks.getForm.mockResolvedValue(FORM);
    mocks.submit.mockResolvedValue({ message: 'Thanks!' });
    renderAt('/forms/obd-feedback');

    expect(await screen.findByText('October Big Day feedback')).toBeInTheDocument();
    expect(mocks.getForm).toHaveBeenCalledWith('obd-feedback', undefined);
    // Only optional questions are marked.
    expect(screen.getAllByText('(optional)')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Please answer this question.')).toBeInTheDocument();
    expect(mocks.submit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('radio', { name: '4 stars' }));
    fireEvent.click(screen.getByRole('radio', { name: '9' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Great guides' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(mocks.submit).toHaveBeenCalledWith('obd-feedback', undefined, {
      overall: 4, recommend: 9, again: 'Yes', comments: 'Great guides',
    }));
    expect(await screen.findByText('Thank you')).toBeInTheDocument();
  });

  it('greets personal-link respondents and prefills their previous answers', async () => {
    mocks.getForm.mockResolvedValue({
      ...FORM,
      respondent: { first_name: 'Alice', event: 'Site A' },
      existing_response: { data: { overall: 5, comments: 'Lovely' } },
    });
    renderAt('/forms/obd-feedback/tok-123');

    expect(await screen.findByText(/Hi Alice, thanks for joining us at Site A/)).toBeInTheDocument();
    expect(mocks.getForm).toHaveBeenCalledWith('obd-feedback', 'tok-123');
    expect(screen.getByRole('textbox')).toHaveValue('Lovely');
    expect(screen.getByRole('radio', { name: '5 stars' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Update my response' })).toBeInTheDocument();
  });

  it('preselects the respondent site in a site dropdown', async () => {
    mocks.getForm.mockResolvedValue({
      ...FORM,
      fields: [{ key: 'site', label: 'Which site?', type: 'select', required: true, display: true, choices: ['Bidadari Park', 'Fort Canning Park'] }, ...FORM.fields],
      respondent: { first_name: 'Alice', event: 'October Big Day 2026: Fort Canning Park' },
    });
    renderAt('/forms/obd-feedback/tok-123');
    expect(await screen.findByRole('radio', { name: 'Fort Canning Park' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Bidadari Park' })).toHaveAttribute('aria-checked', 'false');
  });

  it('shows server-side field errors', async () => {
    mocks.getForm.mockResolvedValue(FORM);
    mocks.submit.mockRejectedValue({ response: { data: { errors: { overall: 'Choose a value from 1 to 5.' } } } });
    renderAt('/forms/obd-feedback');
    fireEvent.click(await screen.findByRole('radio', { name: '3 stars' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Choose a value from 1 to 5.')).toBeInTheDocument();
  });

  it('asks for the personal link when anonymous responses are off', async () => {
    mocks.getForm.mockResolvedValue({ ...FORM, allow_anonymous: false });
    renderAt('/forms/obd-feedback');
    expect(await screen.findByText(/use the personal link from your email/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();
  });

  it('explains an invalid personal link', async () => {
    mocks.getForm.mockRejectedValue({ response: { status: 404 } });
    renderAt('/forms/obd-feedback/bad');
    expect(await screen.findByText(/feedback link isn't valid/)).toBeInTheDocument();
  });
});
