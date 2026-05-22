import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Typography,
} from '@mui/material';
import {
  AccountBalance,
  CloudUpload,
  EmojiEvents,
  EventAvailable,
  GroupAdd,
  ManageAccounts,
  Payments,
  PendingActions,
  PeopleAlt,
  PersonAddAlt1,
  QueryStats,
  WarningAmber,
} from '@mui/icons-material';
import { API, HEADERS } from '../../lib/api';
import { supabase } from '../../lib/supabaseClient';

interface Stats {
  activeEmployees: number;
  pendingApplications: number;
  forInterviewCount: number;
  pendingRequests: number;
  supervisorApprovedRequests: number;
  attendanceIssues: number;
  payrollForReview: number;
  topEvaluee: string | null;
  topScore: number | null;
}

type AnyRecord = Record<string, unknown>;

const DEFAULT_STATS: Stats = {
  activeEmployees: 0,
  pendingApplications: 0,
  forInterviewCount: 0,
  pendingRequests: 0,
  supervisorApprovedRequests: 0,
  attendanceIssues: 0,
  payrollForReview: 0,
  topEvaluee: null,
  topScore: null,
};

const DASHBOARD_STAT_KEYS = {
  activeEmployees: [
    'activeEmployees',
    'active_employees',
    'activeEmployeeCount',
    'active_employee_count',
    'activeEmployeesCount',
    'employeesActive',
    'employees_active',
    'active_count',
    'totalActiveEmployees',
    'total_active_employees',
  ],
  pendingApplications: [
    'pendingApplications',
    'pending_applications',
    'pendingApplicants',
    'pending_applicants',
    'pendingApplicationCount',
    'pending_application_count',
  ],
  forInterviewCount: [
    'forInterviewCount',
    'for_interview_count',
    'forInterview',
    'for_interview',
    'interviewCount',
    'interview_count',
  ],
  pendingRequests: [
    'pendingRequests',
    'pending_requests',
    'pendingRequestCount',
    'pending_request_count',
  ],
  supervisorApprovedRequests: [
    'supervisorApprovedRequests',
    'supervisor_approved_requests',
    'pendingHrValidation',
    'pending_hr_validation',
    'pendingHRValidation',
    'hrValidationCount',
    'hr_validation_count',
  ],
  attendanceIssues: [
    'attendanceIssues',
    'attendance_issues',
    'attendanceIssueCount',
    'attendance_issue_count',
  ],
  payrollForReview: [
    'payrollForReview',
    'payroll_for_review',
    'payrollReviewCount',
    'payroll_review_count',
  ],
  topEvaluee: [
    'topEvaluee',
    'top_evaluee',
    'topPerformer',
    'top_performer',
    'bestEmployee',
    'best_employee',
  ],
  topScore: ['topScore', 'top_score', 'topPerformerScore', 'top_performer_score', 'score'],
};

const isRecord = (value: unknown): value is AnyRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const cleaned = value.trim().replace(/,/g, '');
    if (!cleaned) return null;

    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const toText = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (isRecord(value)) {
    const firstName = toText(value.first_name ?? value.firstName);
    const middleName = toText(value.middle_name ?? value.middleName);
    const lastName = toText(value.last_name ?? value.lastName);
    const fullName = toText(value.name ?? value.full_name ?? value.fullName);

    if (fullName) return fullName;

    const nameParts = [firstName, middleName, lastName].filter(Boolean);
    return nameParts.length > 0 ? nameParts.join(' ') : null;
  }

  return null;
};

const getPossibleSources = (payload: unknown): AnyRecord[] => {
  const sources: AnyRecord[] = [];

  const addSource = (value: unknown) => {
    if (isRecord(value) && !sources.includes(value)) {
      sources.push(value);
    }
  };

  addSource(payload);

  if (isRecord(payload)) {
    addSource(payload.data);
    addSource(payload.stats);
    addSource(payload.summary);
    addSource(payload.dashboard);
    addSource(payload.result);

    if (isRecord(payload.data)) {
      addSource(payload.data.stats);
      addSource(payload.data.summary);
      addSource(payload.data.dashboard);
      addSource(payload.data.result);
    }
  }

  return sources;
};

const readValue = (payload: unknown, keys: string[]): unknown => {
  for (const source of getPossibleSources(payload)) {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        return source[key];
      }
    }
  }

  return undefined;
};

const readNumber = (payload: unknown, keys: string[]): number | null => toNumber(readValue(payload, keys));

const readString = (payload: unknown, keys: string[]): string | null => toText(readValue(payload, keys));

const normalizeDashboardStats = (payload: unknown): Stats => ({
  activeEmployees: readNumber(payload, DASHBOARD_STAT_KEYS.activeEmployees) ?? DEFAULT_STATS.activeEmployees,
  pendingApplications:
    readNumber(payload, DASHBOARD_STAT_KEYS.pendingApplications) ?? DEFAULT_STATS.pendingApplications,
  forInterviewCount:
    readNumber(payload, DASHBOARD_STAT_KEYS.forInterviewCount) ?? DEFAULT_STATS.forInterviewCount,
  pendingRequests: readNumber(payload, DASHBOARD_STAT_KEYS.pendingRequests) ?? DEFAULT_STATS.pendingRequests,
  supervisorApprovedRequests:
    readNumber(payload, DASHBOARD_STAT_KEYS.supervisorApprovedRequests) ??
    DEFAULT_STATS.supervisorApprovedRequests,
  attendanceIssues: readNumber(payload, DASHBOARD_STAT_KEYS.attendanceIssues) ?? DEFAULT_STATS.attendanceIssues,
  payrollForReview: readNumber(payload, DASHBOARD_STAT_KEYS.payrollForReview) ?? DEFAULT_STATS.payrollForReview,
  topEvaluee: readString(payload, DASHBOARD_STAT_KEYS.topEvaluee),
  topScore: readNumber(payload, DASHBOARD_STAT_KEYS.topScore),
});

const fetchJson = async (endpoint: string, signal: AbortSignal): Promise<unknown> => {
  const response = await fetch(`${API}${endpoint}`, { headers: HEADERS, signal });

  if (!response.ok) {
    throw new Error(`${endpoint} responded with ${response.status}`);
  }

  return response.json();
};

const fetchActiveEmployeesCount = async (signal?: AbortSignal): Promise<number> => {
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }

  const { count, error } = await supabase
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .ilike('status', 'active');

  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }

  if (error) throw error;

  return count ?? 0;
};

export default function HRDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDashboardStats = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const dashboardPayload = await fetchJson('/dashboard/stats', signal);
      const normalizedStats = normalizeDashboardStats(dashboardPayload);

      try {
        const activeEmployeesCount = await fetchActiveEmployeesCount(signal);

        setStats({
          ...normalizedStats,
          activeEmployees: activeEmployeesCount,
        });
      } catch (activeEmployeesError) {
        if (activeEmployeesError instanceof DOMException && activeEmployeesError.name === 'AbortError') return;

        console.warn('Active employees count error:', activeEmployeesError);

        setStats(normalizedStats);
        setErrorMessage(
          'Dashboard stats loaded, but Active Employees could not be counted from the employees table.',
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;

      console.error('Dashboard stats error:', error);

      try {
        const activeEmployeesCount = await fetchActiveEmployeesCount(signal);

        setStats({
          ...DEFAULT_STATS,
          activeEmployees: activeEmployeesCount,
        });

        setErrorMessage('Some dashboard stats could not be loaded, but Active Employees was fetched successfully.');
      } catch (fallbackError) {
        if (fallbackError instanceof DOMException && fallbackError.name === 'AbortError') return;

        console.error('Active employees fallback error:', fallbackError);
        setStats(DEFAULT_STATS);
        setErrorMessage('Unable to load dashboard stats. Please check the API connection and Supabase access.');
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadDashboardStats(controller.signal);

    return () => controller.abort();
  }, [loadDashboardStats]);

  const statCards = [
    {
      title: 'Active Employees',
      value: loading ? '…' : String(stats.activeEmployees),
      icon: <PeopleAlt />,
      color: '#1F7A47',
    },
    {
      title: 'Pending Applications',
      value: loading ? '…' : String(stats.pendingApplications),
      icon: <PersonAddAlt1 />,
      color: '#ed6c02',
    },
    {
      title: 'For Interview',
      value: loading ? '…' : String(stats.forInterviewCount),
      icon: <EventAvailable />,
      color: '#2F8F8B',
    },
    {
      title: 'Pending HR Validation',
      value: loading ? '…' : String(stats.supervisorApprovedRequests),
      icon: <PendingActions />,
      color: '#9c27b0',
    },
    {
      title: 'Attendance Issues',
      value: loading ? '…' : String(stats.attendanceIssues),
      icon: <WarningAmber />,
      color: '#d32f2f',
    },
    {
      title: 'Payroll For Review',
      value: loading ? '…' : String(stats.payrollForReview),
      icon: <AccountBalance />,
      color: '#0277BD',
    },
    {
      title: 'Top Performer',
      value: loading
        ? '…'
        : stats.topEvaluee
          ? `${stats.topEvaluee} (${stats.topScore?.toFixed(1) ?? '0.0'}%)`
          : 'No data',
      icon: <EmojiEvents />,
      color: '#b8860b',
    },
  ];

  const shortcuts = [
    { title: 'Manage Employees', icon: <ManageAccounts />, path: '/dashboard/employees', color: '#1F7A47' },
    { title: 'Review Applications', icon: <PersonAddAlt1 />, path: '/dashboard/recruitment', color: '#ed6c02' },
    { title: 'Import Attendance', icon: <CloudUpload />, path: '/dashboard/attendance', color: '#2F8F8B' },
    { title: 'Generate Payroll', icon: <Payments />, path: '/dashboard/payroll', color: '#0277BD' },
    { title: 'View DSS Results', icon: <QueryStats />, path: '/dashboard/evaluation', color: '#9c27b0' },
    { title: 'User Accounts', icon: <GroupAdd />, path: '/dashboard/users', color: '#b8860b' },
  ];

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          fontWeight="bold"
          sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' } }}
        >
          HR / Admin Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Welcome to Buenaventura Estate HRIS
        </Typography>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 2 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">
            Loading live stats…
          </Typography>
        </Box>
      )}

      {errorMessage && !loading && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                const controller = new AbortController();
                void loadDashboardStats(controller.signal);
              }}
            >
              Retry
            </Button>
          }
        >
          {errorMessage}
        </Alert>
      )}

      <Grid container spacing={{ xs: 2, md: 2.5 }} sx={{ mb: 4 }}>
        {statCards.map((stat) => (
          <Grid key={stat.title} size={{ xs: 12, sm: 6, md: 4, lg: 3 }} sx={{ display: 'flex' }}>
            <Card
              elevation={0}
              sx={{
                height: 96,
                width: '100%',
                border: '1px solid',
                borderColor: 'divider',
                transition: 'box-shadow 0.2s',
                '&:hover': { boxShadow: 4 },
              }}
            >
              <CardContent
                sx={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  p: '16px !important',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 2 }}>
                  <Box
                    sx={{
                      bgcolor: stat.color,
                      borderRadius: '14px',
                      p: 1.5,
                      display: 'flex',
                      flexShrink: 0,
                    }}
                  >
                    <Box sx={{ color: 'white', display: 'flex', fontSize: '1.35rem' }}>{stat.icon}</Box>
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      fontWeight="bold"
                      sx={{
                        fontSize: '1.25rem',
                        lineHeight: 1.2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {stat.value}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {stat.title}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" gutterBottom fontWeight="bold">
          Quick Actions
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {shortcuts.map((shortcut) => (
            <Grid key={shortcut.title} size={{ xs: 12, sm: 6, md: 4 }}>
              <Button
                fullWidth
                variant="outlined"
                size="large"
                startIcon={<Box sx={{ color: shortcut.color, display: 'flex' }}>{shortcut.icon}</Box>}
                onClick={() => navigate(shortcut.path)}
                sx={{
                  py: 1.5,
                  justifyContent: 'flex-start',
                  borderColor: 'divider',
                  color: 'text.primary',
                  '&:hover': { borderColor: shortcut.color, bgcolor: `${shortcut.color}11` },
                }}
              >
                {shortcut.title}
              </Button>
            </Grid>
          ))}
        </Grid>
      </Paper>
    </Box>
  );
}
