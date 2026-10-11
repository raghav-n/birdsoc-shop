import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RichTextEditor from '../RichTextEditor';

describe('RichTextEditor tables', () => {
  it('hides table controls unless tables are enabled', () => {
    render(<RichTextEditor value="<p>Hi</p>" onChange={() => {}} />);
    expect(screen.queryByTitle('Insert table')).not.toBeInTheDocument();
  });

  it('inserts a table with a header row and shows row/column controls inside it', async () => {
    const onChange = vi.fn();
    render(<RichTextEditor value="<p>Hi</p>" onChange={onChange} tables />);
    fireEvent.mouseDown(screen.getByTitle('Insert table'));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const html = onChange.mock.calls.at(-1)[0];
    expect(html).toContain('<table');
    expect(html.match(/<th\b/g)).toHaveLength(3);
    expect(html.match(/<tr\b/g)).toHaveLength(3);
    expect(await screen.findByTitle('Add row below')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTitle('Add row below'));
    await waitFor(() => expect(onChange.mock.calls.at(-1)[0].match(/<tr\b/g)).toHaveLength(4));
  });
});
