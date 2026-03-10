import React, { useEffect, useState } from 'react';

//this is an Example Steam Login button and should be replaced

function App() {
    const [user, setUser] = useState(null);

    const fetchUser = () => {
        fetch("http://localhost:5000/user", { credentials: "include" })
            .then(res => res.json())
            .then(data => {
                if (data.loggedIn) setUser(data.username);
            })
            .catch(err => console.error(err));
    };

    useEffect(() => {

        fetchUser();

        const timer = setTimeout(fetchUser, 100);
        return () => clearTimeout(timer);
    }, []);

    const steamLogin = () => {
        window.location.href = "http://localhost:5000/auth/steam";
    };

    return (
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
            {user ? (
                <p>Welcome, {user}!</p>
            ) : (
                <button
                    onClick={steamLogin}
                    style={{
                        padding: "12px 20px",
                        fontSize: "18px",
                        cursor: "pointer",
                        borderRadius: "6px",
                        backgroundColor: "#171a21",
                        color: "white",
                        border: "none"
                    }}
                >
                    Login with Steam
                </button>
            )}
        </div>
    );
}

export default App;