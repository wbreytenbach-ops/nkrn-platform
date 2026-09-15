import { RequestModel } from "@/types/request";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ========================================
// TYPES
// ========================================

export interface Category {
    categoryID: number;
    categoryName: string;
}

export interface Status {
    statusID: number;
    statusName: string;
}

export interface RequesterOption {
    userID: number;
    firstName: string;
    lastName: string;
    email: string;
}

export interface CreateRequestInput {
    title: string;
    description: string;
    priority: string;
    categoryID: number;
    requestedForUserID?: number;
}

export class RequestSubmissionError extends Error {
    constructor(public readonly status: number) {
        super(`Failed to create request. Status: ${status}`);
        this.name = "RequestSubmissionError";
    }
}

// ========================================
// GET JWT TOKEN
// ========================================

function getToken(): string | null {
    if (typeof window === "undefined") {
        return null;
    }

    return localStorage.getItem("token");
}

// ========================================
// CREATE AUTH HEADERS
// ========================================

function getAuthHeaders(): HeadersInit {
    const token = getToken();

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
// CREATE REQUEST
// ========================================

export async function createRequest(
    request: CreateRequestInput
): Promise<RequestModel> {
    const response = await fetch(
        `${API_URL}/api/Requests`,
        {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(request),
        }
    );

    if (!response.ok) {
        throw new RequestSubmissionError(response.status);
    }

    return response.json();
}

// Admin-only endpoint; returns just the staff details needed for this selection.
export async function getRequesters(): Promise<RequesterOption[]> {
    const response = await fetch(`${API_URL}/api/Requests/requesters`, {
        headers: getAuthHeaders(),
        cache: "no-store",
    });
    if (!response.ok) throw new Error("Unable to load requesters.");
    return response.json();
}

// ========================================
// GET ALL REQUESTS
// TECHNICIAN + ADMIN ONLY
// ========================================

export async function getRequests(): Promise<
    RequestModel[]
> {
    const response = await fetch(
        `${API_URL}/api/Requests`,
        {
            method: "GET",
            headers: getAuthHeaders(),
            cache: "no-store",
        }
    );

    if (!response.ok) {
        throw new Error(
            `Failed to fetch requests. Status: ${response.status}`
        );
    }

    return response.json();
}

// ========================================
// GET REQUESTS FOR ONE USER
// ========================================

export async function getUserRequests(
    userID: number
): Promise<RequestModel[]> {
    const response = await fetch(
        `${API_URL}/api/Requests/user/${userID}`,
        {
            method: "GET",
            headers: getAuthHeaders(),
            cache: "no-store",
        }
    );

    if (!response.ok) {
        throw new Error(
            `Failed to fetch user requests. Status: ${response.status}`
        );
    }

    return response.json();
}

// ========================================
// GET CATEGORIES
// TECHNICIAN + ADMIN
// ========================================

export async function getCategories(): Promise<
    Category[]
> {
    const response = await fetch(
        `${API_URL}/api/Categories`,
        {
            method: "GET",
            headers: getAuthHeaders(),
            cache: "no-store",
        }
    );

    if (!response.ok) {
        throw new Error(
            `Failed to fetch categories. Status: ${response.status}`
        );
    }

    return response.json();
}

// ========================================
// GET STATUSES
// ========================================

export async function getStatuses(): Promise<
    Status[]
> {
    const response = await fetch(
        `${API_URL}/api/Statuses`,
        {
            method: "GET",
            headers: getAuthHeaders(),
            cache: "no-store",
        }
    );

    if (!response.ok) {
        throw new Error(
            `Failed to fetch statuses. Status: ${response.status}`
        );
    }

    return response.json();
}
