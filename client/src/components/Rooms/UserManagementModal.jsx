import React, { useState, useEffect } from "react";
import { FaUserPlus, FaUserMinus, FaEnvelope, FaUserTag } from "react-icons/fa";
import { users, rooms } from "../../utils/api";

const UserManagementModal = ({
    isOpen,
    onClose,
    roomId,
    existingUsers,
    onUsersUpdate,
}) => {
    const [allUsers, setAllUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState("");
    const [selectedPermissions, setSelectedPermissions] = useState({
        can_view: true,
        can_manage: false,
    });

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await users.all();
                setAllUsers(response.data || []);
            } catch (err) {
                console.error("Failed to fetch users:", err);
            }
        };

        if (isOpen) {
            fetchUsers();
        }
    }, [isOpen]);

    const handleAddUser = async () => {
        if (!selectedUser) return;
        try {
            await rooms.addUser({
                room_id: roomId,
                user_id: selectedUser,
                ...selectedPermissions,
            });
            onUsersUpdate();
            setSelectedUser("");
            setSelectedPermissions({ can_view: true, can_manage: false });
        } catch (err) {
            console.error("Failed to add user:", err);
        }
    };

    const handleRemoveUser = async (userId) => {
        try {
            await rooms.removeUser({ room_id: roomId, user_id: userId });
            onUsersUpdate();
        } catch (err) {
            console.error("Failed to remove user:", err);
        }
    };

    if (!isOpen) return null;

    return (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
            <div className='bg-white rounded-lg p-6 w-full max-w-3xl'>
                <h2 className='text-xl font-semibold mb-4'>
                    Manage Room Users
                </h2>

                <div className='flex gap-4 mb-4'>
                    <select
                        value={selectedUser}
                        onChange={(e) => setSelectedUser(e.target.value)}
                        className='border rounded p-2 flex-grow'
                    >
                        <option value=''>Select a user to add...</option>
                        {allUsers
                            .filter(
                                (u) =>
                                    !existingUsers.find((ru) => ru.id === u.id)
                            )
                            .map((user) => (
                                <option key={user.id} value={user.id}>
                                    {user.full_name} ({user.email})
                                </option>
                            ))}
                    </select>
                    <div className='flex items-center gap-4'>
                        <label className='flex items-center gap-2'>
                            <input
                                type='checkbox'
                                checked={selectedPermissions.can_view}
                                onChange={(e) =>
                                    setSelectedPermissions((prev) => ({
                                        ...prev,
                                        can_view: e.target.checked,
                                    }))
                                }
                            />
                            Can View
                        </label>
                        <label className='flex items-center gap-2'>
                            <input
                                type='checkbox'
                                checked={selectedPermissions.can_manage}
                                onChange={(e) =>
                                    setSelectedPermissions((prev) => ({
                                        ...prev,
                                        can_manage: e.target.checked,
                                    }))
                                }
                            />
                            Can Manage
                        </label>
                    </div>
                    <button
                        onClick={handleAddUser}
                        className='bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center gap-2'
                    >
                        <FaUserPlus /> Add User
                    </button>
                </div>

                <div className='space-y-2 max-h-96 overflow-y-auto'>
                    {existingUsers.map((user) => (
                        <div
                            key={user.id}
                            className='flex justify-between items-center p-3 border rounded hover:bg-gray-50'
                        >
                            <div className='space-y-1'>
                                <div className='font-medium'>
                                    {user.full_name}
                                </div>
                                <div className='flex items-center gap-4 text-sm text-gray-600'>
                                    <span className='flex items-center gap-1'>
                                        <FaEnvelope className='text-gray-400' />
                                        {user.email}
                                    </span>
                                    <span className='flex items-center gap-1'>
                                        <FaUserTag className='text-gray-400' />
                                        {user.role}
                                    </span>
                                </div>
                                <div className='text-sm'>
                                    <span className='text-blue-500 mr-3'>
                                        {user.can_view ? "✓ Can view" : ""}
                                    </span>
                                    <span className='text-green-500'>
                                        {user.can_manage ? "✓ Can manage" : ""}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => handleRemoveUser(user.id)}
                                className='text-red-500 hover:text-red-600'
                            >
                                <FaUserMinus />
                            </button>
                        </div>
                    ))}
                </div>

                <div className='flex justify-end mt-6'>
                    <button
                        onClick={onClose}
                        className='bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600'
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserManagementModal;
