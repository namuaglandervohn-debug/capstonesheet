import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Card, CardContent, Typography, Box, Button, Grid, Paper,
  Chip, CircularProgress, Divider,
} from '@mui/material';
import {
  PersonAddAlt1, QueryStats, PeopleAlt, Analytics,
  EmojiEvents, Timelapse, TrendingUp,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { API, HEADERS } from '../../lib/api';

export default function GMDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [forInterview, setForInterview] = useState<any[]>([]);
  const [topEvaluations, setTopEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [statsRes, appRes, evalRes] = await Promise.all([
          fetch(`${API}/dashboard/stats`, { headers: HEADERS }),
          fetch(`${API}/applications`, { headers: HEADERS }),
          fetch(`${API}/evaluations`, { headers: HEADERS }),
        ]);
        const [statsData, appData, evalData] = await Promise.all([
          statsRes.json(), appRes.json(), evalRes.json(),
        ]);
        setStats(statsData);
        setForInterview((appData.applications ?? []).filter((a: any) => a?.status === 'For Interview').slice(0, 5));
        const evals = (evalData.evaluations ?? []).filter((e: any) => e?.status === 'Pending GM Approval');
        setTopEvaluations(evals.sort((a: any, b: any) => b.finalScore - a.finalScore).slice(0, 5));
      } catch (e) { console.error('GM dashboard error:', e); }
      finally { setLoading(false); }
    })();
  }, []);

  const statCards = [
    { title: 'Active Employees',      value: loading ? '…' : String(stats?.activeEmployees ?? 0),   icon: <PeopleAlt />,     color: '#1F7A47' },
    { title: 'For Interview',         value: loading ? '…' : String(stats?.forInterviewCount ?? 0), icon: <PersonAddAlt1 />, color: '#2F8F8B' },
    { title: 'Pending DSS Approvals', value: loading ? '…' : String(topEvaluations.length),         icon: <TrendingUp />,    color: '#D9A441' },
    { title: 'Pending Requests',      value: loading ? '…' : String(stats?.pendingRequests ?? 0),   icon: <Timelapse />,     color: '#B73E2D' },
  ];

  const shortcuts = [
    { title: 'Recruitment & Hiring',   icon: <PersonAddAlt1 />, path: '/dashboard/recruitment', color: '#1F7A47' },
    { title: 'DSS Performance Review', icon: <QueryStats />,    path: '/dashboard/evaluation',  color: '#D9A441' },
    { title: 'Employee Directory',     icon: <PeopleAlt />,     path: '/dashboard/employees',   color: '#2F8F8B' },
    { title: 'Reports & Analytics',    icon: <Analytics />,     path: '/dashboard/reports',     color: '#9C27B0' },
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' } }}>
          General Manager Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Welcome, {user?.name} — Estate-wide Overview
        </Typography>
      </Box>

      {/* Loading */}
      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 2 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">Loading estate data…</Typography>
        </Box>
      )}

      {/* EOTM Banner — content, preserved as-is */}
      {stats?.eotmEmployee && (
        <Paper sx={{ p: 2.5, mb: 3, background: 'linear-gradient(135deg, #D9A441 0%, #E8C06A 100%)', color: 'white', borderRadius: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <EmojiEvents sx={{ fontSize: 48 }} />
            <Box>
              <Typography variant="caption" sx={{ opacity: 0.9, letterSpacing: 1 }}>🏆 EMPLOYEE OF THE MONTH</Typography>
              <Typography variant="h5" fontWeight="bold">{stats.eotmEmployee}</Typography>
              <Typography variant="body2" sx={{ opacity: 0.85 }}>Highest DSS Performance Score</Typography>
            </Box>
          </Box>
        </Paper>
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

      {/* Applicants For Interview */}
      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight="bold">Applicants for Interview</Typography>
          <Button size="small" onClick={() => navigate('/dashboard/recruitment')}>Manage</Button>
        </Box>
        {forInterview.length === 0 ? (
          <Typography color="text.secondary" variant="body2">No applicants scheduled for interview.</Typography>
        ) : forInterview.map(a => (
          <Box key={a.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box>
              <Typography variant="body2" fontWeight={600}>{a.name}</Typography>
              <Typography variant="caption" color="text.secondary">{a.position} · {a.interviewDate ?? 'Date TBD'}</Typography>
            </Box>
            <Chip label="For Interview" size="small" color="info" />
          </Box>
        ))}
      </Paper>

      {/* Pending DSS Evaluations */}
      {topEvaluations.length > 0 && (
        <Paper sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" fontWeight="bold">DSS Evaluations — Pending Your Approval</Typography>
            <Button size="small" variant="contained" onClick={() => navigate('/dashboard/evaluation')}>Approve Now</Button>
          </Box>
          {topEvaluations.map((e, i) => (
            <Box key={e.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Chip label={`#${i + 1}`} size="small" color={i === 0 ? 'warning' : 'default'} />
                <Box>
                  <Typography variant="body2" fontWeight={600}>{e.employee}</Typography>
                  <Typography variant="caption" color="text.secondary">{e.position} · {e.period}</Typography>
                </Box>
              </Box>
              <Typography variant="body1" fontWeight="bold" color="primary">{e.finalScore?.toFixed(2)}%</Typography>
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  );
}
