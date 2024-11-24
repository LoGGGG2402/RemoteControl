import React, { useState, useEffect } from "react";
import { rooms } from "../../utils/api";
import { FaEdit, FaTrash } from "react-icons/fa";

const RoomCard = ({ room, onEdit, onDelete, isAdmin }) => {
    const { id, name, description } = room;
    const [amount, setAmount] = useState({
        computers: 0,
        errors: 0,
        online: 0,
    });

    useEffect(() => {
        const fetchAmount = async () => {
            const response = await rooms.amountComputers(id);
            console.log(response);
            // setAmount(data);
        };
        fetchAmount();
    }, [id]);

    return (
        <div className='border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow'>
            <div className='flex justify-between items-start mb-2'>
                <h3 className='text-xl font-semibold'>{name}</h3>
                {isAdmin && (
                    <div className='flex gap-2'>
                        <button
                            onClick={() => onEdit()}
                            className='text-blue-500 hover:text-blue-700'
                        >
                            <FaEdit />
                        </button>
                        <button
                            onClick={() => onDelete()}
                            className='text-red-500 hover:text-red-700'
                        >
                            <FaTrash />
                        </button>
                    </div>
                )}
            </div>
            <p className='text-gray-600 mb-4'>{description}</p>
            <div className='flex justify-between text-sm text-gray-500'>
                <span>Computers: {amount.computers}</span>
                <span>Online: {amount.online}</span>
                <span>Errors: {amount.errors}</span>
            </div>
        </div>
    );
};

export default RoomCard;
