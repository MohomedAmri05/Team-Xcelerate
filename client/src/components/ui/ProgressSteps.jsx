import { Check, X } from 'lucide-react';

/*
| Step indicator that reflects the real status of a record. Terminal
| "off-path" states (Cancelled, Archived) are shown as a stopped flow
| rather than as a fake percentage.
*/

const FLOWS = {
  complaint: {
    steps: ['Submitted', 'Under Review', 'In Progress', 'Resolved', 'Closed'],
    stopped: {}
  },
  booking: {
    steps: ['Pending', 'Confirmed', 'Completed'],
    stopped: {
      Cancelled: 'Cancelled'
    }
  },
  enquiry: {
    steps: ['New', 'In Progress', 'Responded'],
    stopped: {
      Archived: 'Archived'
    }
  },
  vehicle: {
    steps: ['Draft', 'Available', 'Sold'],
    stopped: {
      Archived: 'Archived'
    }
  },
  // Herathge – Finance Applications
  application: {
    steps: ['Submitted', 'Under Review', 'Approved in Principle'],
    stopped: {
      Declined: 'Declined',
      Withdrawn: 'Withdrawn'
    }
  }
};

export default function ProgressSteps({ kind, status, compact = false, stoppedAt = null }) {
  const flow = FLOWS[kind];

  if (!flow || !status) {
    return null;
  }

  const stopped = flow.stopped[status];
  // For a stopped flow, show progress up to where it stopped (if known).
  const currentIndex = stopped
    ? Math.max(flow.steps.indexOf(stoppedAt || flow.steps[0]), 0)
    : flow.steps.indexOf(status);

  const percent = stopped
    ? 0
    : Math.round((currentIndex / (flow.steps.length - 1)) * 100);

  return (
    <div
      className={`progress-steps ${compact ? 'progress-steps--compact' : ''} ${stopped ? 'progress-steps--stopped' : ''}`}
      role="group"
      aria-label={`${kind} progress: ${status}`}
    >
      <div className="progress-steps__track" aria-hidden="true">
        <span
          className="progress-steps__fill"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ol>
        {flow.steps.map((step, index) => {
          const done = !stopped && index < currentIndex;
          const current = !stopped && index === currentIndex;

          return (
            <li
              key={step}
              className={[
                'progress-steps__step',
                done ? 'is-done' : '',
                current ? 'is-current' : ''
              ].join(' ')}
              aria-current={current ? 'step' : undefined}
            >
              <span className="progress-steps__dot">
                {done || (current && index === flow.steps.length - 1) ? <Check /> : index + 1}
              </span>
              {!compact && <span className="progress-steps__label">{step}</span>}
            </li>
          );
        })}
      </ol>

      {stopped && (
        <p className="progress-steps__stopped">
          <X aria-hidden="true" />
          {stopped}
        </p>
      )}

      {compact && !stopped && (
        <p className="progress-steps__caption">
          Step {currentIndex + 1} of {flow.steps.length}: {status}
        </p>
      )}
    </div>
  );
}
