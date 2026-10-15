/*
| VIVA-UI – M.R. Ahamed – Admin Dashboard shell
|   Tabs per role/permission, badges, deep links (?tab=), 60-second live summary (GET /dashboard/summary)
| API paths are relative to /api/v1 (services/api.js).
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BadgeDollarSign,
  BarChart3,
  CalendarDays,
  Car,
  FileText,
  FolderLock,
  Gauge,
  Image,
  Inbox,
  Landmark,
  LogOut,
  Mail,
  Menu,
  MessageSquareText,
  MessageSquareWarning,
  Monitor,
  ShieldCheck,
  Store,
  Users,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';

import { api, errorMessage } from '../services/api';
import { useAuth } from '../features/auth/AuthContext';
import BookingManager from '../components/BookingManager';
import ContentManager from '../components/ContentManager';
import EnquiryManager from '../components/EnquiryManager';
import FinanceManager from '../components/FinanceManager';
import SessionManager from '../components/SessionManager';
import StaffPermissionManager from '../components/StaffPermissionManager';
import UserManager from '../components/UserManager';
import VehicleImageManager from '../components/VehicleImageManager';
import VehicleManager from '../components/VehicleManager';
import OverviewDashboard from '../components/admin/OverviewDashboard';
import ComplaintManager from '../components/admin/ComplaintManager';
import DocumentManager from '../components/admin/DocumentManager';
import ReportCenter from '../components/admin/ReportCenter';
import EmailCenter from '../components/admin/EmailCenter';
// VIVA – 16-CRUD completion: Naaziq's Reply Templates, Herathge's Finance Applications
import ReplyTemplateManager from '../components/admin/ReplyTemplateManager';
import FinanceApplicationManager from '../components/admin/FinanceApplicationManager';

/*
|--------------------------------------------------------------------------
| Operations dashboard
|--------------------------------------------------------------------------
|
| Tabs are shown according to the signed-in role and Staff permissions.
| The same rules are enforced by the API; hiding a tab here is only for
| convenience. The live summary refreshes every minute and raises a popup
| when new enquiries, test-drive requests or complaints arrive.
|
*/

const POLL_MS = 60000;

const TABS = [
  { name: 'Overview', group: 'Operations', icon: Gauge, component: null },
  { name: 'Vehicles', group: 'Operations', icon: Car, component: VehicleManager, can: (p) => p.canManageInventory },
  { name: 'Images', group: 'Operations', icon: Image, component: VehicleImageManager, can: (p) => p.canManageInventory },
  {
    name: 'Enquiries',
    group: 'Customers',
    icon: Inbox,
    component: EnquiryManager,
    can: (p) => p.canManageEnquiries && p.canViewAssignedContacts,
    badge: 'newEnquiries'
  },
  {
    name: 'Bookings',
    group: 'Customers',
    icon: CalendarDays,
    component: BookingManager,
    // VIVA – Ahamed – test drives have their own permission since October 2026
    can: (p) => p.canManageBookings && p.canViewAssignedContacts,
    badge: 'pendingBookings'
  },
  {
    name: 'Complaints',
    group: 'Customers',
    icon: MessageSquareWarning,
    component: ComplaintManager,
    can: (p) => p.canManageComplaints,
    badge: 'openComplaints',
    urgent: 'urgentComplaints'
  },
  {
    name: 'Reply templates',
    group: 'Customers',
    icon: MessageSquareText,
    component: ReplyTemplateManager,
    can: (p) => p.canManageEnquiries || p.canManageComplaints
  },
  {
    name: 'Documents',
    group: 'Customers',
    icon: FolderLock,
    component: DocumentManager,
    can: (p) => p.canManageInventory || p.canManageEnquiries || p.canManageBookings || p.canManageComplaints
  },
  { name: 'Reports', group: 'Insights', icon: BarChart3, component: ReportCenter, can: (p) => p.canViewLimitedAnalytics },
  { name: 'Users', group: 'Administration', icon: Users, component: UserManager, adminOnly: true },
  { name: 'Permissions', group: 'Administration', icon: ShieldCheck, component: StaffPermissionManager, adminOnly: true },
  { name: 'Sessions', group: 'Administration', icon: Monitor, component: SessionManager },
  { name: 'Content', group: 'Administration', icon: FileText, component: ContentManager, adminOnly: true },
  { name: 'Financing', group: 'Administration', icon: BadgeDollarSign, component: FinanceManager, adminOnly: true },
  {
    name: 'Finance applications',
    group: 'Administration',
    icon: Landmark,
    component: FinanceApplicationManager,
    adminOnly: true,
    badge: 'awaitingFinance'
  },
  { name: 'Emails', group: 'Administration', icon: Mail, component: EmailCenter, adminOnly: true, badge: 'failedEmails', urgent: 'failedEmails' }
];

const ATTENTION = [
  ['newEnquiries', 'new enquiry', 'new enquiries', 'Enquiries', Inbox],
  ['pendingBookings', 'test-drive request', 'test-drive requests', 'Bookings', CalendarDays],
  ['openComplaints', 'open complaint', 'open complaints', 'Complaints', MessageSquareWarning],
  ['failedEmails', 'failed email', 'failed emails', 'Emails', Mail],
  ['awaitingFinance', 'finance application to review', 'finance applications to review', 'Finance applications', Landmark]
];

function visibleTabs(user) {
  if (user?.role === 'Admin') {
    return TABS;
  }

  if (user?.role !== 'Staff') {
    return [];
  }

  const permissions = user.permissions || {};

  return TABS.filter((tab) => !tab.adminOnly && (!tab.can || tab.can(permissions)));
}

export default function Admin() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, logout: logoutUser, refreshUser } = useAuth();
  const tabs = useMemo(() => visibleTabs(user), [user]);
  const requested = searchParams.get('tab');
  const tab = tabs.find((entry) => entry.name === requested) || tabs[0];
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(null);
  const [online, setOnline] = useState(true);
  const previous = useRef(null);

  const setTab = useCallback(
    (name) => {
      setSearchParams(name === 'Overview' ? {} : { tab: name });
      setOpen(false);
    },
    [setSearchParams]
  );

  const loadSummary = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setSummaryLoading(true);
      }

      try {
        const response = await api.get('/dashboard/summary');
        const data = response.data.data;
        const attention = data.attention || {};

        // Popup when new work arrives between polls.
        if (previous.current) {
          for (const [key, singular, plural, target, Icon] of ATTENTION) {
            const increase = (attention[key] || 0) - (previous.current[key] || 0);

            if (increase > 0 && tabs.some((entry) => entry.name === target)) {
              toast(
                (t) => (
                  <button
                    type="button"
                    className="toast-notification"
                    onClick={() => {
                      toast.dismiss(t.id);
                      setTab(target);
                    }}
                  >
                    <Icon aria-hidden="true" />
                    <span>
                      <strong>
                        {increase} {increase === 1 ? singular : plural}
                      </strong>
                      <small>Open {target}</small>
                    </span>
                  </button>
                ),
                { id: `attention-${key}-${attention[key]}`, duration: 8000 }
              );
            }
          }
        }

        previous.current = attention;
        setSummary(data);
        setSummaryError(null);
        setOnline(true);
      } catch (error) {
        setSummaryError(errorMessage(error, 'Could not load the dashboard summary'));
        setOnline(error.response ? true : false);
      } finally {
        setSummaryLoading(false);
      }
    },
    [tabs, setTab]
  );

  useEffect(() => {
    // Permissions may have changed since the last sign-in.
    refreshUser?.().catch(() => {});
  }, [refreshUser]);

  useEffect(() => {
    loadSummary();

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadSummary({ silent: true });
      }
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [loadSummary]);

  // Refresh the badges after switching sections (records may have changed).
  useEffect(() => {
    if (summary) {
      loadSummary({ silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab?.name]);

  if (!tab) {
    return (
      <main className="route-loading">
        <p>Your account does not have access to any dashboard sections yet. Ask an Admin to assign permissions.</p>
        <button type="button" className="button" onClick={() => navigate('/')}>
          Back to the store
        </button>
      </main>
    );
  }

  const handleLogout = async () => {
    await logoutUser();
    navigate('/');
  };

  const attention = summary?.attention || {};
  const groups = [...new Set(tabs.map((entry) => entry.group))];
  const ActiveComponent = tab.component;
  const can = (name) => tabs.some((entry) => entry.name === name);

  return (
    <div className="admin">
      <aside className={open ? 'open' : ''} aria-label="Dashboard navigation">
        <div className="admin-logo">
          HS <span>CONTROL</span>
        </div>

        <button type="button" className="store-switch" onClick={() => navigate('/')}>
          <Store />
          View Store
        </button>

        {groups.map((group) => (
          <div className="admin-nav-group" key={group}>
            <p>{group}</p>
            {tabs
              .filter((entry) => entry.group === group)
              .map(({ name, icon: Icon, badge, urgent }) => {
                const count = badge ? attention[badge] || 0 : 0;
                const isUrgent = urgent && (attention[urgent] || 0) > 0;

                return (
                  <button
                    type="button"
                    className={tab.name === name ? 'active' : ''}
                    aria-current={tab.name === name ? 'page' : undefined}
                    onClick={() => setTab(name)}
                    key={name}
                  >
                    <Icon />
                    {name}
                    {count > 0 && (
                      <span className={`admin-nav-badge ${isUrgent ? 'is-urgent' : ''}`} aria-label={`${count} need attention`}>
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        ))}

        <button type="button" className="admin-signout" onClick={handleLogout}>
          <LogOut />
          Sign out
        </button>
      </aside>

      {open && <button type="button" className="admin-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />}

      <main>
        <header className="admin-topbar">
          <button
            type="button"
            className="menu"
            onClick={() => setOpen((current) => !current)}
            aria-label="Toggle dashboard navigation"
            aria-expanded={open}
          >
            {open ? <X /> : <Menu />}
          </button>

          <div className="admin-topbar__title">
            <p className="eyebrow">HIGH STREET OPERATIONS · {tab.group.toUpperCase()}</p>
            <h1>{tab.name}</h1>
            <p className="dashboard-user">
              Signed in as <strong>{user?.name}</strong> <span className="role-chip">{user?.role}</span>
            </p>
          </div>

          <div className="admin-topbar__status">
            <div className="attention-chips" aria-label="Needs attention">
              {ATTENTION.filter(([key, , , target]) => can(target) && (attention[key] || 0) > 0).map(
                ([key, singular, plural, target, Icon]) => (
                  <button
                    type="button"
                    key={key}
                    className={`attention-chip ${key === 'failedEmails' || (key === 'openComplaints' && attention.urgentComplaints) ? 'is-urgent' : ''}`}
                    onClick={() => setTab(target)}
                  >
                    <Icon aria-hidden="true" />
                    {attention[key]} {attention[key] === 1 ? singular : plural}
                  </button>
                )
              )}
              {summary && !ATTENTION.some(([key, , , target]) => can(target) && (attention[key] || 0) > 0) && (
                <span className="attention-chip is-clear">Nothing waiting — all caught up</span>
              )}
            </div>
            <span className={online ? 'online' : 'online is-offline'} role="status">
              ● {online ? 'System online' : 'API unreachable'}
            </span>
          </div>
        </header>

        <section className="admin-panel">
          {tab.name === 'Overview' ? (
            <OverviewDashboard
              summary={summary}
              loading={summaryLoading}
              error={summaryError}
              onRefresh={() => loadSummary()}
              onNavigate={setTab}
              can={can}
            />
          ) : (
            ActiveComponent && <ActiveComponent />
          )}
        </section>
      </main>
    </div>
  );
}
