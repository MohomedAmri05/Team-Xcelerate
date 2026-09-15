import {
  useEffect,
  useState
} from 'react';

import {
  useNavigate
} from 'react-router-dom';

import {
  BadgeDollarSign,
  CalendarDays,
  Car,
  FileText,
  Image,
  Inbox,
  LogOut,
  Menu,
  Monitor,
  ShieldCheck,
  Store,
  Users
} from 'lucide-react';

import toast from 'react-hot-toast';

import {
  api
} from '../services/api';

import {
  useAuth
} from '../features/auth/AuthContext';

import BookingManager
  from '../components/BookingManager';

import ContentManager
  from '../components/ContentManager';

import EnquiryManager
  from '../components/EnquiryManager';

import FinanceManager
  from '../components/FinanceManager';

import SessionManager
  from '../components/SessionManager';

import StaffPermissionManager
  from '../components/StaffPermissionManager';

import UserManager
  from '../components/UserManager';

import VehicleImageManager
  from '../components/VehicleImageManager';

import VehicleManager
  from '../components/VehicleManager';

const resources = {
  Vehicles: {
    icon: Car,
    path: '/vehicles',
    fields: {},
    custom: true
  },

  Images: {
    icon: Image,
    path: '/vehicles/1/images',
    fields: {},
    custom: true
  },

  Enquiries: {
    icon: Inbox,
    path: '/enquiries',
    fields: {},
    custom: true
  },

  Bookings: {
    icon: CalendarDays,
    path: '/bookings',
    fields: {},
    custom: true
  },

  Users: {
    icon: Users,
    path: '/users',
    fields: {},
    custom: true
  },

  Permissions: {
    icon: ShieldCheck,
    path: '/users',
    fields: {},
    custom: true
  },

  Sessions: {
    icon: Monitor,
    path: '/sessions',
    fields: {},
    custom: true
  },

  Content: {
    icon: FileText,
    path: '/content',
    fields: {},
    custom: true
  },

  Financing: {
    icon: BadgeDollarSign,
    path: '/financing-config',
    fields: {},
    custom: true
  }
};

function getVisibleResources(user) {
  if (user?.role === 'Admin') {
    return resources;
  }

  if (user?.role !== 'Staff') {
    return {};
  }

  const visible = {};

  const permissions =
    user.permissions || {};

  if (
    permissions.canManageInventory
  ) {
    visible.Vehicles =
      resources.Vehicles;

    visible.Images =
      resources.Images;
  }

  if (
    permissions.canManageEnquiries &&
    permissions.canViewAssignedContacts
  ) {
    visible.Enquiries =
      resources.Enquiries;

    visible.Bookings =
      resources.Bookings;
  }

  visible.Sessions =
    resources.Sessions;

  return visible;
}

function recordId(
  resourceName,
  record
) {
  const idFields = {
    Financing: 'configId'
  };

  return record[
    idFields[resourceName]
  ];
}

export default function Admin() {
  const navigate = useNavigate();

  const {
    user,
    logout: logoutUser
  } = useAuth();

  const visibleResources =
    getVisibleResources(user);

  const firstVisibleTab =
    Object.keys(
      visibleResources
    )[0] || 'Sessions';

  const [
    tab,
    setTab
  ] = useState(
    firstVisibleTab
  );

  const [
    rows,
    setRows
  ] = useState([]);

  const [
    form,
    setForm
  ] = useState(
    resources[
      firstVisibleTab
    ]?.fields || {}
  );

  const [
    editing,
    setEditing
  ] = useState(null);

  const [
    busy,
    setBusy
  ] = useState(false);

  const [
    open,
    setOpen
  ] = useState(false);

  const config =
    resources[tab] ||
    resources.Sessions;

  const customTabs = [
    'Vehicles',
    'Images',
    'Enquiries',
    'Bookings',
    'Users',
    'Permissions',
    'Sessions',
    'Content',
    'Financing'
  ];

  const load = async () => {
    if (
      !visibleResources[tab] ||
      config.custom
    ) {
      setRows([]);
      setBusy(false);
      return;
    }

    setBusy(true);

    try {
      const response =
        await api.get(
          config.path
        );

      const data =
        response.data.data;

      setRows(
        Array.isArray(data)
          ? data
          : data?.rows || []
      );
    } catch (error) {
      if (
        error.response?.status ===
        401
      ) {
        navigate('/login');
      } else {
        toast.error(
          error.response?.data
            ?.message ||
            'Could not load data'
        );
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (
      !visibleResources[tab]
    ) {
      setTab(firstVisibleTab);
      return;
    }

    setForm(config.fields);
    setEditing(null);
    load();
  }, [tab, user]);

  const save = async (
    event
  ) => {
    event.preventDefault();

    try {
      const requestPath =
        editing
          ? `${config.path}/${editing}`
          : config.path;

      await api[
        editing ? 'put' : 'post'
      ](
        requestPath,
        form
      );

      toast.success(
        `${tab} saved`
      );

      setEditing(null);
      setForm(config.fields);

      await load();
    } catch (error) {
      toast.error(
        error.response?.data
          ?.message ||
          'Save failed'
      );
    }
  };

  const edit = (record) => {
    setEditing(
      recordId(
        tab,
        record
      )
    );

    setForm(
      Object.fromEntries(
        Object.keys(
          config.fields
        ).map(
          (fieldName) => [
            fieldName,

            record[fieldName] ??
              config.fields[
                fieldName
              ]
          ]
        )
      )
    );
  };

  const remove = async (
    record
  ) => {
    const confirmed =
      window.confirm(
        `Delete this ${tab.toLowerCase()} record?`
      );

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(
        `${config.path}/${recordId(
          tab,
          record
        )}`
      );

      toast.success(
        'Record deleted'
      );

      await load();
    } catch (error) {
      toast.error(
        error.response?.data
          ?.message ||
          'Action failed'
      );
    }
  };

  const handleLogout =
    async () => {
      await logoutUser();
      navigate('/');
    };

  return (
    <div className="admin">
      <aside
        className={
          open ? 'open' : ''
        }
      >
        <div className="admin-logo">
          HS <span>CONTROL</span>
        </div>

        <button
          type="button"
          className="store-switch"
          onClick={() => {
            navigate('/');
          }}
        >
          <Store />
          View Store
        </button>

        {Object.entries(
          visibleResources
        ).map(
          ([
            name,
            {
              icon: Icon
            }
          ]) => (
            <button
              type="button"
              className={
                tab === name
                  ? 'active'
                  : ''
              }
              onClick={() => {
                setTab(name);
                setOpen(false);
              }}
              key={name}
            >
              <Icon />
              {name}
            </button>
          )
        )}

        <button
          type="button"
          onClick={
            handleLogout
          }
        >
          <LogOut />
          Sign out
        </button>
      </aside>

      <main>
        <header>
          <button
            type="button"
            className="menu"
            onClick={() => {
              setOpen(
                (current) =>
                  !current
              );
            }}
            aria-label="Toggle dashboard navigation"
          >
            <Menu />
          </button>

          <div>
            <p className="eyebrow">
              HIGH STREET OPERATIONS
            </p>

            <h1>{tab}</h1>

            <p className="dashboard-user">
              Signed in as{' '}
              {user?.name}{' '}

              <span>
                {user?.role}
              </span>
            </p>
          </div>

          <span className="online">
            ● System online
          </span>
        </header>

        <section className="admin-panel">
          {tab === 'Vehicles' && (
            <VehicleManager />
          )}

          {tab === 'Images' && (
            <VehicleImageManager />
          )}

          {tab === 'Enquiries' && (
            <EnquiryManager />
          )}

          {tab === 'Bookings' && (
            <BookingManager />
          )}

          {tab === 'Users' && (
            <UserManager />
          )}

          {tab ===
            'Permissions' && (
            <StaffPermissionManager />
          )}

          {tab === 'Sessions' && (
            <SessionManager />
          )}

          {tab === 'Content' && (
            <ContentManager />
          )}

          {tab === 'Financing' && (
            <FinanceManager />
          )}

          {!customTabs.includes(
            tab
          ) && (
            <>
              <div className="admin-head">
                <h2>
                  {editing
                    ? 'Edit record'
                    : 'Records'}
                </h2>

                {busy && (
                  <span>
                    Loading…
                  </span>
                )}
              </div>

              {Object.keys(
                config.fields
              ).length > 0 && (
                <form
                  className="admin-form"
                  onSubmit={save}
                >
                  {Object.entries(
                    config.fields
                  ).map(
                    ([
                      fieldName,
                      defaultValue
                    ]) => (
                      <ResourceField
                        key={
                          fieldName
                        }
                        fieldName={
                          fieldName
                        }
                        defaultValue={
                          defaultValue
                        }
                        value={
                          form[
                            fieldName
                          ]
                        }
                        onChange={(
                          value
                        ) => {
                          setForm({
                            ...form,

                            [fieldName]:
                              value
                          });
                        }}
                      />
                    )
                  )}

                  <button
                    className="button"
                    type="submit"
                  >
                    {editing
                      ? 'Update'
                      : 'Create'}
                  </button>

                  {editing && (
                    <button
                      type="button"
                      className="clear"
                      onClick={() => {
                        setEditing(
                          null
                        );

                        setForm(
                          config.fields
                        );
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </form>
              )}

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>

                      <th>
                        Summary
                      </th>

                      <th>
                        Status
                      </th>

                      <th>
                        Updated
                      </th>

                      <th>
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map(
                      (record) => (
                        <tr
                          key={
                            recordId(
                              tab,
                              record
                            ) ||
                            JSON.stringify(
                              record
                            )
                          }
                        >
                          <td>
                            #
                            {recordId(
                              tab,
                              record
                            )}
                          </td>

                          <td>
                            <strong>
                              {record.name ||
                                'Record'}
                            </strong>
                          </td>

                          <td>
                            {record.isActive
                              ? 'Active'
                              : 'Inactive'}
                          </td>

                          <td>
                            {record.updatedAt
                              ? new Date(
                                  record.updatedAt
                                ).toLocaleDateString()
                              : '—'}
                          </td>

                          <td>
                            <button
                              type="button"
                              onClick={() => {
                                edit(
                                  record
                                );
                              }}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="danger"
                              onClick={() => {
                                remove(
                                  record
                                );
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      )
                    )}

                    {!busy &&
                      rows.length ===
                        0 && (
                        <tr>
                          <td colSpan="5">
                            No records
                            yet.
                          </td>
                        </tr>
                      )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function ResourceField({
  fieldName,
  defaultValue,
  value,
  onChange
}) {
  const isBoolean =
    typeof defaultValue ===
    'boolean';

  if (isBoolean) {
    return (
      <label>
        {fieldName}

        <input
          type="checkbox"
          checked={
            Boolean(value)
          }
          onChange={(event) => {
            onChange(
              event.target.checked
            );
          }}
        />
      </label>
    );
  }

  return (
    <label>
      {fieldName}

      <input
        required
        type={
          typeof defaultValue ===
          'number'
            ? 'number'
            : 'text'
        }
        value={value ?? ''}
        onChange={(event) => {
          onChange(
            typeof defaultValue ===
            'number'
              ? Number(
                  event.target.value
                )
              : event.target.value
          );
        }}
      />
    </label>
  );
}