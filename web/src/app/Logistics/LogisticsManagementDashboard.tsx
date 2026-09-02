"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import "../nkrn-control.css";

// ============================================================
// TYPES
// ============================================================

interface NKRNUser {
    userID: number;
    firstName: string;
    lastName: string;
    email: string;
    roleID: number;
}

interface LogisticsDepartment {
    departmentID: number;
    departmentName: string;
    isActive?: boolean;
    sortOrder?: number;
}

interface LogisticsWorker {
    workerID: number;
    userID: number | null;
    firstName: string;
    lastName: string;
    workerType: string | null;
    email: string | null;
    mobileNumber: string | null;
    isActive: boolean;
}

interface LogisticsTask {
    taskID: number;
    departmentID: number | null;
    departmentName: string | null;
    title: string;
    background: string | null;
    requestedDate: string | null;
    requestedByUserID: number | null;
    requestedByName?: string | null;
    priority: string;
    responsibleUserID: number | null;
    responsibleUserName?: string | null;
    responsibleWorkerID: number | null;
    responsibleWorkerName?: string | null;
    responsibleText: string | null;
    quoteRequired: boolean;
    quoteReceived: boolean;
    dueDate: string | null;
    dueDateNote: string | null;
    status: string;
    nextAction: string | null;
    contractorName: string | null;
    budgetAmount: number | null;
    approvalStatus: string | null;
    completedDate: string | null;
    lastFollowUp: string | null;
    nextFollowUp: string | null;
    notes: string | null;
    includeOnJobCard: boolean;
    isArchived: boolean;
    createdDate: string;
    updatedDate: string | null;
}

interface WorkPlanItem {
    workPlanItemID: number;
    workDate: string;
    taskID: number | null;
    taskTitle: string | null;
    departmentID: number | null;
    departmentName: string | null;
    workerID: number | null;
    workerName: string | null;
    area: string | null;
    taskDescription: string;
    priority: string;
    plannedStart: string | null;
    plannedEnd: string | null;
    materialsRequired: string | null;
    managerNote: string | null;
    status: string;
}

interface JobCard {
    jobCardID: number;
    jobCardNumber: string;
    jobCardDate: string;
    recipientUserID: number | null;
    recipientEmail: string | null;
    status: string;
    generatedAt: string;
    sentAt: string | null;
    generatedByUserID: number | null;
    notes: string | null;
    itemCount: number;
}

// ============================================================
// API + SHARED STYLES
// ============================================================

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const glassCard =
    "nkrn-panel rounded-[28px] border border-white/10 bg-white/4 shadow-2xl shadow-black/20 backdrop-blur-2xl";

const inputClass =
    "nkrn-input w-full rounded-xl border border-white/10 bg-zinc-900/70 px-3.5 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-white/25 focus:bg-zinc-900";

const selectClass =
    "nkrn-select w-full rounded-xl border border-white/10 bg-zinc-900/70 px-3.5 py-3 text-sm text-white outline-none transition focus:border-white/25 focus:bg-zinc-900";

const buttonClass =
    "rounded-xl border border-white/10 bg-white/6 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10";

function getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem("token");

    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

// ============================================================
// HELPERS
// ============================================================

function todayISO(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function displayDate(value: string | null | undefined): string {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString("en-ZA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function displayDateTime(value: string | null | undefined): string {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString("en-ZA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function priorityClass(priority: string): string {
    switch (priority?.toUpperCase()) {
        case "P1":
            return "border-red-400/15 bg-red-500/12 text-red-300";
        case "P2":
            return "border-orange-400/15 bg-orange-500/12 text-orange-300";
        case "P4":
            return "border-blue-400/15 bg-blue-500/12 text-blue-300";
        default:
            return "border-yellow-400/15 bg-yellow-500/10 text-yellow-200";
    }
}

function statusClass(status: string): string {
    const normalised = status?.trim().toLowerCase();

    if (normalised === "afgehandel") {
        return "border-green-400/15 bg-green-500/10 text-green-300";
    }

    if (normalised === "in proses") {
        return "border-blue-400/15 bg-blue-500/10 text-blue-300";
    }

    if (normalised === "staan oor") {
        return "border-orange-400/15 bg-orange-500/10 text-orange-300";
    }

    return "border-white/10 bg-white/5 text-zinc-300";
}

function responsibleName(task: LogisticsTask): string {
    return (
        task.responsibleWorkerName ||
        task.responsibleUserName ||
        task.responsibleText ||
        "Unassigned"
    );
}

function workerDisplayName(worker: LogisticsWorker): string {
    const fullName = `${worker.firstName ?? ""} ${worker.lastName ?? ""}`.trim();
    return fullName || `Worker #${worker.workerID}`;
}

function csvCell(value: unknown): string {
    if (value === null || value === undefined) {
        return '""';
    }

    const text = String(value).replace(/"/g, '""');
    return `"${text}"`;
}

// ============================================================
// PAGE
// ============================================================

export default function LogisticsManagementDashboard() {
    const router = useRouter();

    const [user, setUser] = useState<NKRNUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);
    const [error, setError] = useState("");

    const [tasks, setTasks] = useState<LogisticsTask[]>([]);
    const [departments, setDepartments] = useState<LogisticsDepartment[]>([]);
    const [workers, setWorkers] = useState<LogisticsWorker[]>([]);
    const [workPlan, setWorkPlan] = useState<WorkPlanItem[]>([]);
    const [jobCards, setJobCards] = useState<JobCard[]>([]);

    const [successMessage, setSuccessMessage] = useState("");
    const [selectedTask, setSelectedTask] = useState<LogisticsTask | null>(null);
    const [savingPlan, setSavingPlan] = useState(false);
    const [jobCardDate, setJobCardDate] = useState(todayISO());
    const [generatingJobCard, setGeneratingJobCard] = useState(false);
    const [sendingJobCardID, setSendingJobCardID] = useState<number | null>(null);
    const [planDate, setPlanDate] = useState(todayISO());
    const [planWorkerID, setPlanWorkerID] = useState("");
    const [planArea, setPlanArea] = useState("");
    const [planDescription, setPlanDescription] = useState("");
    const [planPriority, setPlanPriority] = useState("P3");
    const [planMaterials, setPlanMaterials] = useState("");
    const [planManagerNote, setPlanManagerNote] = useState("");

    const [workerEditorOpen, setWorkerEditorOpen] = useState(false);
    const [editingWorker, setEditingWorker] = useState<LogisticsWorker | null>(null);
    const [workerFirstName, setWorkerFirstName] = useState("");
    const [workerLastName, setWorkerLastName] = useState("");
    const [workerType, setWorkerType] = useState("Grounds");
    const [workerEmail, setWorkerEmail] = useState("");
    const [workerMobileNumber, setWorkerMobileNumber] = useState("");
    const [workerIsActive, setWorkerIsActive] = useState(true);
    const [savingWorker, setSavingWorker] = useState(false);
    const [deactivatingWorkerID, setDeactivatingWorkerID] = useState<number | null>(null);

    const [search, setSearch] = useState("");
    const [departmentFilter, setDepartmentFilter] = useState("All");
    const [priorityFilter, setPriorityFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState("Open");

    const loadLogistics = useCallback(async () => {
        setLoading(true);
        setError("");
        setAccessDenied(false);

        try {
            const storedUser = localStorage.getItem("user");
            const token = localStorage.getItem("token");

            if (!storedUser || !token) {
                router.replace("/login");
                return;
            }

            const loggedInUser = JSON.parse(storedUser) as NKRNUser;
            setUser(loggedInUser);

            const today = todayISO();

            const [
                tasksResponse,
                departmentsResponse,
                workersResponse,
                workPlanResponse,
                jobCardsResponse,
            ] = await Promise.all([
                fetch(`${API_URL}/api/LogisticsTasks`, {
                    headers: getAuthHeaders(),
                    cache: "no-store",
                }),
                fetch(`${API_URL}/api/LogisticsDepartments`, {
                    headers: getAuthHeaders(),
                    cache: "no-store",
                }),
                fetch(`${API_URL}/api/LogisticsWorkers?includeInactive=true`, {
                    headers: getAuthHeaders(),
                    cache: "no-store",
                }),
                fetch(`${API_URL}/api/LogisticsWorkPlan?date=${today}`, {
                    headers: getAuthHeaders(),
                    cache: "no-store",
                }),
                fetch(`${API_URL}/api/LogisticsJobCards`, {
                    headers: getAuthHeaders(),
                    cache: "no-store",
                }),
            ]);

            if (tasksResponse.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                router.replace("/login");
                return;
            }

            if (tasksResponse.status === 403) {
                setAccessDenied(true);
                return;
            }

            if (!tasksResponse.ok) {
                throw new Error(`Logistics tasks failed: ${tasksResponse.status}`);
            }

            const taskData = (await tasksResponse.json()) as LogisticsTask[];
            setTasks(taskData);

            if (departmentsResponse.ok) {
                setDepartments(
                    (await departmentsResponse.json()) as LogisticsDepartment[]
                );
            }

            if (workersResponse.ok) {
                setWorkers((await workersResponse.json()) as LogisticsWorker[]);
            }

            if (workPlanResponse.ok) {
                setWorkPlan((await workPlanResponse.json()) as WorkPlanItem[]);
            }

            if (jobCardsResponse.ok) {
                setJobCards((await jobCardsResponse.json()) as JobCard[]);
            }
        } catch (loadError) {
            console.error("Unable to load Logistics dashboard:", loadError);
            setError("Unable to load the Logistics dashboard.");
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadLogistics();
        }, 0);

        return () => {
            window.clearTimeout(timer);
        };
    }, [loadLogistics]);

    const filteredTasks = useMemo(() => {
        const query = search.trim().toLowerCase();

        return tasks.filter((task) => {
            const isCompleted =
                task.status?.trim().toLowerCase() === "afgehandel";

            const matchesSearch =
                !query ||
                task.title?.toLowerCase().includes(query) ||
                task.departmentName?.toLowerCase().includes(query) ||
                task.responsibleText?.toLowerCase().includes(query) ||
                task.nextAction?.toLowerCase().includes(query) ||
                String(task.taskID).includes(query);

            const matchesDepartment =
                departmentFilter === "All" ||
                String(task.departmentID) === departmentFilter;

            const matchesPriority =
                priorityFilter === "All" || task.priority === priorityFilter;

            const matchesStatus =
                statusFilter === "All" ||
                (statusFilter === "Open"
                    ? !isCompleted
                    : task.status === statusFilter);

            return (
                matchesSearch &&
                matchesDepartment &&
                matchesPriority &&
                matchesStatus
            );
        });
    }, [tasks, search, departmentFilter, priorityFilter, statusFilter]);

    const statistics = useMemo(() => {
        const open = tasks.filter(
            (task) => task.status?.trim().toLowerCase() !== "afgehandel"
        );

        return {
            total: tasks.length,
            open: open.length,
            urgent: open.filter(
                (task) => task.priority === "P1" || task.priority === "P2"
            ).length,
            inProgress: open.filter(
                (task) => task.status?.trim().toLowerCase() === "in proses"
            ).length,
            unassigned: open.filter(
                (task) => responsibleName(task) === "Unassigned"
            ).length,
        };
    }, [tasks]);

    const latestJobCard = jobCards.length > 0 ? jobCards[0] : null;
    const selectedDateJobCard = jobCards.find(
        (card) => card.jobCardDate?.slice(0, 10) === jobCardDate
    ) ?? null;
    const activeWorkers = workers.filter((worker) => worker.isActive !== false);

    function startAddingWorker() {
        setError("");
        setSuccessMessage("");
        setEditingWorker(null);
        setWorkerFirstName("");
        setWorkerLastName("");
        setWorkerType("Grounds");
        setWorkerEmail("");
        setWorkerMobileNumber("");
        setWorkerIsActive(true);
        setWorkerEditorOpen(true);
    }

    function startEditingWorker(worker: LogisticsWorker) {
        setError("");
        setSuccessMessage("");
        setEditingWorker(worker);
        setWorkerFirstName(worker.firstName || "");
        setWorkerLastName(worker.lastName || "");
        setWorkerType(worker.workerType || "Grounds");
        setWorkerEmail(worker.email || "");
        setWorkerMobileNumber(worker.mobileNumber || "");
        setWorkerIsActive(worker.isActive !== false);
        setWorkerEditorOpen(true);
    }

    function closeWorkerEditor() {
        if (savingWorker) {
            return;
        }

        setWorkerEditorOpen(false);
        setEditingWorker(null);
    }

    async function saveWorker() {
        const firstName = workerFirstName.trim();
        const lastName = workerLastName.trim();

        if (!firstName) {
            setError("A worker first name is required.");
            return;
        }

        try {
            setSavingWorker(true);
            setError("");
            setSuccessMessage("");

            const isEditing = Boolean(editingWorker);
            const response = await fetch(
                isEditing
                    ? `${API_URL}/api/LogisticsWorkers/${editingWorker!.workerID}`
                    : `${API_URL}/api/LogisticsWorkers`,
                {
                    method: isEditing ? "PUT" : "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        ...(isEditing ? { workerID: editingWorker!.workerID } : {}),
                        userID: editingWorker?.userID ?? null,
                        firstName,
                        lastName,
                        workerType: workerType.trim() || null,
                        email: workerEmail.trim() || null,
                        mobileNumber: workerMobileNumber.trim() || null,
                        isActive: workerIsActive,
                    }),
                }
            );

            if (response.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                router.replace("/login");
                return;
            }

            if (response.status === 403) {
                throw new Error(
                    "Your Logistics access is view-only. Manage permission is required to manage workers."
                );
            }

            if (!response.ok) {
                let message = isEditing
                    ? "Unable to update this worker."
                    : "Unable to add this worker.";

                try {
                    const responseText = await response.text();

                    if (responseText) {
                        try {
                            const responseBody = JSON.parse(responseText) as {
                                message?: string;
                                title?: string;
                            };
                            message = responseBody.message || responseBody.title || message;
                        } catch {
                            message = responseText;
                        }
                    }
                } catch {
                    // Keep the friendly fallback message above.
                }

                throw new Error(message);
            }

            setWorkerEditorOpen(false);
            setEditingWorker(null);
            setSuccessMessage(
                isEditing
                    ? `${firstName}${lastName ? ` ${lastName}` : ""} was updated successfully.`
                    : `${firstName}${lastName ? ` ${lastName}` : ""} was added to the Logistics team.`
            );

            await loadLogistics();
        } catch (workerError) {
            console.error("Unable to save Logistics worker:", workerError);
            setError(
                workerError instanceof Error
                    ? workerError.message
                    : "Unable to save this Logistics worker."
            );
        } finally {
            setSavingWorker(false);
        }
    }

    async function deactivateWorker(worker: LogisticsWorker) {
        if (worker.isActive === false) {
            return;
        }

        const displayName = workerDisplayName(worker);
        const confirmed = window.confirm(
            `Deactivate ${displayName}? They will no longer appear as an assignable worker.`
        );

        if (!confirmed) {
            return;
        }

        try {
            setDeactivatingWorkerID(worker.workerID);
            setError("");
            setSuccessMessage("");

            const response = await fetch(
                `${API_URL}/api/LogisticsWorkers/${worker.workerID}`,
                {
                    method: "DELETE",
                    headers: getAuthHeaders(),
                }
            );

            if (response.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                router.replace("/login");
                return;
            }

            if (response.status === 403) {
                throw new Error(
                    "Your Logistics access is view-only. Manage permission is required to deactivate workers."
                );
            }

            if (!response.ok) {
                let message = "Unable to deactivate this worker.";

                try {
                    const responseText = await response.text();
                    if (responseText) {
                        try {
                            const responseBody = JSON.parse(responseText) as { message?: string; title?: string };
                            message = responseBody.message || responseBody.title || message;
                        } catch {
                            message = responseText;
                        }
                    }
                } catch {
                    // Keep the friendly fallback message above.
                }

                throw new Error(message);
            }

            setSuccessMessage(`${displayName} was deactivated.`);
            await loadLogistics();
        } catch (workerError) {
            console.error("Unable to deactivate Logistics worker:", workerError);
            setError(
                workerError instanceof Error
                    ? workerError.message
                    : "Unable to deactivate this Logistics worker."
            );
        } finally {
            setDeactivatingWorkerID(null);
        }
    }

    function startPlanningTask(task: LogisticsTask) {
        setError("");
        setSuccessMessage("");
        setSelectedTask(task);
        setPlanDate(todayISO());
        setPlanWorkerID(
            task.responsibleWorkerID ? String(task.responsibleWorkerID) : ""
        );
        setPlanArea(task.departmentName || "");
        setPlanDescription(task.title);
        setPlanPriority(task.priority || "P3");
        setPlanMaterials("");
        setPlanManagerNote(task.nextAction || "");
    }

    function closePlanningTask() {
        if (savingPlan) {
            return;
        }

        setSelectedTask(null);
    }

    async function addTaskToWorkPlan() {
        if (!selectedTask) {
            return;
        }

        if (!planDate) {
            setError("Select a work date before adding the task to the Daily Work Plan.");
            return;
        }

        if (!planDescription.trim()) {
            setError("A work-plan description is required.");
            return;
        }

        try {
            setSavingPlan(true);
            setError("");
            setSuccessMessage("");

            const response = await fetch(`${API_URL}/api/LogisticsWorkPlan`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    workDate: planDate,
                    taskID: selectedTask.taskID,
                    workerID: planWorkerID ? Number(planWorkerID) : null,
                    area: planArea.trim() || selectedTask.departmentName || null,
                    taskDescription: planDescription.trim(),
                    priority: planPriority,
                    plannedStart: null,
                    plannedEnd: null,
                    materialsRequired: planMaterials.trim() || null,
                    managerNote: planManagerNote.trim() || null,
                    status: "Beplan",
                }),
            });

            if (response.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                router.replace("/login");
                return;
            }

            if (response.status === 403) {
                throw new Error(
                    "Your Logistics access is view-only. Manage permission is required to schedule work."
                );
            }

            if (!response.ok) {
                let message = "Unable to add this task to the Daily Work Plan.";

                try {
                    const responseBody = (await response.json()) as {
                        message?: string;
                    };

                    if (responseBody.message) {
                        message = responseBody.message;
                    }
                } catch {
                    // Keep the friendly fallback message above.
                }

                throw new Error(message);
            }

            const scheduledTaskTitle = selectedTask.title;
            const scheduledDate = planDate;

            setSelectedTask(null);
            setSuccessMessage(
                `${scheduledTaskTitle} was added to the Daily Work Plan for ${displayDate(scheduledDate)}.`
            );

            await loadLogistics();
        } catch (planError) {
            console.error("Unable to add Logistics work-plan item:", planError);
            setError(
                planError instanceof Error
                    ? planError.message
                    : "Unable to add this task to the Daily Work Plan."
            );
        } finally {
            setSavingPlan(false);
        }
    }

    async function generateJobCard() {
        if (!jobCardDate) {
            setError("Select a job-card date first.");
            return;
        }

        if (selectedDateJobCard) {
            setError(
                `A Logistics job card already exists for ${displayDate(jobCardDate)} (${selectedDateJobCard.jobCardNumber}).`
            );
            return;
        }

        try {
            setGeneratingJobCard(true);
            setError("");
            setSuccessMessage("");

            const response = await fetch(
                `${API_URL}/api/LogisticsJobCards/generate?date=${encodeURIComponent(jobCardDate)}`,
                {
                    method: "POST",
                    headers: getAuthHeaders(),
                }
            );

            if (response.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                router.replace("/login");
                return;
            }

            if (response.status === 403) {
                throw new Error(
                    "Your Logistics access is view-only. Manage permission is required to generate job cards."
                );
            }

            if (!response.ok) {
                let message = "Unable to generate the Logistics job card.";

                try {
                    const responseBody = (await response.json()) as {
                        message?: string;
                        title?: string;
                    };

                    message = responseBody.message || responseBody.title || message;
                } catch {
                    // Keep the friendly fallback message above.
                }

                throw new Error(message);
            }

            let generatedCardNumber = "";

            try {
                const generatedCard = (await response.json()) as Partial<JobCard>;
                generatedCardNumber = generatedCard.jobCardNumber || "";
            } catch {
                // The reload below remains the source of truth.
            }

            setSuccessMessage(
                generatedCardNumber
                    ? `${generatedCardNumber} was generated successfully.`
                    : `The Logistics job card for ${displayDate(jobCardDate)} was generated successfully.`
            );

            await loadLogistics();
        } catch (jobCardError) {
            console.error("Unable to generate Logistics job card:", jobCardError);
            setError(
                jobCardError instanceof Error
                    ? jobCardError.message
                    : "Unable to generate the Logistics job card."
            );
        } finally {
            setGeneratingJobCard(false);
        }
    }

    async function sendJobCard(jobCard: JobCard) {
        if (jobCard.status === "Sent") {
            return;
        }

        try {
            setSendingJobCardID(jobCard.jobCardID);
            setError("");
            setSuccessMessage("");

            const response = await fetch(
                `${API_URL}/api/LogisticsJobCards/${jobCard.jobCardID}/send`,
                {
                    method: "POST",
                    headers: getAuthHeaders(),
                }
            );

            if (response.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                router.replace("/login");
                return;
            }

            if (response.status === 403) {
                throw new Error(
                    "Your Logistics access is view-only. Manage permission is required to send job cards."
                );
            }

            if (!response.ok) {
                let message = "Unable to send the Logistics job card.";

                try {
                    const responseBody = (await response.json()) as {
                        message?: string;
                        title?: string;
                    };

                    message = responseBody.message || responseBody.title || message;
                } catch {
                    // Keep the friendly fallback message above.
                }

                throw new Error(message);
            }

            setSuccessMessage(`${jobCard.jobCardNumber} was sent successfully.`);
            await loadLogistics();
        } catch (sendError) {
            console.error("Unable to send Logistics job card:", sendError);
            setError(
                sendError instanceof Error
                    ? sendError.message
                    : "Unable to send the Logistics job card."
            );
        } finally {
            setSendingJobCardID(null);
        }
    }


    function exportTasksCsv() {
        if (filteredTasks.length === 0) {
            setError("There are no visible Logistics tasks to export.");
            setSuccessMessage("");
            return;
        }

        setError("");
        setSuccessMessage("");

        const headers = [
            "Task ID",
            "Department",
            "Title",
            "Background",
            "Requested Date",
            "Requested By",
            "Priority",
            "Responsible",
            "Quote Required",
            "Quote Received",
            "Due Date",
            "Due Date Note",
            "Status",
            "Next Action",
            "Contractor",
            "Budget Amount",
            "Approval Status",
            "Completed Date",
            "Last Follow Up",
            "Next Follow Up",
            "Notes",
            "Include On Job Card",
            "Archived",
            "Created",
            "Updated",
        ];

        const rows = filteredTasks.map((task) => [
            task.taskID,
            task.departmentName ?? "",
            task.title,
            task.background ?? "",
            task.requestedDate ?? "",
            task.requestedByName ?? (task.requestedByUserID ? `User #${task.requestedByUserID}` : ""),
            task.priority,
            responsibleName(task),
            task.quoteRequired ? "Yes" : "No",
            task.quoteReceived ? "Yes" : "No",
            task.dueDate ?? "",
            task.dueDateNote ?? "",
            task.status,
            task.nextAction ?? "",
            task.contractorName ?? "",
            task.budgetAmount ?? "",
            task.approvalStatus ?? "",
            task.completedDate ?? "",
            task.lastFollowUp ?? "",
            task.nextFollowUp ?? "",
            task.notes ?? "",
            task.includeOnJobCard ? "Yes" : "No",
            task.isArchived ? "Yes" : "No",
            task.createdDate,
            task.updatedDate ?? "",
        ]);

        const csv = [
            headers.map(csvCell).join(","),
            ...rows.map((row) => row.map(csvCell).join(",")),
        ].join("\r\n");

        const blob = new Blob(["\uFEFF", csv], {
            type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const datePart = todayISO();

        link.href = url;
        link.download = `nkrn-logistics-tasks-${datePart}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);

        setSuccessMessage(
            `${filteredTasks.length} Logistics task${filteredTasks.length === 1 ? "" : "s"} exported to CSV.`
        );
    }

    function logout() {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        router.replace("/login");
    }

    if (loading) {
        return (
            <main className="nkrn-control relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 text-white">
                <div className={`${glassCard} p-8 text-center`}>
                    <p className="text-xs font-medium uppercase tracking-[0.25em] text-yellow-400">
                        Logistics
                    </p>
                    <h1 className="mt-2 text-xl font-semibold">Loading dashboard…</h1>
                </div>
            </main>
        );
    }

    if (accessDenied) {
        return (
            <main className="nkrn-control relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-5 text-white">
                <div className={`${glassCard} w-full max-w-lg p-8 text-center`}>
                    <p className="text-xs font-medium uppercase tracking-[0.25em] text-red-400">
                        Access restricted
                    </p>
                    <h1 className="mt-3 text-2xl font-semibold">Logistics access required</h1>
                    <p className="mt-3 text-sm leading-6 text-zinc-400">
                        Your NKRN account does not currently have permission to open the Logistics module.
                    </p>
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className={`${buttonClass} mt-6`}
                    >
                        Go Back
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="nkrn-control relative min-h-screen overflow-hidden bg-zinc-950 text-white">
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -left-40 -top-40 h-125 w-125 rounded-full bg-yellow-500/4 blur-3xl" />
                <div className="absolute -right-40 top-1/4 h-150 w-150 rounded-full bg-white/3 blur-3xl" />
                <div className="absolute -bottom-62.5 left-1/3 h-125 w-125 rounded-full bg-yellow-500/2 blur-3xl" />
            </div>

            <div className="relative mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
                <header className={`${glassCard} nkrn-hero mb-8 p-5 sm:p-7`}>
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-5">
                            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/4">
                                <Image
                                    src="/wit-logo-tygies.png"
                                    alt="Laerskool Tygerpoort Logo"
                                    width={150}
                                    height={60}
                                    className="h-auto w-30 object-contain"
                                    priority
                                />
                            </div>

                            <div>
                                <p className="mb-1 text-xs font-medium uppercase tracking-[0.25em] text-yellow-400">
                                    Logistics
                                </p>
                                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                                    Logistics Control Centre
                                </h1>
                                <p className="mt-1 text-sm text-zinc-400">
                                    Welcome {user?.firstName}. Track operational work, priorities and daily execution.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {user?.roleID === 3 && (
                                <button
                                    type="button"
                                    onClick={() => router.push("/Admin")}
                                    className={buttonClass}
                                >
                                    Admin Dashboard
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => void loadLogistics()}
                                className={buttonClass}
                            >
                                Refresh
                            </button>
                            <button
                                type="button"
                                onClick={() => router.push("/")}
                                className="rounded-xl border border-[#d7a31f]/25 bg-[#d7a31f]/8 px-4 py-2.5 text-sm font-medium text-[#e7b42b] transition hover:border-[#d7a31f]/40 hover:bg-[#d7a31f]/12"
                            >
                                NKRN Home
                            </button>

                            <button
                                type="button"
                                onClick={logout}
                                className="rounded-xl border border-red-400/10 bg-red-500/8 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/14"
                            >
                                Log Out
                            </button>
                        </div>
                    </div>
                </header>

                {error && (
                    <div className="mb-6 rounded-2xl border border-red-400/10 bg-red-500/7 p-4 text-sm text-red-300 backdrop-blur-xl">
                        {error}
                    </div>
                )}

                {successMessage && (
                    <div className="mb-6 rounded-2xl border border-green-400/10 bg-green-500/7 p-4 text-sm text-green-300 backdrop-blur-xl">
                        {successMessage}
                    </div>
                )}

                <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    <StatCard label="All Tasks" value={statistics.total} note="Imported + new" />
                    <StatCard label="Open" value={statistics.open} note="Needs attention" />
                    <StatCard label="P1 / P2" value={statistics.urgent} note="Critical + urgent" accent="text-orange-300" />
                    <StatCard label="In Progress" value={statistics.inProgress} note="Currently active" accent="text-blue-300" />
                    <StatCard label="Unassigned" value={statistics.unassigned} note="Needs an owner" accent="text-yellow-300" />
                </section>

                <section className="mb-8 grid gap-6 lg:grid-cols-2">
                    <div className={`${glassCard} p-5 sm:p-6`}>
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-[0.22em] text-yellow-400">
                                    Daily Work Plan
                                </p>
                                <h2 className="mt-1 text-xl font-semibold">Today</h2>
                            </div>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400">
                                {workPlan.length} item{workPlan.length === 1 ? "" : "s"}
                            </span>
                        </div>

                        {workPlan.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-6 text-sm text-zinc-500">
                                No work-plan items are scheduled for today yet.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {workPlan.slice(0, 6).map((item) => (
                                    <div
                                        key={item.workPlanItemID}
                                        className="rounded-2xl border border-white/8 bg-black/10 p-4"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <p className="font-medium text-zinc-100">
                                                    {item.taskDescription}
                                                </p>
                                                <p className="mt-1 text-xs text-zinc-500">
                                                    {item.workerName || "Unassigned"} · {item.area || item.departmentName || "No area"}
                                                </p>
                                            </div>
                                            <span className={`rounded-full border px-2.5 py-1 text-xs ${priorityClass(item.priority)}`}>
                                                {item.priority}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className={`${glassCard} p-5 sm:p-6`}>
                        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-[0.22em] text-yellow-400">
                                    Job Cards
                                </p>
                                <h2 className="mt-1 text-xl font-semibold">Daily job card</h2>
                                <p className="mt-1 text-sm text-zinc-500">
                                    Generate the consolidated work card for a selected date.
                                </p>
                            </div>
                            <span className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400">
                                {jobCards.length} generated
                            </span>
                        </div>

                        <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                            <label className="block">
                                <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                                    Job-card date
                                </span>
                                <input
                                    type="date"
                                    value={jobCardDate}
                                    onChange={(event) => setJobCardDate(event.target.value)}
                                    className={inputClass}
                                />
                            </label>

                            <button
                                type="button"
                                onClick={() => void generateJobCard()}
                                disabled={generatingJobCard || Boolean(selectedDateJobCard)}
                                className="min-h-11 rounded-xl border border-yellow-400/20 bg-yellow-500/12 px-4 py-3 text-sm font-semibold text-yellow-100 transition hover:bg-yellow-500/18 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                                {generatingJobCard
                                    ? "Generating…"
                                    : selectedDateJobCard
                                      ? "Already Generated"
                                      : "Generate Job Card"}
                            </button>
                        </div>

                        {selectedDateJobCard && (
                            <p className="mb-5 text-xs text-zinc-500">
                                {selectedDateJobCard.jobCardNumber} already exists for {displayDate(jobCardDate)}.
                            </p>
                        )}

                        {!latestJobCard ? (
                            <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-6 text-sm text-zinc-500">
                                No Logistics job card has been generated yet.
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-white/8 bg-black/10 p-5">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-600">
                                            Latest job card
                                        </p>
                                        <p className="mt-1 text-lg font-semibold text-zinc-100">
                                            {latestJobCard.jobCardNumber}
                                        </p>
                                        <p className="mt-1 text-sm text-zinc-500">
                                            {displayDate(latestJobCard.jobCardDate)} · {latestJobCard.itemCount} items
                                        </p>
                                    </div>
                                    <span className={`rounded-full border px-3 py-1 text-xs ${latestJobCard.status === "Sent" ? "border-green-400/15 bg-green-500/10 text-green-300" : "border-yellow-400/15 bg-yellow-500/10 text-yellow-300"}`}>
                                        {latestJobCard.status}
                                    </span>
                                </div>

                                <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                                    <Info label="Recipient" value={latestJobCard.recipientEmail || "—"} />
                                    <Info label="Sent" value={displayDateTime(latestJobCard.sentAt)} />
                                </div>

                                {latestJobCard.status !== "Sent" && (
                                    <button
                                        type="button"
                                        onClick={() => void sendJobCard(latestJobCard)}
                                        disabled={sendingJobCardID === latestJobCard.jobCardID}
                                        className="mt-5 w-full rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
                                    >
                                        {sendingJobCardID === latestJobCard.jobCardID
                                            ? "Sending…"
                                            : "Send Job Card"}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </section>

                <section className={`${glassCard} mb-8 overflow-hidden`}>
                    <div className="border-b border-white/8 p-5 sm:p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-[0.22em] text-yellow-400">
                                    Logistics Team
                                </p>
                                <h2 className="mt-1 text-xl font-semibold">Worker Management</h2>
                                <p className="mt-1 text-sm text-zinc-500">
                                    {activeWorkers.length} active worker{activeWorkers.length === 1 ? "" : "s"} · {workers.length} total
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={startAddingWorker}
                                className="w-fit rounded-xl border border-yellow-400/20 bg-yellow-500/10 px-4 py-2.5 text-sm font-semibold text-yellow-200 transition hover:bg-yellow-500/15"
                            >
                                + Add Worker
                            </button>
                        </div>
                    </div>

                    {workers.length === 0 ? (
                        <div className="p-5 sm:p-6">
                            <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-6 text-sm text-zinc-500">
                                No Logistics workers have been configured yet. Add the grounds and cleaning staff here so they can be assigned to Daily Work Plan items.
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm">
                                <thead className="border-b border-white/8 bg-black/15 text-xs uppercase tracking-[0.12em] text-zinc-500">
                                    <tr>
                                        <th className="px-5 py-4 font-medium">Worker</th>
                                        <th className="px-5 py-4 font-medium">Type</th>
                                        <th className="px-5 py-4 font-medium">Contact</th>
                                        <th className="px-5 py-4 font-medium">Status</th>
                                        <th className="px-5 py-4 text-right font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/6">
                                    {workers
                                        .slice()
                                        .sort((a, b) => {
                                            if (a.isActive !== b.isActive) {
                                                return a.isActive ? -1 : 1;
                                            }
                                            return workerDisplayName(a).localeCompare(workerDisplayName(b));
                                        })
                                        .map((worker) => (
                                            <tr
                                                key={worker.workerID}
                                                className={`transition hover:bg-white/2.5 ${worker.isActive === false ? "opacity-55" : ""}`}
                                            >
                                                <td className="min-w-52 px-5 py-4">
                                                    <p className="font-medium text-zinc-100">
                                                        {workerDisplayName(worker)}
                                                    </p>
                                                    <p className="mt-1 font-mono text-xs text-zinc-600">
                                                        Worker #{worker.workerID}
                                                    </p>
                                                </td>
                                                <td className="min-w-36 px-5 py-4 text-zinc-400">
                                                    {worker.workerType || "—"}
                                                </td>
                                                <td className="min-w-52 px-5 py-4 text-zinc-400">
                                                    <div>{worker.mobileNumber || "No mobile number"}</div>
                                                    {worker.email && (
                                                        <div className="mt-1 text-xs text-zinc-600">
                                                            {worker.email}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span
                                                        className={`rounded-full border px-2.5 py-1 text-xs ${
                                                            worker.isActive !== false
                                                                ? "border-green-400/15 bg-green-500/10 text-green-300"
                                                                : "border-white/10 bg-white/5 text-zinc-500"
                                                        }`}
                                                    >
                                                        {worker.isActive !== false ? "Active" : "Inactive"}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => startEditingWorker(worker)}
                                                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/10"
                                                        >
                                                            Edit
                                                        </button>
                                                        {worker.isActive !== false && (
                                                            <button
                                                                type="button"
                                                                onClick={() => void deactivateWorker(worker)}
                                                                disabled={deactivatingWorkerID === worker.workerID}
                                                                className="rounded-xl border border-red-400/10 bg-red-500/8 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/14 disabled:cursor-not-allowed disabled:opacity-45"
                                                            >
                                                                {deactivatingWorkerID === worker.workerID
                                                                    ? "Deactivating…"
                                                                    : "Deactivate"}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                <section className={`${glassCard} overflow-hidden`}>
                    <div className="border-b border-white/8 p-5 sm:p-6">
                        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-[0.22em] text-yellow-400">
                                    Tasks & Maintenance
                                </p>
                                <h2 className="mt-1 text-xl font-semibold">Operational Task Register</h2>
                                <p className="mt-1 text-sm text-zinc-500">
                                    Showing {filteredTasks.length} of {tasks.length} tasks.
                                </p>
                            </div>

                            <div className="grid w-full gap-3 md:grid-cols-2 xl:w-auto xl:grid-cols-5">
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Search tasks…"
                                    className={inputClass}
                                />

                                <select
                                    value={departmentFilter}
                                    onChange={(event) => setDepartmentFilter(event.target.value)}
                                    className={selectClass}
                                >
                                    <option value="All">All departments</option>
                                    {departments.map((department) => (
                                        <option key={department.departmentID} value={String(department.departmentID)}>
                                            {department.departmentName}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    value={priorityFilter}
                                    onChange={(event) => setPriorityFilter(event.target.value)}
                                    className={selectClass}
                                >
                                    <option value="All">All priorities</option>
                                    <option value="P1">P1 · Critical</option>
                                    <option value="P2">P2 · Urgent</option>
                                    <option value="P3">P3 · Planned</option>
                                    <option value="P4">P4 · Improvement</option>
                                </select>

                                <select
                                    value={statusFilter}
                                    onChange={(event) => setStatusFilter(event.target.value)}
                                    className={selectClass}
                                >
                                    <option value="Open">Open tasks</option>
                                    <option value="All">All statuses</option>
                                    <option value="Nog nie begin">Nog nie begin</option>
                                    <option value="In Proses">In Proses</option>
                                    <option value="Staan oor">Staan oor</option>
                                    <option value="Afgehandel">Afgehandel</option>
                                </select>

                                <button
                                    type="button"
                                    onClick={exportTasksCsv}
                                    disabled={filteredTasks.length === 0}
                                    className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-3 text-sm font-semibold text-yellow-300 transition hover:bg-yellow-400/15 disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                    Export CSV
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead className="border-b border-white/8 bg-black/15 text-xs uppercase tracking-[0.12em] text-zinc-500">
                                <tr>
                                    <th className="px-5 py-4 font-medium">ID</th>
                                    <th className="px-5 py-4 font-medium">Task</th>
                                    <th className="px-5 py-4 font-medium">Department</th>
                                    <th className="px-5 py-4 font-medium">Priority</th>
                                    <th className="px-5 py-4 font-medium">Responsible</th>
                                    <th className="px-5 py-4 font-medium">Deadline</th>
                                    <th className="px-5 py-4 font-medium">Status</th>
                                    <th className="px-5 py-4 font-medium">Next Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/6">
                                {filteredTasks.map((task) => (
                                    <tr key={task.taskID} className="transition hover:bg-white/2.5">
                                        <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-zinc-500">
                                            #{task.taskID}
                                        </td>
                                        <td className="min-w-64 px-5 py-4">
                                            <p className="font-medium text-zinc-100">{task.title}</p>
                                            {task.background && (
                                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">
                                                    {task.background}
                                                </p>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => startPlanningTask(task)}
                                                disabled={task.status?.trim().toLowerCase() === "afgehandel"}
                                                className="mt-3 whitespace-nowrap rounded-xl border border-yellow-400/15 bg-yellow-500/10 px-3 py-2 text-xs font-semibold text-yellow-200 transition hover:bg-yellow-500/15 disabled:cursor-not-allowed disabled:opacity-35"
                                            >
                                                Add to Plan
                                            </button>
                                        </td>
                                        <td className="min-w-44 px-5 py-4 text-zinc-400">
                                            {task.departmentName || "—"}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`rounded-full border px-2.5 py-1 text-xs ${priorityClass(task.priority)}`}>
                                                {task.priority}
                                            </span>
                                        </td>
                                        <td className="min-w-40 px-5 py-4 text-zinc-300">
                                            {responsibleName(task)}
                                        </td>
                                        <td className="min-w-36 px-5 py-4 text-zinc-400">
                                            {task.dueDate ? displayDate(task.dueDate) : task.dueDateNote || "—"}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs ${statusClass(task.status)}`}>
                                                {task.status}
                                            </span>
                                        </td>
                                        <td className="min-w-56 px-5 py-4 text-zinc-400">
                                            {task.nextAction || "—"}
                                        </td>
                                    </tr>
                                ))}

                                {filteredTasks.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-5 py-12 text-center text-zinc-500">
                                            No tasks match the current filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                {workerEditorOpen && (
                    <div
                        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 px-4 py-6 backdrop-blur-sm sm:items-center"
                        onMouseDown={(event) => {
                            if (event.currentTarget === event.target) {
                                closeWorkerEditor();
                            }
                        }}
                    >
                        <div className={`${glassCard} my-auto w-full max-w-2xl p-5 sm:p-7`}>
                            <div className="flex items-start justify-between gap-5 border-b border-white/8 pb-5">
                                <div>
                                    <p className="text-xs font-medium uppercase tracking-[0.22em] text-yellow-400">
                                        Logistics Team
                                    </p>
                                    <h2 className="mt-1 text-2xl font-semibold">
                                        {editingWorker ? "Edit Worker" : "Add Worker"}
                                    </h2>
                                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                                        Workers do not need an NKRN login account. They can be assigned directly to Daily Work Plan items.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={closeWorkerEditor}
                                    disabled={savingWorker}
                                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/10 disabled:opacity-40"
                                >
                                    Close
                                </button>
                            </div>

                            <div className="mt-6 grid gap-5 sm:grid-cols-2">
                                <label className="block">
                                    <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                                        First Name *
                                    </span>
                                    <input
                                        type="text"
                                        value={workerFirstName}
                                        onChange={(event) => setWorkerFirstName(event.target.value)}
                                        className={inputClass}
                                        autoFocus
                                    />
                                </label>

                                <label className="block">
                                    <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                                        Last Name
                                    </span>
                                    <input
                                        type="text"
                                        value={workerLastName}
                                        onChange={(event) => setWorkerLastName(event.target.value)}
                                        className={inputClass}
                                    />
                                </label>

                                <label className="block">
                                    <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                                        Worker Type
                                    </span>
                                    <select
                                        value={workerType}
                                        onChange={(event) => setWorkerType(event.target.value)}
                                        className={selectClass}
                                    >
                                        <option value="Grounds">Grounds</option>
                                        <option value="Cleaning">Cleaning</option>
                                        <option value="Maintenance">Maintenance</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                                        Mobile Number
                                    </span>
                                    <input
                                        type="tel"
                                        value={workerMobileNumber}
                                        onChange={(event) => setWorkerMobileNumber(event.target.value)}
                                        placeholder="Optional"
                                        className={inputClass}
                                    />
                                </label>
                            </div>

                            <label className="mt-5 block">
                                <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                                    Email Address
                                </span>
                                <input
                                    type="email"
                                    value={workerEmail}
                                    onChange={(event) => setWorkerEmail(event.target.value)}
                                    placeholder="Optional"
                                    className={inputClass}
                                />
                            </label>

                            {editingWorker && (
                                <label className="mt-5 flex items-center gap-3 rounded-2xl border border-white/8 bg-black/10 p-4">
                                    <input
                                        type="checkbox"
                                        checked={workerIsActive}
                                        onChange={(event) => setWorkerIsActive(event.target.checked)}
                                        className="h-4 w-4 rounded border-white/20 bg-zinc-900"
                                    />
                                    <span>
                                        <span className="block text-sm font-medium text-zinc-200">Active worker</span>
                                        <span className="mt-1 block text-xs text-zinc-500">
                                            Inactive workers remain in history but cannot be assigned to new work.
                                        </span>
                                    </span>
                                </label>
                            )}

                            <div className="mt-7 flex flex-col-reverse gap-3 border-t border-white/8 pt-5 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={closeWorkerEditor}
                                    disabled={savingWorker}
                                    className={buttonClass}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void saveWorker()}
                                    disabled={savingWorker}
                                    className="rounded-xl border border-yellow-400/20 bg-yellow-500/12 px-5 py-2.5 text-sm font-semibold text-yellow-100 transition hover:bg-yellow-500/18 disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                    {savingWorker
                                        ? "Saving…"
                                        : editingWorker
                                          ? "Save Changes"
                                          : "Add Worker"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {selectedTask && (
                    <div
                        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 px-4 py-6 backdrop-blur-sm sm:items-center"
                        onMouseDown={(event) => {
                            if (event.currentTarget === event.target) {
                                closePlanningTask();
                            }
                        }}
                    >
                        <div className={`${glassCard} my-auto w-full max-w-3xl p-5 sm:p-7`}>
                            <div className="flex items-start justify-between gap-5 border-b border-white/8 pb-5">
                                <div>
                                    <p className="text-xs font-medium uppercase tracking-[0.22em] text-yellow-400">
                                        Daily Work Plan
                                    </p>
                                    <h2 className="mt-1 text-2xl font-semibold">
                                        Schedule Task #{selectedTask.taskID}
                                    </h2>
                                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                                        {selectedTask.title}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={closePlanningTask}
                                    disabled={savingPlan}
                                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/10 disabled:opacity-40"
                                >
                                    Close
                                </button>
                            </div>

                            <div className="mt-6 grid gap-5 md:grid-cols-2">
                                <label className="block">
                                    <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                                        Work Date
                                    </span>
                                    <input
                                        type="date"
                                        value={planDate}
                                        onChange={(event) => setPlanDate(event.target.value)}
                                        className={inputClass}
                                    />
                                </label>

                                <label className="block">
                                    <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                                        Worker
                                    </span>
                                    <select
                                        value={planWorkerID}
                                        onChange={(event) => setPlanWorkerID(event.target.value)}
                                        className={selectClass}
                                    >
                                        <option value="">Unassigned</option>
                                        {workers
                                            .filter((worker) => worker.isActive !== false)
                                            .map((worker) => (
                                                <option key={worker.workerID} value={String(worker.workerID)}>
                                                    {workerDisplayName(worker)}
                                                    {worker.workerType ? ` · ${worker.workerType}` : ""}
                                                </option>
                                            ))}
                                    </select>
                                    {workers.length === 0 && (
                                        <p className="mt-2 text-xs text-zinc-600">
                                            No Logistics workers have been configured yet. You can still schedule this item as unassigned.
                                        </p>
                                    )}
                                </label>

                                <label className="block">
                                    <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                                        Area
                                    </span>
                                    <input
                                        type="text"
                                        value={planArea}
                                        onChange={(event) => setPlanArea(event.target.value)}
                                        placeholder="Work area"
                                        className={inputClass}
                                    />
                                </label>

                                <label className="block">
                                    <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                                        Priority
                                    </span>
                                    <select
                                        value={planPriority}
                                        onChange={(event) => setPlanPriority(event.target.value)}
                                        className={selectClass}
                                    >
                                        <option value="P1">P1 · Critical</option>
                                        <option value="P2">P2 · Urgent</option>
                                        <option value="P3">P3 · Planned</option>
                                        <option value="P4">P4 · Improvement</option>
                                    </select>
                                </label>
                            </div>

                            <label className="mt-5 block">
                                <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                                    Work Description
                                </span>
                                <textarea
                                    value={planDescription}
                                    onChange={(event) => setPlanDescription(event.target.value)}
                                    rows={3}
                                    className={`${inputClass} resize-y`}
                                />
                            </label>

                            <div className="mt-5 grid gap-5 md:grid-cols-2">
                                <label className="block">
                                    <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                                        Materials Required
                                    </span>
                                    <textarea
                                        value={planMaterials}
                                        onChange={(event) => setPlanMaterials(event.target.value)}
                                        rows={4}
                                        placeholder="Optional materials, tools or stock"
                                        className={`${inputClass} resize-y`}
                                    />
                                </label>

                                <label className="block">
                                    <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                                        Manager Note
                                    </span>
                                    <textarea
                                        value={planManagerNote}
                                        onChange={(event) => setPlanManagerNote(event.target.value)}
                                        rows={4}
                                        placeholder="Instructions for the daily job card"
                                        className={`${inputClass} resize-y`}
                                    />
                                </label>
                            </div>

                            <div className="mt-6 rounded-2xl border border-white/8 bg-black/15 p-4 text-sm text-zinc-400">
                                <div className="grid gap-2 sm:grid-cols-2">
                                    <p>
                                        <span className="text-zinc-600">Department:</span>{" "}
                                        {selectedTask.departmentName || "—"}
                                    </p>
                                    <p>
                                        <span className="text-zinc-600">Current responsible:</span>{" "}
                                        {responsibleName(selectedTask)}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={closePlanningTask}
                                    disabled={savingPlan}
                                    className={buttonClass}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void addTaskToWorkPlan()}
                                    disabled={savingPlan}
                                    className="rounded-xl border border-yellow-300/20 bg-yellow-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {savingPlan ? "Adding…" : "Add to Daily Work Plan"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <footer className="py-8 text-center text-xs text-zinc-700">
                    NKRN™ © · Laerskool Tygerpoort
                </footer>
            </div>
        </main>
    );
}

function StatCard({
    label,
    value,
    note,
    accent = "text-white",
}: {
    label: string;
    value: number;
    note: string;
    accent?: string;
}) {
    return (
        <div className={`${glassCard} p-5`}>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                {label}
            </p>
            <p className={`mt-3 text-3xl font-semibold tracking-tight ${accent}`}>
                {value}
            </p>
            <p className="mt-1 text-xs text-zinc-600">{note}</p>
        </div>
    );
}

function Info({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-white/8 bg-white/2.5 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-600">
                {label}
            </p>
            <p className="mt-1 break-all text-sm text-zinc-300">{value}</p>
        </div>
    );
}
