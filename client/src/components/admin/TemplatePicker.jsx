import { MessageSquareText } from 'lucide-react';
import { useEffect, useState } from 'react';

import { api } from '../../services/api';
import { useAuth } from '../../features/auth/AuthContext';
import { fillTemplate } from '../../utils/templates';

/*
|--------------------------------------------------------------------------
| VIVA – Naaziq – Reply Templates: READ inside the reply boxes
|--------------------------------------------------------------------------
| Loads active templates for the given category (plus "General") and
| fills the placeholders with the real record values before inserting.
*/

export { fillTemplate };

export default function TemplatePicker({ category, values = {}, onInsert, label = 'Insert template' }) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    let active = true;

    api
      .get('/reply-templates', { params: { category, includeGeneral: 'true', active: 'true' } })
      .then((response) => {
        if (active) setTemplates(response.data.data || []);
      })
      .catch(() => {
        if (active) setTemplates([]);
      });

    return () => {
      active = false;
    };
  }, [category]);

  if (!templates.length) {
    return null;
  }

  const choose = (event) => {
    const template = templates.find((item) => String(item.templateId) === event.target.value);
    setSelected('');

    if (!template) {
      return;
    }

    const filled = { staff_name: user?.name, ...values };
    onInsert({
      subject: template.subject ? fillTemplate(template.subject, filled) : '',
      body: fillTemplate(template.body, filled)
    });
  };

  return (
    <label className="template-picker">
      <MessageSquareText size={15} aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <select value={selected} onChange={choose} aria-label={label}>
        <option value="">{label}…</option>
        {templates.map((template) => (
          <option key={template.templateId} value={template.templateId}>
            {template.title}
          </option>
        ))}
      </select>
    </label>
  );
}
