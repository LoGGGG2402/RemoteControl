import React, { useState, useEffect } from "react";
import { computers, rooms } from "../../utils/api";
import { 
    FaSpinner, 
    FaDesktop, 
    FaSearch, 
    FaServer, 
    FaCircle, 
    FaExclamationTriangle,
    FaFilter 
} from "react-icons/fa";
import ComputerCard from "./ComputerCard";

const ComputersPage = ({ user }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [computersList, setComputersList] = useState([]);
    const [stats, setStats] = useState({
        total: 0,
        online: 0,
        errors: 0,
    });
    const [search, setSearch] = useState("");
    const [filters, setFilters] = useState({
        status: "all",
        roomId: "all"
    });
    const [roomsList, setRoomsList] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [computersRes, statsRes, roomsRes] = await Promise.all([
                    computers.all(),
                    computers.amount(),
                    rooms.all()
                ]);

                const computersWithRoomNames = computersRes.data.map(computer => ({
                    ...computer,
                    room_name: roomsRes.data.find(room => room.id === computer.room_id)?.name || 'Unassigned Room',
                    error_count: computer.error_count || 0
                }));

                setComputersList(computersWithRoomNames);
                setStats({
                    total: statsRes.data.amount,
                    online: statsRes.data.amount_online,
                    errors: statsRes.data.amount_error,
                });
                setRoomsList(roomsRes.data);
            } catch (err) {
                setError("Failed to fetch data");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const filteredComputers = computersList.filter(computer => {
        const matchesSearch = search === "" || 
            computer.hostname?.toLowerCase().includes(search.toLowerCase()) ||
            computer.ip_address?.toLowerCase().includes(search.toLowerCase()) ||
            computer.mac_address?.toLowerCase().includes(search.toLowerCase());

        const matchesStatus = 
            filters.status === "all" ||
            (filters.status === "online" && computer.online) ||
            (filters.status === "offline" && !computer.online) ||
            (filters.status === "error" && computer.error_count > 0);

        const matchesRoom = 
            filters.roomId === "all" ||
            computer.room_id?.toString() === filters.roomId;

        return matchesSearch && matchesStatus && matchesRoom;
    });

    if (loading) {
        return (
            <div className='flex justify-center items-center h-full'>
                <FaSpinner className='animate-spin text-4xl' />
            </div>
        );
    }

    if (error) {
        return <div className='text-red-500 text-center'>{error}</div>;
    }

    return (
        <div className='container mx-auto p-4'>
            <div className='flex justify-between items-center mb-6'>
                <h1 className='text-3xl font-bold flex items-center gap-2 text-gray-800'>
                    <FaDesktop className='text-blue-500' />
                    Computers
                </h1>
            </div>

            <div className='bg-white p-6 rounded-lg shadow-md mb-6'>
                <div className='flex flex-col md:flex-row gap-4 mb-4'>
                    <div className='flex-1'>
                        <div className='relative'>
                            <input
                                type="text"
                                placeholder="Search by hostname, IP, or MAC..."
                                className='w-full pl-10 pr-4 py-2 border rounded-lg'
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <FaSearch className='absolute left-3 top-3 text-gray-400' />
                        </div>
                    </div>
                    <div className='flex gap-2'>
                        <select 
                            className='border rounded-lg px-3 py-2'
                            value={filters.status}
                            onChange={(e) => setFilters(prev => ({...prev, status: e.target.value}))}
                        >
                            <option value="all">All Status</option>
                            <option value="online">Online</option>
                            <option value="offline">Offline</option>
                            <option value="error">Error</option>
                        </select>
                        <select
                            className='border rounded-lg px-3 py-2'
                            value={filters.roomId}
                            onChange={(e) => setFilters(prev => ({...prev, roomId: e.target.value}))}
                        >
                            <option value="all">All Rooms</option>
                            {roomsList.map(room => (
                                <option key={room.id} value={room.id}>
                                    {room.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mt-6'>
                    <div className='bg-gray-50 rounded-xl p-4 flex items-center justify-between'>
                        <div className='flex items-center gap-3'>
                            <div className='bg-blue-100 p-3 rounded-lg'>
                                <FaServer className='text-xl text-blue-600' />
                            </div>
                            <div>
                                <p className='text-sm text-gray-600'>Total Computers</p>
                                <p className='text-2xl font-semibold text-gray-800'>{stats.total}</p>
                            </div>
                        </div>
                    </div>

                    <div className='bg-green-50 rounded-xl p-4 flex items-center justify-between'>
                        <div className='flex items-center gap-3'>
                            <div className='bg-green-100 p-3 rounded-lg'>
                                <FaCircle className='text-xl text-green-600' />
                            </div>
                            <div>
                                <p className='text-sm text-gray-600'>Online</p>
                                <div className='flex items-end gap-2'>
                                    <p className='text-2xl font-semibold text-gray-800'>{stats.online}</p>
                                    <p className='text-sm text-gray-500 mb-1'>
                                        ({Math.round((stats.online / stats.total) * 100) || 0}%)
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className='bg-red-50 rounded-xl p-4 flex items-center justify-between'>
                        <div className='flex items-center gap-3'>
                            <div className='bg-red-100 p-3 rounded-lg'>
                                <FaExclamationTriangle className='text-xl text-red-600' />
                            </div>
                            <div>
                                <p className='text-sm text-gray-600'>Errors</p>
                                <div className='flex items-end gap-2'>
                                    <p className='text-2xl font-semibold text-gray-800'>{stats.errors}</p>
                                    <p className='text-sm text-gray-500 mb-1'>
                                        ({Math.round((stats.errors / stats.total) * 100) || 0}%)
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'>
                {filteredComputers.map((computer) => (
                    <div key={computer.id} className='aspect-square'>
                        <ComputerCard
                            computer={computer}
                            position={`PC${computer.id}`}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ComputersPage;
