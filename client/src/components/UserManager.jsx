import {
  Edit3,
  UserCheck,
  UserMinus,
  UserPlus,
  X
} from 'lucide-react';

import {
  useEffect,
  useState
} from 'react';

import toast from 'react-hot-toast';

import {
  api
} from '../services/api';

const emptyUser = {
  name: '',
  email: '',
  password: '',
  role: 'Staff',
  isActive: true
};

export default function UserManager() {
  const [
    users,
    setUsers
  ] = useState([]);

  const [
    form,
    setForm
  ] = useState({
    ...emptyUser
  });

  const [
    editingId,
    setEditingId
  ] = useState(null);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    saving,
    setSaving
  ] = useState(false);

  const [
    roleFilter,
    setRoleFilter
  ] = useState('');

  const loadUsers = async () => {
    setLoading(true);

    try {
      const response =
        await api.get('/users');

      const records =
        Array.isArray(
          response.data.data
        )
          ? response.data.data
          : response.data.data
              ?.rows || [];

      setUsers(records);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not load user accounts'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const resetForm = () => {
    setEditingId(null);

    setForm({
      ...emptyUser
    });
  };

  const editUser = (account) => {
    setEditingId(
      account.userId
    );

    setForm({
      name: account.name || '',
      email: account.email || '',
      password: '',
      role: account.role,
      isActive:
        Boolean(account.isActive)
    });

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const saveUser = async (
    event
  ) => {
    event.preventDefault();
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      email:
        form.email
          .trim()
          .toLowerCase(),
      role: form.role,
      isActive:
        Boolean(form.isActive)
    };

    if (form.password) {
      payload.password =
        form.password;
    }

    try {
      if (editingId) {
        await api.put(
          `/users/${editingId}`,
          payload
        );

        toast.success(
          'Account updated'
        );
      } else {
        if (!form.password) {
          toast.error(
            'Password is required for a new Staff account'
          );

          setSaving(false);
          return;
        }

        await api.post(
          '/users',
          payload
        );

        toast.success(
          'Staff account created'
        );
      }

      resetForm();
      await loadUsers();
    } catch (error) {
      const validationErrors =
        error.response?.data?.errors;

      toast.error(
        validationErrors?.[0]?.message ||
        error.response?.data?.message ||
        'Could not save the account'
      );
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (
    account
  ) => {
    const nextStatus =
      !account.isActive;

    const action =
      nextStatus
        ? 'activate'
        : 'deactivate';

    const confirmed =
      window.confirm(
        `${action[0].toUpperCase()}${action.slice(
          1
        )} ${account.name}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      await api.patch(
        `/users/${account.userId}/status`,
        {
          isActive: nextStatus
        }
      );

      toast.success(
        nextStatus
          ? 'Account activated'
          : 'Account deactivated'
      );

      await loadUsers();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not change account status'
      );
    }
  };

  const filteredUsers =
    roleFilter
      ? users.filter(
          (account) =>
            account.role ===
            roleFilter
        )
      : users;

  return (
    <section className="user-manager">
      <div className="admin-head">
        <div>
          <p className="eyebrow">
            ACCOUNT CONTROL
          </p>

          <h2>
            {editingId
              ? `Edit account #${editingId}`
              : 'Create Staff account'}
          </h2>
        </div>
      </div>

      <form
        className="user-editor"
        onSubmit={saveUser}
      >
        <label>
          Full name

          <input
            type="text"
            required
            minLength="2"
            maxLength="100"
            value={form.name}
            onChange={(event) => {
              setForm({
                ...form,
                name:
                  event.target.value
              });
            }}
          />
        </label>

        <label>
          Email

          <input
            type="email"
            required
            maxLength="150"
            value={form.email}
            onChange={(event) => {
              setForm({
                ...form,
                email:
                  event.target.value
              });
            }}
          />
        </label>

        <label>
          {editingId
            ? 'New password (optional)'
            : 'Password'}

          <input
            type="password"
            required={!editingId}
            minLength="10"
            maxLength="72"
            value={form.password}
            onChange={(event) => {
              setForm({
                ...form,
                password:
                  event.target.value
              });
            }}
          />
        </label>

        <label>
          Role

          <select
            value={form.role}
            onChange={(event) => {
              setForm({
                ...form,
                role:
                  event.target.value
              });
            }}
          >
            <option value="Staff">
              Staff
            </option>

            {editingId && (
              <>
                <option value="Admin">
                  Admin
                </option>

                <option value="Customer">
                  Customer
                </option>
              </>
            )}
          </select>
        </label>

        <label className="user-active-field">
          <input
            type="checkbox"
            checked={
              form.isActive
            }
            onChange={(event) => {
              setForm({
                ...form,
                isActive:
                  event.target.checked
              });
            }}
          />

          Active account
        </label>

        <div className="actions">
          <button
            className="button"
            type="submit"
            disabled={saving}
          >
            {editingId
              ? <Edit3 size={17} />
              : <UserPlus size={17} />}

            {saving
              ? 'Saving…'
              : editingId
                ? 'Update account'
                : 'Create Staff'}
          </button>

          {editingId && (
            <button
              className="button ghost"
              type="button"
              onClick={resetForm}
            >
              <X size={17} />
              Cancel editing
            </button>
          )}
        </div>
      </form>

      <div className="user-manager-toolbar">
        <h2>User accounts</h2>

        <select
          value={roleFilter}
          onChange={(event) => {
            setRoleFilter(
              event.target.value
            );
          }}
        >
          <option value="">
            All roles
          </option>
          <option value="Admin">
            Admin
          </option>
          <option value="Staff">
            Staff
          </option>
          <option value="Customer">
            Customer
          </option>
        </select>
      </div>

      {loading && (
        <div className="state">
          Loading accounts…
        </div>
      )}

      <div className="managed-user-list">
        {!loading &&
          filteredUsers.map(
            (account) => (
              <article
                className="managed-user-card"
                key={account.userId}
              >
                <div>
                  <strong>
                    {account.name}
                  </strong>

                  <span>
                    {account.email}
                  </span>
                </div>

                <span className="user-role">
                  {account.role}
                </span>

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

                <div className="actions">
                  <button
                    type="button"
                    onClick={() => {
                      editUser(account);
                    }}
                  >
                    <Edit3 size={16} />
                    Edit
                  </button>

                  <button
                    type="button"
                    className={
                      account.isActive
                        ? 'danger'
                        : ''
                    }
                    onClick={() => {
                                           changeStatus(
                        account
                      );
                    }}
                  >
                    {account.isActive
                      ? <UserMinus
                          size={16}
                        />
                      : <UserCheck
                          size={16}
                        />}

                    {account.isActive
                      ? 'Deactivate'
                      : 'Activate'}
                  </button>
                </div>
              </article>
            )
          )}
      </div>

      {!loading &&
        filteredUsers.length === 0 && (
          <div className="state">
            No accounts found.
          </div>
        )}
    </section>
  );
}