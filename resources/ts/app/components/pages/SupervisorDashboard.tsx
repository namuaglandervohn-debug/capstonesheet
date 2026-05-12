import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Card, CardContent, Typography, Box, Button, Grid, Paper,
  Chip, CircularProgress, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
  CalendarMonth, Assignment, QueryStats, PeopleAlt,
  TaskAlt, Timelapse, EventAvailable,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { API, HEADERS } from '../../lib/api';

interface Schedule {
  id: string;
  employee: string;
  week: string;
  outlet?: string;
  status: string;
  monday?: string; tuesday?: string; wednesday?: string;
  thursday?: string; friday?: string; saturday?: string; sunday?: string;
}

const DAY_KEYS: (keyof Schedule)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function SupervisorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ pendingRequests: 0, publishedSchedules: 0, pendingEvals: 0 });
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [publishedSchedules, setPublishedSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [reqRes, schedRes, evalRes] = await Promise.all([
          fetch(`${API}/requests`, { headers: HEADERS }),
          fetch(`${API}/schedules`, { headers: HEADERS }),
          fetch(`${API}/evaluations`, { headers: HEADERS }),
        ]);
        const [req, sched, evalData] = await Promise.all([reqRes.json(), schedRes.json(), evalRes.json()]);
        const allReqs: any[] = (req.requests ?? []).filter((r: any) => r != null);
        const pending = allReqs.filter(r => r.status === 'Pending');
        setPendingRequests(pending.slice(0, 5));
        const allSchedules: Schedule[] = (sched.schedules ?? []).filter((s: any) => s != null);
        const published = allSchedules.filter(s => s.status === 'Published');
        setPublishedSchedules(published);
        setStats({
          pendingRequests: pending.length,
          publishedSchedules: published.length,
          pendingEvals: (evalData.evaluations ?? []).filter((e: any) => e?.status === 'Pending GM Approval').length,
        });
      } catch (e) { console.error('Supervisor dashboard error:', e); }
      finally { setLoading(false); }
    })();
  }, []);

  const statCards = [
    { title: 'Pending Requests',      value: loading ? '…' : String(stats.pendingRequests),    icon: <Timelapse />,      color: '#D9A441' },
    { title: 'Published Schedules',   value: loading ? '…' : String(stats.publishedSchedules), icon: <EventAvailable />, color: '#1F7A47' },
    { title: 'Evaluations Submitted', value: loading ? '…' : String(stats.pendingEvals),       icon: <QueryStats />,     color: '#2F8F8B' },
  ];

  const shortcuts = [
    { title: 'Schedule Management', icon: <CalendarMonth />, path: '/dashboard/schedule',   color: '#1F7A47' },
    { title: 'Request Inbox',       icon: <Assignment />,    path: '/dashboard/requests',   color: '#D9A441' },
    { title: 'Evaluate Employees',  icon: <QueryStats />,    path: '/dashboard/evaluation', color: '#2F8F8B' },
    { title: 'Employee Directory',  icon: <PeopleAlt />,     path: '/dashboard/employees',  color: '#9C27B0' },
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' } }}>
          Supervisor Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Welcome, {user?.name} — Buenaventura Estate
        </Typography>
      </Box>

      {/* Loading */}
      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 2 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">Loading live stats…</Typography>
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

      {/* Published Schedules Panel */}
      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EventAvailable sx={{ color: '#1F7A47' }} />
            <Typography variant="h6" fontWeight="bold">Published Schedules</Typography>
            <Chip label={publishedSchedules.length} size="small" color="success" variant="outlined" />
          </Box>
          <Button size="small" variant="outlined" onClick={() => navigate('/dashboard/schedule')}>
            Manage Schedules
          </Button>
        </Box>
        <Divider sx={{ mb: 2 }} />
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3, gap: 1 }}>
            <CircularProgress size={20} />
            <Typography color="text.secondary" variant="body2">Loading schedules…</Typography>
          </Box>
        ) : publishedSchedules.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CalendarMonth sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">No published schedules yet.</Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
              Go to Schedule Management to create and publish employee schedules.
            </Typography>
          </Box>
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Employee</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Week / Period</TableCell>
                  {DAY_LABELS.map(d => (
                    <TableCell key={d} sx={{ fontWeight: 700, textAlign: 'center', fontSize: '0.75rem' }}>{d}</TableCell>
                  ))}
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {publishedSchedules.map(s => (
                  <TableRow key={s.id} hover>
                    <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{s.employee}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary', fontSize: '0.82rem' }}>{s.week}</TableCell>
                    {DAY_KEYS.map(day => {
                      const val = s[day] as string | undefined;
                      const isOff = !val || val === '' || val.toLowerCase() === 'off' || val.toLowerCase() === 'rest';
                      return (
                        <TableCell key={String(day)} sx={{ textAlign: 'center', p: '6px 4px' }}>
                          {isOff ? (
                            <Typography variant="caption" color="text.disabled">—</Typography>
                          ) : (
                            <Chip label={val} size="small" variant="outlined" color="success"
                              sx={{ fontSize: '0.68rem', height: 20, '& .MuiChip-label': { px: 0.75 } }} />
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell>
                      <Chip label="Published" size="small" color="success" sx={{ fontWeight: 600 }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Pending Request Inbox */}
      <Paper sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight="bold">Pending Requests (Inbox)</Typography>
          <Button size="small" onClick={() => navigate('/dashboard/requests')}>View All</Button>
        </Box>
        {pendingRequests.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <TaskAlt color="success" sx={{ fontSize: 40, mb: 1 }} />
            <Typography color="text.secondary">No pending requests — all clear!</Typography>
          </Box>
        ) : pendingRequests.map(r => (
          <Box key={r.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.25 }}>
                <Typography variant="body2" fontWeight={600} component="span">{r.employee} —</Typography>
                <Chip label={r.type} size="small" />
              </Box>
              <Typography variant="caption" color="text.secondary">Date: {r.date} · {r.reason?.slice(0, 50)}</Typography>
            </Box>
            <Button size="small" variant="outlined" onClick={() => navigate('/dashboard/requests')}>Review</Button>
          </Box>
        ))}
      </Paper>
    </Box>
  );
}
