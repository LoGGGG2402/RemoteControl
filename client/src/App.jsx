import React, { useState, useEffect } from "react";

import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import LoginPage from "./components/Login";
import SideBar from "./components/SideBar";

import RoomsPage from "./components/Rooms/RoomsPage";
import RoomDetails from "./components/Rooms/RoomDetails";

import ComputersPage from "./components/Computers/ComputersPage";
import ComputerDetails from "./components/Computers/ComputerDetails";

import UsersPage from "./components/Users/UsersPage";
import ApplicationsPage from "./components/Applications/ApplicationsPage";
import FilesPage from "./components/Files/FilesPage";

import { WebSocketProvider } from './contexts/WebSocketContext';

function App() {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem("user"));
        if (user) {
            setUser(user);
        }
    }, []);

    return (
        <WebSocketProvider>
            <Router>
                <div className='min-h-screen bg-gray-100 flex'>
                    <SideBar user={user} />
                    <div className='flex-grow ml-64'>
                        <div className='container mx-auto px-4 py-8'>
                            <Routes>
                                <Route
                                    path='/'
                                    element={
                                        user ? (
                                            <RoomsPage user={user} />
                                        ) : (
                                            <LoginPage />
                                        )
                                    }
                                />
                                <Route path='/login' element={<LoginPage />} />
                                <Route
                                    path='/users'
                                    element={<UsersPage user={user} />}
                                />
                                <Route
                                    path='/rooms'
                                    element={<RoomsPage user={user} />}
                                />
                                <Route
                                    path='/rooms/:id'
                                    element={<RoomDetails user={user} />}
                                />
                                <Route
                                    path='/computers'
                                    element={<ComputersPage user={user} />}
                                />
                                <Route
                                    path='/computers/:id'
                                    element={<ComputerDetails user={user} />}
                                />
                                <Route
                                    path='/applications'
                                    element={<ApplicationsPage user={user} />}
                                />
                                <Route
                                    path='/files'
                                    element={<FilesPage user={user} />}
                                />
                            </Routes>
                        </div>
                    </div>
                </div>
            </Router>
        </WebSocketProvider>
    );
}

export default App;
