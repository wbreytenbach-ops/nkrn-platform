export interface RequestModel {
    requestID?: number;

    userID: number;

    title: string;

    description: string;

    priority: string;

    assignedTo?: string | null;

    createdDate?: string | null;

    completedDate?: string | null;

    categoryID: number;

    statusID: number;
}