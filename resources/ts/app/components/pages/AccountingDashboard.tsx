import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Card, CardContent, Typography, Box, Button, Grid, Paper,
  Chip, CircularProgress, Divider,
} from '@mui/material';
import { Payments, Analytics, TaskAlt, Timelapse, AccountBalanceWallet } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { API, HEADERS } from '../../lib/api';

export default function AccountingDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [forReview, setForReview] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [statsRes, payRes] = await Promise.all([
          fetch(`${API}/dashboard/stats`, { headers: HEADERS }),
          fetch(`${API}/payroll`, { headers: HEADERS }),
        ]);
        const [statsData, payData] = await Promise.all([statsRes.json(), payRes.json()]);
        setStats(statsData);
        const allPayrolls: any[] = (payData.payrolls ?? []).filter((p: any) => p != null);
        setForReview(allPayrolls.filter(p => p.status === 'For Review').slice(0, 5));
      } catch (e) { console.error('Accounting dashboard error:', e); }
      finally { setLoading(false); }
    })();
  }, []);

  const totalNet = forReview.reduce((sum, p) => {
    const v = parseFloat((p.netPay ?? '').replace(/[₱,]/g, '')) || 0;
    return sum + v;
  }, 0);

  const statCards = [
    {
      title: 'Payroll For Review',
      value: loading ? '…' : String(stats?.payrollForReview ?? 0),
      icon: <Timelapse />,
      color: '#D9A441',
    },
    {
      title: 'Payroll Released',
      value: loading ? '…' : String(stats?.payrollReleased ?? 0),
      icon: <TaskAlt />,
      color: '#1F7A47',
    },
    {
      title: 'Total Net Payable',
      value: loading ? '…' : (totalNet > 0 ? `₱${Math.round(totalNet).toLocaleString()}` : '₱0'),
      icon: <AccountBalanceWallet />,
      color: '#2F8F8B',
    },
  ];

  const shortcuts = [
    { title: 'Payroll Dashboard', icon: <Payments />,  path: '/dashboard/payroll',  color: '#1F7A47' },
    { title: 'Reports',           icon: <Analytics />, path: '/dashboard/reports',  color: '#2F8F8B' },
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' } }}>
          Accounting & Finance Dashboard
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

      {/* Payroll Awaiting Release */}
      <Paper sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight="bold">Payroll Awaiting Release</Typography>
          <Button variant="contained" size="small" onClick={() => navigate('/dashboard/payroll')}>Go to Payroll</Button>
        </Box>
        {forReview.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <TaskAlt color="success" sx={{ fontSize: 40, mb: 1 }} />
            <Typography color="text.secondary">No payroll records awaiting release</Typography>
          </Box>
        ) : (
          <>
            {forReview.map(p => (
              <Box key={p.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box>
                  <Typography variant="body2" fontWeight={600}>{p.employee}</Typography>
                  <Typography variant="caption" color="text.secondary">{p.position} · Period: {p.period}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body1" fontWeight="bold" color="success.main">{p.netPay}</Typography>
                  <Chip label="For Review" size="small" color="warning" />
                </Box>
              </Box>
            ))}
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" color="success" onClick={() => navigate('/dashboard/payroll')}>
                Proceed to Salary Release
              </Button>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
}
