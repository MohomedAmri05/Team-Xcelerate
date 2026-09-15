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

import toast from 'react-hot-toast';

import {
  api
} from '../services/api';

import {
  useAuth
} from '../features/auth/AuthContext';

import EnquiryResponsePanel
  from './EnquiryResponsePanel';

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

  const loadEnquiries = async () => {
    setLoading(true);

    try {
      const response =
        await api.get('/enquiries');

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
    loadEnquiries();
    loadStaff();
  }, []);

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
      window.confirm(
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

                  <span
                    className={
                      `enquiry-status ${selected.status
                        .toLowerCase()
                        .replaceAll(
                          ' ',
                          '-'
                        )}`
                    }
                  >
                    {selected.status}
                  </span>
                </div>

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
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
