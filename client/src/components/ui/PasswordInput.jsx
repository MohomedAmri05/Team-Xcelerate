import { Check, Eye, EyeOff, X } from 'lucide-react';
import { useId, useState } from 'react';

/*
|--------------------------------------------------------------------------
| VIVA-UI – M.R. Ahamed – password field with show/hide and a strength meter
|--------------------------------------------------------------------------
| Used on Register, Profile › Change password, the forced first-login
| change and Reset password. The rules shown are the same ones the API
| enforces (at least 10 characters, an uppercase letter, a lowercase letter
| and a number); a symbol and extra length only raise the strength score.
| Nothing typed here is stored or sent anywhere except with the form.
*/

export const PASSWORD_RULES = [
  { key: 'length', label: 'At least 10 characters', test: (value) => value.length >= 10 },
  { key: 'upper', label: 'An uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { key: 'lower', label: 'A lowercase letter', test: (value) => /[a-z]/.test(value) },
  { key: 'number', label: 'A number', test: (value) => /[0-9]/.test(value) }
];

const LEVELS = [
  { label: 'Too weak', tone: 'danger' },
  { label: 'Weak', tone: 'danger' },
  { label: 'Fair', tone: 'warning' },
  { label: 'Good', tone: 'info' },
  { label: 'Strong', tone: 'success' }
];

export function passwordStrength(value = '') {
  const text = String(value);

  if (!text) {
    return { score: 0, ...LEVELS[0], meetsRules: false };
  }

  const passed = PASSWORD_RULES.filter((rule) => rule.test(text)).length;
  const meetsRules = passed === PASSWORD_RULES.length;
  let score = Math.min(passed, 3);

  if (meetsRules) {
    score = 3;
    if (/[^A-Za-z0-9]/.test(text) || text.length >= 14) score = 4;
  }

  return { score, ...LEVELS[score], meetsRules };
}

export function PasswordStrength({ value = '', id }) {
  if (!value) {
    return null;
  }

  const strength = passwordStrength(value);

  return (
    <div className={`password-strength password-strength--${strength.tone}`} id={id} aria-live="polite">
      <div className="password-strength__bar" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span key={step} className={strength.score >= step ? 'on' : ''} />
        ))}
      </div>
      <p className="password-strength__label">
        Strength: <strong>{strength.label}</strong>
      </p>
      <ul className="password-strength__rules">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(value);
          return (
            <li key={rule.key} className={ok ? 'ok' : ''}>
              {ok ? <Check size={13} aria-hidden="true" /> : <X size={13} aria-hidden="true" />}
              {rule.label}
              <span className="sr-only">{ok ? ' – done' : ' – missing'}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function PasswordInput({
  label,
  name,
  value,
  onChange,
  autoComplete = 'current-password',
  required = false,
  minLength,
  maxLength = 72,
  placeholder,
  showStrength = false,
  hint
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <label className="password-field">
      {label}
      <div className="password">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-describedby={showStrength && value ? `${id}-strength` : undefined}
        />
        <button
          type="button"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-controls={id}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff /> : <Eye />}
        </button>
      </div>
      {hint && <small>{hint}</small>}
      {showStrength && <PasswordStrength value={value} id={`${id}-strength`} />}
    </label>
  );
}
