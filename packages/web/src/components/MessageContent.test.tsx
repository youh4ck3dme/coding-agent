import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MessageContent } from './MessageContent';

describe('MessageContent', () => {
  it('renders sanitized plain text', () => {
    render(<MessageContent content={'Hello<script>alert(1)</script> world'} />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });
});