import React, { useState, useEffect } from "react";
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Slider, Card, CardContent,
  Grid, CircularProgress, Alert, Snackbar, Tooltip, IconButton,
  Divider, MenuItem,
} from "@mui/material";
import {
  AddCircleOutline, Insights, Grade, TaskAlt, Sync, EmojiEvents,
  DeleteOutline, Groups, Edit, Add, Save,
} from "@mui/icons-material";
import { API, HEADERS } from "../../lib/api";
import { DSS_CRITERIA, POSITIONS, OUTLETS } from "../../lib/constants";
import { useAuth } from "../../context/AuthContext";

/* ── Types ─────────────────────────────────────────────────────────────── */
interface CriterionDef {
  key: string;
  label: string;
  weight: number;
  description: string;
}

interface EvaluationResult {
  id: string;
  employee: string;
  position: string;
  period: string;
  workQuality: number;
  jobKnowledge: number;
  teamwork: number;
  initiative: number;
  peerEvaluation: number;
  conduct: number;
  attendance: number;
  performanceOutput: number;
  finalScore: number;
  evaluatedBy?: string;
  status: "Pending GM Approval" | "Approved" | "Employee of the Month";
}

interface EmployeeRecord {
  id: string;
  name: string;
  position: string;
  outlet: string;
  status: string;
}

interface FormState {
  employee: string;
  position: string;
  outlet: string;
  periodStart: string;
  periodEnd: string;
  scores: Record<string, number>;
  comments: string;
}

interface PublishedTemplate {
  position: string;
  periodStart: string;
  periodEnd: string;
  criteria: CriterionDef[];
  publishedAt: string;
}

/* ── localStorage helpers ────────────────────────────────────────────── */
const CRITERIA_KEY = "hris_eval_criteria";
const TEMPLATE_KEY = "hris_eval_template";

const loadCriteria = (): CriterionDef[] => {
  try {
    const s = localStorage.getItem(CRITERIA_KEY);
    return s ? JSON.parse(s) : [...DSS_CRITERIA];
  } catch {
    return [...DSS_CRITERIA];
  }
};

const loadTemplate = (): PublishedTemplate | null => {
  try {
    const s = localStorage.getItem(TEMPLATE_KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
};

function buildEmptyForm(criteria: CriterionDef[]): FormState {
  const scores: Record<string, number> = {};
  criteria.forEach((c) => { scores[c.key] = 50; });
  return { employee: "", position: "", outlet: "", periodStart: "", periodEnd: "", scores, comments: "" };
}

function computeScore(scores: Record<string, number>, criteria: CriterionDef[]): number {
  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0);
  if (totalWeight === 0) return 50;
  return criteria.reduce((sum, c) => sum + (scores[c.key] ?? 50) * c.weight, 0) / totalWeight;
}

/* ── Component ────────────────────────────────────────────────────────── */
export default function PerformanceEvaluation() {
  const { user } = useAuth();

  /* evaluation results */
  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* eval form dialog */
  const [openEvalForm, setOpenEvalForm] = useState(false);
  const [form, setForm] = useState<FormState>(() => buildEmptyForm(loadCriteria()));
  const [saving, setSaving] = useState(false);

  /* snackbar */
  const [snackbar, setSnackbar] = useState({
    open: false, message: "", severity: "success" as "success" | "error",
  });

  /* custom criteria */
  const [customCriteria, setCustomCriteria] = useState<CriterionDef[]>(loadCriteria);
  const [criteriaDialogOpen, setCriteriaDialogOpen] = useState(false);
  const [editCriteriaTemp, setEditCriteriaTemp] = useState<CriterionDef[]>([]);

  /* published template */
  const [publishedTemplate, setPublishedTemplate] = useState<PublishedTemplate | null>(loadTemplate);

  /* employees (supervisor) */
  const [employeesList, setEmployeesList] = useState<EmployeeRecord[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);

  /* ── data fetching ─────────────────────────────────────────────────── */
  const fetchEvaluations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/evaluations`, { headers: HEADERS });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Server error");
      const evals = (data.evaluations ?? []).filter((e: any) => e != null);
      evals.sort((a: EvaluationResult, b: EvaluationResult) => b.finalScore - a.finalScore);
      setResults(evals);
    } catch (e: any) {
      setError(`Could not load evaluations: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvaluations(); }, []);

  useEffect(() => {
    if (user?.role !== "supervisor") return;
    setEmployeesLoading(true);
    fetch(`${API}/employees`, { headers: HEADERS })
      .then((r) => r.json())
      .then((d) => setEmployeesList((d.employees ?? []).filter((e: any) => e != null)))
      .catch(() => {})
      .finally(() => setEmployeesLoading(false));
  }, [user]);

  /* ── submit handlers ────────────────────────────────────────────────── */
  const handleSubmit = async () => {
    if (user?.role === "hr") {
      /* HR publishes a template — no evaluation record created */
      const template: PublishedTemplate = {
        position: form.position,
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        criteria: customCriteria,
        publishedAt: new Date().toISOString(),
      };
      localStorage.setItem(TEMPLATE_KEY, JSON.stringify(template));
      setPublishedTemplate(template);
      setOpenEvalForm(false);
      setForm(buildEmptyForm(customCriteria));
      setSnackbar({ open: true, message: "✅ Evaluation form published successfully!", severity: "success" });
      return;
    }

    /* Supervisor creates evaluation record */
    if (!form.employee) return;
    setSaving(true);
    try {
      const criteria = publishedTemplate?.criteria ?? customCriteria;
      const finalScore = computeScore(form.scores, criteria);
      const body = {
        employee: form.employee,
        position: form.position,
        outlet: form.outlet,
        period:
          form.periodStart && form.periodEnd
            ? `${form.periodStart} — ${form.periodEnd}`
            : form.periodStart || "—",
        evaluatedBy: user?.name ?? "",
        evaluatorRole: user?.role ?? "",
        workQuality: form.scores.workQuality ?? 50,
        jobKnowledge: form.scores.jobKnowledge ?? 50,
        teamwork: form.scores.teamwork ?? 50,
        initiative: form.scores.initiative ?? 50,
        peerEvaluation: form.scores.peerEvaluation ?? 50,
        conduct: form.scores.conduct ?? 50,
        attendance: form.scores.attendance ?? 50,
        performanceOutput: form.scores.performanceOutput ?? 50,
        comments: form.comments,
        finalScore,
      };
      const res = await fetch(`${API}/evaluations`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Server error");
      const updated = [...results, data.record].sort((a, b) => b.finalScore - a.finalScore);
      setResults(updated);
      // ── Notify GM of new evaluation submission ──
      try {
        await fetch(`${API}/notifications`, {
          method: "POST",
          headers: HEADERS,
          body: JSON.stringify({
            recipientEmployee: "gm",
            type: "eval_submitted",
            message: `${user?.name ?? "Supervisor"} submitted an evaluation for ${form.employee} — Final Score: ${data.record.finalScore.toFixed(2)}%`,
            scheduleId: data.record.id,
            week: form.periodStart,
            createdBy: user?.name ?? "",
          }),
        });
      } catch { /* non-critical */ }
      setOpenEvalForm(false);
      setForm(buildEmptyForm(criteria));
      setSnackbar({
        open: true,
        message: `✅ Evaluation submitted for ${form.employee}! Score: ${data.record.finalScore.toFixed(2)}%`,
        severity: "success",
      });
    } catch (e: any) {
      setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  const openEvaluateForEmployee = (emp: EmployeeRecord) => {
    const template = publishedTemplate;
    const criteria = template?.criteria ?? customCriteria;
    const scores: Record<string, number> = {};
    criteria.forEach((c) => { scores[c.key] = 50; });
    setForm({
      employee: emp.name,
      position: emp.position,
      outlet: emp.outlet,
      periodStart: template?.periodStart ?? "",
      periodEnd: template?.periodEnd ?? "",
      scores,
      comments: "",
    });
    setOpenEvalForm(true);
  };

  /* ── criteria dialog ─────────────────────────────────────────────── */
  const openCriteriaDialog = () => {
    setEditCriteriaTemp([...customCriteria]);
    setCriteriaDialogOpen(true);
  };

  const saveCriteria = () => {
    setCustomCriteria(editCriteriaTemp);
    localStorage.setItem(CRITERIA_KEY, JSON.stringify(editCriteriaTemp));
    setCriteriaDialogOpen(false);
    setSnackbar({ open: true, message: "✅ Criteria updated!", severity: "success" });
  };

  const addNewCriterion = () => {
    const newKey = `custom_${Date.now()}`;
    setEditCriteriaTemp((prev) => [
      ...prev,
      { key: newKey, label: "New Criterion", weight: 0.05, description: "Describe this criterion." },
    ]);
  };

  const removeCriterion = (idx: number) => {
    setEditCriteriaTemp((prev) => prev.filter((_, i) => i !== idx));
  };

  /* ── approval / EOTM / delete ────────────────────────────────────── */
  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`${API}/evaluations/${id}`, {
        method: "PUT", headers: HEADERS, body: JSON.stringify({ status: "Approved" }),
      });
      if (!res.ok) throw new Error("Update failed");
      setResults((prev) => prev.map((r) => r.id === id ? { ...r, status: "Approved" } : r));
      setSnackbar({ open: true, message: "✅ Evaluation approved!", severity: "success" });
    } catch (e: any) {
      setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: "error" });
    }
  };

  const handleEOTM = async (id: string) => {
    try {
      const res = await fetch(`${API}/evaluations/${id}`, {
        method: "PUT", headers: HEADERS, body: JSON.stringify({ status: "Employee of the Month" }),
      });
      if (!res.ok) throw new Error("Update failed");
      setResults((prev) => prev.map((r) => r.id === id ? { ...r, status: "Employee of the Month" } : r));
      setSnackbar({ open: true, message: "🏆 Employee of the Month saved!", severity: "success" });
    } catch (e: any) {
      setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: "error" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Delete evaluation ${id}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API}/evaluations/${id}`, { method: "DELETE", headers: HEADERS });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Server error");
      setResults((prev) => prev.filter((r) => r.id !== id));
      setSnackbar({ open: true, message: `🗑️ Evaluation ${id} deleted.`, severity: "success" });
    } catch (e: any) {
      setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: "error" });
    }
  };

  /* ── derived values ─────────────────────────────────────────────── */
  const eotm = results.find((r) => r.status === "Employee of the Month");
  const activeCriteria =
    user?.role === "supervisor" && publishedTemplate
      ? publishedTemplate.criteria
      : customCriteria;
  const previewScore = computeScore(form.scores, activeCriteria);
  const displayResults =
    user?.role === "employee" ? results.filter((r) => r.employee === user.name) : results;

  // ── Date-range gate for supervisor Evaluate button ─────────────────
  const todayStr = new Date().toISOString().split("T")[0];
  const isWithinPeriod = publishedTemplate
    ? todayStr >= publishedTemplate.periodStart && todayStr <= publishedTemplate.periodEnd
    : true; // no template → allow (use default criteria)

  /* ═══════════════════════════════════════════════════════════════════ */
  return (
    <Box>
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" }, flexWrap: "wrap", gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom fontWeight="bold" sx={{ fontSize: { xs: "1.35rem", sm: "1.75rem", md: "2.125rem" } }}>
            Performance Evaluation with DSS
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {user?.role === "supervisor"
              ? "Evaluate your team members using the HR-published performance criteria"
              : user?.role === "gm"
              ? "Review DSS results and approve / designate Employee of the Month"
              : user?.role === "employee"
              ? "View your evaluation results"
              : "Decision Support System — Weighted scoring per HRIS Capstone documentation"}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Tooltip title="Refresh">
            <span>
              <IconButton onClick={fetchEvaluations} disabled={loading}><Sync /></IconButton>
            </span>
          </Tooltip>
          {user?.role === "hr" && (
            <Button
              variant="contained"
              startIcon={<AddCircleOutline />}
              onClick={() => { setForm(buildEmptyForm(customCriteria)); setOpenEvalForm(true); }}
            >
              New Evaluation
            </Button>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}
          action={<Button size="small" onClick={fetchEvaluations}>Retry</Button>}>
          {error}
        </Alert>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* SUPERVISOR VIEW                                               */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {user?.role === "supervisor" && (
        <>
          {/* Published template banner */}
          {publishedTemplate ? (
            <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: "#e8f5e9" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                <TaskAlt color="success" sx={{ fontSize: 20 }} />
                <Typography variant="subtitle2" fontWeight={700} color="success.dark">
                  Published Evaluation Period: {publishedTemplate.periodStart} — {publishedTemplate.periodEnd}
                </Typography>
                {publishedTemplate.position && (
                  <Chip label={`For: ${publishedTemplate.position}`} size="small" color="success" variant="outlined" />
                )}
                <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
                  Published: {new Date(publishedTemplate.publishedAt).toLocaleDateString()}
                </Typography>
              </Box>
            </Paper>
          ) : (
            <Alert severity="info" sx={{ mb: 3 }}>
              No evaluation form has been published by HR yet. You can still evaluate employees using the default DSS criteria.
            </Alert>
          )}

          {/* Employee list for evaluation */}
          <Paper sx={{ mb: 4 }}>
            <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", gap: 1 }}>
              <Groups color="primary" />
              <Typography variant="h6" fontWeight={700}>Employee List — Select an Employee to Evaluate</Typography>
            </Box>
            <TableContainer sx={{ overflowX: "auto" }}>
              {employeesLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 5, gap: 2 }}>
                  <CircularProgress size={24} />
                  <Typography color="text.secondary">Loading employees…</Typography>
                </Box>
              ) : (
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: "primary.main" }}>
                      {["Employee ID", "Name", "Position", "Outlet", "Status", "Action"].map((h) => (
                        <TableCell key={h} sx={{ color: "white", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {employeesList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 5, color: "text.secondary" }}>
                          No employees found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      employeesList.map((emp) => (
                        <TableRow key={emp.id} hover>
                          <TableCell><Chip label={emp.id} size="small" variant="outlined" /></TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{emp.name}</TableCell>
                          <TableCell>{emp.position}</TableCell>
                          <TableCell>{emp.outlet}</TableCell>
                          <TableCell>
                            <Chip
                              label={emp.status}
                              size="small"
                              color={emp.status === "Active" ? "success" : emp.status === "On Leave" ? "warning" : "default"}
                            />
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const evalRecord = results.find(
                                (r) => r.evaluatedBy === user?.name && r.employee === emp.name
                              );
                              const alreadyEvaluated = !!evalRecord;
                              const canEval = !alreadyEvaluated && isWithinPeriod;
                              return (
                                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, alignItems: "flex-start" }}>
                                  <Tooltip
                                    title={
                                      alreadyEvaluated
                                        ? "Already evaluated"
                                        : !isWithinPeriod
                                        ? `Evaluation period: ${publishedTemplate?.periodStart ?? "—"} to ${publishedTemplate?.periodEnd ?? "—"}`
                                        : "Evaluate this employee"
                                    }
                                  >
                                    <span>
                                      <Chip
                                        label={alreadyEvaluated ? "Evaluated" : "Evaluate"}
                                        size="small"
                                        clickable={canEval}
                                        variant="outlined"
                                        color={alreadyEvaluated ? "default" : canEval ? "primary" : "default"}
                                        disabled={!canEval}
                                        onClick={canEval ? () => openEvaluateForEmployee(emp) : undefined}
                                        sx={{ minWidth: 100 }}
                                      />
                                    </span>
                                  </Tooltip>
                                  {alreadyEvaluated && evalRecord && (
                                    <Chip
                                      label="Delete"
                                      size="small"
                                      clickable
                                      variant="outlined"
                                      color="error"
                                      onClick={() => handleDelete(evalRecord.id)}
                                      sx={{ minWidth: 100 }}
                                    />
                                  )}
                                </Box>
                              );
                            })()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </TableContainer>
          </Paper>

          {/* Supervisor's own submitted evaluations */}
          {results.filter((r) => r.evaluatedBy === user?.name).length > 0 && (
            <>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>My Submitted Evaluations</Typography>
              <TableContainer component={Paper} sx={{ overflowX: "auto", mb: 3 }}>
                <Table sx={{ minWidth: 700 }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: "grey.100" }}>
                      {["Employee", "Position", "Period", "Final Score", "Status"].map((h) => (
                        <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {results.filter((r) => r.evaluatedBy === user?.name).map((r) => (
                      <TableRow key={r.id} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{r.employee}</TableCell>
                        <TableCell>{r.position}</TableCell>
                        <TableCell>{r.period}</TableCell>
                        <TableCell>
                          <Typography fontWeight="bold" color="primary.main">{r.finalScore.toFixed(2)}%</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={r.status}
                            size="small"
                            color={r.status === "Employee of the Month" ? "warning" : r.status === "Approved" ? "success" : "default"}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* HR / GM / EMPLOYEE VIEW                                       */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {user?.role !== "supervisor" && (
        <>
          {/* DSS formula banner */}
          <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: "#f0f7f0" }}>
            <Typography variant="subtitle2" fontWeight={700} color="primary.dark" gutterBottom>
              DSS Weighted Scoring Formula (Capstone Chapter II):
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Final Score = {customCriteria.map((c) => `(${c.label} × ${(c.weight * 100).toFixed(0)}%)`).join(" + ")}
            </Typography>
          </Paper>

          {/* Stat cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 3 }}>
              <Card elevation={2}>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Total Evaluated</Typography>
                      <Typography variant="h5" fontWeight="bold">{results.length}</Typography>
                    </Box>
                    <TaskAlt color="success" sx={{ fontSize: 36 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Card elevation={2}>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Pending GM Approval</Typography>
                      <Typography variant="h5" fontWeight="bold">
                        {results.filter((r) => r.status === "Pending GM Approval").length}
                      </Typography>
                    </Box>
                    <Insights color="warning" sx={{ fontSize: 36 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card elevation={2} sx={{ bgcolor: "warning.main", color: "white" }}>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Box>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>🏆 Employee of the Month</Typography>
                      <Typography variant="h6" fontWeight="bold">
                        {eotm ? `${eotm.employee} — ${eotm.finalScore.toFixed(2)}%` : "Not yet designated"}
                      </Typography>
                      {eotm && (
                        <Typography variant="caption" sx={{ opacity: 0.85 }}>
                          {eotm.position} • {eotm.period}
                        </Typography>
                      )}
                    </Box>
                    <Grade sx={{ fontSize: 44 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Results table */}
          <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 6, gap: 2 }}>
                <CircularProgress size={28} />
                <Typography color="text.secondary">Loading…</Typography>
              </Box>
            ) : (
              <Table sx={{ minWidth: 1400 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: "primary.main" }}>
                    {[
                      "Rank", "Employee", "Position", "Period",
                      "Work Quality (15%)", "Job Knowledge (10%)", "Teamwork (10%)",
                      "Initiative (10%)", "Peer Eval (10%)", "Conduct (10%)",
                      "Attendance (20%)", "Performance (25%)", "Final Score", "Status",
                      ...(user?.role === "gm" || user?.role === "hr" ? ["Actions"] : []),
                    ].map((h) => (
                      <TableCell key={h} sx={{ color: "white", fontWeight: 700, whiteSpace: "nowrap", fontSize: "0.78rem" }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayResults.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={15} align="center" sx={{ py: 5, color: "text.secondary" }}>
                        {user?.role === "employee"
                          ? "No evaluations found for your account."
                          : 'No evaluations yet. Click "New Evaluation" to add one.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayResults.map((r, i) => (
                      <TableRow key={r.id} hover sx={{
                        bgcolor: r.status === "Employee of the Month" ? "#fff8e1" : i === 0 ? "#f0f7f0" : "inherit",
                      }}>
                        <TableCell>
                          <Chip
                            label={r.status === "Employee of the Month" ? "🏆 #1" : `#${i + 1}`}
                            color={r.status === "Employee of the Month" ? "warning" : i === 0 ? "success" : "default"}
                            size="small"
                          />
                        </TableCell>
                        <TableCell sx={{ fontWeight: i === 0 ? "bold" : "normal" }}>{r.employee}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap", fontSize: "0.82rem" }}>{r.position}</TableCell>
                        <TableCell>{r.period}</TableCell>
                        <TableCell align="center">{r.workQuality}%</TableCell>
                        <TableCell align="center">{r.jobKnowledge}%</TableCell>
                        <TableCell align="center">{r.teamwork}%</TableCell>
                        <TableCell align="center">{r.initiative}%</TableCell>
                        <TableCell align="center">{r.peerEvaluation}%</TableCell>
                        <TableCell align="center">{r.conduct}%</TableCell>
                        <TableCell align="center">{r.attendance}%</TableCell>
                        <TableCell align="center">{r.performanceOutput}%</TableCell>
                        <TableCell>
                          <Typography fontWeight="bold" color="primary.main" sx={{ whiteSpace: "nowrap" }}>
                            {r.finalScore.toFixed(2)}%
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={
                              user?.role === "employee" && r.status === "Pending GM Approval"
                                ? "Under Review"
                                : r.status
                            }
                            size="small"
                            color={r.status === "Employee of the Month" ? "warning" : r.status === "Approved" ? "success" : "default"}
                            sx={{ fontSize: "0.72rem" }}
                          />
                        </TableCell>
                        {(user?.role === "gm" || user?.role === "hr") && (
                          <TableCell>
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, alignItems: "flex-start" }}>
                              {r.status === "Pending GM Approval" && (
                                <Chip
                                  label="Approve"
                                  size="small"
                                  clickable
                                  variant="outlined"
                                  color="success"
                                  sx={{ minWidth: 110 }}
                                  onClick={() => handleApprove(r.id)}
                                />
                              )}
                              {r.status === "Approved" && user?.role === "gm" && (
                                <Chip
                                  label="Mark EOTM"
                                  size="small"
                                  clickable
                                  variant="outlined"
                                  color="warning"
                                  sx={{ minWidth: 110 }}
                                  onClick={() => handleEOTM(r.id)}
                                />
                              )}
                              <Chip
                                label="Delete"
                                size="small"
                                clickable
                                variant="outlined"
                                color="error"
                                sx={{ minWidth: 110 }}
                                onClick={() => handleDelete(r.id)}
                              />
                            </Box>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </TableContainer>
        </>
      )}

      {/* ════════════════════════════════════════���═════════════════════ */}
      {/* EVALUATION FORM DIALOG (HR publish / Supervisor evaluate)     */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <Dialog open={openEvalForm} onClose={() => setOpenEvalForm(false)} maxWidth="md" fullWidth>
        <DialogTitle fontWeight={700}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            Performance Evaluation Form — DSS
            {user?.role === "hr" && (
              <Button size="small" variant="outlined" startIcon={<Edit />} onClick={openCriteriaDialog}>
                Edit Criteria
              </Button>
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Supervisor: employee name pre-filled (read-only) */}
            {user?.role === "supervisor" && (
              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Employee Name"
                  value={form.employee}
                  disabled
                  sx={{ "& .MuiInputBase-input.Mui-disabled": { WebkitTextFillColor: "rgba(0,0,0,0.87)", fontWeight: 600 } }}
                />
              </Grid>
            )}

            {/* Position */}
            <Grid size={{ xs: 12, md: user?.role === "hr" ? 6 : 12 }}>
              <TextField
                fullWidth
                select
                label="Position"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                InputLabelProps={{ shrink: true }}
                disabled={user?.role === "supervisor"}
              >
                <MenuItem key="pos-empty" value="">Select position…</MenuItem>
                {POSITIONS.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </TextField>
            </Grid>

            {/* Outlet (HR only) */}
            {user?.role === "hr" && (
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  select
                  label="Outlet / Branch (Optional)"
                  value={form.outlet}
                  onChange={(e) => setForm({ ...form, outlet: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                >
                  <MenuItem key="outlet-empty" value="">All Outlets</MenuItem>
                  {OUTLETS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                </TextField>
              </Grid>
            )}

            {/* Period start */}
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Period Start Date"
                type="date"
                value={form.periodStart}
                onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
                InputLabelProps={{ shrink: true }}
                disabled={user?.role === "supervisor" && !!publishedTemplate?.periodStart}
              />
            </Grid>

            {/* Period end */}
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Period End Date"
                type="date"
                value={form.periodEnd}
                onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
                InputLabelProps={{ shrink: true }}
                disabled={user?.role === "supervisor" && !!publishedTemplate?.periodEnd}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              EVALUATION CRITERIA (Drag sliders to score 0–100)
            </Typography>
          </Divider>

          <Grid container spacing={1.5}>
            {activeCriteria.map((c) => (
              <Grid key={c.key} size={{ xs: 12, md: 6 }}>
                <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{c.label}</Typography>
                      <Typography variant="caption" color="text.secondary">Weight: {(c.weight * 100).toFixed(0)}%</Typography>
                    </Box>
                    <Typography variant="h6" fontWeight="bold" color="primary">
                      {form.scores[c.key] ?? 50}%
                    </Typography>
                  </Box>
                  <Slider
                    value={form.scores[c.key] ?? 50}
                    onChange={(_, v) => setForm({ ...form, scores: { ...form.scores, [c.key]: v as number } })}
                    valueLabelDisplay="auto"
                    min={0}
                    max={100}
                    size="small"
                    sx={{ color: (form.scores[c.key] ?? 50) >= 75 ? "success.main" : "primary.main" }}
                  />
                  <Typography variant="caption" color="text.secondary">{c.description}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>

          {/* Score preview */}
          <Paper sx={{
            p: 2.5, mt: 3,
            bgcolor: previewScore >= 90 ? "warning.light" : previewScore >= 75 ? "success.light" : "primary.light",
            borderRadius: 2,
          }}>
            <Typography variant="h5" color="white" fontWeight="bold">
              Projected Final Score: {previewScore.toFixed(2)}%
              {previewScore >= 90 && " 🏆 Eligible for EOTM"}
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.9)", mt: 0.5 }}>
              {previewScore >= 90
                ? "Excellent — Recommended for Employee of the Month"
                : previewScore >= 75
                ? "Good performance"
                : previewScore >= 60
                ? "Satisfactory"
                : "Needs improvement"}
            </Typography>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenEvalForm(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={saving || (user?.role !== "hr" && !form.employee)}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={user?.role === "hr" ? { color: "white" } : {}}
          >
            {saving
              ? "Submitting…"
              : user?.role === "hr"
              ? "Published Evaluation"
              : "Submit Evaluation"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* EDIT CRITERIA DIALOG                                          */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <Dialog open={criteriaDialogOpen} onClose={() => setCriteriaDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle fontWeight={700}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            Edit Evaluation Criteria
            <Button size="small" variant="outlined" startIcon={<Add />} onClick={addNewCriterion}>
              Add Criterion
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Edit criterion labels, weights, and descriptions, or add new ones. Current total weight:{" "}
            <strong>{(editCriteriaTemp.reduce((s, c) => s + c.weight, 0) * 100).toFixed(0)}%</strong>
          </Alert>
          {editCriteriaTemp.map((c, i) => (
            <Paper key={c.key} variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                <Chip label={`#${i + 1}`} size="small" />
                <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>{c.label}</Typography>
                <Tooltip title="Remove criterion">
                  <IconButton size="small" color="error" onClick={() => removeCriterion(i)}>
                    <DeleteOutline fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 7 }}>
                  <TextField
                    fullWidth
                    label="Criterion Label"
                    size="small"
                    value={c.label}
                    onChange={(e) =>
                      setEditCriteriaTemp((prev) => prev.map((x, j) => j === i ? { ...x, label: e.target.value } : x))
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    fullWidth
                    label="Weight (%)"
                    size="small"
                    type="number"
                    value={(c.weight * 100).toFixed(0)}
                    inputProps={{ min: 1, max: 100, step: 1 }}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(100, parseInt(e.target.value) || 0));
                      setEditCriteriaTemp((prev) => prev.map((x, j) => j === i ? { ...x, weight: v / 100 } : x));
                    }}
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    fullWidth
                    label="Description"
                    size="small"
                    multiline
                    rows={2}
                    value={c.description}
                    onChange={(e) =>
                      setEditCriteriaTemp((prev) => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))
                    }
                  />
                </Grid>
              </Grid>
            </Paper>
          ))}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCriteriaDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" startIcon={<Save />} onClick={saveCriteria}>
            Save Criteria
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ─────────────────────────────────────────────────── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}