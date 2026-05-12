import { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Chip, Grid,
  CircularProgress, Alert, Snackbar, Tooltip, IconButton,
  Autocomplete, Divider,
} from '@mui/material';
import {
  AddCircleOutline, Sync, TaskAlt, DoneAll, CloudUpload,
  CancelOutlined, EditOutlined as EditIcon, CheckCircleOutline,
} from '@mui/icons-material';
import { CalendarMonth } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { API, HEADERS } from '../../lib/api';
import { OUTLETS, POSITIONS } from '../../lib/constants';
import { useAuth } from '../../context/AuthContext';

interface Schedule {
  id: string; employee: string; position: string; outlet: string; week: string;
  timeIn: string; timeOut: string; breakTime: string;
  monday: string; tuesday: string; wednesday: string; thursday: string;
  friday: string; saturday: string; sunday: string;
  status: 'Draft' | 'Published' | 'Confirmed' | 'Declined';
  confirmedBy?: string; confirmedAt?: string;
  declinedBy?: string; declinedAt?: string;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const EMPTY = {
  employee: '', position: '', outlet: '', week: '', timeIn: '', timeOut: '',
  breakTime: '1 hour', monday: '', tuesday: '', wednesday: '', thursday: '',
  friday: '', saturday: '', sunday: '',
};

const SHIFT_PRESETS = [
  'Off',
  '6:00 AM – 3:00 PM',
  '7:00 AM – 4:00 PM',
  '8:00 AM – 5:00 PM',
  '9:00 AM – 6:00 PM',
  '10:00 AM – 7:00 PM',
  'AM (6:00 AM – 2:00 PM)',
  'MID (2:00 PM – 10:00 PM)',
  'PM (10:00 PM – 6:00 AM)',
  'Full (8:00 AM – 5:00 PM)',
];

const BREAK_TIME_OPTIONS = ['30 minutes', '1 hour', '1 hour 30 minutes', '2 hours'];

const getWeekRange = (offsetWeeks: number = 0): string => {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1) + offsetWeeks * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const mDay = monday.getDate(), sDay = sunday.getDate();
  const mMonth = monday.getMonth(), sMonth = sunday.getMonth();
  const year = sunday.getFullYear();
  if (mMonth === sMonth) return `${MONTHS[mMonth]} ${mDay}–${sDay}, ${year}`;
  return `${MONTHS[mMonth]} ${mDay} – ${MONTHS[sMonth]} ${sDay}, ${year}`;
};

export default function ScheduleManagement() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [filterOutlet, setFilterOutlet] = useState('all');
  const [editDialog, setEditDialog] = useState(false);
  const [editRecord, setEditRecord] = useState<Schedule | null>(null);
  const [editForm, setEditForm] = useState(EMPTY);

  // Employee list with position + outlet for auto-fill
  const [employeeList, setEmployeeList] = useState<{ name: string; position: string; outlet: string }[]>([]);
  const excelRef = useRef<HTMLInputElement>(null);
  const [importingExcel, setImportingExcel] = useState(false);

  const canPublish = user?.role === 'hr' || user?.role === 'supervisor';
  const canConfirm = user?.role === 'employee';

  // ── Push a schedule notification to an employee (fire-and-forget) ──────
  const pushNotification = async (
    recipientEmployee: string,
    type: 'schedule_published' | 'schedule_edited',
    message: string,
    scheduleId: string,
    week: string,
  ) => {
    try {
      await fetch(`${API}/notifications`, {
        method: 'POST', headers: HEADERS,
        body: JSON.stringify({ recipientEmployee, type, message, scheduleId, week, createdBy: user?.name }),
      });
    } catch { /* silent — notification failure must not block main action */ }
  };

  // ── Data fetchers ────────────────────────────────────────────────────────
  const fetchSchedules = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/schedules`, { headers: HEADERS });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Server error');
      setSchedules((data.schedules ?? []).filter((s: any) => s != null));
    } catch (e: any) {
      setError(`Could not load schedules: ${e.message}`);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchSchedules(); }, []);

  const handleCreate = async () => {
    if (!form.employee || !form.week) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/schedules`, { method: 'POST', headers: HEADERS, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Server error');
      setSchedules(prev => [...prev, data.record]);
      setOpenDialog(false); setForm(EMPTY);
      setSnackbar({ open: true, message: 'Schedule saved as Draft!', severity: 'success' });
    } catch (e: any) {
      setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' });
    } finally { setSaving(false); }
  };

  // Publish: only callable when status === 'Draft'; after success button hides until next edit
  const handlePublish = async (s: Schedule) => {
    try {
      const res = await fetch(`${API}/schedules/${s.id}`, {
        method: 'PUT', headers: HEADERS, body: JSON.stringify({ status: 'Published' }),
      });
      if (!res.ok) throw new Error('Update failed');
      setSchedules(prev => prev.map(x => x.id === s.id ? { ...x, status: 'Published' } : x));
      setSnackbar({ open: true, message: '✅ Schedule published — employee can now view and confirm.', severity: 'success' });
      await pushNotification(
        s.employee,
        'schedule_published',
        `Your schedule for ${s.week} has been published by ${user?.name ?? 'HR'}. Please review and confirm it.`,
        s.id, s.week,
      );
    } catch (e: any) {
      setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' });
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      const res = await fetch(`${API}/schedules/${id}`, {
        method: 'PUT', headers: HEADERS,
        body: JSON.stringify({ status: 'Confirmed', confirmedBy: user?.name, confirmedAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error('Update failed');
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, status: 'Confirmed', confirmedBy: user?.name } : s));
      setSnackbar({ open: true, message: '✅ Schedule confirmed! Your schedule has been acknowledged.', severity: 'success' });
    } catch (e: any) {
      setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' });
    }
  };

  const handleDecline = async (id: string) => {
    try {
      const res = await fetch(`${API}/schedules/${id}`, {
        method: 'PUT', headers: HEADERS,
        body: JSON.stringify({ status: 'Declined', declinedBy: user?.name, declinedAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error('Update failed');
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, status: 'Declined' as any, declinedBy: user?.name } : s));
      setSnackbar({ open: true, message: '❌ Schedule declined. HR/Supervisor has been notified.', severity: 'success' });
    } catch (e: any) {
      setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Delete schedule ${id}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API}/schedules/${id}`, { method: 'DELETE', headers: HEADERS });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Server error');
      setSchedules(prev => prev.filter(s => s.id !== id));
      setSnackbar({ open: true, message: `🗑️ Schedule ${id} deleted.`, severity: 'success' });
    } catch (e: any) {
      setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' });
    }
  };

  const openEditDialog = (s: Schedule) => {
    setEditRecord(s);
    setEditForm({
      employee: s.employee, position: s.position, outlet: s.outlet, week: s.week,
      timeIn: s.timeIn, timeOut: s.timeOut, breakTime: s.breakTime,
      monday: s.monday, tuesday: s.tuesday, wednesday: s.wednesday,
      thursday: s.thursday, friday: s.friday, saturday: s.saturday, sunday: s.sunday,
    });
    setEditDialog(true);
  };

  // Edit: resets status to 'Draft' → Publish button reappears; notifies employee
  const handleEditSave = async () => {
    if (!editRecord) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/schedules/${editRecord.id}`, {
        method: 'PUT', headers: HEADERS,
        body: JSON.stringify({ ...editForm, status: 'Draft' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Server error');
      setSchedules(prev => prev.map(s => s.id === editRecord.id ? data.record : s));
      setEditDialog(false);
      setSnackbar({ open: true, message: `✅ Schedule ${editRecord.id} updated — status reset to Draft.`, severity: 'success' });
      await pushNotification(
        editRecord.employee,
        'schedule_edited',
        `Your schedule for ${editForm.week || editRecord.week} has been updated by ${user?.name ?? 'HR'}. Please review and re-confirm once it is re-published.`,
        editRecord.id, editForm.week || editRecord.week,
      );
    } catch (e: any) {
      setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' });
    } finally { setSaving(false); }
  };

  const filtered = schedules.filter(s => {
    if (canConfirm) {
      const matchesOwner = s.employee === user?.name || s.employee === user?.email;
      if (!matchesOwner) return false;
    }
    return filterOutlet === 'all' || s.outlet === filterOutlet;
  });

  // Fetch employee list — includes position AND outlet for auto-fill
  useEffect(() => {
    fetch(`${API}/employees`, { headers: HEADERS })
      .then(r => r.json())
      .then(d => {
        const list = (d.employees ?? [])
          .filter((e: any) => e?.name && e?.status !== 'Resigned')
          .map((e: any) => ({
            name: e.name as string,
            position: (e.position ?? '') as string,
            outlet: (e.outlet ?? '') as string,
          }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name));
        setEmployeeList(list);
      })
      .catch(() => {});
  }, []);

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportingExcel(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      const COL = (row: any, ...keys: string[]) => {
        for (const k of keys) {
          const v = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()];
          if (v !== undefined && v !== '') return String(v).trim();
        }
        return '';
      };

      let created = 0;
      for (const row of rows) {
        const employee = COL(row, 'Employee', 'employee', 'EMPLOYEE', 'Name', 'name');
        if (!employee) continue;
        const payload = {
          employee,
          position: COL(row, 'Position', 'position'),
          outlet: COL(row, 'Outlet', 'outlet', 'Branch', 'branch'),
          week: COL(row, 'Week', 'week', 'WeekPeriod', 'Week Period'),
          breakTime: COL(row, 'BreakTime', 'break_time', 'Break', 'break') || '1 hour',
          monday: COL(row, 'Monday', 'Mon', 'mon'),
          tuesday: COL(row, 'Tuesday', 'Tue', 'tue'),
          wednesday: COL(row, 'Wednesday', 'Wed', 'wed'),
          thursday: COL(row, 'Thursday', 'Thu', 'thu'),
          friday: COL(row, 'Friday', 'Fri', 'fri'),
          saturday: COL(row, 'Saturday', 'Sat', 'sat'),
          sunday: COL(row, 'Sunday', 'Sun', 'sun'),
        };
        const res = await fetch(`${API}/schedules`, { method: 'POST', headers: HEADERS, body: JSON.stringify(payload) });
        const result = await res.json();
        if (res.ok) {
          setSchedules(prev => [...prev, result.record]);
          created++;
        }
      }
      setSnackbar({ open: true, message: `✅ Excel import complete — ${created} schedule(s) created from ${rows.length} row(s)!`, severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: `Excel import failed: ${err.message}`, severity: 'error' });
    } finally { setImportingExcel(false); }
  };

  return (
    <Box>
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom fontWeight="bold" sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' } }}>
            Employee Schedule Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create weekly schedules per outlet — Supervisors publish, Employees confirm
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Tooltip title="Refresh"><span><IconButton onClick={fetchSchedules} disabled={loading}><Sync /></IconButton></span></Tooltip>
          {canPublish && (
            <Button variant="contained" startIcon={<AddCircleOutline />} onClick={() => setOpenDialog(true)} sx={{ flexShrink: 0 }}>
              Create Schedule
            </Button>
          )}
          {canPublish && (
            <Button variant="contained" startIcon={<CloudUpload />} onClick={() => excelRef.current?.click()} sx={{ flexShrink: 0 }}>
              Import Excel
            </Button>
          )}
          <input ref={excelRef} type="file" accept=".xlsx, .xls" style={{ display: 'none' }} onChange={handleExcelImport} />
        </Box>
      </Box>

      {error &&
        <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={fetchSchedules}>Retry</Button>}>{error}</Alert>
      }

      {/* ── Outlet Filter ─────────────────────────────────────────────────── */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth select label="Filter by Outlet" value={filterOutlet}
              onChange={e => setFilterOutlet(e.target.value)}
              InputLabelProps={{ shrink: true }}>
              <MenuItem key="all" value="all">All Outlets</MenuItem>
              {OUTLETS.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Button fullWidth variant="outlined" sx={{ height: '56px' }} onClick={() => setFilterOutlet('all')}>
              Clear Filter
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* ── Schedule Table ─────────────────────────────────────────────────── */}
      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6, gap: 2 }}>
            <CircularProgress size={28} /><Typography color="text.secondary">Loading…</Typography>
          </Box>
        ) : (
          <Table sx={{ minWidth: 1000 }}>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Employee</TableCell>
                <TableCell>Position</TableCell>
                <TableCell>Outlet</TableCell>
                <TableCell>Week</TableCell>
                {DAY_LABELS.map(d => <TableCell key={d}>{d}</TableCell>)}
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    {schedules.length === 0 ? 'No schedules yet. Click "Create Schedule" to add one.' : 'No schedules match your filter.'}
                  </TableCell>
                </TableRow>
              ) : filtered.map(s => (
                <TableRow key={s.id} hover>
                  <TableCell><Chip label={s.id} size="small" variant="outlined" /></TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{s.employee}</TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{s.position}</TableCell>
                  <TableCell>
                    <Chip label={s.outlet || '—'} size="small" color={
                      s.outlet === 'Maria Clara Restaurant' ? 'success' :
                      s.outlet === 'Maria Clara Resort' ? 'primary' : 'warning'
                    } variant="outlined" sx={{ fontSize: '0.72rem' }} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{s.week}</TableCell>
                  {DAYS.map(d => (
                    <TableCell key={d} sx={{ fontSize: '0.78rem', color: s[d as keyof Schedule] === 'Off' ? 'text.disabled' : 'inherit' }}>
                      {(s[d as keyof Schedule] as string) || '—'}
                    </TableCell>
                  ))}

                  {/* Status chip */}
                  <TableCell>
                    <Chip label={s.status} size="small"
                      color={
                        s.status === 'Confirmed' ? 'success' :
                        s.status === 'Published' ? 'primary' :
                        s.status === 'Declined'  ? 'error'   : 'default'
                      }
                    />
                  </TableCell>

                  {/* Actions */}
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>

                    {/* HR / Supervisor: Publish (Draft only), Edit, Delete */}
                    {canPublish && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
                        {s.status === 'Draft' && (
                          <Chip
                            label="Publish"
                            size="small"
                            clickable
                            variant="outlined"
                            color="success"
                            onClick={() => handlePublish(s)}
                            sx={{ minWidth: 110 }}
                          />
                        )}
                        <Chip
                          label="Edit Schedule"
                          size="small"
                          clickable
                          variant="outlined"
                          color="primary"
                          onClick={() => openEditDialog(s)}
                          sx={{ minWidth: 110 }}
                        />
                        <Chip
                          label="Delete"
                          size="small"
                          clickable
                          variant="outlined"
                          color="error"
                          onClick={() => handleDelete(s.id)}
                          sx={{ minWidth: 110 }}
                        />
                      </Box>
                    )}

                    {/* Employee: Confirm + Decline (only on Published) */}
                    {canConfirm && s.status === 'Published' && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
                        <Chip
                          label="Confirm"
                          size="small"
                          clickable
                          variant="filled"
                          color="success"
                          onClick={() => handleConfirm(s.id)}
                          sx={{ minWidth: 110 }}
                        />
                        <Chip
                          label="Decline"
                          size="small"
                          clickable
                          variant="outlined"
                          color="error"
                          onClick={() => handleDecline(s.id)}
                          sx={{ minWidth: 110 }}
                        />
                      </Box>
                    )}

                    {/* Employee: already actioned */}
                    {canConfirm && s.status !== 'Published' && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {s.status === 'Confirmed' && <CheckCircleOutline fontSize="small" color="success" />}
                        {s.status === 'Declined'  && <CancelOutlined fontSize="small" color="error" />}
                        <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                          {s.status === 'Confirmed' ? 'Confirmed' : s.status === 'Declined' ? 'Declined' : '—'}
                        </Typography>
                      </Box>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {/* ── Create Schedule Dialog ─────────────────────────────────────────── */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle fontWeight={700}>Create Weekly Schedule</DialogTitle>
        <DialogContent>
          {importingExcel && <Alert severity="info" sx={{ mb: 2 }}>⏳ Importing from Excel…</Alert>}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Employee — position AND outlet auto-fill on select */}
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth select label="Employee" required value={form.employee}
                onChange={e => {
                  const selected = employeeList.find(emp => emp.name === e.target.value);
                  setForm(prev => ({
                    ...prev,
                    employee: e.target.value,
                    position: selected?.position ?? prev.position,
                    outlet: selected?.outlet || prev.outlet,   // ← auto-fill outlet
                  }));
                }}
                InputLabelProps={{ shrink: true }}>
                <MenuItem key="emp-empty" value="">Select employee…</MenuItem>
                {employeeList.map(emp => <MenuItem key={emp.name} value={emp.name}>{emp.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth select label="Position" value={form.position}
                onChange={e => setForm({ ...form, position: e.target.value })}
                InputLabelProps={{ shrink: true }}>
                <MenuItem key="pos-empty" value="">Select position…</MenuItem>
                {POSITIONS.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth select label="Outlet / Branch" value={form.outlet}
                onChange={e => setForm(prev => ({ ...prev, outlet: e.target.value }))}
                InputLabelProps={{ shrink: true }}>
                <MenuItem key="outlet-empty" value="">Select outlet</MenuItem>
                {OUTLETS.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="Week Period" required value={form.week}
                onChange={e => setForm({ ...form, week: e.target.value })}
                placeholder="e.g. May 12–18, 2026" />
              <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75, flexWrap: 'wrap' }}>
                <Chip icon={<CalendarMonth sx={{ fontSize: '0.85rem !important' }} />}
                  label="This Week" size="small" variant="outlined" color="primary" clickable
                  onClick={() => setForm({ ...form, week: getWeekRange(0) })} />
                <Chip icon={<CalendarMonth sx={{ fontSize: '0.85rem !important' }} />}
                  label="Next Week" size="small" variant="outlined" clickable
                  onClick={() => setForm({ ...form, week: getWeekRange(1) })} />
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Autocomplete freeSolo options={BREAK_TIME_OPTIONS} value={form.breakTime}
                onChange={(_, v) => setForm({ ...form, breakTime: v ?? '' })}
                onInputChange={(_, v) => setForm({ ...form, breakTime: v })}
                renderInput={(params) => (
                  <TextField {...params} fullWidth label="Break Time" placeholder="e.g. 1 hour" InputLabelProps={{ shrink: true }} />
                )} />
            </Grid>
          </Grid>

          <Divider sx={{ mt: 3, mb: 2 }}>
            <Typography variant="caption" color="text.secondary">Daily Schedule Assignment</Typography>
          </Divider>
          <Grid container spacing={1.5}>
            {DAYS.map(day => (
              <Grid key={day} size={{ xs: 12, sm: 6, md: 3 }}>
                <Autocomplete freeSolo options={SHIFT_PRESETS}
                  value={form[day as keyof typeof form] || ''}
                  onChange={(_, v) => setForm({ ...form, [day]: v ?? '' })}
                  onInputChange={(_, v) => setForm({ ...form, [day]: v })}
                  renderInput={(params) => (
                    <TextField {...params} fullWidth
                      label={day.charAt(0).toUpperCase() + day.slice(1)}
                      placeholder="e.g. 8:00 AM – 5:00 PM"
                      InputLabelProps={{ shrink: true }} />
                  )} />
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}>
            {saving ? 'Saving…' : 'Save as Draft'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit Schedule Dialog ───────────────────────────────────────────── */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle fontWeight={700}>Edit Schedule — {editRecord?.id}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" icon={<EditIcon fontSize="inherit" />} sx={{ mb: 2 }}>
            Saving will reset this schedule's status to <strong>Draft</strong> and notify the employee to re-confirm.
          </Alert>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth label="Employee Name" required value={editForm.employee}
                onChange={e => setEditForm({ ...editForm, employee: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth select label="Position" value={editForm.position}
                onChange={e => setEditForm({ ...editForm, position: e.target.value })}
                InputLabelProps={{ shrink: true }}>
                <MenuItem key="edit-pos-empty" value="">Select position…</MenuItem>
                {POSITIONS.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth select label="Outlet / Branch" value={editForm.outlet}
                onChange={e => setEditForm(prev => ({ ...prev, outlet: e.target.value }))}
                InputLabelProps={{ shrink: true }}>
                <MenuItem key="edit-outlet-empty" value="">Select outlet…</MenuItem>
                {OUTLETS.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="Week Period" required value={editForm.week}
                onChange={e => setEditForm({ ...editForm, week: e.target.value })}
                placeholder="e.g. May 12–18, 2026" />
              <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75, flexWrap: 'wrap' }}>
                <Chip icon={<CalendarMonth sx={{ fontSize: '0.85rem !important' }} />}
                  label="This Week" size="small" variant="outlined" color="primary" clickable
                  onClick={() => setEditForm({ ...editForm, week: getWeekRange(0) })} />
                <Chip icon={<CalendarMonth sx={{ fontSize: '0.85rem !important' }} />}
                  label="Next Week" size="small" variant="outlined" clickable
                  onClick={() => setEditForm({ ...editForm, week: getWeekRange(1) })} />
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Autocomplete freeSolo options={BREAK_TIME_OPTIONS} value={editForm.breakTime}
                onChange={(_, v) => setEditForm({ ...editForm, breakTime: v ?? '' })}
                onInputChange={(_, v) => setEditForm({ ...editForm, breakTime: v })}
                renderInput={(params) => (
                  <TextField {...params} fullWidth label="Break Time" placeholder="e.g. 1 hour" InputLabelProps={{ shrink: true }} />
                )} />
            </Grid>
          </Grid>

          <Divider sx={{ mt: 3, mb: 2 }}>
            <Typography variant="caption" color="text.secondary">Daily Schedule Assignment</Typography>
          </Divider>
          <Grid container spacing={1.5}>
            {DAYS.map(day => (
              <Grid key={day} size={{ xs: 12, sm: 6, md: 3 }}>
                <Autocomplete freeSolo options={SHIFT_PRESETS}
                  value={editForm[day as keyof typeof editForm] || ''}
                  onChange={(_, v) => setEditForm({ ...editForm, [day]: v ?? '' })}
                  onInputChange={(_, v) => setEditForm({ ...editForm, [day]: v })}
                  renderInput={(params) => (
                    <TextField {...params} fullWidth
                      label={day.charAt(0).toUpperCase() + day.slice(1)}
                      placeholder="e.g. 8:00 AM – 5:00 PM"
                      InputLabelProps={{ shrink: true }} />
                  )} />
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleEditSave} disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open} autoHideDuration={5000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}