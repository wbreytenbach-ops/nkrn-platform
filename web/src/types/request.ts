export interface RequestModel {
    requestID?: number;

    userID: number;

    createdByUserID?: number | null;
    userName?: string | null;
    userEmail?: string | null;
    createdByName?: string | null;
    createdByEmail?: string | null;

    title: string;

    description: string;

    priority: string;

    assignedTo?: number | null;

    createdDate?: string | null;

    completedDate?: string | null;

    categoryID: number;

    statusID: number;
}
