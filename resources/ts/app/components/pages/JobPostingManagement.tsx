import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Stack,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Alert,
  MenuItem,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import { Add, Edit, Delete } from "@mui/icons-material";
import { supabase } from "../../lib/supabaseClient";

interface JobPosting {
  id: string;
  title: string;
  department: string;
  location: string;
  employment_type: string;
  salary_range: string;
  description: string;
  qualifications: string;
  responsibilities: string;
  is_active: boolean;
}

const EMPTY_FORM = {
  title: "",
  department: "",
  location: "",
  employment_type: "Full-Time",
  salary_range: "",
  description: "",
  qualifications: "",
  responsibilities: "",
};

const DEPARTMENTS = [
  "Management",
  "Operations",
  "Human Resource and Administration",
  "Accounting and Finance",
  "Restaurant",
  "Resort",
  "Café",
];

export default function JobPostingManagement() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JobPosting | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error",
  });

  const fetchJobs = async () => {
    const { data } = await supabase
      .from("job_postings")
      .select("*")
      .order("created_at", { ascending: false });

    setJobs(data || []);
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleOpenCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const handleEdit = (job: JobPosting) => {
    setEditing(job);

    setForm({
      title: job.title,
      department: job.department,
      location: job.location,
      employment_type: job.employment_type,
      salary_range: job.salary_range,
      description: job.description,
      qualifications: job.qualifications ?? "",
      responsibilities: job.responsibilities ?? "",
    });

    setOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        const { error } = await supabase
          .from("job_postings")
          .update(form)
          .eq("id", editing.id);

        if (error) throw error;

        setSnackbar({
          open: true,
          message: "Job posting updated!",
          severity: "success",
        });
      } else {
        const { error } = await supabase
          .from("job_postings")
          .insert({
            ...form,
            is_active: true,
          });

        if (error) throw error;

        setSnackbar({
          open: true,
          message: "Job posting created!",
          severity: "success",
        });
      }

      setOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      fetchJobs();
    } catch (e: any) {
      setSnackbar({
        open: true,
        message: `Failed: ${e.message}`,
        severity: "error",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Remove this job posting?")) return;

    try {
      const { error } = await supabase
        .from("job_postings")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;

      setJobs(prev =>
        prev.map(job =>
          job.id === id ? { ...job, is_active: false } : job
        )
      );

      setSnackbar({
        open: true,
        message: "Job posting removed!",
        severity: "success",
      });

      fetchJobs();
    } catch (e: any) {
      setSnackbar({
        open: true,
        message: `Failed: ${e.message}`,
        severity: "error",
      });
    }
  };

  const handleToggleActive = async (job: JobPosting) => {
    const newStatus = !job.is_active;

    try {
      const { error } = await supabase
        .from("job_postings")
        .update({ is_active: newStatus })
        .eq("id", job.id);

      if (error) throw error;

      setJobs(prev =>
        prev.map(j =>
          j.id === job.id ? { ...j, is_active: newStatus } : j
        )
      );

      setSnackbar({
        open: true,
        message: `Job posting ${newStatus ? "activated" : "deactivated"}!`,
        severity: "success",
      });
    } catch (e: any) {
      setSnackbar({
        open: true,
        message: `Failed: ${e.message}`,
        severity: "error",
      });
    }
  };

  return (
    <Box>
      <Box
        sx={{
          mb: 4,
          display: "flex",
          justifyContent: "space-between",
          alignItems: { xs: "stretch", md: "center" },
          flexDirection: { xs: "column", md: "row" },
          gap: 2,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            fontWeight={900}
            sx={{
              fontSize: { xs: "1.7rem", sm: "2rem", md: "2.125rem" },
            }}
          >
            Job Posting Management
          </Typography>

          <Typography color="text.secondary">
            Create and manage career opportunities.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleOpenCreate}
          sx={{
            borderRadius: 999,
            fontWeight: 800,
            background:
              "linear-gradient(135deg, #1F7A47 0%, #3FA46A 100%)",
            width: { xs: "100%", sm: "fit-content" },
            py: { xs: 1.3, sm: 1 },
            alignSelf: { xs: "stretch", sm: "flex-start", md: "center" },
          }}
        >
          Create Job Posting
        </Button>
      </Box>

      <Grid container spacing={{ xs: 2, md: 3 }}>
        {jobs.map((job) => (
          <Grid
            key={job.id}
            size={{
              xs: 12,
              sm: 12,
              md: 6,
              lg: 4,
            }}
          >
            <Card
              sx={{
                borderRadius: 4,
                height: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <CardContent
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  p: { xs: 2.2, sm: 3 },
                }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  spacing={1}
                  sx={{ mb: 2 }}
                >
                  <Typography
                    variant="h5"
                    fontWeight={800}
                    sx={{
                      fontSize: { xs: "1.2rem", sm: "1.5rem" },
                      wordBreak: "break-word",
                    }}
                  >
                    {job.title}
                  </Typography>

                  <Chip
                    label={job.is_active ? "Active" : "Inactive"}
                    color={job.is_active ? "success" : "default"}
                    size="small"
                  />
                </Stack>

                <Typography sx={{ wordBreak: "break-word" }}>
                  {job.department}
                </Typography>

                <Typography sx={{ wordBreak: "break-word" }}>
                  {job.location}
                </Typography>

                <Typography
                  sx={{
                    mt: 2,
                    flexGrow: 1,
                    wordBreak: "break-word",
                  }}
                  color="text.secondary"
                >
                  {job.description}
                </Typography>

                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{ mt: 3 }}
                >
                  <Button
                    fullWidth={isMobile}
                    variant="outlined"
                    startIcon={<Edit />}
                    onClick={() => handleEdit(job)}
                  >
                    Edit
                  </Button>

                  <Button
                    fullWidth={isMobile}
                    color="error"
                    variant="outlined"
                    startIcon={<Delete />}
                    onClick={() => handleDelete(job.id)}
                  >
                    Delete
                  </Button>

                  <Button
                    fullWidth={isMobile}
                    color={job.is_active ? "warning" : "success"}
                    variant="outlined"
                    onClick={() => handleToggleActive(job)}
                  >
                    {job.is_active ? "Set Inactive" : "Set Active"}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          {editing ? "Edit Job Posting" : "Create Job Posting"}
        </DialogTitle>

        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Job Title"
                value={form.title}
                onChange={(e) =>
                  setForm({ ...form, title: e.target.value })
                }
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                select
                label="Department"
                value={form.department}
                onChange={(e) =>
                  setForm({ ...form, department: e.target.value })
                }
                InputLabelProps={{ shrink: true }}
              >
                <MenuItem value="">Select Department...</MenuItem>
                {DEPARTMENTS.map((dept) => (
                  <MenuItem key={dept} value={dept}>
                    {dept}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Location"
                value={form.location}
                onChange={(e) =>
                  setForm({ ...form, location: e.target.value })
                }
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Salary Range"
                value={form.salary_range}
                onChange={(e) =>
                  setForm({ ...form, salary_range: e.target.value })
                }
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                select
                label="Employment Type"
                value={form.employment_type}
                onChange={(e) =>
                  setForm({ ...form, employment_type: e.target.value })
                }
                InputLabelProps={{ shrink: true }}
              >
                <MenuItem value="">Select Employment Type...</MenuItem>
                <MenuItem value="Full-Time">Full-Time</MenuItem>
                <MenuItem value="Part-Time">Part-Time</MenuItem>
                <MenuItem value="Contractual">Contractual</MenuItem>
                <MenuItem value="Internship">Internship</MenuItem>
              </TextField>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                multiline
                minRows={4}
                label="Description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Qualifications"
                value={form.qualifications}
                onChange={(e) =>
                  setForm({ ...form, qualifications: e.target.value })
                }
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Responsibilities"
                value={form.responsibilities}
                onChange={(e) =>
                  setForm({ ...form, responsibilities: e.target.value })
                }
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions
          sx={{
            flexDirection: { xs: "column-reverse", sm: "row" },
            gap: 1,
            p: 2,
          }}
        >
          <Button
            fullWidth={isMobile}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>

          <Button
            fullWidth={isMobile}
            variant="contained"
            onClick={handleSave}
            sx={{
              background:
                "linear-gradient(135deg, #1F7A47 0%, #3FA46A 100%)",
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() =>
          setSnackbar({ ...snackbar, open: false })
        }
      >
        <Alert severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}