"use client";

import { itLabel, itError } from "../it-labels";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "../nkrn-control.css";

// ========================================
// TYPES
// ========================================

interface User {
    userID: number;
    firstName: string;
    lastName: string;
    email: string;
    roleID: number;
}

interface Category {
    categoryID: number;
    categoryName: string;
}

interface RequestItem {
    requestID: number;
    userID: number;
    userName: string;
    userEmail: string;
    createdByUserID?: number | null;
    createdByName?: string | null;
    createdByEmail?: string | null;
    title: string;
    description: string;
    priority: string;
    assignedTo: number | null;
    createdDate: string | null;
    completedDate: string | null;
    categoryID: number | null;
    categoryName: string | null;
    statusID: number | null;
    statusName: string | null;

    // Google Calendar scheduling
    scheduledStart: string | null;
    scheduledEnd: string | null;
    googleCalendarEventID: string | null;
}

interface RequestComment {
    commentID: number;
    requestID: number;
    userID: number;
    commentText: string;
    createdDate: string | null;
    user?: User | null;
}

interface Status {
    statusID: number;
    statusName: string;
}

// ========================================
// API
// ========================================

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ========================================
// STYLES
// ========================================

const glassCard =
    "nkrn-panel rounded-[28px] border border-white/10 bg-white/4 shadow-2xl shadow-black/20 backdrop-blur-2xl";

const inputClass =
    "nkrn-input w-full rounded-xl border border-white/10 bg-zinc-900/70 p-3.5 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-white/25 focus:bg-zinc-900";

const selectClass =
    "nkrn-select w-full rounded-xl border border-white/10 bg-zinc-900/70 p-3.5 text-sm text-white outline-none transition focus:border-white/25 focus:bg-zinc-900";

const buttonClass =
    "rounded-xl border border-white/10 bg-white/6 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10";

// ========================================
// AUTH HEADERS
// ========================================

function getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem("token");

    return {
        "Content-Type": "application/json",
        ...(token
            ? {
                  Authorization: `Bearer ${token}`,
              }
            : {}),
    };
}

// ========================================
// DATE HELPERS
// ========================================

function toDateTimeLocal(
    value: string | null | undefined
): string {
    if (!value) {
        return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const year = date.getFullYear();
    const month = String(
        date.getMonth() + 1
    ).padStart(2, "0");
    const day = String(
        date.getDate()
    ).padStart(2, "0");
    const hours = String(
        date.getHours()
    ).padStart(2, "0");
    const minutes = String(
        date.getMinutes()
    ).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function fromDateTimeLocal(
    value: string
): string | null {
    if (!value) {
        return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.toISOString();
}

function formatDateTime(
    value: string | null | undefined
): string {
    if (!value) {
        return "Nog nie beplan nie";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Ongeldige datum";
    }

    return date.toLocaleString("af-ZA");
}

// ========================================
// PAGE
// ========================================

export default function AdminPage() {
    return <AdminDashboard />;
}

// ========================================
// ADMIN DASHBOARD
// ========================================

function AdminDashboard() {
    const router = useRouter();

    // ========================================
    // USER
    // ========================================

    const [user, setUser] =
        useState<User | null>(null);

    // ========================================
    // DATA
    // ========================================

    const [requests, setRequests] =
        useState<RequestItem[]>([]);

    const [users, setUsers] =
        useState<User[]>([]);

    const [technicians, setTechnicians] =
        useState<User[]>([]);

    const [administrators, setAdministrators] =
        useState<User[]>([]);

    const [categories, setCategories] =
        useState<Category[]>([]);

    const [statuses, setStatuses] =
        useState<Status[]>([]);

    const [comments, setComments] =
        useState<
            Record<number, RequestComment[]>
        >({});

    const [commentText, setCommentText] =
        useState<Record<number, string>>({});

    // ========================================
    // USER MANAGEMENT
    // ========================================

    const [editingUserID, setEditingUserID] =
        useState<number | null>(null);

    const [editingUser, setEditingUser] =
        useState<User | null>(null);

    const [savingUserID, setSavingUserID] =
        useState<number | null>(null);

    const [removingUserID, setRemovingUserID] =
        useState<number | null>(null);

    const [showAddUser, setShowAddUser] =
        useState(false);

    const [newUserFirstName, setNewUserFirstName] =
        useState("");

    const [newUserLastName, setNewUserLastName] =
        useState("");

    const [newUserEmail, setNewUserEmail] =
        useState("");

    const [newUserRoleID, setNewUserRoleID] =
        useState(1);

    const [creatingUser, setCreatingUser] =
        useState(false);

    // ========================================
    // UI
    // ========================================

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    const [successMessage, setSuccessMessage] =
        useState("");

    const [savingID, setSavingID] =
        useState<number | null>(null);

    const [commentSavingID, setCommentSavingID] =
        useState<number | null>(null);

    const [showDone, setShowDone] =
        useState(false);

    const [showUsers, setShowUsers] =
        useState(false);

    // ========================================
    // LOAD DASHBOARD
    // ========================================

    useEffect(() => {
        let cancelled = false;

        async function initialiseDashboard() {
            const storedUser =
                localStorage.getItem("user");

            const token =
                localStorage.getItem("token");

            if (!storedUser || !token) {
                router.replace("/login");
                return;
            }

            try {
                const loggedInUser: User =
                    JSON.parse(storedUser);

                if (loggedInUser.roleID !== 3) {
                    router.replace(
                        loggedInUser.roleID === 2
                            ? "/Tech"
                            : "/requests"
                    );

                    return;
                }

                if (!cancelled) {
                    setUser(loggedInUser);
                }

                // ========================================
                // LOAD REQUESTS
                // ========================================

                const requestsResponse =
                    await fetch(
                        `${API_URL}/api/Requests`,
                        {
                            method: "GET",
                            headers:
                                getAuthHeaders(),
                            cache: "no-store",
                        }
                    );

                if (!requestsResponse.ok) {
                    if (
                        requestsResponse.status ===
                            401 ||
                        requestsResponse.status ===
                            403
                    ) {
                        localStorage.removeItem(
                            "token"
                        );

                        localStorage.removeItem(
                            "user"
                        );

                        router.replace("/login");

                        return;
                    }

                    throw new Error(
                        "Die versoeke kon nie gelaai word nie."
                    );
                }

                const requestData: RequestItem[] =
                    await requestsResponse.json();

                if (!cancelled) {
                    setRequests(requestData);
                }

                // ========================================
                // LOAD ALL USERS
                // ========================================

                const usersResponse =
                    await fetch(
                        `${API_URL}/api/Users`,
                        {
                            method: "GET",
                            headers:
                                getAuthHeaders(),
                            cache: "no-store",
                        }
                    );

                let loadedUsers: User[] = [];

                if (usersResponse.ok) {
                    loadedUsers =
                        await usersResponse.json();

                    if (!cancelled) {
                        setUsers(loadedUsers);

                        setTechnicians(
                            loadedUsers.filter(
                                (systemUser) =>
                                    systemUser.roleID ===
                                    2
                            )
                        );

                        setAdministrators(
                            loadedUsers.filter(
                                (systemUser) =>
                                    systemUser.roleID ===
                                    3
                            )
                        );

                        // Resolve submitter information
                        // from the user table in case the
                        // Requests endpoint does not provide
                        // userName/userEmail.
                        setRequests(
                            requestData.map(
                                (request) => {
                                    const submittedBy =
                                        loadedUsers.find(
                                            (
                                                systemUser
                                            ) =>
                                                systemUser.userID ===
                                                request.userID
                                        );

                                    return {
                                        ...request,
                                        userName:
                                            request.userName ||
                                            (submittedBy
                                                ? `${submittedBy.firstName} ${submittedBy.lastName}`
                                                : `Gebruiker #${request.userID}`),
                                        userEmail:
                                            request.userEmail ||
                                            submittedBy?.email ||
                                            "",
                                    };
                                }
                            )
                        );
                    }
                }

                // ========================================
                // LOAD CATEGORIES
                // ========================================

                const categoriesResponse =
                    await fetch(
                        `${API_URL}/api/Categories`,
                        {
                            method: "GET",
                            headers:
                                getAuthHeaders(),
                            cache: "no-store",
                        }
                    );

                if (categoriesResponse.ok) {
                    const categoryData: Category[] =
                        await categoriesResponse.json();

                    if (!cancelled) {
                        setCategories(
                            categoryData
                        );

                        // Resolve category names from
                        // category IDs if the Requests
                        // endpoint does not include them.
                        setRequests(
                            (currentRequests) =>
                                currentRequests.map(
                                    (request) => {
                                        const matchingCategory =
                                            categoryData.find(
                                                (
                                                    category
                                                ) =>
                                                    category.categoryID ===
                                                    request.categoryID
                                            );

                                        return {
                                            ...request,
                                            categoryName:
                                                request.categoryName ||
                                                matchingCategory?.categoryName ||
                                                null,
                                        };
                                    }
                                )
                        );
                    }
                }

                // ========================================
                // LOAD STATUSES
                // ========================================

                const statusesResponse =
                    await fetch(
                        `${API_URL}/api/Statuses`,
                        {
                            method: "GET",
                            headers:
                                getAuthHeaders(),
                            cache: "no-store",
                        }
                    );

                if (statusesResponse.ok) {
                    const statusData: Status[] =
                        await statusesResponse.json();

                    if (!cancelled) {
                        setStatuses(statusData);
                    }
                }

                // ========================================
                // LOAD COMMENTS
                // ========================================

                const commentResults =
                    await Promise.all(
                        requestData.map(
                            async (request) => {
                                try {
                                    const response =
                                        await fetch(
                                            `${API_URL}/api/RequestComments/request/${request.requestID}`,
                                            {
                                                method:
                                                    "GET",
                                                headers:
                                                    getAuthHeaders(),
                                                cache:
                                                    "no-store",
                                            }
                                        );

                                    if (
                                        !response.ok
                                    ) {
                                        return {
                                            requestID:
                                                request.requestID,
                                            comments:
                                                [],
                                        };
                                    }

                                    const data: RequestComment[] =
                                        await response.json();

                                    return {
                                        requestID:
                                            request.requestID,
                                        comments:
                                            data,
                                    };
                                } catch {
                                    return {
                                        requestID:
                                            request.requestID,
                                        comments: [],
                                    };
                                }
                            }
                        )
                    );

                if (!cancelled) {
                    const commentMap: Record<
                        number,
                        RequestComment[]
                    > = {};

                    commentResults.forEach(
                        (result) => {
                            commentMap[
                                result.requestID
                            ] =
                                result.comments;
                        }
                    );

                    setComments(commentMap);
                }
            } catch (dashboardError) {
                console.error(
                    "Unable to load admin dashboard:",
                    dashboardError
                );

                if (!cancelled) {
                    setError(
                        "Die IT-inligting kon nie gelaai word nie."
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void initialiseDashboard();

        return () => {
            cancelled = true;
        };
    }, [router]);

    // ========================================
    // USER MANAGEMENT HELPERS
    // ========================================

    async function createUser() {
        const firstName =
            newUserFirstName.trim();

        const lastName =
            newUserLastName.trim();

        const email =
            newUserEmail
                .trim()
                .toLowerCase();

        if (
            !firstName ||
            !lastName ||
            !email
        ) {
            setError(
                "Voornaam, van en e-posadres is verpligtend."
            );

            return;
        }

        if (
            !email.endsWith(
                "@tygies.co.za"
            )
        ) {
            setError(
                "Slegs @tygies.co.za-e-posadresse word toegelaat."
            );

            return;
        }

        if (
            newUserRoleID !== 1 &&
            newUserRoleID !== 2 &&
            newUserRoleID !== 3
        ) {
            setError(
                "Ongeldige gebruikersrol."
            );

            return;
        }

        try {
            setCreatingUser(true);
            setError("");
            setSuccessMessage("");

            const response = await fetch(
                `${API_URL}/api/Auth/register`,
                {
                    method: "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        firstName,
                        lastName,
                        email,
                        roleID:
                            newUserRoleID,
                    }),
                }
            );

            if (!response.ok) {
                const responseText =
                    await response.text();

                console.error(
                    "User creation error:",
                    responseText
                );

                if (
                    response.status === 401 ||
                    response.status === 403
                ) {
                    throw new Error(
                        "Jy het nie toestemming om gebruikers by te voeg nie."
                    );
                }

                if (
                    response.status === 409
                ) {
                    throw new Error(
                        "Daar is reeds â€™n gebruiker met hierdie e-posadres."
                    );
                }

                let message =
                    "Die gebruiker kon nie bygevoeg word nie.";

                try {
                    const parsed =
                        JSON.parse(
                            responseText
                        ) as {
                            message?: string;
                        };

                    if (
                        parsed.message
                    ) {
                        message =
                            parsed.message;
                    }
                } catch {
                    // Keep the default message.
                }

                throw new Error(
                    message
                );
            }

            const createdUser: User =
                await response.json();

            setUsers(
                (currentUsers) => {
                    const updatedUsers = [
                        ...currentUsers,
                        createdUser,
                    ].sort(
                        (a, b) =>
                            `${a.firstName} ${a.lastName}`.localeCompare(
                                `${b.firstName} ${b.lastName}`
                            )
                    );

                    setTechnicians(
                        updatedUsers.filter(
                            (systemUser) =>
                                systemUser.roleID ===
                                2
                        )
                    );

                    setAdministrators(
                        updatedUsers.filter(
                            (systemUser) =>
                                systemUser.roleID ===
                                3
                        )
                    );

                    return updatedUsers;
                }
            );

            setNewUserFirstName("");
            setNewUserLastName("");
            setNewUserEmail("");
            setNewUserRoleID(1);
            setShowAddUser(false);

            setSuccessMessage(
                `${createdUser.firstName} ${createdUser.lastName} is bygevoeg.`
            );
        } catch (userError) {
            console.error(
                "Unable to add user:",
                userError
            );

            setError(
                userError instanceof Error
                    ? userError.message
                    : "Die gebruiker kon nie bygevoeg word nie."
            );
        } finally {
            setCreatingUser(false);
        }
    }

    function startEditingUser(
        systemUser: User
    ) {
        setError("");
        setSuccessMessage("");

        setEditingUserID(
            systemUser.userID
        );

        setEditingUser({
            ...systemUser,
        });
    }

    function cancelEditingUser() {
        setEditingUserID(null);
        setEditingUser(null);
    }

    function updateEditingUser(
        field:
            | "firstName"
            | "lastName"
            | "email"
            | "roleID",
        value: string
    ) {
        if (!editingUser) {
            return;
        }

        setEditingUser({
            ...editingUser,
            [field]:
                field === "roleID"
                    ? Number(value)
                    : value,
        });
    }

    async function saveUser() {
        if (!editingUser) {
            return;
        }

        if (
            !editingUser.firstName.trim() ||
            !editingUser.lastName.trim() ||
            !editingUser.email.trim()
        ) {
            setError(
                "Voornaam, van en e-posadres is verpligtend."
            );

            return;
        }

        if (
            !editingUser.email
                .trim()
                .toLowerCase()
                .endsWith("@tygies.co.za")
        ) {
            setError(
                "Slegs @tygies.co.za-e-posadresse word toegelaat."
            );

            return;
        }

        if (
            editingUser.roleID !== 1 &&
            editingUser.roleID !== 2 &&
            editingUser.roleID !== 3
        ) {
            setError(
                "Ongeldige gebruikersrol."
            );

            return;
        }

        try {
            setSavingUserID(
                editingUser.userID
            );

            setError("");
            setSuccessMessage("");

            const response = await fetch(
                `${API_URL}/api/Users/${editingUser.userID}`,
                {
                    method: "PUT",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        userID:
                            editingUser.userID,

                        firstName:
                            editingUser.firstName.trim(),

                        lastName:
                            editingUser.lastName.trim(),

                        email:
                            editingUser.email.trim(),

                        roleID:
                            editingUser.roleID,
                    }),
                }
            );

            if (!response.ok) {
                const responseText =
                    await response.text();

                console.error(
                    "User update error:",
                    responseText
                );

                if (
                    response.status === 401 ||
                    response.status === 403
                ) {
                    throw new Error(
                        "Jy het nie toestemming om gebruikers te bestuur nie."
                    );
                }

                if (
                    response.status === 409
                ) {
                    throw new Error(
                        "Daar is reeds â€™n gebruiker met hierdie e-posadres."
                    );
                }

                throw new Error(
                    "Die gebruiker kon nie opgedateer word nie."
                );
            }

            const updatedUser: User =
                await response.json();

            setUsers(
                (currentUsers) =>
                    currentUsers.map(
                        (systemUser) =>
                            systemUser.userID ===
                            updatedUser.userID
                                ? updatedUser
                                : systemUser
                    )
            );

           setTechnicians(
    users
        .map(
            (systemUser) =>
                systemUser.userID ===
                updatedUser.userID
                    ? updatedUser
                    : systemUser
        )
        .filter(
            (systemUser) =>
                systemUser.roleID ===
                2
        )
);
setAdministrators(
    users
        .map(
            (systemUser) =>
                systemUser.userID ===
                updatedUser.userID
                    ? updatedUser
                    : systemUser
        )
        .filter(
            (systemUser) =>
                systemUser.roleID ===
                3
        )
);

            // Keep the logged-in user information current
            // if the administrator edited their own details.
            if (
                user &&
                user.userID ===
                    updatedUser.userID
            ) {
                setUser(updatedUser);

                localStorage.setItem(
                    "user",
                    JSON.stringify(
                        updatedUser
                    )
                );
            }

            // Update request submitter information
            // where this user is referenced.
            setRequests(
                (currentRequests) =>
                    currentRequests.map(
                        (request) =>
                            request.userID ===
                            updatedUser.userID
                                ? {
                                      ...request,
                                      userName: `${updatedUser.firstName} ${updatedUser.lastName}`,
                                      userEmail:
                                          updatedUser.email,
                                  }
                                : request
                    )
            );

            setEditingUserID(null);
            setEditingUser(null);

            setSuccessMessage(
                `${updatedUser.firstName} ${updatedUser.lastName} is opgedateer.`
            );

            // Rebuild technician/admin lists from the
            // newly updated complete user list.
            setUsers(
                (currentUsers) => {
                    const updatedUsers =
                        currentUsers.map(
                            (systemUser) =>
                                systemUser.userID ===
                                updatedUser.userID
                                    ? updatedUser
                                    : systemUser
                        );

                    setTechnicians(
                        updatedUsers.filter(
                            (systemUser) =>
                                systemUser.roleID ===
                                2
                        )
                    );

                    setAdministrators(
                        updatedUsers.filter(
                            (systemUser) =>
                                systemUser.roleID ===
                                3
                        )
                    );

                    return updatedUsers;
                }
            );
        } catch (userError) {
            console.error(
                "Unable to update user:",
                userError
            );

            setError(
                userError instanceof Error
                    ? userError.message
                    : "Die gebruiker kon nie opgedateer word nie."
            );
        } finally {
            setSavingUserID(null);
        }
    }

    async function removeUser(
        systemUser: User
    ) {
        if (
            user &&
            systemUser.userID ===
                user.userID
        ) {
            setError(
                "Jy kan nie jou eie rekening deaktiveer nie."
            );

            return;
        }

        const confirmed =
            window.confirm(
                `Wil jy ${systemUser.firstName} ${systemUser.lastName} se rekening deaktiveer?\n\nDie gebruiker sal nie meer kan aanmeld nie.`
            );

        if (!confirmed) {
            return;
        }

        try {
            setRemovingUserID(
                systemUser.userID
            );

            setError("");
            setSuccessMessage("");

            const response = await fetch(
                `${API_URL}/api/Users/${systemUser.userID}`,
                {
                    method: "DELETE",
                    headers: getAuthHeaders(),
                }
            );

            if (!response.ok) {
                const responseText =
                    await response.text();

                console.error(
                    "User removal error:",
                    responseText
                );

                if (
                    response.status === 401 ||
                    response.status === 403
                ) {
                    throw new Error(
                        "Jy het nie toestemming om gebruikers te deaktiveer nie."
                    );
                }

                throw new Error(
                    "Die gebruiker kon nie gedeaktiveer word nie."
                );
            }

            setUsers(
                (currentUsers) =>
                    currentUsers.filter(
                        (existingUser) =>
                            existingUser.userID !==
                            systemUser.userID
                    )
            );

            setTechnicians(
                (currentUsers) =>
                    currentUsers.filter(
                        (existingUser) =>
                            existingUser.userID !==
                                systemUser.userID &&
                            existingUser.roleID === 2
                    )
            );

            setAdministrators(
                (currentUsers) =>
                    currentUsers.filter(
                        (existingUser) =>
                            existingUser.userID !==
                                systemUser.userID &&
                            existingUser.roleID === 3
                    )
            );

            if (
                editingUserID ===
                systemUser.userID
            ) {
                cancelEditingUser();
            }

            setSuccessMessage(
                `${systemUser.firstName} ${systemUser.lastName} is gedeaktiveer.`
            );
        } catch (userError) {
            console.error(
                "Unable to remove user:",
                userError
            );

            setError(
                userError instanceof Error
                    ? userError.message
                    : "Die gebruiker kon nie gedeaktiveer word nie."
            );
        } finally {
            setRemovingUserID(null);
        }
    }

    // ========================================
    // UPDATE REQUEST LOCALLY
    // ========================================

    function updateRequest(
        requestID: number,
        field:
            | "statusID"
            | "priority"
            | "assignedTo"
            | "categoryID"
            | "scheduledStart"
            | "scheduledEnd",
        value: string
    ) {
        setRequests((currentRequests) =>
            currentRequests.map((request) => {
                if (
                    request.requestID !==
                    requestID
                ) {
                    return request;
                }

                if (field === "statusID") {
                    const newStatusID =
                        Number(value);

                    const matchingStatus =
                        statuses.find(
                            (status) =>
                                status.statusID ===
                                newStatusID
                        );

                    return {
                        ...request,
                        statusID: newStatusID,
                        statusName:
                            matchingStatus?.statusName ??
                            (newStatusID === 1
                                ? "Logged"
                                : newStatusID === 2
                                ? "Busy"
                                : "Done"),
                        completedDate:
                            newStatusID === 3
                                ? request.completedDate ??
                                  new Date().toISOString()
                                : null,
                    };
                }

                if (field === "assignedTo") {
                    return {
                        ...request,
                        assignedTo:
                            value === ""
                                ? null
                                : Number(value),
                    };
                }

                if (field === "categoryID") {
                    const newCategoryID =
                        value === ""
                            ? null
                            : Number(value);

                    const matchingCategory =
                        categories.find(
                            (category) =>
                                category.categoryID ===
                                newCategoryID
                        );

                    return {
                        ...request,
                        categoryID:
                            newCategoryID,
                        categoryName:
                            matchingCategory?.categoryName ??
                            null,
                    };
                }

                if (
                    field ===
                    "scheduledStart"
                ) {
                    return {
                        ...request,
                        scheduledStart:
                            fromDateTimeLocal(
                                value
                            ),
                    };
                }

                if (
                    field === "scheduledEnd"
                ) {
                    return {
                        ...request,
                        scheduledEnd:
                            fromDateTimeLocal(
                                value
                            ),
                    };
                }

                return {
                    ...request,
                    priority: value,
                };
            })
        );
    }

    // ========================================
    // SAVE REQUEST
    // ========================================

    async function saveRequest(
        request: RequestItem
    ) {
        try {
            setSavingID(request.requestID);
            setError("");
            setSuccessMessage("");

            // Prevent an invalid calendar range.
            if (
                request.scheduledStart &&
                request.scheduledEnd
            ) {
                const start = new Date(
                    request.scheduledStart
                ).getTime();

                const end = new Date(
                    request.scheduledEnd
                ).getTime();

                if (
                    !Number.isNaN(start) &&
                    !Number.isNaN(end) &&
                    end <= start
                ) {
                    throw new Error(
                        "Die beplande eindtyd moet nÃ¡ die begintyd wees."
                    );
                }
            }

            const response = await fetch(
                `${API_URL}/api/Requests/${request.requestID}`,
                {
                    method: "PUT",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        requestID:
                            request.requestID,

                        userID:
                            request.userID,

                        title:
                            request.title,

                        description:
                            request.description,

                        priority:
                            request.priority,

                        assignedTo:
                            request.assignedTo,

                        createdDate:
                            request.createdDate,

                        completedDate:
                            request.completedDate,

                        categoryID:
                            request.categoryID,

                        statusID:
                            request.statusID,

                        scheduledStart:
                            request.scheduledStart,

                        scheduledEnd:
                            request.scheduledEnd,

                        googleCalendarEventID:
                            request.googleCalendarEventID,
                    }),
                }
            );

            if (!response.ok) {
                const responseText =
                    await response.text();

                console.error(
                    "Request update error:",
                    responseText
                );

                if (
                    response.status === 401 ||
                    response.status === 403
                ) {
                    throw new Error(
                        "Jy het nie toestemming om hierdie versoek op te dateer nie."
                    );
                }

                throw new Error(
                    "Die versoek kon nie opgedateer word nie."
                );
            }

            setSuccessMessage(
                `Versoek #${request.requestID} is gestoor.`
            );
        } catch (saveError) {
            console.error(
                "Unable to save request:",
                saveError
            );

            setError(
                saveError instanceof Error
                    ? saveError.message
                    : `Versoek #${request.requestID} kon nie opgedateer word nie.`
            );
        } finally {
            setSavingID(null);
        }
    }

    // ========================================
    // ADD COMMENT
    // ========================================

    async function addComment(
        requestID: number
    ) {
        if (!user) {
            return;
        }

        const text =
            commentText[requestID]?.trim() ??
            "";

        if (!text) {
            setError(
                "Tik eers jou kommentaar in."
            );

            return;
        }

        try {
            setCommentSavingID(requestID);
            setError("");
            setSuccessMessage("");

            const response = await fetch(
                `${API_URL}/api/RequestComments`,
                {
                    method: "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        requestID,
                        userID: user.userID,
                        commentText: text,
                    }),
                }
            );

            if (!response.ok) {
                const responseText =
                    await response.text();

                console.error(
                    "Comment API error:",
                    responseText
                );

                throw new Error(
                    "Die kommentaar kon nie bygevoeg word nie."
                );
            }

            const newComment: RequestComment =
                await response.json();

            setComments((currentComments) => ({
                ...currentComments,

                [requestID]: [
                    ...(currentComments[
                        requestID
                    ] ?? []),

                    newComment,
                ],
            }));

            setCommentText((currentText) => ({
                ...currentText,
                [requestID]: "",
            }));

            setSuccessMessage(
                `Kommentaar is by versoek #${requestID} gevoeg.`
            );
        } catch (commentError) {
            console.error(
                "Unable to add comment:",
                commentError
            );

            setError(
                commentError instanceof Error
                    ? commentError.message
                    : `Kommentaar kon nie by versoek #${requestID} gevoeg word nie.`
            );
        } finally {
            setCommentSavingID(null);
        }
    }

    // ========================================
    // EXPORT CSV
    // ========================================

    function exportCSV() {
        if (requests.length === 0) {
            setError(
                "Daar is geen versoeke om uit te voer nie."
            );

            return;
        }

        const headers = [
            "Versoeknommer",
            "Gebruikersnommer",
            "Gebruiker se naam",
            "Gebruiker se e-posadres",
            "Aangemeld deur: gebruikersnommer",
            "Aangemeld deur: naam",
            "Aangemeld deur: e-posadres",
            "Titel",
            "Beskrywing",
            "Prioriteit",
            "Toegewys aan",
            "Aanmelddatum",
            "Afhandelingsdatum",
            "Beplande begintyd",
            "Beplande eindtyd",
            "Kategorie",
            "Status",
            "Google Calendar-afspraaknommer",
        ];

        const rows = requests.map(
            (request) => [
                request.requestID,
                request.userID,
                request.userName ?? "",
                request.userEmail ?? "",
                request.createdByUserID ?? request.userID,
                request.createdByName ?? request.userName ?? "",
                request.createdByEmail ?? request.userEmail ?? "",
                request.title ?? "",
                request.description ?? "",
                itLabel(request.priority),
                request.assignedTo ?? "",
                request.createdDate ?? "",
                request.completedDate ?? "",
                request.scheduledStart ?? "",
                request.scheduledEnd ?? "",
                request.categoryName ?? "",
                itLabel(request.statusName),
                request.googleCalendarEventID ??
                    "",
            ]
        );

        function escapeCSV(
            value: unknown
        ): string {
            const text = String(
                value ?? ""
            );

            return `"${text.replace(
                /"/g,
                '""'
            )}"`;
        }

        const csvContent = [
            headers
                .map(escapeCSV)
                .join(","),

            ...rows.map((row) =>
                row
                    .map(escapeCSV)
                    .join(",")
            ),
        ].join("\r\n");

        const blob = new Blob(
            [csvContent],
            {
                type: "text/csv;charset=utf-8;",
            }
        );

        const url =
            URL.createObjectURL(blob);

        const link =
            document.createElement("a");

        link.href = url;

        const date = new Date()
            .toISOString()
            .slice(0, 10);

        link.download =
            `Tygerpoort-ITDesk-Admin-${date}.csv`;

        document.body.appendChild(link);

        link.click();

        document.body.removeChild(link);

        URL.revokeObjectURL(url);

        setSuccessMessage(
            "Alle IT-versoeke is uitgevoer."
        );
    }

    // ========================================
    // LOGOUT
    // ========================================

    function logout() {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        router.replace("/login");
    }

    // ========================================
    // STATUS STYLE
    // ========================================

    function statusClass(
        statusID: number | null
    ) {
        switch (statusID) {
            case 1:
                return "border-red-400/10 bg-red-500/10 text-red-300";

            case 2:
                return "border-orange-400/10 bg-orange-500/10 text-orange-300";

            case 3:
                return "border-green-400/10 bg-green-500/10 text-green-300";

            default:
                return "border-white/10 bg-white/5 text-zinc-400";
        }
    }

    // ========================================
    // PRIORITY STYLE
    // ========================================

    function priorityClass(
        priority: string
    ) {
        switch (priority) {
            case "Critical":
                return "border-red-400/10 bg-red-500/10 text-red-300";

            case "High":
                return "border-orange-400/10 bg-orange-500/10 text-orange-300";

            case "Medium":
                return "border-yellow-400/10 bg-yellow-500/10 text-yellow-300";

            default:
                return "border-green-400/10 bg-green-500/10 text-green-300";
        }
    }

    // ========================================
    // LOADING
    // ========================================

    if (loading) {
        return (
            <main className="nkrn-control relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 text-white">
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute -left-40 -top-40 h-125 w-125 rounded-full bg-white/4 blur-3xl" />

                    <div className="absolute -right-40 top-1/4 h-150 w-150 rounded-full bg-white/3 blur-3xl" />
                </div>

                <div className="relative text-center">
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
                        <div className="h-5 w-5 animate-pulse rounded-full bg-white/60" />
                    </div>

                    <p className="text-sm text-zinc-400">
                        Administrasieportaal laaiâ€¦
                    </p>
                </div>
            </main>
        );
    }

    if (!user) {
        return null;
    }

    // ========================================
    // STATISTICS
    // ========================================

    const loggedCount =
        requests.filter(
            (request) =>
                request.statusID === 1
        ).length;

    const busyCount =
        requests.filter(
            (request) =>
                request.statusID === 2
        ).length;

    const doneCount =
        requests.filter(
            (request) =>
                request.statusID === 3
        ).length;

    const criticalCount =
        requests.filter(
            (request) =>
                request.priority ===
                "Critical"
        ).length;

    const scheduledCount =
        requests.filter(
            (request) =>
                Boolean(
                    request.scheduledStart
                )
        ).length;

    const visibleRequests =
        showDone
            ? requests
            : requests.filter(
                  (request) =>
                      request.statusID !==
                      3
              );

    // ========================================
    // PAGE
    // ========================================

    return (
        <main className="nkrn-control nkrn-admin relative min-h-screen overflow-hidden bg-zinc-950 text-white">
            {/* ========================================
                BACKGROUND
            ======================================== */}

            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -left-40 -top-40 h-125 w-125 rounded-full bg-white/4 blur-3xl" />

                <div className="absolute -right-40 top-1/4 h-150 w-150 rounded-full bg-white/3 blur-3xl" />

                <div className="absolute -bottom-62.5 left-1/3 h-125 w-125 rounded-full bg-white/2 blur-3xl" />
            </div>

            <div className="relative mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
                {/* ========================================
                    HEADER
                ======================================== */}

                <header
                    className={`${glassCard} nkrn-hero mb-8 p-5 sm:p-7`}
                >
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-5">
                            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/4">
                                <Image
                                    src="/wit-logo-tygies.png"
                                    alt="Laerskool Tygerpoort-logo"
                                    width={150}
                                    height={60}
                                    className="h-auto w-30 object-contain"
                                    priority
                                />
                            </div>

                            <div>
                                <p className="mb-1 text-xs font-medium uppercase tracking-[0.25em] text-red-400">
                                    Administrateur
                                </p>

                                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                                    IT-beheersentrum
                                </h1>

                                <p className="mt-1 text-sm text-zinc-400">
                                    Welcome{" "}
                                    {user.firstName}. Manage requests, assignments and scheduled support.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() =>
                                    router.push(
                                        "/requests"
                                    )
                                }
                                className={buttonClass}
                            >
                                My versoeke
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    router.push(
                                        "/Tech"
                                    )
                                }
                                className={buttonClass}
                            >
                                Tegnikusportaal
                            </button>

                            <button
                                type="button"
                                onClick={
                                    exportCSV
                                }
                                className="rounded-xl border border-green-400/10 bg-green-500/10 px-4 py-2.5 text-sm font-medium text-green-300 transition hover:bg-green-500/15"
                            >
                                Voer CSV uit
                            </button>

                            <button
                                type="button"
                                onClick={() => router.push("/")}
                                className="rounded-xl border border-[#d7a31f]/25 bg-[#d7a31f]/8 px-4 py-2.5 text-sm font-medium text-[#e7b42b] transition hover:border-[#d7a31f]/40 hover:bg-[#d7a31f]/12"
                            >
                                Tuis
                            </button>

                            <button
                                type="button"
                                onClick={logout}
                                className="rounded-xl border border-red-400/10 bg-red-500/8 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/14"
                            >
                                Meld af
                            </button>
                        </div>
                    </div>
                </header>

                {/* ========================================
                    MESSAGES
                ======================================== */}

                {successMessage && (
                    <div className="mb-6 rounded-2xl border border-green-400/10 bg-green-500/7 p-4 text-sm text-green-300 backdrop-blur-xl">
                        {successMessage}
                    </div>
                )}

                {error && (
                    <div className="mb-6 rounded-2xl border border-red-400/10 bg-red-500/7 p-4 text-sm text-red-300 backdrop-blur-xl">
                        {itError(error)}
                    </div>
                )}

                {/* ========================================
                    STATISTICS
                ======================================== */}

                <section className="nkrn-stats mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5">
                    <div
                        className={`${glassCard} p-6`}
                    >
                        <p className="text-sm text-zinc-500">
                            Aangemeld
                        </p>

                        <p className="mt-2 text-4xl font-bold text-red-400">
                            {loggedCount}
                        </p>

                        <p className="mt-2 text-xs text-zinc-600">
                            Wag op aandag
                        </p>
                    </div>

                    <div
                        className={`${glassCard} p-6`}
                    >
                        <p className="text-sm text-zinc-500">
                            Besig
                        </p>

                        <p className="mt-2 text-4xl font-bold text-orange-400">
                            {busyCount}
                        </p>

                        <p className="mt-2 text-xs text-zinc-600">
                            Word tans hanteer
                        </p>
                    </div>

                    <div
                        className={`${glassCard} p-6`}
                    >
                        <p className="text-sm text-zinc-500">
                            Afgehandel
                        </p>

                        <p className="mt-2 text-4xl font-bold text-green-400">
                            {doneCount}
                        </p>

                        <p className="mt-2 text-xs text-zinc-600">
                            Afgehandelde versoeke
                        </p>
                    </div>

                    <div
                        className={`${glassCard} p-6`}
                    >
                        <p className="text-sm text-zinc-500">
                            Kritiek
                        </p>

                        <p className="mt-2 text-4xl font-bold text-red-500">
                            {criticalCount}
                        </p>

                        <p className="mt-2 text-xs text-zinc-600">
                            HoÃ«prioriteitsversoeke
                        </p>
                    </div>

                    <div
                        className={`${glassCard} p-6`}
                    >
                        <p className="text-sm text-zinc-500">
                            Beplan
                        </p>

                        <p className="mt-2 text-4xl font-bold text-blue-400">
                            {scheduledCount}
                        </p>

                        <p className="mt-2 text-xs text-zinc-600">
                            Kalenderafsprake
                        </p>
                    </div>
                </section>

                {/* ========================================
                    SYSTEM OVERVIEW
                ======================================== */}

                <section
                    className={`${glassCard} mb-8 p-5 sm:p-7`}
                >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="mb-1 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                                Administrasie
                            </p>

                            <h2 className="text-2xl font-semibold">
                                Stelseloorsig
                            </h2>

                            <p className="mt-1 text-sm text-zinc-500">
                                {requests.length} requests Â·{" "}
                                {technicians.length} technicians Â·{" "}
                                {administrators.length} administrators Â·{" "}
                                {users.length} total users
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowUsers(true);
                                    setShowAddUser(
                                        (current) =>
                                            !current
                                    );
                                    setError("");
                                    setSuccessMessage("");
                                }}
                                className="rounded-xl border border-[#d7a31f]/25 bg-[#d7a31f]/10 px-4 py-2.5 text-sm font-medium text-[#e7b42b] transition hover:bg-[#d7a31f]/15"
                            >
                                {showAddUser
                                    ? "Kanselleer nuwe gebruiker"
                                    : "+ Voeg gebruiker by"}
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    setShowUsers(
                                        (current) =>
                                            !current
                                    )
                                }
                                className={buttonClass}
                            >
                                {showUsers
                                    ? "Versteek gebruikers"
                                    : "Wys gebruikers"}
                            </button>
                        </div>
                    </div>

                    {showAddUser && (
                        <div className="mt-6 rounded-2xl border border-[#d7a31f]/20 bg-[#d7a31f]/5 p-5">
                            <div className="mb-5">
                                <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#d7a31f]">
                                    Gebruikersadministrasie
                                </p>

                                <h3 className="mt-1 text-lg font-semibold text-white">
                                    Voeg NKRN-gebruiker by
                                </h3>

                                <p className="mt-1 text-sm text-zinc-500">
                                    Create a new active NKRN account using the staff member&apos;s @tygies.co.za email address.
                                </p>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <div>
                                    <label className="mb-2 block text-xs font-medium uppercase tracking-[0.15em] text-zinc-500">
                                        Voornaam
                                    </label>

                                    <input
                                        type="text"
                                        value={
                                            newUserFirstName
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setNewUserFirstName(
                                                event.target.value
                                            )
                                        }
                                        className={inputClass}
                                        placeholder="Voornaam"
                                        disabled={
                                            creatingUser
                                        }
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-xs font-medium uppercase tracking-[0.15em] text-zinc-500">
                                        Van
                                    </label>

                                    <input
                                        type="text"
                                        value={
                                            newUserLastName
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setNewUserLastName(
                                                event.target.value
                                            )
                                        }
                                        className={inputClass}
                                        placeholder="Van"
                                        disabled={
                                            creatingUser
                                        }
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-xs font-medium uppercase tracking-[0.15em] text-zinc-500">
                                        E-pos
                                    </label>

                                    <input
                                        type="email"
                                        value={
                                            newUserEmail
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setNewUserEmail(
                                                event.target.value
                                            )
                                        }
                                        className={inputClass}
                                        placeholder="name@tygies.co.za"
                                        disabled={
                                            creatingUser
                                        }
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-xs font-medium uppercase tracking-[0.15em] text-zinc-500">
                                        Rol
                                    </label>

                                    <select
                                        value={
                                            newUserRoleID
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setNewUserRoleID(
                                                Number(
                                                    event.target.value
                                                )
                                            )
                                        }
                                        className={selectClass}
                                        disabled={
                                            creatingUser
                                        }
                                    >
                                        <option value="1">
                                            Personeellid
                                        </option>

                                        <option value="2">
                                            Tegnikus
                                        </option>

                                        <option value="3">
                                            Administrateur
                                        </option>
                                    </select>
                                </div>
                            </div>

                            <div className="mt-5 flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={
                                        createUser
                                    }
                                    disabled={
                                        creatingUser
                                    }
                                    className="rounded-xl border border-green-400/15 bg-green-500/10 px-4 py-2.5 text-sm font-medium text-green-300 transition hover:bg-green-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {creatingUser
                                        ? "Gebruiker word geskepâ€¦"
                                        : "Skep gebruiker"}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddUser(
                                            false
                                        );
                                        setNewUserFirstName(
                                            ""
                                        );
                                        setNewUserLastName(
                                            ""
                                        );
                                        setNewUserEmail(
                                            ""
                                        );
                                        setNewUserRoleID(
                                            1
                                        );
                                    }}
                                    disabled={
                                        creatingUser
                                    }
                                    className={buttonClass}
                                >
                                    Kanselleer
                                </button>
                            </div>
                        </div>
                    )}

                    {showUsers && (
                        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-white/10 text-zinc-500">
                                            <th className="px-5 py-4">
                                                ID
                                            </th>

                                            <th className="px-5 py-4">
                                                Naam
                                            </th>

                                            <th className="px-5 py-4">
                                                E-pos
                                            </th>

                                            <th className="px-5 py-4">
                                                Rol
                                            </th>

                                            <th className="px-5 py-4">
                                                Aksies
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {users.map(
                                            (
                                                systemUser
                                            ) => {
                                                const isEditing =
                                                    editingUserID ===
                                                    systemUser.userID;

                                                return (
                                                    <tr
                                                        key={
                                                            systemUser.userID
                                                        }
                                                        className="border-b border-white/5 last:border-0"
                                                    >
                                                        <td className="px-5 py-4 text-zinc-600">
                                                            {
                                                                systemUser.userID
                                                            }
                                                        </td>

                                                        <td className="px-5 py-4">
                                                            {isEditing &&
                                                            editingUser ? (
                                                                <div className="flex min-w-60 flex-col gap-2">
                                                                    <input
                                                                        type="text"
                                                                        value={
                                                                            editingUser.firstName
                                                                        }
                                                                        onChange={(
                                                                            event
                                                                        ) =>
                                                                            updateEditingUser(
                                                                                "firstName",
                                                                                event
                                                                                    .target
                                                                                    .value
                                                                            )
                                                                        }
                                                                        className={inputClass}
                                                                        placeholder="Voornaam"
                                                                    />

                                                                    <input
                                                                        type="text"
                                                                        value={
                                                                            editingUser.lastName
                                                                        }
                                                                        onChange={(
                                                                            event
                                                                        ) =>
                                                                            updateEditingUser(
                                                                                "lastName",
                                                                                event
                                                                                    .target
                                                                                    .value
                                                                            )
                                                                        }
                                                                        className={inputClass}
                                                                        placeholder="Van"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <span className="text-zinc-200">
                                                                    {
                                                                        systemUser.firstName
                                                                    }{" "}
                                                                    {
                                                                        systemUser.lastName
                                                                    }
                                                                </span>
                                                            )}
                                                        </td>

                                                        <td className="px-5 py-4">
                                                            {isEditing &&
                                                            editingUser ? (
                                                                <input
                                                                    type="email"
                                                                    value={
                                                                        editingUser.email
                                                                    }
                                                                    onChange={(
                                                                        event
                                                                    ) =>
                                                                        updateEditingUser(
                                                                            "email",
                                                                            event
                                                                                .target
                                                                                .value
                                                                        )
                                                                    }
                                                                    className={`${inputClass} min-w-65`}
                                                                    placeholder="E-posadres"
                                                                />
                                                            ) : (
                                                                <span className="text-zinc-500">
                                                                    {
                                                                        systemUser.email
                                                                    }
                                                                </span>
                                                            )}
                                                        </td>

                                                        <td className="px-5 py-4">
                                                            {isEditing &&
                                                            editingUser ? (
                                                                <select
                                                                    value={
                                                                        editingUser.roleID
                                                                    }
                                                                    onChange={(
                                                                        event
                                                                    ) =>
                                                                        updateEditingUser(
                                                                            "roleID",
                                                                            event
                                                                                .target
                                                                                .value
                                                                        )
                                                                    }
                                                                    className={`${selectClass} min-w-45`}
                                                                >
                                                                    <option value="1">
                                                                        Personeellid
                                                                    </option>

                                                                    <option value="2">
                                                                        Tegnikus
                                                                    </option>

                                                                    <option value="3">
                                                                        Administrateur
                                                                    </option>
                                                                </select>
                                                            ) : (
                                                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                                                                    {systemUser.roleID ===
                                                                    3
                                                                        ? "Administrateur"
                                                                        : systemUser.roleID ===
                                                                          2
                                                                        ? "Tegnikus"
                                                                        : "Personeellid"}
                                                                </span>
                                                            )}
                                                        </td>

                                                        <td className="px-5 py-4">
                                                            <div className="flex flex-wrap gap-2">
                                                                {isEditing ? (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={
                                                                                saveUser
                                                                            }
                                                                            disabled={
                                                                                savingUserID ===
                                                                                systemUser.userID
                                                                            }
                                                                            className="rounded-xl border border-green-400/10 bg-green-500/10 px-3 py-2 text-xs font-medium text-green-300 transition hover:bg-green-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                                                                        >
                                                                            {savingUserID ===
                                                                            systemUser.userID
                                                                                ? "Besig om te stoorâ€¦"
                                                                                : "Stoor"}
                                                                        </button>

                                                                        <button
                                                                            type="button"
                                                                            onClick={
                                                                                cancelEditingUser
                                                                            }
                                                                            disabled={
                                                                                savingUserID ===
                                                                                systemUser.userID
                                                                            }
                                                                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                                                                        >
                                                                            Kanselleer
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            startEditingUser(
                                                                                systemUser
                                                                            )
                                                                        }
                                                                        className="rounded-xl border border-blue-400/10 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-300 transition hover:bg-blue-500/15"
                                                                    >
                                                                        Wysig
                                                                    </button>
                                                                )}

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        removeUser(
                                                                            systemUser
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        removingUserID ===
                                                                            systemUser.userID ||
                                                                        (user?.userID ===
                                                                            systemUser.userID)
                                                                    }
                                                                    className="rounded-xl border border-red-400/10 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                                                                >
                                                                    {removingUserID ===
                                                                    systemUser.userID
                                                                        ? "Besig om te deaktiveerâ€¦"
                                                                        : "Deaktiveer"}
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            }
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </section>

                {/* ========================================
                    REQUESTS HEADER
                ======================================== */}

                <section>
                    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div>
                            <p className="mb-1 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                                IT-ondersteuning
                            </p>

                            <h2 className="text-2xl font-semibold">
                                IT-versoeke
                            </h2>

                            <p className="mt-1 text-sm text-zinc-500">
                                Showing{" "}
                                {
                                    visibleRequests.length
                                }{" "}
                                of{" "}
                                {
                                    requests.length
                                }{" "}
                                requests
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                setShowDone(
                                    (current) =>
                                        !current
                                )
                            }
                            className={buttonClass}
                        >
                            {showDone
                                ? "Versteek afgehandelde versoeke"
                                : "Wys afgehandelde versoeke"}
                        </button>
                    </div>

                    {/* ========================================
                        REQUEST LIST
                    ======================================== */}

                    <div className="space-y-6">
                        {visibleRequests.length ===
                            0 && (
                            <div
                                className={`${glassCard} p-10 text-center`}
                            >
                                <p className="text-sm text-zinc-500">
                                    Geen aktiewe versoeke nie.
                                </p>
                            </div>
                        )}

                        {visibleRequests.map(
                            (request) => {
                                const requestComments =
                                    comments[
                                        request
                                            .requestID
                                    ] ?? [];

                                const assignedUser =
                                    users.find(
                                        (
                                            systemUser
                                        ) =>
                                            systemUser.userID ===
                                            request.assignedTo
                                    );

                                const submittedByUser =
                                    users.find(
                                        (
                                            systemUser
                                        ) =>
                                            systemUser.userID ===
                                            request.userID
                                    );

                                const submittedByName =
                                    request.userName ||
                                    (submittedByUser
                                        ? `${submittedByUser.firstName} ${submittedByUser.lastName}`
                                        : `Gebruiker #${request.userID}`);

                                const submittedByEmail =
                                    request.userEmail ||
                                    submittedByUser?.email ||
                                    "";

                                return (
                                    <article
                                        key={
                                            request.requestID
                                        }
                                        className={`${glassCard} overflow-hidden`}
                                    >
                                        {/* REQUEST TOP */}

                                        <div className="p-5 sm:p-7">
                                            <div className="flex flex-col gap-6 xl:flex-row">
                                                {/* ========================================
                                                    REQUEST DETAILS
                                                ======================================== */}

                                                <div className="min-w-0 flex-1">
                                                    <div className="mb-4 flex flex-wrap items-center gap-2">
                                                        <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-500">
                                                            Request #
                                                            {
                                                                request.requestID
                                                            }
                                                        </span>

                                                        <span
                                                            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${statusClass(
                                                                request.statusID
                                                            )}`}
                                                        >
                                                            {
                                                                itLabel(request.statusName)
                                                            }
                                                        </span>

                                                        <span
                                                            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${priorityClass(
                                                                request.priority
                                                            )}`}
                                                        >
                                                            {
                                                                itLabel(request.priority)
                                                            }
                                                        </span>
                                                    </div>

                                                    <h3 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                                                        {
                                                            request.title
                                                        }
                                                    </h3>

                                                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-400">
                                                        {
                                                            request.description
                                                        }
                                                    </p>

                                                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                                                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                                            <p className="text-xs uppercase tracking-wide text-zinc-600">
                                                                {itLabel("Requester")}
                                                            </p>

                                                            <p className="mt-1 text-sm text-zinc-200">
                                                                {
                                                                    submittedByName
                                                                }
                                                            </p>

                                                            <p className="mt-1 break-all text-xs text-zinc-500">
                                                                {
                                                                    submittedByEmail
                                                                }
                                                            </p>
                                                        </div>

                                                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                                            <p className="text-xs uppercase tracking-wide text-zinc-600">
                                                                {itLabel("Logged by")}
                                                            </p>
                                                            <p className="mt-1 text-sm text-zinc-200">
                                                                {request.createdByName || (request.createdByUserID && request.createdByUserID !== request.userID
                                                                    ? `#${request.createdByUserID}`
                                                                    : submittedByName)}
                                                            </p>
                                                            <p className="mt-1 break-all text-xs text-zinc-500">
                                                                {request.createdByEmail || ((request.createdByUserID ?? request.userID) === request.userID ? submittedByEmail : "")}
                                                            </p>
                                                        </div>

                                                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                                            <p className="text-xs uppercase tracking-wide text-zinc-600">
                                                                Kategorie
                                                            </p>

                                                            <p className="mt-1 text-sm text-zinc-200">
                                                                {
                                                                    request.categoryName ??
                                                                    "Uncategorised"
                                                                }
                                                            </p>
                                                        </div>

                                                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                                            <p className="text-xs uppercase tracking-wide text-zinc-600">
                                                                Aangemeld op
                                                            </p>

                                                            <p className="mt-1 text-sm text-zinc-200">
                                                                {formatDateTime(
                                                                    request.createdDate
                                                                )}
                                                            </p>
                                                        </div>

                                                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                                            <p className="text-xs uppercase tracking-wide text-zinc-600">
                                                                Toegewys aan
                                                            </p>

                                                            <p className="mt-1 text-sm text-zinc-200">
                                                                {assignedUser
                                                                    ? `${assignedUser.firstName} ${assignedUser.lastName}`
                                                                    : "Nie toegeken nie"}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* CALENDAR STATUS */}

                                                    <div className="mt-4 rounded-2xl border border-blue-400/10 bg-blue-500/5 p-4">
                                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                            <div>
                                                                <p className="text-xs font-medium uppercase tracking-wide text-blue-300/70">
                                                                    Google Calendar
                                                                </p>

                                                                <p className="mt-1 text-sm text-zinc-300">
                                                                    {request.scheduledStart
                                                                        ? `${formatDateTime(
                                                                              request.scheduledStart
                                                                          )} â†’ ${formatDateTime(
                                                                              request.scheduledEnd
                                                                          )}`
                                                                        : "Geen afspraak beplan nie"}
                                                                </p>
                                                            </div>

                                                            {request.googleCalendarEventID && (
                                                                <span className="rounded-lg border border-green-400/10 bg-green-500/10 px-3 py-2 text-xs text-green-300">
                                                                    Kalenderafspraak gekoppel
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* ========================================
                                                    MANAGEMENT
                                                ======================================== */}

                                                <div className="w-full shrink-0 rounded-2xl border border-white/10 bg-black/20 p-5 xl:w-90">
                                                    <div className="mb-5">
                                                        <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-600">
                                                            Administrasie
                                                        </p>

                                                        <h4 className="mt-1 text-lg font-semibold">
                                                            Bestuur versoek
                                                        </h4>
                                                    </div>

                                                    <div className="space-y-4">
                                                        {/* STATUS */}

                                                        <div>
                                                            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                                                                Status
                                                            </label>

                                                            <select
                                                                value={
                                                                    request.statusID ?? 1
                                                                }
                                                                onChange={(
                                                                    event
                                                                ) =>
                                                                    updateRequest(
                                                                        request.requestID,
                                                                        "statusID",
                                                                        event
                                                                            .target
                                                                            .value
                                                                    )
                                                                }
                                                                className={
                                                                    selectClass
                                                                }
                                                            >
                                                                {statuses.length >
                                                                0 ? (
                                                                    statuses.map(
                                                                        (
                                                                            status
                                                                        ) => (
                                                                            <option
                                                                                key={
                                                                                    status.statusID
                                                                                }
                                                                                value={
                                                                                    status.statusID
                                                                                }
                                                                            >
                                                                                {
                                                                                    itLabel(status.statusName)
                                                                                }
                                                                            </option>
                                                                        )
                                                                    )
                                                                ) : (
                                                                    <>
                                                                        <option value="1">
                                                                            Aangemeld
                                                                        </option>

                                                                        <option value="2">
                                                                            Besig
                                                                        </option>

                                                                        <option value="3">
                                                                            Afgehandel
                                                                        </option>
                                                                    </>
                                                                )}
                                                            </select>
                                                        </div>

                                                        {/* PRIORITY */}

                                                        <div>
                                                            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                                                                Prioriteit
                                                            </label>

                                                            <select
                                                                value={
                                                                    request.priority
                                                                }
                                                                onChange={(
                                                                    event
                                                                ) =>
                                                                    updateRequest(
                                                                        request.requestID,
                                                                        "priority",
                                                                        event
                                                                            .target
                                                                            .value
                                                                    )
                                                                }
                                                                className={
                                                                    selectClass
                                                                }
                                                            >
                                                                <option value="Low">
                                                                    Laag
                                                                </option>

                                                                <option value="Medium">
                                                                    Medium
                                                                </option>

                                                                <option value="High">
                                                                    Hoog
                                                                </option>

                                                                <option value="Critical">
                                                                    Kritiek
                                                                </option>
                                                            </select>
                                                        </div>

                                                        {/* CATEGORY */}

                                                        <div>
                                                            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                                                                Kategorie
                                                            </label>

                                                            <select
                                                                value={
                                                                    request.categoryID ??
                                                                    ""
                                                                }
                                                                onChange={(
                                                                    event
                                                                ) =>
                                                                    updateRequest(
                                                                        request.requestID,
                                                                        "categoryID",
                                                                        event
                                                                            .target
                                                                            .value
                                                                    )
                                                                }
                                                                className={
                                                                    selectClass
                                                                }
                                                            >
                                                                <option value="">
                                                                    Geen kategorie
                                                                </option>

                                                                {categories.map(
                                                                    (
                                                                        category
                                                                    ) => (
                                                                        <option
                                                                            key={
                                                                                category.categoryID
                                                                            }
                                                                            value={
                                                                                category.categoryID
                                                                            }
                                                                        >
                                                                            {
                                                                                itLabel(category.categoryName)
                                                                            }
                                                                        </option>
                                                                    )
                                                                )}
                                                            </select>
                                                        </div>

                                                        {/* ASSIGNMENT */}

                                                        <div>
                                                            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                                                                Ken toe aan
                                                            </label>

                                                            <select
                                                                value={
                                                                    request.assignedTo ??
                                                                    ""
                                                                }
                                                                onChange={(
                                                                    event
                                                                ) =>
                                                                    updateRequest(
                                                                        request.requestID,
                                                                        "assignedTo",
                                                                        event
                                                                            .target
                                                                            .value
                                                                    )
                                                                }
                                                                className={
                                                                    selectClass
                                                                }
                                                            >
                                                                <option value="">
                                                                    Nie toegeken nie
                                                                </option>

                                                                {technicians.length >
                                                                    0 && (
                                                                    <optgroup label="Tegnici">
                                                                        {technicians.map(
                                                                            (
                                                                                technician
                                                                            ) => (
                                                                                <option
                                                                                    key={`tech-${technician.userID}`}
                                                                                    value={
                                                                                        technician.userID
                                                                                    }
                                                                                >
                                                                                    {
                                                                                        technician.firstName
                                                                                    }{" "}
                                                                                    {
                                                                                        technician.lastName
                                                                                    }
                                                                                </option>
                                                                            )
                                                                        )}
                                                                    </optgroup>
                                                                )}

                                                                {administrators.length >
                                                                    0 && (
                                                                    <optgroup label="Administrateurs">
                                                                        {administrators.map(
                                                                            (
                                                                                administrator
                                                                            ) => (
                                                                                <option
                                                                                    key={`admin-${administrator.userID}`}
                                                                                    value={
                                                                                        administrator.userID
                                                                                    }
                                                                                >
                                                                                    {
                                                                                        administrator.firstName
                                                                                    }{" "}
                                                                                    {
                                                                                        administrator.lastName
                                                                                    }
                                                                                </option>
                                                                            )
                                                                        )}
                                                                    </optgroup>
                                                                )}
                                                            </select>
                                                        </div>

                                                        {/* SCHEDULED START */}

                                                        <div>
                                                            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                                                                Beplande begintyd
                                                            </label>

                                                            <input
                                                                type="datetime-local"
                                                                value={toDateTimeLocal(
                                                                    request.scheduledStart
                                                                )}
                                                                onChange={(
                                                                    event
                                                                ) =>
                                                                    updateRequest(
                                                                        request.requestID,
                                                                        "scheduledStart",
                                                                        event
                                                                            .target
                                                                            .value
                                                                    )
                                                                }
                                                                className={
                                                                    inputClass
                                                                }
                                                            />
                                                        </div>

                                                        {/* SCHEDULED END */}

                                                        <div>
                                                            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                                                                Beplande eindtyd
                                                            </label>

                                                            <input
                                                                type="datetime-local"
                                                                value={toDateTimeLocal(
                                                                    request.scheduledEnd
                                                                )}
                                                                onChange={(
                                                                    event
                                                                ) =>
                                                                    updateRequest(
                                                                        request.requestID,
                                                                        "scheduledEnd",
                                                                        event
                                                                            .target
                                                                            .value
                                                                    )
                                                                }
                                                                className={
                                                                    inputClass
                                                                }
                                                            />
                                                        </div>

                                                        {/* CALENDAR ID */}

                                                        {request.googleCalendarEventID && (
                                                            <div className="rounded-xl border border-green-400/10 bg-green-500/5 p-3">
                                                                <p className="text-xs text-green-300">
                                                                    Google Calendar-afspraak gekoppel
                                                                </p>

                                                                <p className="mt-1 break-all text-[11px] text-zinc-600">
                                                                    {
                                                                        request.googleCalendarEventID
                                                                    }
                                                                </p>
                                                            </div>
                                                        )}

                                                        {/* SAVE */}

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                saveRequest(
                                                                    request
                                                                )
                                                            }
                                                            disabled={
                                                                savingID ===
                                                                request.requestID
                                                            }
                                                            className="w-full rounded-xl bg-white p-3.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            {savingID ===
                                                            request.requestID
                                                                ? "Besig om te stoorâ€¦"
                                                                : "Stoor veranderinge"}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* ========================================
                                                COMMENTS
                                            ======================================== */}

                                            <div className="mt-7 border-t border-white/10 pt-7">
                                                <div className="mb-5">
                                                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-600">
                                                        Kommunikasie
                                                    </p>

                                                    <h4 className="mt-1 text-lg font-semibold">
                                                        Kommentaar en vordering
                                                    </h4>

                                                    <p className="mt-1 text-sm text-zinc-500">
                                                        {
                                                            requestComments.length
                                                        }{" "}
                                                        comment
                                                        {requestComments.length ===
                                                        1
                                                            ? ""
                                                            : "s"}
                                                    </p>
                                                </div>

                                                {requestComments.length ===
                                                0 ? (
                                                    <div className="mb-5 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-zinc-600">
                                                        Daar is nog geen kommentaar op hierdie versoek nie.
                                                    </div>
                                                ) : (
                                                    <div className="mb-5 space-y-3">
                                                        {requestComments.map(
                                                            (
                                                                comment
                                                            ) => (
                                                                <div
                                                                    key={
                                                                        comment.commentID
                                                                    }
                                                                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                                                                >
                                                                    <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                                        <p className="text-sm font-medium text-zinc-200">
                                                                            {comment.user
                                                                                ? `${comment.user.firstName} ${comment.user.lastName}`
                                                                                : `Gebruiker #${comment.userID}`}
                                                                        </p>

                                                                        <p className="text-xs text-zinc-600">
                                                                            {formatDateTime(
                                                                                comment.createdDate
                                                                            )}
                                                                        </p>
                                                                    </div>

                                                                    <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-400">
                                                                        {
                                                                            comment.commentText
                                                                        }
                                                                    </p>
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                )}

                                                <div>
                                                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                                                        Voeg â€™n vorderingsnota by
                                                    </label>

                                                    <textarea
                                                        value={
                                                            commentText[
                                                                request
                                                                    .requestID
                                                            ] ??
                                                            ""
                                                        }
                                                        onChange={(
                                                            event
                                                        ) =>
                                                            setCommentText(
                                                                (
                                                                    current
                                                                ) => ({
                                                                    ...current,
                                                                    [request.requestID]:
                                                                        event
                                                                            .target
                                                                            .value,
                                                                })
                                                            )
                                                        }
                                                        placeholder="Voeg â€™n vorderingsnota byâ€¦"
                                                        rows={
                                                            3
                                                        }
                                                        className={`${inputClass} resize-none`}
                                                    />

                                                    <div className="mt-3 flex justify-end">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                addComment(
                                                                    request.requestID
                                                                )
                                                            }
                                                            disabled={
                                                                commentSavingID ===
                                                                request.requestID
                                                            }
                                                            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            {commentSavingID ===
                                                            request.requestID
                                                                ? "Besig om by te voegâ€¦"
                                                                : "Voeg kommentaar by"}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                );
                            }
                        )}
                    </div>
                </section>

                {/* ========================================
                    FOOTER
                ======================================== */}

                <footer className="mt-10 border-t border-white/10 pt-6">
                    <p className="text-center text-sm text-zinc-600">
                        Laerskool Tygerpoort Â· IT Report Â· Administrateur
                    </p>
                </footer>
            </div>
        </main>
    );
}
