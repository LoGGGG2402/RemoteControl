import React, { useState, useEffect } from "react";

import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import LoginPage from "./components/Login";
import SideBar from "./components/SideBar";

import RoomList from "./components/Rooms/RoomList";
import RoomView from "./components/Rooms/RoomView";

import ComputerList from "./components/Computers/ComputersList";
import ComputerView from "./components/Computers/ComputerView";

import UserList from "./components/Users/UsersList";

function App() {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem("user"));
        if (user) {
            setUser(user);
        }
    }, []);

    return (
        <>
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
                                            <RoomList user={user} />
                                        ) : (
                                            <LoginPage />
                                        )
                                    }
                                />
                                <Route path='/login' element={<LoginPage />} />
                                <Route
                                    path='/users'
                                    element={<UserList user={user} />}
                                />
                                <Route
                                    path='/rooms'
                                    element={<RoomList user={user} />}
                                />
                                <Route
                                    path='/rooms/:id'
                                    element={<RoomView user={user} />}
                                />
                                <Route
                                    path='/computers'
                                    element={<ComputerList />}
                                />
                                <Route
                                    path='/computers/:id'
                                    element={<ComputerView />}
                                />
                            </Routes>
                        </div>
                    </div>
                </div>
            </Router>
        </>
    );
}

export default App;
