import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { rooms, applications as appsApi } from "../../utils/api";
import {
    FaSpinner,
    FaDesktop,
    FaCircle,
    FaMapMarkerAlt,
    FaUsers,
    FaDownload,
    FaFilter,
} from "react-icons/fa";
import ComputerCard from "./ComputerCard";
import UserManagementModal from "./UserManagementModal";

const RoomDetails = ({ user }) => {
    const { id } = useParams();
    const [room, setRoom] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [amount, setAmount] = useState({
        computers: 0,
        errors: 0,
        online: 0,
    });
    const [usersList, setUsersList] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedApp, setSelectedApp] = useState(null);
    const [availableApps, setAvailableApps] = useState([]);
    const [installedComputers, setInstalledComputers] = useState([]);
    const [installing, setInstalling] = useState(false);
    const [installError, setInstallError] = useState(null);
    const [installationResults, setInstallationResults] = useState({});

    const generatePlaceholders = (
        row_count,
        column_count,
        existingComputers
    ) => {
        const placeholders = [];
        for (let row = 0; row < row_count; row++) {
            for (let col = 0; col < column_count; col++) {
                // Check if there's a computer at this position
                const hasComputer = existingComputers?.some(
                    (c) => c.row_index === row && c.column_index === col
                );
                if (!hasComputer) {
                    placeholders.push({
                        row_index: row,
                        column_index: col,
                        isPlaceholder: true,
                    });
                }
            }
        }
        return placeholders;
    };

    useEffect(() => {
        const fetchRoom = async () => {
            try {
                const response = await rooms.get(id);
                setRoom(response.data);
                setAmount({
                    computers: response.data.computers.length,
                    errors: response.data.computers.filter(
                        (c) => c.error || false
                    ).length,
                    online: response.data.computers.filter(
                        (c) => c.online === 1
                    ).length,
                });
            } catch (err) {
                setError("Failed to fetch room details");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        const fetchUsers = async () => {
            try {
                const response = await rooms.getUsers(id);
                setUsersList(response.data || []);
            } catch (err) {
                console.error("Failed to fetch users:", err);
            }
        };

        fetchRoom();
        fetchUsers();
    }, [id]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [appsRes] = await Promise.all([appsApi.all()]);
                setAvailableApps(appsRes.data);
            } catch (err) {
                console.error("Failed to fetch applications:", err);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        // remove the previous installation results when changing the selected app
        setInstallationResults({});
        setInstallError(null);
        setInstalledComputers([]);

        const fetchInstalledComputers = async () => {
            if (!selectedApp) return;
            try {
                const response = await rooms.getComputersInstalled({
                    room_id: id,
                    application_id: selectedApp,
                });
                setInstalledComputers(response.data);
            } catch (err) {
                console.error("Failed to fetch installed computers:", err);
            }
        };
        fetchInstalledComputers();
    }, [selectedApp, id]);

    const handleUsersUpdate = async () => {
        const response = await rooms.getUsers(id);
        setUsersList(response.data || []);
    };

    const handleInstallApp = async () => {
        if (
            !selectedApp ||
            !window.confirm(
                "Install application on all computers in this room?"
            )
        )
            return;

        setInstalling(true);
        setInstallError(null);
        try {
            const resp = await rooms.installApplication({
                room_id: id,
                application_id: selectedApp,
                user_id: user.id,
            });

            // Store results mapped by computer_id
            const resultsMap = resp.data.reduce((acc, result) => {
                acc[result.computer_id] = result;
                return acc;
            }, {});
            setInstallationResults(resultsMap);

            // Refresh installed computers list
            const response = await rooms.getComputersInstalled({
                room_id: id,
                application_id: selectedApp,
            });
            setInstalledComputers(response.data);
        } catch (err) {
            setInstallError(
                err.response?.data || "Failed to install application"
            );
        } finally {
            setInstalling(false);
        }
    };

    if (loading) {
        return (
            <div className='flex justify-center items-center h-full'>
                <FaSpinner className='animate-spin text-4xl' />
            </div>
        );
    }

    if (error || !room) {
        return (
            <div className='text-red-500 text-center'>
                {error || "Room not found"}
            </div>
        );
    }

    return (
        <div className='container mx-auto p-4'>
            <div className='flex justify-between items-center mb-6'>
                <h1 className='text-3xl font-bold flex items-center gap-2 text-gray-800'>
                    <FaMapMarkerAlt className='text-blue-500' />
                    {room.name}
                </h1>
                {user.role === "admin" && (
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className='bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center gap-2'
                    >
                        <FaUsers /> Manage Users
                    </button>
                )}
            </div>

            <div className='bg-white p-6 rounded-lg shadow-md mb-6 hover:shadow-lg transition-shadow'>
                <div className='flex justify-between items-center text-gray-600'>
                    <div className='flex items-center gap-2'>
                        <div className='text-blue-500'>
                            <FaDesktop />
                        </div>
                        <span>
                            Size: {room.row_count}×{room.column_count}
                        </span>
                    </div>
                    <div className='flex items-center gap-2'>
                        <div className='text-gray-500'>
                            <FaDesktop />
                        </div>
                        <span>Computers: {room.computers?.length || 0}</span>
                    </div>
                    <div className='flex items-center gap-2'>
                        <FaCircle className='text-green-500' />
                        <span>Online: {amount.online}</span>
                    </div>
                    <div className='flex items-center gap-2'>
                        <FaCircle className='text-red-500' />
                        <span>Errors: {amount.errors}</span>
                    </div>
                </div>
            </div>

            <div className='bg-white p-6 rounded-lg shadow-md mb-6'>
                <div className='flex items-center gap-4 mb-4'>
                    <select
                        className='border rounded p-2 flex-grow'
                        value={selectedApp || ""}
                        onChange={(e) => setSelectedApp(e.target.value || null)}
                    >
                        <option value=''>Filter by application...</option>
                        {availableApps.map((app) => (
                            <option key={app.id} value={app.id}>
                                {app.name}
                            </option>
                        ))}
                    </select>
                    {selectedApp && (
                        <button
                            onClick={handleInstallApp}
                            disabled={installing}
                            className='bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center gap-2 disabled:bg-gray-400'
                        >
                            {installing ? (
                                <FaSpinner className='animate-spin' />
                            ) : (
                                <FaDownload />
                            )}
                            Install on All
                        </button>
                    )}
                </div>
                {installError && (
                    <div className='text-red-500 mb-4'>{installError}</div>
                )}

                <div
                    className='grid gap-3 border rounded-lg p-4 relative bg-gray-50'
                    style={{
                        gridTemplateColumns: `repeat(${room.column_count}, minmax(80px, 1fr))`,
                        gridTemplateRows: `repeat(${room.row_count}, minmax(80px, 1fr))`,
                    }}
                >
                    {[
                        ...(room.computers || []).map((c) => ({
                            ...c,
                            isPlaceholder: false,
                            hasSelectedApp: installedComputers.some(
                                (ic) => ic.id === c.id
                            ),
                            installationDate: installedComputers.find(
                                (ic) => ic.id === c.id
                            )?.installed_at,
                        })),
                        ...generatePlaceholders(
                            room.row_count,
                            room.column_count,
                            room.computers
                        ),
                    ].map((computer) => (
                        <div
                            key={`${computer.row_index}-${computer.column_index}`}
                            className='aspect-square border rounded-md relative bg-white hover:bg-gray-50 transition-all hover:shadow-md'
                            style={{
                                gridRow: computer.row_index + 1,
                                gridColumn: computer.column_index + 1,
                            }}
                        >
                            <ComputerCard
                                computer={computer}
                                isPlaceholder={computer.isPlaceholder}
                                position={`PC${computer.row_index}-${computer.column_index}`}
                                installationResult={
                                    !computer.isPlaceholder
                                        ? installationResults[computer.id]
                                        : null
                                }
                            />
                        </div>
                    ))}
                </div>
            </div>

            <UserManagementModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                roomId={id}
                existingUsers={usersList}
                onUsersUpdate={handleUsersUpdate}
            />
        </div>
    );
};

export default RoomDetails;
