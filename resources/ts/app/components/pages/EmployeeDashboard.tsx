import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Card, CardContent, Typography, Box, Button, Grid, Paper,
  Chip, CircularProgress, Divider,
} from '@mui/material';
import {
  CalendarMonth, Assignment, Payments,
  QueryStats, ManageAccounts, Fingerprint,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { API, HEADERS } from '../../lib/api';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mySchedule, setMySchedule] = useState<any | null>(null);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [myAttendance, setMyAttendance] = useState<any[]>([]);
  const [myPayslips, setMyPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [schedRes, reqRes, attRes, payRes] = await Promise.all([
          fetch(`${API}/schedules`, { headers: HEADERS }),
          fetch(`${API}/requests`, { headers: HEADERS }),
          fetch(`${API}/attendance`, { headers: HEADERS }),
          fetch(`${API}/payroll`, { headers: HEADERS }),
        ]);
        const [sched, req, att, pay] = await Promise.all([
          schedRes.json(), reqRes.json(), attRes.json(), payRes.json(),
        ]);
        const name = user?.name ?? '';
        const allSchedules = (sched.schedules ?? []).filter((s: any) => s?.employee === name);
        setMySchedule(allSchedules[allSchedules.length - 1] ?? null);
        setMyRequests((req.requests ?? []).filter((r: any) => r?.employee === name));
        setMyAttendance((att.attendance ?? []).filter((a: any) => a?.employee === name).slice(-7));
        setMyPayslips((pay.payrolls ?? []).filter((p: any) => p?.employee === name));
      } catch (e) {
        console.error('Employee dashboard error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const todayAtt = myAttendance.find(a => a.date === new Date().toISOString().split('T')[0]);
  const pendingReqs = myRequests.filter(r => r.status === 'Pending').length;
  const latestPayslip = myPayslips[myPayslips.length - 1];

  const statCards = [
    {
      title: 'Attendance Today',
      value: loading ? '…' : (todayAtt ? todayAtt.status : 'No entry'),
      icon: <Fingerprint />,
      color: '#2F8F8B',
    },
    {
      title: 'Active Schedule',
      value: loading ? '…' : (mySchedule ? (mySchedule.outlet ?? mySchedule.week ?? 'Assigned') : 'No schedule'),
      icon: <CalendarMonth />,
      color: '#1F7A47',
    },
    {
      title: 'Pending Requests',
      value: loading ? '…' : String(pendingReqs),
      icon: <Assignment />,
      color: '#D9A441',
    },
    {
      title: 'Latest Net Pay',
      value: loading ? '…' : (latestPayslip ? latestPayslip.netPay : '—'),
      icon: <Payments />,
      color: '#9C27B0',
    },
  ];

  const shortcuts = [
    { title: 'My Schedule',       icon: <CalendarMonth />, path: '/dashboard/schedule',   color: '#1F7A47' },
    { title: 'Daily Time Record', icon: <Fingerprint />,   path: '/dashboard/time',       color: '#2F8F8B' },
    { title: 'My Requests',       icon: <Assignment />,    path: '/dashboard/requests',   color: '#D9A441' },
    { title: 'My Payslips',       icon: <Payments />,      path: '/dashboard/payslips',   color: '#9C27B0' },
    { title: 'My Evaluation',     icon: <QueryStats />,    path: '/dashboard/evaluation', color: '#D32F2F' },
    { title: 'My Profile',        icon: <ManageAccounts />,path: '/dashboard/profile',    color: '#0277BD' },
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' } }}>
          Welcome back, {user?.name}! 👋
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Employee Portal — Buenaventura Estate
        </Typography>
      </Box>

      {/* Loading */}
      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 2 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">Loading your data…</Typography>
        </Box>
      )}

      {/* Stat Cards */}
      <Grid container spacing={{ xs: 2, md: 2.5 }} sx={{ mb: 4 }}>
        {statCards.map((stat, index) => (
          <Grid key={index} size={{ xs: 12, sm: 6, md: 4, lg: 3 }} sx={{ display: 'flex' }}>
            <Card elevation={0} sx={{
              height: 96, width: '100%',
              border: '1px solid', borderColor: 'divider',
              transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 4 },
            }}>
              <CardContent sx={{ height: '100%', display: 'flex', alignItems: 'center', p: '16px !important' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 2 }}>
                  <Box sx={{ bgcolor: stat.color, borderRadius: '14px', p: 1.5, display: 'flex', flexShrink: 0 }}>
                    <Box sx={{ color: 'white', display: 'flex', fontSize: '1.35rem' }}>{stat.icon}</Box>
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography fontWeight="bold" sx={{ fontSize: '1.25rem', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {stat.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {stat.title}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Quick Actions */}
      <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, border: '1px solid', borderColor: 'divider', mb: 3 }}>
        <Typography variant="h6" gutterBottom fontWeight="bold">Quick Actions</Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {shortcuts.map((shortcut, index) => (
            <Grid key={index} size={{ xs: 12, sm: 6, md: 4 }}>
              <Button
                fullWidth variant="outlined" size="large"
                startIcon={<Box sx={{ color: shortcut.color, display: 'flex' }}>{shortcut.icon}</Box>}
                onClick={() => navigate(shortcut.path)}
                sx={{ py: 1.5, justifyContent: 'flex-start', borderColor: 'divider', color: 'text.primary', '&:hover': { borderColor: shortcut.color, bgcolor: `${shortcut.color}11` } }}
              >
                {shortcut.title}
              </Button>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Recent Attendance */}
      {myAttendance.length > 0 && (
        <Paper sx={{ p: 2.5, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="h6" fontWeight="bold">Recent Attendance</Typography>
            <Button size="small" onClick={() => navigate('/dashboard/time')}>View All</Button>
          </Box>
          <Grid container spacing={1}>
            {myAttendance.slice(-5).reverse().map(a => (
              <Grid key={a.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" fontWeight={600}>{a.date}</Typography>
                    <Chip label={a.status} size="small" color={a.status === 'Present' ? 'success' : a.status === 'Late' ? 'warning' : 'error'} />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {a.timeIn || '—'} – {a.timeOut || '—'} · {a.totalHours || '—'} hrs
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Recent Requests */}
      {myRequests.length > 0 && (
        <Paper sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="h6" fontWeight="bold">My Requests</Typography>
            <Button size="small" onClick={() => navigate('/dashboard/requests')}>View All</Button>
          </Box>
          {myRequests.slice(-3).reverse().map(r => (
            <Box key={r.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box>
                <Typography variant="body2" fontWeight={600}>{r.type} — {r.date}</Typography>
                <Typography variant="caption" color="text.secondary">{r.reason?.slice(0, 60)}</Typography>
              </Box>
              <Chip label={r.status} size="small"
                color={r.status === 'Approved' ? 'success' : r.status === 'Disapproved' ? 'error' : r.status === 'Supervisor Approved' ? 'info' : 'warning'} />
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  );
}
