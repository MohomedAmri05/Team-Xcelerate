import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import StatusBadge from './StatusBadge';
import ProgressSteps from './ProgressSteps';
import { sortRows } from './DataControls';
import { parseContactBody, phoneHref, whatsappHref } from '../../hooks/useContactDetails';
import { fillTemplate } from '../../utils/templates';

describe('StatusBadge', () => {
  it('describes module-specific statuses', () => {
    render(<StatusBadge kind="complaint" status="Resolved" />);
    expect(screen.getByTitle(/awaiting your confirmation/i)).toBeInTheDocument();
  });
});

describe('ProgressSteps', () => {
  it('shows a stopped flow for cancelled bookings instead of fake progress', () => {
    const { container } = render(<ProgressSteps kind="booking" status="Cancelled" />);
    expect(container.textContent).toContain('Cancelled');
    expect(container.querySelectorAll('.is-done')).toHaveLength(0);
  });

  it('marks completed complaint steps from the real status', () => {
    const { container } = render(<ProgressSteps kind="complaint" status="In Progress" />);
    expect(container.querySelectorAll('.is-done')).toHaveLength(2);
  });
});

describe('helpers', () => {
  it('sorts numbers numerically with empty values last', () => {
    expect(sortRows([{ a: '10' }, { a: '9' }, { a: '' }], 'a:asc').map((row) => row.a)).toEqual(['9', '10', '']);
  });

  it('parses contact details without inventing values', () => {
    expect(parseContactBody('Kandy|+94 77|e@x.lk|Mon').phone).toBe('+94 77');
    expect(parseContactBody('not in the expected format')).toBeNull();
  });

  it('builds phone and WhatsApp links for Sri Lankan numbers', () => {
    expect(whatsappHref('0771234567')).toBe('https://wa.me/94771234567');
    expect(phoneHref('+94 77 1')).toBe('tel:+94771');
  });
});

// 16-CRUD completion (October 2026)
describe('finance applications and reply templates', () => {
  it('describes an approval in principle honestly', () => {
    render(<StatusBadge kind="application" status="Approved in Principle" />);
    expect(screen.getByTitle(/not a final loan offer/i)).toBeInTheDocument();
  });

  it('shows a declined application as a stopped flow', () => {
    const { container } = render(<ProgressSteps kind="application" status="Declined" />);
    expect(container.textContent).toContain('Declined');
    expect(container.querySelectorAll('.is-done')).toHaveLength(0);
  });

  it('fills only known template placeholders', () => {
    expect(fillTemplate('Hi {{customer_name}} {{unknown}}', { customer_name: 'Nimal' })).toBe('Hi Nimal {{unknown}}');
    expect(fillTemplate('Hi {{customer_name}}', {})).toBe('Hi {{customer_name}}');
  });
});

// October 2026 – Users, Sessions, Staff Permissions (Ahamed)
import { PasswordStrength, passwordStrength } from './PasswordInput';
import { formatDuration } from '../admin/SessionActivityDrawer';

describe('passwords, sessions and accounts', () => {
  it('uses the same password rules as the API and scores the strength', () => {
    expect(passwordStrength('').meetsRules).toBe(false);
    expect(passwordStrength('short1A').meetsRules).toBe(false);
    expect(passwordStrength('alllowercase123').meetsRules).toBe(false);
    expect(passwordStrength('Abcdefghi1').meetsRules).toBe(true);
    expect(passwordStrength('Abcdefghi1').label).toBe('Good');
    expect(passwordStrength('Abcdefghi1!').label).toBe('Strong');
  });

  it('lists which password rules are still missing', () => {
    const { container } = render(<PasswordStrength value="abc" />);
    expect(container.querySelectorAll('.password-strength__rules li')).toHaveLength(4);
    expect(container.querySelectorAll('.password-strength__rules li.ok')).toHaveLength(1);
    expect(screen.getByText('At least 10 characters')).toBeInTheDocument();
  });

  it('shows locked accounts and logged-out sessions with their own badges', () => {
    render(<StatusBadge kind="account" status="Locked" />);
    expect(screen.getByTitle(/too many wrong passwords/i)).toBeInTheDocument();
    render(<StatusBadge kind="session" status="Logged out" />);
    expect(screen.getByTitle(/The user logged out/i)).toBeInTheDocument();
  });

  it('formats session durations in plain words', () => {
    expect(formatDuration(20 * 1000)).toBe('less than a minute');
    expect(formatDuration(42 * 60 * 1000)).toBe('42 min');
    expect(formatDuration((2 * 60 + 14) * 60 * 1000)).toBe('2 h 14 min');
    expect(formatDuration((26 * 60) * 60 * 1000)).toBe('1 day 2 h');
  });
});
