import React, { useState, useEffect } from "react";
import {
    FaDesktop,
    FaDoorOpen,
    FaSignOutAlt,
    FaSignInAlt,
    FaUsers,
    FaGithub, // Added for footer
    FaBox, // Add this import
} from "react-icons/fa";
import { Link } from "react-router-dom";
import { auth, users, computers, rooms } from "../utils/api";
import { Tooltip } from "react-tooltip"; // You'll need to install this package

const SideBar = ({ user }) => {
    const [amountOfRooms, setAmountOfRooms] = useState(0);
    const [computerStats, setComputerStats] = useState({
        amount: 0,
        amount_error: 0,
        amount_online: 0,
    });
    const [amountOfUsers, setAmountOfUsers] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeMenuItem, setActiveMenuItem] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                if (user) {
                    const roomsList = await rooms.amount();
                    setAmountOfRooms(roomsList.data);
                    if (user.role === "admin") {
                        const computersList = await computers.amount();
                        setComputerStats(computersList.data);
                        const usersList = await users.amount();
                        setAmountOfUsers(usersList.data);
                    }
                }
                setLoading(false);
            } catch (err) {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    const menuItems = user
        ? [
              // { name: "Dashboard", icon: FaHome, key: "dashboard" },
              {
                  name: "Rooms",
                  icon: FaDoorOpen,
                  key: "rooms",
                  count: amountOfRooms,
              },
              user.role === "admin" && {
                  name: "Computers",
                  icon: FaDesktop,
                  key: "computers",
                  count: `${computerStats.amount_online}/${computerStats.amount}`,
              },
              user.role === "admin" && {
                  name: "Users",
                  icon: FaUsers,
                  key: "users",
                  count: amountOfUsers,
              },
              user.role === "admin" && {
                  name: "Applications",
                  icon: FaBox,
                  key: "applications",
              },
              // { name: "Settings", icon: FaCog, key: "settings" },
              { name: "Logout", icon: FaSignOutAlt, key: "logout" },
          ]
        : [{ name: "Login", icon: FaSignInAlt, key: "login" }];

    const handleMenuItemClick = async (key) => {
        if (key === "logout") {
            await handleLogout();
            return;
        }

        if (typeof setActiveMenuItem === "function") {
            setActiveMenuItem(key);
        }
    };

    const handleLogout = async () => {
        try {
            await auth.logout();
            // Clear any stored user data/tokens
            localStorage.removeItem("token");
            document.cookie =
                "user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            // Force page refresh to clear React state
            window.location.href = "/login";
        } catch (error) {
            setError("Logout failed. Please try again.");
        }
    };

    const Logo = () => (
        <div className='flex items-center justify-center py-6 border-b border-gray-700'>
            <img
                src='src/assets/react.svg'
                alt='Logo'
                className='h-12 w-12 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-200'
            />
            <span className='ml-3 text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent'>
                Remotly
            </span>
        </div>
    );

    const LoadingSpinner = () => (
        <div className='flex items-center justify-center h-screen'>
            <div className='relative'>
                <div className='w-16 h-16 border-4 border-blue-200 border-solid rounded-full animate-spin'>
                    <div className='absolute top-0 left-0 w-full h-full border-t-4 border-blue-500 rounded-full animate-pulse'></div>
                </div>
            </div>
        </div>
    );

    if (loading) return <LoadingSpinner />;
    if (error)
        return (
            <div className='flex items-center justify-center h-screen text-red-500'>
                {error}
            </div>
        );

    return (
        <div className='bg-gray-900 text-white h-screen w-64 fixed left-0 top-0 flex flex-col shadow-xl'>
            <Logo />

            <nav className='flex-1 p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900'>
                <ul className='space-y-2'>
                    {menuItems.filter(Boolean).map((item) => (
                        <li key={item.key}>
                            <Link
                                to={`/${item.key}`}
                                onClick={() => handleMenuItemClick(item.key)}
                                className={`group flex items-center w-full p-3 rounded-lg transition-all duration-200 ${
                                    activeMenuItem === item.key
                                        ? "bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg transform scale-105"
                                        : "hover:bg-gray-800 hover:transform hover:translate-x-1"
                                }`}
                                data-tooltip-id={`tooltip-${item.key}`}
                                data-tooltip-content={item.name}
                            >
                                <item.icon
                                    className={`w-5 h-5 mr-3 transition-colors duration-200 ${
                                        activeMenuItem === item.key
                                            ? "text-white"
                                            : "text-gray-400 group-hover:text-white"
                                    }`}
                                />
                                <span className='font-medium'>{item.name}</span>
                                {item.count !== undefined && (
                                    <span className='ml-auto px-2.5 py-0.5 bg-blue-500 bg-opacity-20 text-blue-300 text-xs font-medium rounded-full'>
                                        {item.count}
                                    </span>
                                )}
                            </Link>
                            <Tooltip id={`tooltip-${item.key}`} place='right' />
                        </li>
                    ))}
                </ul>
            </nav>

            <footer className='p-4 border-t border-gray-700'>
                <div className='flex items-center justify-between text-gray-400 text-sm'>
                    <span>© 2024 Remotly</span>
                    <a
                        href='https://github.com/LoGGGG2402'
                        target='_blank'
                        rel='noopener noreferrer'
                        className='hover:text-white transition-colors duration-200'
                    >
                        <FaGithub className='w-5 h-5' />
                    </a>
                </div>
            </footer>
        </div>
    );
};

export default SideBar;
