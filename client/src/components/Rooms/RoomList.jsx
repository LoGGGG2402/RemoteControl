import React, { useEffect, useState } from "react";
import { rooms } from "../../utils/api";
import RoomCard from "./RoomCard";
import { FaPlus, FaSpinner } from "react-icons/fa";

const RoomList = ({ user }) => {
    const [roomList, setRoomList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editingRoom, setEditingRoom] = useState(null);
    const [formData, setFormData] = useState({
        name: "",
        description: "",
    });

    useEffect(() => {
        fetchRooms();
    }, []);

    const fetchRooms = async () => {
        try {
            const response = await rooms.all();
            console.log(response);
            setRoomList(response.data);
        } catch (err) {
            setError("Failed to fetch rooms");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = async () => {
        try {
            await rooms.create(formData);
            fetchRooms();
            setShowModal(false);
            setFormData({ name: "", description: "" });
        } catch (err) {
            setError("Failed to create room");
            console.error(err);
        }
    };

    const handleUpdate = async () => {
        try {
            await rooms.update({ ...formData, id: editingRoom.id });
            fetchRooms();
            setShowModal(false);
            setEditingRoom(null);
            setFormData({ name: "", description: "" });
        } catch (err) {
            setError("Failed to update room");
            console.error(err);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this room?"))
            return;
        try {
            await rooms.delete(id);
            fetchRooms();
        } catch (err) {
            setError("Failed to delete room");
            console.error(err);
        }
    };

    return (
        <div className='container mx-auto p-4'>
            <div className='flex justify-between items-center mb-6'>
                <h1 className='text-2xl font-bold'>Rooms</h1>
                {user?.role === "admin" && (
                    <button
                        className='bg-blue-500 text-white p-2 rounded'
                        onClick={() => setShowModal(true)}
                    >
                        <FaPlus /> Add Room
                    </button>
                )}
            </div>

            {isLoading ? (
                <div className='flex justify-center'>
                    <FaSpinner className='animate-spin text-4xl' />
                </div>
            ) : error ? (
                <div className='text-red-500 text-center'>{error}</div>
            ) : (
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                    {roomList.map((room) => (
                        <RoomCard
                            key={room.id}
                            room={room}
                            onEdit={() => {
                                setEditingRoom(room);
                                setFormData({
                                    name: room.name,
                                    description: room.description,
                                });
                                setShowModal(true);
                            }}
                            onDelete={() => handleDelete(room.id)}
                            isAdmin={user?.role === "admin"}
                        />
                    ))}
                </div>
            )}

            {showModal && (
                <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center'>
                    <div className='bg-white p-6 rounded-lg w-96'>
                        <h2 className='text-xl font-bold mb-4'>
                            {editingRoom ? "Edit Room" : "Create Room"}
                        </h2>
                        <input
                            type='text'
                            placeholder='Room Name'
                            className='w-full p-2 mb-4 border rounded'
                            value={formData.name}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    name: e.target.value,
                                })
                            }
                        />
                        <textarea
                            placeholder='Description'
                            className='w-full p-2 mb-4 border rounded'
                            value={formData.description}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    description: e.target.value,
                                })
                            }
                        />
                        <div className='flex justify-end gap-2'>
                            <button
                                className='bg-gray-500 text-white p-2 rounded'
                                onClick={() => {
                                    setShowModal(false);
                                    setEditingRoom(null);
                                    setFormData({ name: "", description: "" });
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className='bg-blue-500 text-white p-2 rounded'
                                onClick={
                                    editingRoom ? handleUpdate : handleCreate
                                }
                            >
                                {editingRoom ? "Update" : "Create"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoomList;
