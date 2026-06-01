import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProfileSettings from './components/ProfileSettings';
import Login from './components/Login';

const PrivateRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    return token ? children : <Navigate to="/login" />;
};

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/profile-settings" element={
                    <PrivateRoute>
                        <ProfileSettings />
                    </PrivateRoute>
                } />
            </Routes>
        </Router>
    );
}

export default App;s