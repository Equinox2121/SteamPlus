import React, {useEffect, useState} from 'react';
import { Navigate } from 'react-router-dom';

function Login() {

    const [user, setUser] = useState(null);


    const fetchUser = () => {
        fetch("http://localhost:5000/user", { credentials: "include" })
            .then(res => res.json())
            .then(data => {
                if (data.loggedIn) {
                    setUser(data.username);
                } else {
                    setUser(null);
                }
            })
            .catch(err => console.error(err));
    };

    useEffect(() => {

        fetchUser();

        const timer = setTimeout(fetchUser, 100);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div style={{ padding: '20px' }}>
            <h2>Login Page</h2>
            {user ? (
                <Navigate to="/home" replace />
            ) : (
                <a
                    href="http://localhost:5000/auth/steam"
                    style={{ display: "inline-block" }}
                >
                    <img
                        src="https://community.fastly.steamstatic.com/public/shared/images/signinthroughsteam/sits_landing.png"
                        alt="Sign in through Steam"
                        style={{ height: "48px" }}
                    />
                </a>
            )}
        </div>
    );
}

export default Login; 