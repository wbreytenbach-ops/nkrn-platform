"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
    const router = useRouter();

    function handleLogout() {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        router.push("/login");
    }

    return (
        <button
            type="button"
            onClick={handleLogout}
            className="bg-red-500/15 hover:bg-red-500/25 text-red-300 px-5 py-3 rounded-xl transition"
        >
            Logout
        </button>
    );
}