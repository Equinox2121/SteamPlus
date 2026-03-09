import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';

function App() {

    // This creates the variable 'authenticated' and the function 'setAuthenticated'
    const [authenticated, setAuthenticated] = useState(false);

    return (

        // <Router> - Working on this
        //     <Routes>
        //         {/* Redirect base route based on auth state */}
        //         <Route
        //             path="/"
        //             element={<Navigate to = {authenticated ? "/home" : "/login"} replace />}
        //         />

        //         {/* Login Route */}
        //         <Route
        //             path="/login"
        //             element={authenticated ? (<Navigate to="/home" replace />) : (
        //             <Login setAuthenticated={setAuthenticated} />
        //             )
        //         }
        //         />

        //         {/* Register Route */}
        //         <Route
        //         path="/register"
        //         element={
        //             authenticated ? (
        //             <Navigate to="/map" replace />
        //             ) : (
        //             <Register />
        //             )
        //         }
        //         />

        //         {/* Home Page Route */}
        //         <Route
        //             path="/home"
        //             element={
        //                 authenticated ? (<MapPage setAuthenticated={setAuthenticated} /> ) : (
        //             <Navigate to="/login" replace />
        //             )
        //         }
        //         />
        //     </Routes>
        // </Router>


        <div style={{ textAlign: 'center', marginTop: '50px' }}>
        <h1>CS330 Project Baseline</h1>
        <p>Your Vite + React app is running correctly!</p>
        </div>


    );
}
export default App;