import {
  Archive,
  Ban,
  BadgeCheck,
  CircleAlert,
  CircleCheck,
  CircleDot,
  CircleX,
  Clock,
  Eye,
  FileText,
  Hourglass,
  Loader,
  Lock,
  MailCheck,
  MailWarning,
  MailX,
  Send,
  ShieldAlert,
  Star,
  TriangleAlert
} from 'lucide-react';

/*
| Status presentation per module. Every module keeps its own lifecycle,
| so the same word can be styled differently where it means something
| different (e.g. "Draft" vehicle vs "Draft" response).
*/

const tones = {
  success: 'success',
  info: 'info',
  warning: 'warning',
  danger: 'danger',
  neutral: 'neutral',
  accent: 'accent',
  muted: 'muted',
  orange: 'orange'
};

const MAPS = {
  vehicle: {
    Draft: [tones.neutral, FileText, 'Draft — not visible to customers'],
    Available: [tones.success, CircleCheck, 'Available — visible on the website'],
    Sold: [tones.accent, BadgeCheck, 'Sold'],
    Archived: [tones.muted, Archive, 'Archived — hidden and kept for records']
  },
  enquiry: {
    New: [tones.info, CircleDot, 'New enquiry awaiting review'],
    'In Progress': [tones.warning, Loader, 'Being handled by the team'],
    Responded: [tones.success, MailCheck, 'A reply has been sent'],
    Archived: [tones.muted, Archive, 'Archived']
  },
  response: {
    Draft: [tones.neutral, FileText, 'Draft — not sent yet'],
    Sent: [tones.success, Send, 'Accepted by the mail server']
  },
  booking: {
    Pending: [tones.warning, Hourglass, 'Waiting for confirmation'],
    Confirmed: [tones.info, CircleCheck, 'Appointment confirmed'],
    Completed: [tones.success, BadgeCheck, 'Test drive completed'],
    Cancelled: [tones.danger, CircleX, 'Cancelled']
  },
  complaint: {
    Submitted: [tones.info, CircleDot, 'Received, awaiting review'],
    'Under Review': [tones.warning, Eye, 'Being reviewed by the team'],
    'In Progress': [tones.accent, Loader, 'Action is being taken'],
    Resolved: [tones.success, CircleCheck, 'Resolved — awaiting your confirmation'],
    Closed: [tones.muted, Lock, 'Closed']
  },
  priority: {
    Low: [tones.muted, CircleDot, 'Low priority'],
    Medium: [tones.info, CircleAlert, 'Medium priority'],
    High: [tones.warning, TriangleAlert, 'High priority'],
    Urgent: [tones.danger, ShieldAlert, 'Urgent']
  },
  email: {
    Queued: [tones.neutral, Clock, 'Queued for sending'],
    Sending: [tones.info, Loader, 'Sending now'],
    Accepted: [tones.success, MailCheck, 'Accepted by the mail server'],
    Failed: [tones.danger, MailX, 'Sending failed'],
    Preview: [tones.warning, MailWarning, 'Not sent — SMTP is not configured']
  },
  inbound: {
    Matched: [tones.success, CircleCheck, 'Added to the matching record'],
    Unmatched: [tones.warning, CircleAlert, 'No matching record'],
    Rejected: [tones.danger, Ban, 'Sender did not match the record owner']
  },
  account: {
    Active: [tones.success, CircleCheck, 'Account active'],
    Inactive: [tones.muted, Ban, 'Account deactivated'],
    Locked: [tones.danger, Lock, 'Locked after too many wrong passwords'],
    'Password change needed': [tones.warning, TriangleAlert, 'Temporary password not changed yet']
  },
  // Ahamed – Staff Permissions cards: account status beside the name
  staff: {
    Active: [tones.success, CircleCheck, 'Account active – can sign in'],
    Inactive: [tones.danger, Ban, 'Deactivated by an Admin – cannot sign in'],
    Locked: [tones.orange, Lock, 'Locked for 15 minutes after 5 wrong passwords'],
    'Password change needed': [tones.warning, TriangleAlert, 'Has not changed the temporary password yet']
  },
  session: {
    Active: [tones.success, CircleCheck, 'Signed in'],
    Revoked: [tones.danger, Ban, 'Ended by a revoke, password change or deactivation'],
    'Logged out': [tones.muted, Archive, 'The user logged out'],
    Expired: [tones.muted, Clock, 'Expired']
  },
  content: {
    Published: [tones.success, CircleCheck, 'Visible on the website'],
    Draft: [tones.neutral, FileText, 'Hidden draft']
  },
  finance: {
    Active: [tones.success, Star, 'Used by the calculator'],
    Inactive: [tones.muted, CircleDot, 'Not in use']
  },
  // Herathge – Finance Applications
  application: {
    Submitted: [tones.info, CircleDot, 'Received, waiting for review'],
    'Under Review': [tones.warning, Eye, 'Being reviewed by High Street'],
    'Approved in Principle': [tones.success, BadgeCheck, 'Approved in principle — not a final loan offer'],
    Declined: [tones.danger, CircleX, 'Not taken forward'],
    Withdrawn: [tones.muted, Archive, 'Withdrawn by the customer']
  },
  // Naaziq – Reply Templates
  template: {
    Active: [tones.success, CircleCheck, 'Available to insert into replies'],
    Inactive: [tones.muted, Ban, 'Hidden from the template picker']
  }
};

const GENERIC = {
  Active: MAPS.account.Active,
  Inactive: MAPS.account.Inactive,
  Pending: MAPS.booking.Pending,
  Approved: [tones.success, CircleCheck, 'Approved'],
  Rejected: [tones.danger, CircleX, 'Rejected'],
  Completed: MAPS.booking.Completed,
  Cancelled: MAPS.booking.Cancelled,
  Processing: [tones.info, Loader, 'Processing'],
  Failed: MAPS.email.Failed
};

export function statusTone(status, kind) {
  return (MAPS[kind]?.[status] || GENERIC[status] || [tones.neutral])[0];
}

export default function StatusBadge({ status, kind, size = 'md', showIcon = true, title }) {
  if (!status) {
    return null;
  }

  const [tone, Icon, description] = MAPS[kind]?.[status] || GENERIC[status] || [tones.neutral, CircleDot, status];

  return (
    <span
      className={`status-badge status-badge--${tone} status-badge--${size}`}
      title={title || description}
    >
      {showIcon && Icon && <Icon aria-hidden="true" />}
      <span>{status}</span>
    </span>
  );
}
