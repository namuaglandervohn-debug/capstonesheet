import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, Grid, CircularProgress,
  Alert, Snackbar, Tooltip, IconButton, MenuItem,
} from '@mui/material';
import { Calculate, Visibility, Send, AddCircleOutline, Sync, Payments, TaskAlt, DeleteOutline, Print } from '@mui/icons-material';
import { API, HEADERS } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { POSITIONS } from '../../lib/constants';

// ── Position → Default Monthly Salary mapping ────────────────────────────
const POSITION_SALARIES: Record<string, number> = {
  'General Manager': 65000, 'Assistant General Manager': 50000,
  'Operations Manager': 45000, 'Front Office & Sales Supervisor': 35000,
  'Chef/Cook': 22000, 'Commis Chef': 18000, 'Dispatcher/Steward': 16000,
  'Public/Room Attendant': 15000, 'Pool Attendant': 15000,
  'Laundry Attendant': 15000, 'Gardener': 15000,
  'HR and Admin Manager': 40000, 'Payroll Staff': 25000,
  'Driver/Liaison': 18000, 'Purchaser': 20000, 'Stockman': 16000,
  'Accounting and Finance Manager': 45000, 'Accounting Officer': 28000,
  'Finance Officer': 28000, 'Compliance Officer': 28000,
  'Service Crew': 15000, 'Sales Associate': 16000, 'Cashier': 16000,
  'HR Assistant': 18000, 'Security Guard': 16000, 'Maintenance Staff': 15000,
};

interface Payroll {
  id: string; employee: string; position: string; period: string;
  totalHours: string; overtime: string; deductions: string;
  grossPay: string; netPay: string; status: 'Draft' | 'For Review' | 'Processed' | 'Released';
  // Extended payslip fields
  payslipDate?: string;
  basicPayAmt?: string;
  otAmt?: string;
  nsdHours?: string; nsdAmt?: string;
  regularHolidayDays?: string; regularHolidayAmt?: string;
  specialHolidayDays?: string; specialHolidayAmt?: string;
  silDays?: string; silAmt?: string;
  allowanceAmt?: string;
  retroAmt?: string;
  tardinessMin?: string;
  undertimeHours?: string;
  sssAmt?: string;
  phicAmt?: string;
  hdmfAmt?: string;
  cashAdvance?: string;
  atd?: string;
  otherCharges?: string;
  breakages?: string;
  amesco?: string;
  pagibigLoan?: string;
}

const EMPTY = { employee: '', position: '', period: new Date().toISOString().slice(0, 7), totalHours: '', overtime: '0', deductions: '0', grossPay: '', netPay: '' };

export default function PayrollComputation() {
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null);
  const [viewDialog, setViewDialog] = useState(false);
  const [addDialog, setAddDialog] = useState(false);
  const [generateDialog, setGenerateDialog] = useState(false);
  const [generatePeriod, setGeneratePeriod] = useState(new Date().toISOString().slice(0, 7));
  const [generateBase, setGenerateBase] = useState('18000');
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const { user } = useAuth();
  const [generatePosition, setGeneratePosition] = useState('');

  // ── Payslip edit state ───────────────────────────────────────────────
  const [editingPayslip, setEditingPayslip] = useState(false);
  const EDIT_EMPTY = {
    employee: '', position: '', period: '',
    payslipDate: '',
    totalHours: '', basicPayAmt: '',
    overtime: '', otAmt: '',
    nsdHours: '', nsdAmt: '',
    regularHolidayDays: '', regularHolidayAmt: '',
    specialHolidayDays: '', specialHolidayAmt: '',
    silDays: '', silAmt: '',
    allowanceAmt: '', retroAmt: '',
    tardinessMin: '', undertimeHours: '',
    grossPay: '',
    sssAmt: '', phicAmt: '', hdmfAmt: '',
    cashAdvance: '', atd: '', otherCharges: '', breakages: '', amesco: '', pagibigLoan: '',
    deductions: '', netPay: '',
  };
  const [payslipEditForm, setPayslipEditForm] = useState(EDIT_EMPTY);
  const pef = (k: keyof typeof EDIT_EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setPayslipEditForm(f => ({ ...f, [k]: e.target.value }));

  const fetchPayroll = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/payroll`, { headers: HEADERS });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Server error');
      // Deduplicate by id to prevent React key collisions
      const raw: Payroll[] = (data.payrolls ?? []).filter((p: any) => p != null);
      const seen = new Set<string>();
      const deduped = raw.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
      setPayrolls(deduped);
    } catch (e: any) { setError(`Could not load payroll: ${e.message}`); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPayroll(); }, []);

  const handleAdd = async () => {
    if (!form.employee || !form.grossPay) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/payroll`, { method: 'POST', headers: HEADERS, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Server error');
      // Guard against duplicate id
      setPayrolls(prev => prev.some(p => p.id === data.record?.id) ? prev : [...prev, data.record]);
      setAddDialog(false); setForm(EMPTY);
      setSnackbar({ open: true, message: 'Payroll record saved to Supabase!', severity: 'success' });
    } catch (e: any) { setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' }); }
    finally { setSaving(false); }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${API}/payroll/generate`, {
        method: 'POST', headers: HEADERS,
        body: JSON.stringify({ period: generatePeriod, baseSalary: parseFloat(generateBase) || 18000, position: generatePosition || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Server error');
      if (data.count === 0) {
        setSnackbar({ open: true, message: 'All active employees already have payroll for this period.', severity: 'success' });
      } else {
        // Only append records whose ids are not already in state
        setPayrolls(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newRecords = (data.created ?? []).filter((r: any) => r && !existingIds.has(r.id));
          return [...prev, ...newRecords];
        });
        setSnackbar({ open: true, message: `✅ Generated ${data.count} payroll record(s) for ${generatePeriod}!`, severity: 'success' });
      }
      setGenerateDialog(false);
      setGeneratePosition('');
    } catch (e: any) { setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' }); }
    finally { setGenerating(false); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await fetch(`${API}/payroll/${id}`, { method: 'PUT', headers: HEADERS, body: JSON.stringify({ status }) });
      if (!res.ok) throw new Error('Update failed');
      setPayrolls(prev => prev.map(p => p.id === id ? { ...p, status: status as Payroll['status'] } : p));
      if (selectedPayroll?.id === id) setSelectedPayroll(p => p ? { ...p, status: status as Payroll['status'] } : p);
      setSnackbar({ open: true, message: `Status updated to "${status}"!`, severity: 'success' });
    } catch (e: any) { setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' }); }
  };

  const handleReleaseSalary = async (ids?: string[]) => {
    const targets = ids ? payrolls.filter(p => ids.includes(p.id)) : filtered.filter(p => p.status === 'For Review');
    if (targets.length === 0) { setSnackbar({ open: true, message: 'No "For Review" payrolls to release.', severity: 'success' }); return; }
    const today = new Date().toISOString().split('T')[0];
    let count = 0;
    for (const p of targets) {
      try {
        await fetch(`${API}/payroll/${p.id}`, { method: 'PUT', headers: HEADERS, body: JSON.stringify({ status: 'Released', releasedBy: user?.name ?? 'Accounting', payslipDate: today }) });
        setPayrolls(prev => prev.map(x => x.id === p.id ? { ...x, status: 'Released' as any, payslipDate: today } : x));
        count++;
      } catch (_) {}
    }
    setSnackbar({ open: true, message: `✅ ${count} salary record(s) marked as Released!`, severity: 'success' });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Delete payroll record ${id}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API}/payroll/${id}`, { method: 'DELETE', headers: HEADERS });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Server error');
      setPayrolls(prev => prev.filter(p => p.id !== id));
      setSnackbar({ open: true, message: `🗑️ Payroll record ${id} deleted.`, severity: 'success' });
    } catch (e: any) { setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' }); }
  };

  const filtered = payrolls.filter(p => {
    const periodMatch = !filterPeriod || p.period === filterPeriod;
    const statusMatch = filterStatus === 'all' || p.status.toLowerCase().replace(' ', '') === filterStatus.toLowerCase().replace(' ', '');
    return periodMatch && statusMatch;
  });

  const parseAmt = (v: string) => parseFloat((v ?? '').replace(/[₱,]/g, '')) || 0;
  const totals = filtered.reduce((acc, p) => ({
    gross: acc.gross + parseAmt(p.grossPay),
    net: acc.net + parseAmt(p.netPay),
    ded: acc.ded + parseAmt(p.deductions),
  }), { gross: 0, net: 0, ded: 0 });

  const handleForwardToAccounting = async () => {
    const drafts = filtered.filter(p => p.status === 'Draft');
    if (drafts.length === 0) { setSnackbar({ open: true, message: 'No Draft payrolls to forward.', severity: 'success' }); return; }
    let count = 0;
    for (const p of drafts) {
      try {
        await fetch(`${API}/payroll/${p.id}`, { method: 'PUT', headers: HEADERS, body: JSON.stringify({ status: 'For Review' }) });
        setPayrolls(prev => prev.map(x => x.id === p.id ? { ...x, status: 'For Review' } : x));
        count++;
      } catch (_) {}
    }
    setSnackbar({ open: true, message: `${count} payroll record(s) forwarded to Accounting (For Review).`, severity: 'success' });
  };

  const handlePrintPayslip = (p: Payroll) => {
    const parseAmt = (v: string) => parseFloat((v ?? '').replace(/[₱,]/g, '')) || 0;
    const fmtAmt = (v: number) => v > 0
      ? `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '—';
    const grossAmt = parseAmt(p.grossPay);
    const dedAmt   = parseAmt(p.deductions);
    const netAmt   = parseAmt(p.netPay);
    const totalDed = dedAmt > 0 ? dedAmt : 0;

    const win = window.open('', '_blank', 'width=720,height=960');
    if (!win) return;
    win.document.write(`
      <html><head><title>Payslip — ${p.employee}</title>
      <style>
        @media print { @page { size: A4 portrait; margin: 15mm; } body { padding: 0; } }
        body { font-family: Arial, sans-serif; padding: 24px; font-size: 12px; color: #111; max-width: 580px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px solid #1F7A47; padding-bottom: 8px; margin-bottom: 0; }
        h2 { color: #1F7A47; margin: 4px 0; font-size: 15px; letter-spacing: 1px; }
        table { width: 100%; border-collapse: collapse; }
        td { border: 1px solid #ccc; padding: 4px 8px; font-size: 11px; }
        .sec-hdr { background: #f5f5f5; font-weight: bold; font-size: 11px; }
        .highlight { background: #e8f5e9; }
        .gross-row { background: #fff9c4; font-weight: bold; }
        .net-row { background: #fff9c4; font-weight: bold; color: #1F7A47; }
        .right { text-align: right; }
        .center { text-align: center; }
        .ack { font-size: 10px; margin-top: 14px; border: 1px solid #ccc; padding: 8px; line-height: 1.6; }
        .sig { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 28px; }
        .sig-line { width: 42%; text-align: center; padding-bottom: 4px; border-bottom: 1px solid #333; font-size: 10px; }
        .footer { color: #999; font-size: 10px; text-align: center; margin-top: 14px; }
      </style></head><body>
      <div class="header">
        <h2>BUENAVENTURA ESTATE</h2>
        <div style="font-size:11px;margin-bottom:4px;">ELECTRONIC PAYSLIP</div>
      </div>
      <table style="margin-top:0;">
        <tr><td style="width:40%"><b>Department:</b></td><td colspan="2">${p.position || '—'}</td></tr>
        <tr><td><b>Pay Period:</b></td><td colspan="2">${p.period}</td></tr>
        <tr class="highlight"><td><b>Employee Name:</b></td><td colspan="2"><b>${p.employee.toUpperCase()}</b></td></tr>
        <tr><td><b>Position:</b></td><td colspan="2">${p.position || '—'}</td></tr>
        <tr class="sec-hdr"><td>Earnings:</td><td class="center" style="width:24%">Days/Hours/Mins.</td><td class="right" style="width:22%">Amount</td></tr>
        <tr><td>Basic Pay</td><td class="right">${p.totalHours || '—'}</td><td class="right">${p.basicPayAmt || fmtAmt(grossAmt)}</td></tr>
        <tr><td>Reg.OT</td><td class="right">${p.overtime && p.overtime !== '0' ? p.overtime : '—'}</td><td class="right">${p.otAmt || '—'}</td></tr>
        <tr><td>NSD</td><td class="right">${p.nsdHours || '—'}</td><td class="right">${p.nsdAmt || '—'}</td></tr>
        <tr><td>Regular Holiday</td><td class="right">${p.regularHolidayDays || '—'}</td><td class="right">${p.regularHolidayAmt || '—'}</td></tr>
        <tr><td>Special Holiday</td><td class="right">${p.specialHolidayDays || '—'}</td><td class="right">${p.specialHolidayAmt || '—'}</td></tr>
        <tr><td>SIL</td><td class="right">${p.silDays || '—'}</td><td class="right">${p.silAmt || '—'}</td></tr>
        <tr><td>Allowance</td><td class="right">—</td><td class="right">${p.allowanceAmt || '—'}</td></tr>
        <tr><td>RETRO/ADJUSTMENT</td><td class="right">—</td><td class="right">${p.retroAmt || '—'}</td></tr>
        <tr><td>Tardiness (Mins.)</td><td class="right">${p.tardinessMin || '—'}</td><td class="right">—</td></tr>
        <tr><td>Undertime (Hours)</td><td class="right">${p.undertimeHours || '—'}</td><td class="right">—</td></tr>
        <tr class="gross-row"><td colspan="2" class="center">GROSS PAY</td><td class="right">${fmtAmt(grossAmt)}</td></tr>
        <tr class="sec-hdr"><td colspan="3">DEDUCTIONS:</td></tr>
        <tr><td colspan="2">SSS Premium</td><td class="right">${p.sssAmt || '—'}</td></tr>
        <tr><td colspan="2">PHIC Premium</td><td class="right">${p.phicAmt || '—'}</td></tr>
        <tr><td colspan="2">HDMF Premium</td><td class="right">${p.hdmfAmt || '—'}</td></tr>
        <tr><td colspan="2">CASH ADVANCE</td><td class="right">${p.cashAdvance || '—'}</td></tr>
        <tr><td colspan="2">ATD</td><td class="right">${p.atd || '—'}</td></tr>
        <tr><td colspan="2">Other Charges</td><td class="right">${p.otherCharges || '—'}</td></tr>
        <tr><td colspan="2">BREAKAGES Charges (last)</td><td class="right">${p.breakages || '—'}</td></tr>
        <tr><td colspan="2">AMESCO/OTHER CHARGES</td><td class="right">${p.amesco || '—'}</td></tr>
        <tr><td colspan="2">PAG-IBIG LOAN</td><td class="right">${p.pagibigLoan || '—'}</td></tr>
        <tr class="sec-hdr"><td colspan="2" class="right">TOTAL DEDUCTIONS:</td><td class="right">${totalDed > 0 ? fmtAmt(totalDed) : '—'}</td></tr>
        <tr class="net-row"><td colspan="2" class="center">NET PAY</td><td class="right">${fmtAmt(netAmt)}</td></tr>
      </table>
      <div class="ack">
        I acknowledge to have received the amount of <b>${fmtAmt(netAmt)}</b> and have no further claim for services rendered.
      </div>
      <div class="sig">
        <div class="sig-line">Date: ${p.payslipDate ? new Date(p.payslipDate + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '___________'}</div>
        <div style="width:42%; text-align:center;">
          <div style="padding-bottom:4px; border-bottom:1px solid #333; font-size:10px;">${p.employee.toUpperCase()}</div>
          <div style="font-size:9px; margin-top:3px;">${p.position || '—'}</div>
        </div>
      </div>
      <div class="footer">Generated: ${new Date().toLocaleString()} &nbsp;·&nbsp; Payroll ID: ${p.id} &nbsp;·&nbsp; Electronically generated payslip.</div>
      </body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom fontWeight="bold" sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' } }}>
            Payroll Computation
          </Typography>
          <Typography variant="body2" color="text.secondary">Generate and manage employee payroll — data from Supabase</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Tooltip title="Refresh"><span><IconButton onClick={fetchPayroll} disabled={loading}><Sync /></IconButton></span></Tooltip>
          {(user?.role === 'accounting') && (
            <Button variant="contained" color="success" startIcon={<Payments />} onClick={() => handleReleaseSalary()}>
              Release Salary
            </Button>
          )}
          {(user?.role === 'hr') && (
            <>
              <Button variant="outlined" startIcon={<Send />} onClick={handleForwardToAccounting}>Forward to Accounting</Button>
              <Button variant="outlined" startIcon={<AddCircleOutline />} onClick={() => setAddDialog(true)}>Manual Entry</Button>
              <Button variant="contained" startIcon={<Calculate />} onClick={() => setGenerateDialog(true)}>Generate Payroll</Button>
            </>
          )}
        </Box>
      </Box>

      {error &&
        <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={fetchPayroll}>Retry</Button>}>{error}</Alert>
      }

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth label="Filter by Period" type="month" value={filterPeriod}
              onChange={e => setFilterPeriod(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth select label="Status" value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)} InputLabelProps={{ shrink: true }}>
              <MenuItem key="all" value="all">All Status</MenuItem>
              <MenuItem key="draft" value="draft">Draft</MenuItem>
              <MenuItem key="forreview" value="forreview">For Review</MenuItem>
              <MenuItem key="processed" value="processed">Processed</MenuItem>
              <MenuItem key="released" value="released">Released</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Button fullWidth variant="outlined" sx={{ height: '56px' }} onClick={() => { setFilterPeriod(''); setFilterStatus('all'); }}>Clear Filters</Button>
          </Grid>
        </Grid>
      </Paper>

      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6, gap: 2 }}><CircularProgress size={28} /><Typography color="text.secondary">Loading…</Typography></Box>
        ) : (
          <Table sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell><TableCell>Employee</TableCell><TableCell>Position</TableCell>
                <TableCell>Period</TableCell><TableCell>Base Rate (₱)</TableCell><TableCell>OT (hrs)</TableCell>
                <TableCell>Deductions</TableCell><TableCell>Gross Pay</TableCell><TableCell>Net Pay</TableCell>
                <TableCell>Status</TableCell><TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={11} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                  {payrolls.length === 0 ? 'No payroll records yet. Click "Generate Payroll" to create records for all active employees.' : 'No results match your filters.'}
                </TableCell></TableRow>
              ) : filtered.map(p => (
                <TableRow key={p.id} hover>
                  <TableCell><Chip label={p.id} size="small" variant="outlined" /></TableCell>
                  <TableCell>{p.employee}</TableCell><TableCell>{p.position}</TableCell>
                  <TableCell>{p.period}</TableCell><TableCell>{p.totalHours}</TableCell>
                  <TableCell>{p.overtime} hrs</TableCell><TableCell sx={{ color: 'error.main' }}>{p.deductions}</TableCell>
                  <TableCell>{p.grossPay}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: 'success.main' }}>{p.netPay}</TableCell>
                  <TableCell>
                    <Chip label={p.status} size="small" color={p.status === 'Processed' ? 'success' : p.status === 'For Review' ? 'warning' : 'default'} />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
                      <Chip
                        label={user?.role === 'employee' ? 'View' : 'View Payslip'}
                        size="small"
                        clickable
                        variant="outlined"
                        color="primary"
                        onClick={() => { setSelectedPayroll(p); setViewDialog(true); }}
                        sx={{ minWidth: 110 }}
                      />
                      {(user?.role === 'accounting' || user?.role === 'hr' || user?.role === 'supervisor') && p.status !== 'Released' && (
                        <Chip
                          label="Release"
                          size="small"
                          clickable
                          variant="outlined"
                          color="success"
                          onClick={() => handleReleaseSalary([p.id])}
                          sx={{ minWidth: 110 }}
                        />
                      )}
                      {(user?.role === 'hr' || user?.role === 'supervisor' || user?.role === 'accounting') && (
                        <Chip
                          label="Delete"
                          size="small"
                          clickable
                          variant="outlined"
                          color="error"
                          onClick={() => handleDelete(p.id)}
                          sx={{ minWidth: 110 }}
                        />
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {!loading && filtered.length > 0 && (
        <Paper sx={{ p: 2, mt: 2 }}>
          <Typography variant="h6" gutterBottom>Summary {filterPeriod ? `— ${filterPeriod}` : '(All Periods)'}</Typography>
          <Grid container spacing={2}>
            {[['Employees', filtered.length], ['Total Gross Pay', `₱${Math.round(totals.gross).toLocaleString()}`], ['Total Deductions', `₱${Math.round(totals.ded).toLocaleString()}`], ['Total Net Pay', `₱${Math.round(totals.net).toLocaleString()}`]].map(([l, v]) => (
              <Grid key={String(l)} size={{ xs: 6, md: 3 }}>
                <Typography variant="body2" color="text.secondary">{l}</Typography>
                <Typography variant="h6" color={l === 'Total Net Pay' ? 'primary' : 'inherit'}>{v}</Typography>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Generate Payroll Dialog */}
      <Dialog open={generateDialog} onClose={() => { setGenerateDialog(false); setGeneratePosition(''); }} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Generate Payroll</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          <Alert severity="info" sx={{ fontSize: '0.8rem' }}>
            Auto-generates payroll for <strong>Active</strong> employees. Select a position to target only that role, or leave blank for all. The <em>Base Monthly Salary</em> auto-fills when a position is chosen and reflects as <strong>Basic Pay</strong> in each payslip.
          </Alert>
          <TextField label="Payroll Period" type="month" fullWidth value={generatePeriod}
            onChange={e => setGeneratePeriod(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField
            label="Position (Optional)"
            select fullWidth value={generatePosition}
            onChange={e => {
              const pos = e.target.value;
              setGeneratePosition(pos);
              if (pos && POSITION_SALARIES[pos]) setGenerateBase(String(POSITION_SALARIES[pos]));
              else if (!pos) setGenerateBase('18000');
            }}
            InputLabelProps={{ shrink: true }}
            helperText="Leave blank to generate for all active employees"
          >
            <MenuItem key="all-pos" value="">All Positions</MenuItem>
            {POSITIONS.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
          </TextField>
          <TextField label="Base Monthly Salary (₱)" type="number" fullWidth value={generateBase}
            onChange={e => setGenerateBase(e.target.value)}
            helperText={generatePosition && POSITION_SALARIES[generatePosition] ? `Auto-filled from position salary table (₱${POSITION_SALARIES[generatePosition]?.toLocaleString()}) — editable` : 'Default base salary per employee'} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setGenerateDialog(false); setGeneratePosition(''); }}>Cancel</Button>
          <Button variant="contained" startIcon={generating ? <CircularProgress size={16} color="inherit" /> : <Calculate />}
            onClick={handleGenerate} disabled={generating}>
            {generating ? 'Generating…' : 'Generate'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manual Add Dialog */}
      <Dialog open={addDialog} onClose={() => setAddDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Manual Payroll Entry</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          <TextField label="Employee Name" fullWidth required value={form.employee} onChange={e => setForm({ ...form, employee: e.target.value })} />
          <TextField label="Position" fullWidth value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
          <TextField label="Period" type="month" fullWidth value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} InputLabelProps={{ shrink: true }} />
          <Grid container spacing={2}>
            <Grid size={6}><TextField label="Total Hours" fullWidth value={form.totalHours} onChange={e => setForm({ ...form, totalHours: e.target.value })} /></Grid>
            <Grid size={6}><TextField label="Overtime (hrs)" fullWidth value={form.overtime} onChange={e => setForm({ ...form, overtime: e.target.value })} /></Grid>
            <Grid size={4}><TextField label="Gross Pay" fullWidth required value={form.grossPay} onChange={e => setForm({ ...form, grossPay: e.target.value })} placeholder="₱0" /></Grid>
            <Grid size={4}><TextField label="Deductions" fullWidth value={form.deductions} onChange={e => setForm({ ...form, deductions: e.target.value })} placeholder="₱0" /></Grid>
            <Grid size={4}><TextField label="Net Pay" fullWidth value={form.netPay} onChange={e => setForm({ ...form, netPay: e.target.value })} placeholder="₱0" /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAdd} disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}>
            {saving ? 'Saving…' : 'Save Payroll'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payslip Dialog */}
      <Dialog open={viewDialog} onClose={() => { setViewDialog(false); setEditingPayslip(false); }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Payslip
            {selectedPayroll && <Chip label={selectedPayroll.id} size="small" variant="outlined" />}
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 2 }}>
          {selectedPayroll && (
            <Box>
              {editingPayslip ? (
                /* ── Edit Mode — Receipt Format ── */
                <Box sx={{ border: '1px solid #999', fontSize: '0.78rem', lineHeight: 1.5, mb: 2 }}>
                  {/* Company Header */}
                  <Box sx={{ textAlign: 'center', py: 1, px: 2, borderBottom: '1px solid #999', bgcolor: '#f9f9f9' }}>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '0.88rem', letterSpacing: 0.5 }}>BUENAVENTURA ESTATE</Typography>
                    <Typography sx={{ fontSize: '0.68rem', color: '#777' }}>ELECTRONIC PAYSLIP — EDITING</Typography>
                  </Box>
                  {/* Department */}
                  {[['Department:', 'position'], ['Pay period:', 'period'], ['Position:', 'position'], ['Date:', 'payslipDate']].map(([lbl, fk], idx) => (
                    <Box key={lbl} sx={{ display: 'flex', borderBottom: '1px solid #ccc', alignItems: 'center', ...(lbl === 'Pay period:' ? {} : {}) }}>
                      <Box sx={{ width: '40%', fontWeight: idx === 0 ? 600 : 600, p: '3px 8px', borderRight: '1px solid #ccc', fontSize: '0.77rem' }}>{lbl}</Box>
                      <Box sx={{ flex: 1, px: 1 }}>
                        <TextField variant="standard" fullWidth size="small"
                          type={fk === 'period' ? 'month' : fk === 'payslipDate' ? 'date' : 'text'}
                          value={(payslipEditForm as any)[fk]} onChange={pef(fk as any)}
                          InputLabelProps={{ shrink: true }} inputProps={{ style: { fontSize: '0.76rem' } }} />
                      </Box>
                    </Box>
                  ))}
                  {/* Employee Name — highlighted */}
                  <Box sx={{ display: 'flex', borderBottom: '1px solid #ccc', alignItems: 'center', bgcolor: '#e8f5e9' }}>
                    <Box sx={{ width: '40%', fontWeight: 700, p: '3px 8px', borderRight: '1px solid #ccc', fontSize: '0.77rem' }}>Employee Name:</Box>
                    <Box sx={{ flex: 1, px: 1 }}><TextField variant="standard" fullWidth size="small" value={payslipEditForm.employee} onChange={pef('employee')} inputProps={{ style: { fontSize: '0.76rem', fontWeight: 700 } }} /></Box>
                  </Box>
                  {/* Earnings header */}
                  <Box sx={{ display: 'flex', borderBottom: '1px solid #ccc', bgcolor: '#f5f5f5' }}>
                    <Box sx={{ flex: 1, fontWeight: 700, p: '4px 8px', borderRight: '1px solid #ccc', fontSize: '0.77rem' }}>Earnings:</Box>
                    <Box sx={{ width: '24%', fontWeight: 700, p: '4px 6px', borderRight: '1px solid #ccc', textAlign: 'center', fontSize: '0.7rem' }}>Days/Hours/Mins.</Box>
                    <Box sx={{ width: '22%', fontWeight: 700, p: '4px 6px', textAlign: 'right', fontSize: '0.77rem' }}>Amount</Box>
                  </Box>
                  {([
                    ['Basic Pay',          'totalHours',        'basicPayAmt'       ],
                    ['Reg.OT',            'overtime',           'otAmt'             ],
                    ['NSD',               'nsdHours',           'nsdAmt'            ],
                    ['Regular Holiday',   'regularHolidayDays', 'regularHolidayAmt' ],
                    ['Special Holiday',   'specialHolidayDays', 'specialHolidayAmt' ],
                    ['SIL',              'silDays',             'silAmt'            ],
                    ['Allowance',         null,                  'allowanceAmt'      ],
                    ['RETRO/ADJUSTMENT',  null,                  'retroAmt'          ],
                    ['Tardiness (Mins.)', 'tardinessMin',        null                ],
                    ['Undertime (Hours)', 'undertimeHours',      null                ],
                  ] as [string, string | null, string | null][]).map(([label, dk, ak]) => (
                    <Box key={label} sx={{ display: 'flex', borderBottom: '1px solid #eee', alignItems: 'center' }}>
                      <Box sx={{ flex: 1, p: '1px 8px', borderRight: '1px solid #ccc', fontSize: '0.76rem' }}>{label}</Box>
                      <Box sx={{ width: '24%', px: 0.5, borderRight: '1px solid #ccc' }}>
                        {dk ? <TextField variant="standard" fullWidth size="small" value={(payslipEditForm as any)[dk]} onChange={pef(dk as any)} placeholder="—" inputProps={{ style: { fontSize: '0.73rem', textAlign: 'right', padding: '1px 0' } }} />
                             : <Box sx={{ textAlign: 'right', fontSize: '0.75rem', color: 'text.disabled', p: '3px 2px' }}>—</Box>}
                      </Box>
                      <Box sx={{ width: '22%', px: 0.5 }}>
                        {ak ? <TextField variant="standard" fullWidth size="small" value={(payslipEditForm as any)[ak]} onChange={pef(ak as any)} placeholder="₱0" inputProps={{ style: { fontSize: '0.73rem', textAlign: 'right', padding: '1px 0' } }} />
                             : <Box sx={{ textAlign: 'right', fontSize: '0.75rem', color: 'text.disabled', p: '3px 2px' }}>—</Box>}
                      </Box>
                    </Box>
                  ))}
                  {/* GROSS PAY */}
                  <Box sx={{ display: 'flex', borderTop: '1px solid #999', borderBottom: '1px solid #999', bgcolor: '#fff9c4', fontWeight: 700, alignItems: 'center' }}>
                    <Box sx={{ flex: 1, p: '4px 8px', borderRight: '1px solid #ccc', textAlign: 'center', fontSize: '0.77rem' }}>GROSS PAY</Box>
                    <Box sx={{ width: '24%', borderRight: '1px solid #ccc' }} />
                    <Box sx={{ width: '22%', px: 0.5 }}><TextField variant="standard" fullWidth size="small" value={payslipEditForm.grossPay} onChange={pef('grossPay')} inputProps={{ style: { fontSize: '0.73rem', textAlign: 'right', fontWeight: 700, padding: '2px 0' } }} /></Box>
                  </Box>
                  {/* DEDUCTIONS header */}
                  <Box sx={{ p: '4px 8px', borderBottom: '1px solid #ccc', fontWeight: 700, fontSize: '0.77rem', bgcolor: '#f5f5f5' }}>DEDUCTIONS:</Box>
                  {([
                    ['SSS Premium',              'sssAmt'      ],
                    ['PHIC Premium',             'phicAmt'     ],
                    ['HDMF Premium',             'hdmfAmt'     ],
                    ['CASH ADVANCE',             'cashAdvance' ],
                    ['ATD',                      'atd'         ],
                    ['Other Charges',            'otherCharges'],
                    ['BREAKAGES Charges (last)', 'breakages'   ],
                    ['AMESCO/OTHER CHARGES',     'amesco'      ],
                    ['PAG-IBIG LOAN',            'pagibigLoan' ],
                  ] as [string, string][]).map(([label, key]) => (
                    <Box key={label} sx={{ display: 'flex', borderBottom: '1px solid #eee', alignItems: 'center' }}>
                      <Box sx={{ flex: 1, p: '1px 8px', borderRight: '1px solid #ccc', fontSize: '0.76rem' }}>{label}</Box>
                      <Box sx={{ width: '22%', px: 0.5 }}><TextField variant="standard" fullWidth size="small" value={(payslipEditForm as any)[key]} onChange={pef(key as any)} placeholder="₱0" inputProps={{ style: { fontSize: '0.73rem', textAlign: 'right', padding: '1px 0' } }} /></Box>
                    </Box>
                  ))}
                  {/* TOTAL DEDUCTIONS */}
                  <Box sx={{ display: 'flex', borderTop: '1px solid #999', borderBottom: '1px solid #999', fontWeight: 700, alignItems: 'center' }}>
                    <Box sx={{ flex: 1, p: '4px 8px', borderRight: '1px solid #ccc', textAlign: 'right', fontSize: '0.77rem' }}>TOTAL DEDUCTIONS:</Box>
                    <Box sx={{ width: '22%', px: 0.5 }}><TextField variant="standard" fullWidth size="small" value={payslipEditForm.deductions} onChange={pef('deductions')} inputProps={{ style: { fontSize: '0.73rem', textAlign: 'right', fontWeight: 700, padding: '2px 0' } }} /></Box>
                  </Box>
                  {/* NET PAY */}
                  <Box sx={{ display: 'flex', borderBottom: '1px solid #999', bgcolor: '#fff9c4', fontWeight: 700, alignItems: 'center' }}>
                    <Box sx={{ flex: 1, p: '4px 8px', borderRight: '1px solid #ccc', textAlign: 'center', fontSize: '0.77rem' }}>NET PAY</Box>
                    <Box sx={{ width: '22%', px: 0.5 }}><TextField variant="standard" fullWidth size="small" value={payslipEditForm.netPay} onChange={pef('netPay')} inputProps={{ style: { fontSize: '0.73rem', textAlign: 'right', fontWeight: 700, padding: '2px 0' } }} /></Box>
                  </Box>
                  {/* Acknowledgment */}
                  <Box sx={{ p: '8px', fontSize: '0.72rem', lineHeight: 1.7, bgcolor: '#fafafa', borderBottom: '1px solid #eee' }}>
                    I acknowledge to have received the amount of <strong>{payslipEditForm.netPay || '—'}</strong> and have no further claim for services rendered.
                  </Box>
                </Box>
              ) : (
                /* ── View Mode — Receipt Format ── */
                (() => {
                  const grossAmt = parseAmt(selectedPayroll.grossPay);
                  const dedAmt   = parseAmt(selectedPayroll.deductions);
                  const netAmt   = parseAmt(selectedPayroll.netPay);
                  const fmt      = (v: number) => v > 0
                    ? `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '—';
                  const totalDed = dedAmt > 0 ? dedAmt : 0;
                  const otHours  = parseFloat(selectedPayroll.overtime) || 0;
                  const hasOT    = otHours > 0;

                  const rowSx = { display: 'flex', borderBottom: '1px solid #ccc' };
                  const labelSx = { width: '40%', fontWeight: 600, p: '4px 8px', borderRight: '1px solid #ccc', fontSize: '0.78rem' };
                  const valSx   = { flex: 1, p: '4px 8px', fontSize: '0.78rem' };

                  const earningsRows: [string, string, string][] = [
                    ['Basic Pay',           selectedPayroll.totalHours || '—',                           selectedPayroll.basicPayAmt || fmt(grossAmt)],
                    ['Reg.OT',              selectedPayroll.overtime && selectedPayroll.overtime !== '0' ? selectedPayroll.overtime : '—', selectedPayroll.otAmt || '—'],
                    ['NSD',                 selectedPayroll.nsdHours  || '—',                            selectedPayroll.nsdAmt  || '—'],
                    ['Regular Holiday',     selectedPayroll.regularHolidayDays || '—',                   selectedPayroll.regularHolidayAmt || '—'],
                    ['Special Holiday',     selectedPayroll.specialHolidayDays || '—',                   selectedPayroll.specialHolidayAmt || '—'],
                    ['SIL',                 selectedPayroll.silDays   || '—',                            selectedPayroll.silAmt  || '—'],
                    ['Allowance',           '—',                                                          selectedPayroll.allowanceAmt || '—'],
                    ['RETRO/ADJUSTMENT',    '—',                                                          selectedPayroll.retroAmt || '—'],
                    ['Tardiness (Mins.)',   selectedPayroll.tardinessMin   || '—',                       '—'],
                    ['Undertime (Hours)',   selectedPayroll.undertimeHours || '—',                       '—'],
                  ];

                  const deductionRows: [string, string][] = [
                    ['SSS Premium',              selectedPayroll.sssAmt      || '—'],
                    ['PHIC Premium',             selectedPayroll.phicAmt     || '—'],
                    ['HDMF Premium',             selectedPayroll.hdmfAmt     || '—'],
                    ['CASH ADVANCE',             selectedPayroll.cashAdvance || '—'],
                    ['ATD',                      selectedPayroll.atd         || '—'],
                    ['Other Charges',            selectedPayroll.otherCharges || '—'],
                    ['BREAKAGES Charges (last)', selectedPayroll.breakages   || '—'],
                    ['AMESCO/OTHER CHARGES',     selectedPayroll.amesco      || '—'],
                    ['PAG-IBIG LOAN',            selectedPayroll.pagibigLoan || '—'],
                  ];

                  return (
                    <Box sx={{ border: '1px solid #999', fontSize: '0.78rem', lineHeight: 1.5, mb: 2 }}>
                      {/* Company Header */}
                      <Box sx={{ textAlign: 'center', fontWeight: 'bold', py: 1, px: 2, borderBottom: '1px solid #999', fontSize: '0.88rem', letterSpacing: 0.5 }}>
                        BUENAVENTURA ESTATE
                      </Box>

                      {/* Department */}
                      <Box sx={rowSx}>
                        <Box sx={labelSx}>Department:</Box>
                        <Box sx={valSx}>{selectedPayroll.position || '—'}</Box>
                      </Box>
                      {/* Pay Period */}
                      <Box sx={rowSx}>
                        <Box sx={labelSx}>Pay period:</Box>
                        <Box sx={valSx}>{selectedPayroll.period}</Box>
                      </Box>
                      {/* Employee Name — highlighted */}
                      <Box sx={{ ...rowSx, bgcolor: '#e8f5e9' }}>
                        <Box sx={{ ...labelSx, fontWeight: 700 }}>Employee Name:</Box>
                        <Box sx={{ ...valSx, fontWeight: 700 }}>{selectedPayroll.employee.toUpperCase()}</Box>
                      </Box>
                      {/* Position */}
                      <Box sx={rowSx}>
                        <Box sx={labelSx}>Position:</Box>
                        <Box sx={valSx}>{selectedPayroll.position || '—'}</Box>
                      </Box>

                      {/* Earnings header */}
                      <Box sx={{ display: 'flex', borderBottom: '1px solid #ccc', bgcolor: '#f5f5f5' }}>
                        <Box sx={{ flex: 1, fontWeight: 700, p: '4px 8px', borderRight: '1px solid #ccc', fontSize: '0.78rem' }}>Earnings:</Box>
                        <Box sx={{ width: '24%', fontWeight: 700, p: '4px 6px', borderRight: '1px solid #ccc', textAlign: 'center', fontSize: '0.7rem' }}>Days/Hours/Mins.</Box>
                        <Box sx={{ width: '22%', fontWeight: 700, p: '4px 6px', textAlign: 'right', fontSize: '0.78rem' }}>Amount</Box>
                      </Box>

                      {/* Earnings rows */}
                      {earningsRows.map(([label, days, amount]) => (
                        <Box key={label} sx={{ display: 'flex', borderBottom: '1px solid #eee' }}>
                          <Box sx={{ flex: 1, p: '3px 8px', borderRight: '1px solid #ccc', fontSize: '0.77rem' }}>{label}</Box>
                          <Box sx={{ width: '24%', p: '3px 6px', borderRight: '1px solid #ccc', textAlign: 'right', fontSize: '0.77rem' }}>{days}</Box>
                          <Box sx={{ width: '22%', p: '3px 6px', textAlign: 'right', fontSize: '0.77rem' }}>{amount}</Box>
                        </Box>
                      ))}

                      {/* GROSS PAY — highlighted */}
                      <Box sx={{ display: 'flex', borderTop: '1px solid #999', borderBottom: '1px solid #999', bgcolor: '#fff9c4', fontWeight: 700 }}>
                        <Box sx={{ flex: 1, p: '5px 8px', borderRight: '1px solid #ccc', textAlign: 'center', fontSize: '0.78rem' }}>GROSS PAY</Box>
                        <Box sx={{ width: '24%', p: '5px 6px', borderRight: '1px solid #ccc' }} />
                        <Box sx={{ width: '22%', p: '5px 6px', textAlign: 'right', fontSize: '0.78rem' }}>{fmt(grossAmt)}</Box>
                      </Box>

                      {/* DEDUCTIONS label */}
                      <Box sx={{ p: '5px 8px', borderBottom: '1px solid #ccc', fontWeight: 700, fontSize: '0.78rem' }}>DEDUCTIONS:</Box>

                      {/* Deduction rows */}
                      {deductionRows.map(([label, amount]) => (
                        <Box key={label} sx={{ display: 'flex', borderBottom: '1px solid #eee' }}>
                          <Box sx={{ flex: 1, p: '3px 8px', borderRight: '1px solid #ccc', fontSize: '0.77rem' }}>{label}</Box>
                          <Box sx={{ width: '22%', p: '3px 6px', textAlign: 'right', fontSize: '0.77rem' }}>{amount}</Box>
                        </Box>
                      ))}

                      {/* TOTAL DEDUCTIONS */}
                      <Box sx={{ display: 'flex', borderTop: '1px solid #999', borderBottom: '1px solid #999', fontWeight: 700 }}>
                        <Box sx={{ flex: 1, p: '5px 8px', borderRight: '1px solid #ccc', textAlign: 'right', fontSize: '0.78rem' }}>TOTAL DEDUCTIONS:</Box>
                        <Box sx={{ width: '22%', p: '5px 6px', textAlign: 'right', fontSize: '0.78rem' }}>{totalDed > 0 ? fmt(totalDed) : '—'}</Box>
                      </Box>

                      {/* NET PAY — highlighted */}
                      <Box sx={{ display: 'flex', borderBottom: '1px solid #999', bgcolor: '#fff9c4', fontWeight: 700 }}>
                        <Box sx={{ flex: 1, p: '5px 8px', borderRight: '1px solid #ccc', textAlign: 'center', fontSize: '0.78rem' }}>NET PAY</Box>
                        <Box sx={{ width: '22%', p: '5px 6px', textAlign: 'right', fontSize: '0.78rem' }}>{fmt(netAmt)}</Box>
                      </Box>

                      {/* Acknowledgment */}
                      <Box sx={{ p: '8px', borderBottom: '1px solid #ccc', fontSize: '0.72rem', lineHeight: 1.7 }}>
                        I acknowledge to have received the amount of{' '}
                        <strong>{fmt(netAmt)}</strong>{' '}
                        and have no further claim for services rendered.
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'flex-end', p: '10px 8px', gap: 2 }}>
                        <Box sx={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                          Date:{' '}
                          <strong>
                            {selectedPayroll.payslipDate
                              ? new Date(selectedPayroll.payslipDate + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
                              : '___________'}
                          </strong>
                        </Box>
                        <Box sx={{ flex: 1, textAlign: 'center' }}>
                          <Box sx={{ fontWeight: 700, fontSize: '0.78rem', pb: '4px', borderBottom: '1px solid #333' }}>
                            {selectedPayroll.employee.toUpperCase()}
                          </Box>
                          <Box sx={{ fontSize: '0.72rem', mt: '3px' }}>{selectedPayroll.position || '—'}</Box>
                        </Box>
                      </Box>
                    </Box>
                  );
                })()
              )}

              <TextField select fullWidth label="Update Status" value={selectedPayroll.status}
                onChange={e => handleStatusChange(selectedPayroll.id, e.target.value)}
                InputLabelProps={{ shrink: true }}>
                <MenuItem key="Draft" value="Draft">Draft</MenuItem>
                <MenuItem key="For Review" value="For Review">For Review</MenuItem>
                <MenuItem key="Processed" value="Processed">Processed</MenuItem>
                <MenuItem key="Released" value="Released">Released</MenuItem>
              </TextField>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setViewDialog(false); setEditingPayslip(false); }}>Close</Button>
          {!editingPayslip ? (
            selectedPayroll?.status !== 'Released' && (
            <Button variant="outlined" color="primary"
              onClick={() => {
                if (selectedPayroll) {
                  const g = parseAmt(selectedPayroll.grossPay);
                  const today = new Date().toISOString().split('T')[0];
                  setPayslipEditForm({
                    employee:            selectedPayroll.employee         ?? '',
                    position:            selectedPayroll.position         ?? '',
                    period:              selectedPayroll.period           ?? '',
                    payslipDate:         selectedPayroll.payslipDate      ?? today,
                    totalHours:          selectedPayroll.totalHours       ?? '',
                    basicPayAmt:         selectedPayroll.basicPayAmt      ?? selectedPayroll.grossPay ?? '',
                    overtime:            selectedPayroll.overtime         ?? '',
                    otAmt:               selectedPayroll.otAmt            ?? '',
                    nsdHours:            selectedPayroll.nsdHours         ?? '',
                    nsdAmt:              selectedPayroll.nsdAmt           ?? '',
                    regularHolidayDays:  selectedPayroll.regularHolidayDays ?? '',
                    regularHolidayAmt:   selectedPayroll.regularHolidayAmt  ?? '',
                    specialHolidayDays:  selectedPayroll.specialHolidayDays ?? '',
                    specialHolidayAmt:   selectedPayroll.specialHolidayAmt  ?? '',
                    silDays:             selectedPayroll.silDays          ?? '',
                    silAmt:              selectedPayroll.silAmt           ?? '',
                    allowanceAmt:        selectedPayroll.allowanceAmt     ?? '',
                    retroAmt:            selectedPayroll.retroAmt         ?? '',
                    tardinessMin:        selectedPayroll.tardinessMin     ?? '',
                    undertimeHours:      selectedPayroll.undertimeHours   ?? '',
                    grossPay:            selectedPayroll.grossPay         ?? '',
                    sssAmt:              selectedPayroll.sssAmt           ?? (g > 0 ? `₱${(g * 0.045).toFixed(2)}` : ''),
                    phicAmt:             selectedPayroll.phicAmt          ?? (g > 0 ? `₱${(g * 0.02).toFixed(2)}`  : ''),
                    hdmfAmt:             selectedPayroll.hdmfAmt          ?? (g > 0 ? '₱100.00' : ''),
                    cashAdvance:         selectedPayroll.cashAdvance      ?? '',
                    atd:                 selectedPayroll.atd              ?? '',
                    otherCharges:        selectedPayroll.otherCharges     ?? '',
                    breakages:           selectedPayroll.breakages        ?? '',
                    amesco:              selectedPayroll.amesco           ?? '',
                    pagibigLoan:         selectedPayroll.pagibigLoan      ?? '',
                    deductions:          selectedPayroll.deductions       ?? '',
                    netPay:              selectedPayroll.netPay           ?? '',
                  });
                  setEditingPayslip(true);
                }
              }}>
              Edit Payslip
            </Button>
            )
          ) : (
            <Button variant="contained" color="success" disabled={saving}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
              onClick={async () => {
                if (!selectedPayroll) return;
                setSaving(true);
                try {
                  const res = await fetch(`${API}/payroll/${selectedPayroll.id}`, {
                    method: 'PUT', headers: HEADERS,
                    body: JSON.stringify({ ...payslipEditForm, id: selectedPayroll.id }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error ?? 'Server error');
                  const updated: Payroll = data.record ?? { ...selectedPayroll, ...payslipEditForm };
                  setPayrolls(prev => prev.map(p => p.id === selectedPayroll.id ? updated : p));
                  setSelectedPayroll(updated);
                  setEditingPayslip(false);
                  setSnackbar({ open: true, message: '✅ Payslip saved successfully!', severity: 'success' });
                } catch (e: any) {
                  setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' });
                } finally { setSaving(false); }
              }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          )}
          <Button variant="contained" startIcon={<Print />} onClick={() => selectedPayroll && handlePrintPayslip(selectedPayroll)}>
            Print Payslip
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={() => setSnackbar(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}