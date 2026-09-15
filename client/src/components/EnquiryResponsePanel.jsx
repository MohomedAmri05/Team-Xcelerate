import {
  Edit3,
  Mail,
  Send,
  Trash2
} from 'lucide-react';

import {
  useEffect,
  useState
} from 'react';

import toast from 'react-hot-toast';

import {
  api
} from '../services/api';

import {
  useAuth
} from '../features/auth/AuthContext';

export default function EnquiryResponsePanel({
  enquiryId,
  onResponseSent
}) {
  const {
    user
  } = useAuth();

  const [
    responses,
    setResponses
  ] = useState([]);

  const [
    subject,
    setSubject
  ] = useState('');

  const [
    responseBody,
    setResponseBody
  ] = useState('');

  const [
    editingId,
    setEditingId
  ] = useState(null);

  const [
    loading,
    setLoading
  ] = useState(false);

  const [
    saving,
    setSaving
  ] = useState(false);

  const isAdmin =
    user?.role === 'Admin';

  const loadResponses = async () => {
    if (!enquiryId) {
      setResponses([]);
      return;
    }

    setLoading(true);

    try {
      const response = await api.get(
        `/enquiries/${enquiryId}/responses`
      );

      setResponses(
        Array.isArray(response.data.data)
          ? response.data.data
          : []
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not load enquiry responses'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setEditingId(null);
    setSubject('');
    setResponseBody('');
    loadResponses();
  }, [enquiryId]);

  const resetEditor = () => {
    setEditingId(null);
    setSubject('');
    setResponseBody('');
  };

  const saveDraft = async (event) => {
    event.preventDefault();

    setSaving(true);

    try {
      const payload = {
        subject,
        responseBody,
        status: 'Draft'
      };

      if (editingId) {
        await api.put(
          `/enquiry-responses/${editingId}`,
          payload
        );

        toast.success(
          'Draft response updated'
        );
      } else {
        await api.post(
          `/enquiries/${enquiryId}/responses`,
          payload
        );

        toast.success(
          'Draft response created'
        );
      }

      resetEditor();
      await loadResponses();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not save the draft response'
      );
    } finally {
      setSaving(false);
    }
  };

  const editDraft = (response) => {
    setEditingId(
      response.responseId
    );

    setSubject(
      response.subject || ''
    );

    setResponseBody(
      response.responseBody || ''
    );
  };

  const sendResponse = async (
    response
  ) => {
    const confirmed =
      window.confirm(
        `Send "${response.subject}" to the customer?`
      );

    if (!confirmed) {
      return;
    }

    try {
      await api.post(
        `/enquiry-responses/${response.responseId}/send`
      );

      toast.success(
        'Response sent successfully'
      );

      resetEditor();
      await loadResponses();
      await onResponseSent?.();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not send the response'
      );
    }
  };

  const deleteDraft = async (
    response
  ) => {
    const confirmed =
      window.confirm(
        `Delete the draft "${response.subject}"?`
      );

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(
        `/enquiry-responses/${response.responseId}`
      );

      toast.success(
        'Draft response deleted'
      );

      if (
        editingId ===
        response.responseId
      ) {
        resetEditor();
      }

      await loadResponses();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not delete the draft'
      );
    }
  };

  if (!enquiryId) {
    return null;
  }

  return (
    <section className="response-panel">
      <div className="response-panel-heading">
        <Mail />

        <div>
          <p className="eyebrow">
            CUSTOMER COMMUNICATION
          </p>

          <h3>Enquiry Responses</h3>
        </div>
      </div>

      <form
        className="response-editor"
        onSubmit={saveDraft}
      >
        <h4>
          {editingId
            ? 'Edit draft'
            : 'Create response draft'}
        </h4>

        <label htmlFor="response-subject">
          Subject

          <input
            id="response-subject"
            type="text"
            required
            minLength="2"
            maxLength="180"
            value={subject}
            onChange={(event) => {
              setSubject(
                event.target.value
              );
            }}
          />
        </label>

        <label htmlFor="response-body">
          Response

          <textarea
            id="response-body"
            required
            minLength="2"
            maxLength="10000"
            value={responseBody}
            onChange={(event) => {
              setResponseBody(
                event.target.value
              );
            }}
          />
        </label>

        <div className="actions">
          <button
            className="button"
            type="submit"
            disabled={saving}
          >
            {saving
              ? 'Saving…'
              : editingId
                ? 'Update draft'
                : 'Save draft'}
          </button>

          {editingId && (
            <button
              className="button ghost"
              type="button"
              onClick={resetEditor}
            >
              Cancel editing
            </button>
          )}
        </div>
      </form>

      <div className="response-history">
        <h4>Response history</h4>

        {loading && (
          <div className="state">
            Loading responses…
          </div>
        )}

        {!loading &&
          responses.length === 0 && (
            <div className="state">
              No responses yet.
            </div>
          )}

        {responses.map((response) => (
          <article
            className="response-card"
            key={response.responseId}
          >
            <div className="response-card-head">
              <div>
                <strong>
                  {response.subject}
                </strong>

                <small>
                  {response.author?.name ||
                    'High Street Staff'}
                </small>
              </div>

              <span
                className={
                  `response-status ${response.status.toLowerCase()}`
                }
              >
                {response.status}
              </span>
            </div>

            <p>{response.responseBody}</p>

            <small>
              {response.sentAt
                ? `Sent ${new Date(
                    response.sentAt
                  ).toLocaleString()}`
                : `Saved ${new Date(
                    response.updatedAt ||
                    response.createdAt
                  ).toLocaleString()}`}
            </small>

            {response.status ===
              'Draft' && (
              <div className="actions">
                <button
                  type="button"
                  onClick={() => {
                    editDraft(response);
                  }}
                >
                  <Edit3 size={16} />
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sendResponse(response);
                  }}
                >
                  <Send size={16} />
                  Send
                </button>

                {isAdmin && (
                  <button
                    className="danger"
                    type="button"
                    onClick={() => {
                      deleteDraft(
                        response
                      );
                    }}
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
