import React from "react";
import { useAuth } from "../context/AuthContext";
import UserAccount from "../components/UserAccount"; // adjust path if needed

function Profile() {
    const { user, loading, logout } = useAuth();

    return (
        <UserAccount
            user={user}
            loading={loading}
            logout={logout}
        />
    );
}

export default Profile;