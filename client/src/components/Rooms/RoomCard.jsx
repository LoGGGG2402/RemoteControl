import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { rooms } from "../../utils/api";
import { FaEdit, FaTrash } from "react-icons/fa";

const RoomCard = ({ room, onEdit, onDelete, isAdmin }) => {
    const { id, name, description } = room;
    const navigate = useNavigate();
    const [amount, setAmount] = useState({
        computers: 0,
        errors: 0,
        online: 0,
    });

    useEffect(() => {
        const fetchAmount = async () => {
            const response = await rooms.amountComputers(id);
            const amount = {
                computers: response.data.amount,
                errors: response.data.amount_error,
                online: response.data.amount_online,
            };

            setAmount(amount);
        };
        fetchAmount();
    }, [id]);

    const handleCardClick = (e) => {
        // Don't navigate if clicking edit/delete buttons
        if (e.target.closest("button")) return;
        navigate(`/rooms/${id}`);
    };

    return (
        <div
            className='border rounded-lg p-6 shadow-sm hover:shadow-lg transition-all bg-white'
            onClick={handleCardClick}
        >
            <div className='flex justify-between items-start mb-3'>
                <h3 className='text-xl font-semibold'>{name}</h3>
                {isAdmin && (
                    <div className='flex gap-3'>
                        <button
                            onClick={() => onEdit()}
                            className='text-blue-500 hover:text-blue-700 transition-colors p-1 rounded-full hover:bg-blue-50'
                        >
                            <FaEdit />
                        </button>
                        <button
                            onClick={() => onDelete()}
                            className='text-red-500 hover:text-red-700 transition-colors p-1 rounded-full hover:bg-red-50'
                        >
                            <FaTrash />
                        </button>
                    </div>
                )}
            </div>
            <p className='text-gray-600 mb-6'>{description}</p>
            <div className='flex justify-between text-sm text-gray-500'>
                <span className='px-3 py-1 bg-gray-50 rounded-full'>
                    Computers: {amount.computers}
                </span>
                <span className='px-3 py-1 bg-green-50 rounded-full'>
                    Online: {amount.online}
                </span>
                <span className='px-3 py-1 bg-red-50 rounded-full'>
                    Errors: {amount.errors}
                </span>
            </div>
        </div>
    );
};

export default RoomCard;
