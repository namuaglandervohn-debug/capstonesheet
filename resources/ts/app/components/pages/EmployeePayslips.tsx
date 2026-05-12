import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, CircularProgress,
  Alert, Dialog, DialogTitle, DialogContent, DialogActions, Grid,
  Snackbar,
} from '@mui/material';
import { Print, Sync } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { API, HEADERS } from '../../lib/api';

interface Payslip {
  id: string; employee: string; position: string; period: string;
  totalHours: string; overtime: string; deductions: string;
  grossPay: string; netPay: string;
  status: string; releasedAt?: string; payslipDate?: string;
  // Extended receipt fields
  basicPayAmt?: string; otAmt?: string;
  nsdHours?: string; nsdAmt?: string;
  regularHolidayDays?: string; regularHolidayAmt?: string;
  specialHolidayDays?: string; specialHolidayAmt?: string;
  silDays?: string; silAmt?: string;
  allowanceAmt?: string; retroAmt?: string;
  tardinessMin?: string; undertimeHours?: string;
  sssAmt?: string; phicAmt?: string; hdmfAmt?: string;
  cashAdvance?: string; atd?: string; otherCharges?: string;
  breakages?: string; amesco?: string; pagibigLoan?: string;
}

export default function EmployeePayslips() {
  const { user } = useAuth();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Payslip | null>(null);
  const [viewDialog, setViewDialog] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const fetchPayslips = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/payroll`, { headers: HEADERS });
      const data = await res.json();
      const mine = (data.payrolls ?? []).filter((p: any) => p?.employee === user?.name && p != null);
      setPayslips(mine.sort((a: any, b: any) => b.period.localeCompare(a.period)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPayslips(); }, [user]);

  const handlePrint = (slip: Payslip) => {
    const grossAmt = parseAmt(slip.grossPay);
    const dedAmt   = parseAmt(slip.deductions);
    const netAmt   = parseAmt(slip.netPay);
    const sss      = parseFloat((grossAmt * 0.045).toFixed(2));
    const phic     = parseFloat((grossAmt * 0.02).toFixed(2));
    const hdmf     = 100;
    const totalDed = dedAmt > 0 ? dedAmt : sss + phic + hdmf;

    const win = window.open('', '_blank', 'width=720,height=960');
    if (!win) return;
    win.document.write(`
      <html><head><title>Payslip — ${slip.employee}</title>
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
        <tr><td style="width:40%"><b>Department:</b></td><td colspan="2">${slip.position || '—'}</td></tr>
        <tr><td><b>Pay Period:</b></td><td colspan="2">${slip.period}</td></tr>
        <tr class="highlight"><td><b>Employee Name:</b></td><td colspan="2"><b>${slip.employee.toUpperCase()}</b></td></tr>
        <tr><td><b>Position:</b></td><td colspan="2">${slip.position || '—'}</td></tr>
        <tr class="sec-hdr"><td>Earnings:</td><td class="center" style="width:24%">Days/Hours/Mins.</td><td class="right" style="width:22%">Amount</td></tr>
        <tr><td>Basic Pay</td><td class="right">${slip.totalHours || '—'}</td><td class="right">${slip.basicPayAmt || fmt(grossAmt)}</td></tr>
        <tr><td>Reg.OT</td><td class="right">${slip.overtime && slip.overtime !== '0' ? slip.overtime : '—'}</td><td class="right">${slip.otAmt || '—'}</td></tr>
        <tr><td>NSD</td><td class="right">${slip.nsdHours || '—'}</td><td class="right">${slip.nsdAmt || '—'}</td></tr>
        <tr><td>Regular Holiday</td><td class="right">${slip.regularHolidayDays || '—'}</td><td class="right">${slip.regularHolidayAmt || '—'}</td></tr>
        <tr><td>Special Holiday</td><td class="right">${slip.specialHolidayDays || '—'}</td><td class="right">${slip.specialHolidayAmt || '—'}</td></tr>
        <tr><td>SIL</td><td class="right">${slip.silDays || '—'}</td><td class="right">${slip.silAmt || '—'}</td></tr>
        <tr><td>Allowance</td><td class="right">—</td><td class="right">${slip.allowanceAmt || '—'}</td></tr>
        <tr><td>RETRO/ADJUSTMENT</td><td class="right">—</td><td class="right">${slip.retroAmt || '—'}</td></tr>
        <tr><td>Tardiness (Mins.)</td><td class="right">${slip.tardinessMin || '—'}</td><td class="right">—</td></tr>
        <tr><td>Undertime (Hours)</td><td class="right">${slip.undertimeHours || '—'}</td><td class="right">—</td></tr>
        <tr class="gross-row"><td colspan="2" class="center">GROSS PAY</td><td class="right">${fmt(grossAmt)}</td></tr>
        <tr class="sec-hdr"><td colspan="3">DEDUCTIONS:</td></tr>
        <tr><td colspan="2">SSS Premium</td><td class="right">${slip.sssAmt || (grossAmt > 0 ? fmt(sss) : '—')}</td></tr>
        <tr><td colspan="2">PHIC Premium</td><td class="right">${slip.phicAmt || (grossAmt > 0 ? fmt(phic) : '—')}</td></tr>
        <tr><td colspan="2">HDMF Premium</td><td class="right">${slip.hdmfAmt || (grossAmt > 0 ? fmt(hdmf) : '—')}</td></tr>
        <tr><td colspan="2">CASH ADVANCE</td><td class="right">${slip.cashAdvance || '—'}</td></tr>
        <tr><td colspan="2">ATD</td><td class="right">${slip.atd || '—'}</td></tr>
        <tr><td colspan="2">Other Charges</td><td class="right">${slip.otherCharges || '—'}</td></tr>
        <tr><td colspan="2">BREAKAGES Charges (last)</td><td class="right">${slip.breakages || '—'}</td></tr>
        <tr><td colspan="2">AMESCO/OTHER CHARGES</td><td class="right">${slip.amesco || '—'}</td></tr>
        <tr><td colspan="2">PAG-IBIG LOAN</td><td class="right">${slip.pagibigLoan || '—'}</td></tr>
        <tr class="sec-hdr"><td colspan="2" class="right">TOTAL DEDUCTIONS:</td><td class="right">${fmt(totalDed)}</td></tr>
        <tr class="net-row"><td colspan="2" class="center">NET PAY</td><td class="right">${fmt(netAmt)}</td></tr>
      </table>
      <div class="ack">
        I acknowledge to have received the amount of <b>${fmt(netAmt)}</b> and have no further claim for services rendered.
      </div>
      <div class="sig">
        <div class="sig-line">Date: ${slip.payslipDate ? new Date(slip.payslipDate + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '___________'}</div>
        <div style="width:42%; text-align:center;">
          <div style="padding-bottom:4px; border-bottom:1px solid #333; font-size:10px;">${slip.employee.toUpperCase()}</div>
          <div style="font-size:9px; margin-top:3px;">${slip.position || '—'}</div>
        </div>
      </div>
      <div class="footer">Generated: ${new Date().toLocaleString()} &nbsp;·&nbsp; Payroll ID: ${slip.id} &nbsp;·&nbsp; Electronically generated payslip.</div>
      </body></html>`);
    win.document.close();
    win.print();
  };

  const parseAmt = (v: string) => parseFloat((v ?? '').replace(/[₱,]/g, '')) || 0;
  const fmt = (v: number) => v > 0
    ? `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—';

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Delete payslip record ${id}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API}/payroll/${id}`, { method: 'DELETE', headers: HEADERS });
      if (!res.ok) throw new Error('Delete failed');
      setPayslips(prev => prev.filter(p => p.id !== id));
      setSnackbar({ open: true, message: `Payslip ${id} deleted.`, severity: 'success' });
    } catch (e: any) {
      setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' });
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' } }}>
            My Payslips
          </Typography>
          <Typography variant="body2" color="text.secondary">View and print your electronic payslips — {user?.name}</Typography>
        </Box>
        <Button startIcon={loading ? <CircularProgress size={16} /> : <Sync />} onClick={fetchPayslips} disabled={loading} variant="outlined">Refresh</Button>
      </Box>

      {!loading && payslips.length === 0 && (
        <Alert severity="info">No payslips found for your account. Contact HR if you believe this is an error.</Alert>
      )}

      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6, gap: 2 }}><CircularProgress size={28} /><Typography color="text.secondary">Loading payslips…</Typography></Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Payroll ID</TableCell><TableCell>Period</TableCell><TableCell>Position</TableCell>
                <TableCell>Gross Pay</TableCell><TableCell>Deductions</TableCell><TableCell>Net Pay</TableCell>
                <TableCell>Status</TableCell><TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payslips.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>No payslips found.</TableCell></TableRow>
              ) : payslips.map(p => (
                <TableRow key={p.id} hover>
                  <TableCell><Chip label={p.id} size="small" variant="outlined" /></TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{p.period}</TableCell>
                  <TableCell>{p.position}</TableCell>
                  <TableCell>{p.grossPay}</TableCell>
                  <TableCell sx={{ color: 'error.main' }}>{p.deductions}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: 'success.main' }}>{p.netPay}</TableCell>
                  <TableCell>
                    <Chip label={p.status} size="small"
                      color={p.status === 'Released' ? 'success' : p.status === 'For Review' ? 'warning' : 'default'} />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
                      <Chip
                        label="View Payslip"
                        size="small"
                        clickable
                        variant="outlined"
                        color="primary"
                        onClick={() => { setSelected(p); setViewDialog(true); }}
                        sx={{ minWidth: 110 }}
                      />
                      {(p.status === 'Released' || p.status === 'For Review') && (
                        <Chip
                          label="Print"
                          size="small"
                          clickable
                          variant="outlined"
                          color="default"
                          icon={<Print style={{ fontSize: '0.9rem' }} />}
                          onClick={() => handlePrint(p)}
                          sx={{ minWidth: 110 }}
                        />
                      )}
                      <Chip
                        label="Delete"
                        size="small"
                        clickable
                        variant="outlined"
                        color="error"
                        onClick={() => handleDelete(p.id)}
                        sx={{ minWidth: 110 }}
                      />
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {/* Payslip Detail Dialog — receipt format */}
      <Dialog open={viewDialog} onClose={() => setViewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Payslip
            {selected && <Chip label={selected.id} size="small" variant="outlined" />}
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 2 }}>
          {selected && (() => {
            const grossAmt = parseAmt(selected.grossPay);
            const dedAmt   = parseAmt(selected.deductions);
            const netAmt   = parseAmt(selected.netPay);
            const sss      = parseFloat((grossAmt * 0.045).toFixed(2));
            const phic     = parseFloat((grossAmt * 0.02).toFixed(2));
            const hdmf     = 100;
            const totalDed = dedAmt > 0 ? dedAmt : sss + phic + hdmf;

            const rowSx   = { display: 'flex', borderBottom: '1px solid #ccc' };
            const labelSx = { width: '40%', fontWeight: 600, p: '4px 8px', borderRight: '1px solid #ccc', fontSize: '0.78rem' };
            const valSx   = { flex: 1, p: '4px 8px', fontSize: '0.78rem' };

            const earningsRows: [string, string, string][] = [
              ['Basic Pay',          selected.totalHours || '—',                                           selected.basicPayAmt || fmt(grossAmt)],
              ['Reg.OT',             selected.overtime && selected.overtime !== '0' ? selected.overtime : '—', selected.otAmt || '—'],
              ['NSD',                selected.nsdHours  || '—',                                            selected.nsdAmt  || '—'],
              ['Regular Holiday',    selected.regularHolidayDays || '—',                                   selected.regularHolidayAmt || '—'],
              ['Special Holiday',    selected.specialHolidayDays || '—',                                   selected.specialHolidayAmt || '—'],
              ['SIL',                selected.silDays   || '—',                                            selected.silAmt  || '—'],
              ['Allowance',          '—',                                                                   selected.allowanceAmt || '—'],
              ['RETRO/ADJUSTMENT',   '—',                                                                   selected.retroAmt || '—'],
              ['Tardiness (Mins.)',  selected.tardinessMin   || '—',                                       '—'],
              ['Undertime (Hours)',  selected.undertimeHours || '—',                                       '—'],
            ];

            const deductionRows: [string, string][] = [
              ['SSS Premium',              selected.sssAmt      || (grossAmt > 0 ? fmt(sss)  : '—')],
              ['PHIC Premium',             selected.phicAmt     || (grossAmt > 0 ? fmt(phic) : '—')],
              ['HDMF Premium',             selected.hdmfAmt     || (grossAmt > 0 ? fmt(hdmf) : '—')],
              ['CASH ADVANCE',             selected.cashAdvance || '—'],
              ['ATD',                      selected.atd         || '—'],
              ['Other Charges',            selected.otherCharges || '—'],
              ['BREAKAGES Charges (last)', selected.breakages   || '—'],
              ['AMESCO/OTHER CHARGES',     selected.amesco      || '—'],
              ['PAG-IBIG LOAN',            selected.pagibigLoan || '—'],
            ];

            return (
              <Box sx={{ border: '1px solid #999', fontSize: '0.78rem', lineHeight: 1.5 }}>
                {/* Company Header */}
                <Box sx={{ textAlign: 'center', fontWeight: 'bold', py: 1, px: 2, borderBottom: '1px solid #999', fontSize: '0.88rem', letterSpacing: 0.5 }}>
                  BUENAVENTURA ESTATE
                </Box>

                {/* Department */}
                <Box sx={rowSx}>
                  <Box sx={labelSx}>Department:</Box>
                  <Box sx={valSx}>{selected.position || '—'}</Box>
                </Box>
                {/* Pay Period */}
                <Box sx={rowSx}>
                  <Box sx={labelSx}>Pay period:</Box>
                  <Box sx={valSx}>{selected.period}</Box>
                </Box>
                {/* Employee Name */}
                <Box sx={{ ...rowSx, bgcolor: '#e8f5e9' }}>
                  <Box sx={{ ...labelSx, fontWeight: 700 }}>Employee Name:</Box>
                  <Box sx={{ ...valSx, fontWeight: 700 }}>{selected.employee.toUpperCase()}</Box>
                </Box>
                {/* Position */}
                <Box sx={rowSx}>
                  <Box sx={labelSx}>Position:</Box>
                  <Box sx={valSx}>{selected.position || '—'}</Box>
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

                {/* GROSS PAY */}
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
                  <Box sx={{ width: '22%', p: '5px 6px', textAlign: 'right', fontSize: '0.78rem' }}>{fmt(totalDed)}</Box>
                </Box>

                {/* NET PAY */}
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
                      {selected.payslipDate
                        ? new Date(selected.payslipDate + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
                        : '___________'}
                    </strong>
                  </Box>
                  <Box sx={{ flex: 1, textAlign: 'center' }}>
                    <Box sx={{ fontWeight: 700, fontSize: '0.78rem', pb: '4px', borderBottom: '1px solid #333' }}>
                      {selected.employee.toUpperCase()}
                    </Box>
                    <Box sx={{ fontSize: '0.72rem', mt: '3px' }}>{selected.position || '—'}</Box>
                  </Box>
                </Box>
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialog(false)}>Close</Button>
          {selected && (selected.status === 'Released' || selected.status === 'For Review') && (
            <Button
              variant="contained"
              startIcon={<Print />}
              onClick={() => handlePrint(selected!)}
            >
              Print Payslip
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
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