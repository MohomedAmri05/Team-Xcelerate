import {
  Save,
  ShieldCheck
} from 'lucide-react';

import {
  useEffect,
  useState
} from 'react';

import toast from 'react-hot-toast';

import {
  api
} from '../services/api';

const permissionFields = [
  {
    key: 'canManageInventory',
    label: 'Manage inventory',
    description:
      'Create and update vehicles and upload or organize images.'
  },

  {
    key: 'canManageEnquiries',
    label: 'Manage enquiries',
    description:
      'Update assigned enquiries and create or send responses.'
  },

  {
    key: 'canViewAssignedContacts',
    label: 'View assigned contacts',
    description:
      'View customer contact details for assigned leads and bookings.'
  },

  {
    key: 'canArchiveRecords',
    label: 'Archive records',
    description:
      'Soft-archive vehicle records without permanently deleting them.'
  },

  {
    key: 'canViewLimitedAnalytics',
    label: 'View limited analytics',
    description:
      'View approved operational statistics without financial reports.'
  }
];

const emptyPermissions =
  Object.fromEntries(
    permissionFields.map(
      ({ key }) => [
        key,
        false
      ]
    )
  );

export default function StaffPermissionManager() {
  const [
    staffAccounts,
    setStaffAccounts
  ] = useState([]);

  const [
    permissionMap,
    setPermissionMap
  ] = useState({});

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    savingId,
    setSavingId
  ] = useState(null);

  const load = async () => {
    setLoading(true);

    try {
      const userResponse =
        await api.get('/users');

      const users =
        Array.isArray(
          userResponse.data.data
        )
          ? userResponse.data.data
          : userResponse.data.data
              ?.rows || [];

      const activeStaff =
        users.filter(
          (account) =>
            account.role === 'Staff'
        );

      const permissionResults =
        await Promise.all(
          activeStaff.map(
            async (account) => {
              try {
                const response =
                  await api.get(
                    `/users/${account.userId}/permissions`
                  );

                return [
                account.userId,
                {
                    ...emptyPermissions,
                    ...response.data.data?.permissions
                }
                ];
              } catch (error) {
                if (
                  error.response?.status ===
                  404
                ) {
                  return [
                    account.userId,
                    {
                      ...emptyPermissions
                    }
                  ];
                }

                throw error;
              }
            }
          )
        );

      setStaffAccounts(activeStaff);

      setPermissionMap(
        Object.fromEntries(
          permissionResults
        )
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not load staff permissions'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateLocalPermission = (
    userId,
    permission,
    checked
  ) => {
    setPermissionMap(
      (currentMap) => ({
        ...currentMap,

        [userId]: {
          ...emptyPermissions,
          ...currentMap[userId],

          [permission]:
            checked
        }
      })
    );
  };

  const savePermissions = async (
    account
  ) => {
    setSavingId(
      account.userId
    );

    try {
      const permissions = {
        ...emptyPermissions,
        ...permissionMap[
          account.userId
        ]
      };

      await api.put(
        `/users/${account.userId}/permissions`,
        permissions
      );

      toast.success(
        `Permissions updated for ${account.name}`
      );

      await load();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not update permissions'
      );
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="state">
        Loading staff permissions…
      </div>
    );
  }

  return (
    <section className="permission-manager">
      <div className="admin-head">
        <div>
          <p className="eyebrow">
            ACCESS CONTROL
          </p>

          <h2>Staff Permissions</h2>

          <p>
            Assign only the operational access
            required by each Staff member.
          </p>
        </div>
      </div>

      {staffAccounts.length === 0 && (
        <div className="state">
          No Staff accounts are available.
        </div>
      )}

      <div className="permission-list">
        {staffAccounts.map(
          (account) => {
            const permissions = {
              ...emptyPermissions,

              ...permissionMap[
                account.userId
              ]
            };

            return (
              <article
                className="permission-card"
                key={account.userId}
              >
                <div className="permission-user">
                  <ShieldCheck />

                  <div>
                    <h3>{account.name}</h3>
                    <p>{account.email}</p>

                    <span
                      className={
                        account.isActive
                          ? 'active-account'
                          : 'inactive-account'
                      }
                    >
                      {account.isActive
                        ? 'Active'
                        : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div className="permission-options">
                  {permissionFields.map(
                    ({
                      key,
                      label,
                      description
                    }) => (
                      <label
                        className="permission-option"
                        key={key}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(
                            permissions[key]
                          )}
                          disabled={
                            !account.isActive
                          }
                          onChange={(
                            event
                          ) => {
                            updateLocalPermission(
                              account.userId,
                              key,
                              event.target
                                .checked
                            );
                          }}
                        />

                        <span>
                          <strong>
                            {label}
                          </strong>

                          <small>
                            {description}
                          </small>
                        </span>
                      </label>
                    )
                  )}
                </div>

                <button
                  className="button"
                  type="button"
                  disabled={
                    !account.isActive ||
                    savingId ===
                      account.userId
                  }
                  onClick={() => {
                    savePermissions(
                      account
                    );
                  }}
                >
                  <Save size={17} />

                  {savingId ===
                  account.userId
                    ? 'Saving…'
                    : 'Save permissions'}
                </button>
              </article>
            );
          }
        )}
      </div>
    </section>
  );
}