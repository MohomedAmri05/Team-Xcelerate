/*
| VIVA-UI – H.F. Naaziq – Enquiries (CRUD 1), dashboard
|   READ list / search / details → GET /enquiries(/:id)
|   UPDATE status / assignment → PATCH /enquiries/:id(/assign)
|   DELETE (Admin) → DELETE /enquiries/:id
|   (CREATE is the customer form on the vehicle page and Contact page)
| API paths are relative to /api/v1 (services/api.js).
*/

import {
  Archive,
  Mail,
  Phone,
  Trash2,
  UserRound
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useState
} from 'react';

import { confirmDialog } from './ui/ConfirmDialog';
import toast from 'react-hot-toast';

import {
  api
} from '../services/api';

import {
  useAuth
} from '../features/auth/AuthContext';

import EnquiryResponsePanel
  from './EnquiryResponsePanel';

import SearchBar
  from './ui/SearchBar';

import StatusBadge
  from './ui/StatusBadge';

import ProgressSteps
  from './ui/ProgressSteps';

function EnquiryEmailReplies({ enquiryId }) {
  const [replies, setReplies] = useState([]);

  useEffect(() => {
    let active = true;

    api
      .get(`/enquiries/${enquiryId}/inbound`)
      .then((response) => {
        if (active) {
          setReplies(response.data.data || []);
        }
      })
      .catch(() => {
        if (active) {
          setReplies([]);
        }
      });

    return () => {
      active = false;
    };
  }, [enquiryId]);

  if (!replies.length) {
    return null;
  }

  return (
    <div className="enquiry-message enquiry-email-replies">
      <strong>Customer replies received by email</strong>
      {replies.map((reply) => (
        <div key={reply.inboundId} className="enquiry-email-reply">
          <small>
            {new Date(reply.receivedAt).toLocaleString('en-LK', {
              dateStyle: 'medium',
              timeStyle: 'short'
            })}{' '}
            · {reply.subject}
          </small>
          <p className="pre-wrap">{reply.body}</p>
        </div>
      ))}
    </div>
  );
}

const enquiryStatuses = [
  'New',
  'In Progress',
  'Responded',
  'Archived'
];

export default function EnquiryManager() {
  const {
    user
  } = useAuth();

  const [
    enquiries,
    setEnquiries
  ] = useState([]);

  const [
    selected,
    setSelected
  ] = useState(null);

  const [
    staff,
    setStaff
  ] = useState([]);

  const [
    statusFilter,
    setStatusFilter
  ] = useState('');

  const [
    loading,
    setLoading
  ] = useState(true);

  const isAdmin =
    user?.role === 'Admin';

  const [
    search,
    setSearch
  ] = useState('');

  const loadEnquiries = async () => {
    setLoading(true);

    try {
      const response =
        await api.get('/enquiries', {
          params: {
            limit: 100,
            search: search || undefined
          }
        });

      const records =
        Array.isArray(
          response.data.data
        )
          ? response.data.data
          : response.data.data
              ?.rows || [];

      setEnquiries(records);

      if (selected) {
        const updatedSelection =
          records.find(
            (record) =>
              record.enquiryId ===
              selected.enquiryId
          );

        setSelected(
          updatedSelection || null
        );
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not load enquiries'
      );
    } finally {
      setLoading(false);
    }
  };

  const loadStaff = async () => {
    if (!isAdmin) {
      return;
    }

    try {
      const response =
        await api.get('/users');

      const users =
        Array.isArray(
          response.data.data
        )
          ? response.data.data
          : response.data.data
              ?.rows || [];

      setStaff(
        users.filter(
          (account) =>
            account.role === 'Staff' &&
            account.isActive
        )
      );
    } catch {
      toast.error(
        'Could not load Staff accounts'
      );
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  useEffect(() => {
    loadEnquiries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const filteredEnquiries =
    useMemo(() => {
      if (!statusFilter) {
        return enquiries;
      }

      return enquiries.filter(
        (record) =>
          record.status ===
          statusFilter
      );
    }, [
      enquiries,
      statusFilter
    ]);

  const selectEnquiry = async (
    enquiry
  ) => {
    try {
      const response =
        await api.get(
          `/enquiries/${enquiry.enquiryId}`
        );

      setSelected(
        response.data.data
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not open the enquiry'
      );
    }
  };

  const updateStatus = async (
    status
  ) => {
    if (!selected) {
      return;
    }

    try {
      await api.patch(
        `/enquiries/${selected.enquiryId}`,
        {
          status
        }
      );

      toast.success(
        'Enquiry status updated'
      );

      await loadEnquiries();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not update the enquiry'
      );
    }
  };

  const assignEnquiry = async (
    value
  ) => {
    if (!selected || !isAdmin) {
      return;
    }

    try {
      await api.patch(
        `/enquiries/${selected.enquiryId}/assign`,
        {
          assignedTo:
            value
              ? Number(value)
              : null
        }
      );

      toast.success(
        value
          ? 'Enquiry assigned'
          : 'Assignment removed'
      );

      await loadEnquiries();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not assign the enquiry'
      );
    }
  };

  const deleteEnquiry = async () => {
    if (!selected || !isAdmin) {
      return;
    }

    const confirmed =
      await confirmDialog(
        `Permanently delete enquiry #${selected.enquiryId}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(
        `/enquiries/${selected.enquiryId}`
      );

      toast.success(
        'Enquiry permanently deleted'
      );

      setSelected(null);
      await loadEnquiries();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not delete the enquiry'
      );
    }
  };

  return (
    <section className="enquiry-manager">
      <div className="admin-head">
        <div>
          <p className="eyebrow">
            CUSTOMER LEADS
          </p>

          <h2>Enquiry Management</h2>

          <p>
            {isAdmin
              ? 'View, assign and respond to every customer enquiry.'
              : 'View and respond only to enquiries assigned to you.'}
          </p>
        </div>

        <div className="manager-toolbar">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search customer, email, vehicle or ID"
            historyScope="admin-enquiries"
          />

        <label>
          Status

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(
                event.target.value
              );
            }}
          >
            <option value="">
              All statuses
            </option>

            {enquiryStatuses.map(
              (status) => (
                <option
                  value={status}
                  key={status}
                >
                  {status}
                </option>
              )
            )}
          </select>
        </label>
        </div>
      </div>

      <div className="enquiry-workspace">
        <div className="enquiry-list-panel">
          {loading && (
            <div className="state">
              Loading enquiries…
            </div>
          )}

          {!loading &&
            filteredEnquiries.length ===
              0 && (
              <div className="state">
                No enquiries found.
              </div>
            )}

          {filteredEnquiries.map(
            (enquiry) => (
              <button
                className={
                  `enquiry-list-item ${
                    selected?.enquiryId ===
                    enquiry.enquiryId
                      ? 'selected'
                      : ''
                  }`
                }
                type="button"
                key={enquiry.enquiryId}
                onClick={() => {
                  selectEnquiry(
                    enquiry
                  );
                }}
              >
                <div>
                  <strong>
                    {enquiry.customerName}
                  </strong>

                  <span>
                    {enquiry.vehicleReference}
                  </span>
                </div>

                <span
                  className={
                    `enquiry-status ${enquiry.status
                      .toLowerCase()
                      .replaceAll(
                        ' ',
                        '-'
                      )}`
                  }
                >
                  {enquiry.status}
                </span>

                <small>
                  {new Date(
                    enquiry.createdAt
                  ).toLocaleString()}
                </small>
              </button>
            )
          )}
        </div>

        <div className="enquiry-detail-panel">
          {!selected && (
            <div className="state">
              Select an enquiry to view its
              details and responses.
            </div>
          )}

          {selected && (
            <>
              <article className="enquiry-detail-card">
                <div className="enquiry-card-head">
                  <div>
                    <p className="eyebrow">
                      ENQUIRY #
                      {selected.enquiryId}
                    </p>

                    <h3>
                      {selected.vehicleReference}
                    </h3>
                  </div>

                  <StatusBadge
                    kind="enquiry"
                    status={selected.status}
                  />
                </div>

                <ProgressSteps
                  kind="enquiry"
                  status={selected.status}
                  compact
                />

                <div className="enquiry-contact">
                  <span>
                    <UserRound size={17} />
                    {selected.customerName}
                  </span>

                  <a
                    href={
                      `mailto:${selected.customerEmail}`
                    }
                  >
                    <Mail size={17} />
                    {selected.customerEmail}
                  </a>

                  <a
                    href={
                      `tel:${selected.customerPhone}`
                    }
                  >
                    <Phone size={17} />
                    {selected.customerPhone}
                  </a>
                </div>

                <div className="enquiry-message">
                  <strong>
                    Customer message
                  </strong>

                  <p>{selected.message}</p>
                </div>

                <EnquiryEmailReplies
                  enquiryId={selected.enquiryId}
                />

                {isAdmin && (
                  <label>
                    Assigned Staff

                    <select
                      value={
                        selected.assignedTo ||
                        ''
                      }
                      onChange={(event) => {
                        assignEnquiry(
                          event.target.value
                        );
                      }}
                    >
                      <option value="">
                        Unassigned
                      </option>

                      {staff.map(
                        (account) => (
                          <option
                            value={
                              account.userId
                            }
                            key={
                              account.userId
                            }
                          >
                            {account.name}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                )}

                {!isAdmin &&
                  selected.assignedStaff && (
                  <p>
                    Assigned to{' '}
                    <strong>
                      {
                        selected
                          .assignedStaff
                          .name
                      }
                    </strong>
                  </p>
                )}

                <div className="enquiry-status-actions">
                  {enquiryStatuses.map(
                    (status) => (
                      <button
                        type="button"
                        className={
                          selected.status ===
                          status
                            ? 'active'
                            : ''
                        }
                        key={status}
                        onClick={() => {
                          updateStatus(
                            status
                          );
                        }}
                      >
                        {status ===
                          'Archived' && (
                          <Archive
                            size={15}
                          />
                        )}

                        {status}
                      </button>
                    )
                  )}
                </div>

                {isAdmin && (
                  <button
                    className="button danger"
                    type="button"
                    onClick={
                      deleteEnquiry
                    }
                  >
                    <Trash2 size={17} />
                    Permanently delete enquiry
                  </button>
                )}
              </article>

              <EnquiryResponsePanel
                enquiryId={
                  selected.enquiryId
                }
                onResponseSent={
                  loadEnquiries
                }
                templateValues={{
                  customer_name: selected.customerName,
                  vehicle: selected.vehicleReference
                }}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
