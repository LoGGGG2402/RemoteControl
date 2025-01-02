import React, { useState, useEffect } from "react";
import {
    FaDesktop,
    FaNetworkWired,
    FaList,
    FaTerminal,
    FaCircle,
    FaMapMarkerAlt,
    FaExclamationTriangle,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useWebSocket } from '../../contexts/WebSocketContext';

const ComputerCard = ({ computer }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isOnline, setIsOnline] = useState(computer?.online || false);
    const navigate = useNavigate();
    const { socket } = useWebSocket();
    const errorCount = computer?.error_count || 0;

    useEffect(() => {
        if (computer) {
            setIsOnline(computer.online || false);
        }
    }, [computer]);

    useEffect(() => {
        if (!socket) return;

        const handleComputerStatus = (data) => {
            try {
                const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
                if (parsedData.type === 'computer_status' && parsedData.computer_id === computer.id) {
                    setIsOnline(parsedData.online);
                }
            } catch (error) {
                console.error('Error handling computer status:', error);
            }
        };

        socket.addEventListener('message', handleComputerStatus);
        return () => socket.removeEventListener('message', handleComputerStatus);
    }, [socket, computer?.id]);

    const handleCardClick = () => {
        if (computer?.id) {
            navigate(`/computers/${computer.id}`);
        }
    };

    const handleButtonClick = (tab) => (e) => {
        e.stopPropagation();
        if (computer?.id) {
            navigate(`/computers/${computer.id}`, {
                state: { activeTab: tab },
            });
        }
    };

    const { hostname, ip_address, mac_address, notes } = computer || {};

    return (
        <div
            className={`bg-white border rounded-lg p-3 shadow-sm hover:shadow-md transition-all relative flex flex-col justify-between h-full cursor-pointer`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleCardClick}
        >
            <div className='flex flex-col gap-2'>
                <div className='flex items-start justify-between'>
                    <div className='flex items-center gap-2'>
                        <div className='relative'>
                            <div className='w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center'>
                                <FaDesktop className='text-xl text-blue-500' />
                            </div>
                            <div className='absolute -bottom-0.5 -right-0.5'>
                                <FaCircle
                                    className={`w-2.5 h-2.5 ${
                                        isOnline ? "text-green-500" : "text-gray-400"
                                    } drop-shadow-sm`}
                                />
                            </div>
                            {errorCount > 0 && (
                                <span className='absolute -top-1 left-0 bg-red-500 text-white text-[8px] rounded-full w-3 h-3 flex items-center justify-center'>
                                    {errorCount}
                                </span>
                            )}
                        </div>
                        <div>
                            <h3 className='font-medium text-sm'>{hostname}</h3>
                            <div className='flex items-center gap-1 text-xs text-gray-500'>
                                <FaMapMarkerAlt className='w-3 h-3' />
                                {computer?.room_name || "Unassigned Room"}
                            </div>
                        </div>
                    </div>
                </div>

                <div className='flex flex-col gap-1.5 text-xs'>
                    <div className='flex items-center gap-1'>
                        <FaNetworkWired className='w-3 h-3 text-gray-400' />
                        <span className='text-gray-600'>{ip_address}</span>
                    </div>
                    <div className='flex items-center gap-1'>
                        <FaNetworkWired className='w-3 h-3 text-gray-400' />
                        <span className='text-gray-600 text-[11px]'>
                            {mac_address}
                        </span>
                    </div>
                    {notes && (
                        <div className='text-gray-500 text-[11px] italic'>
                            {notes}
                        </div>
                    )}
                </div>
            </div>

            {isHovered && (
                <div className='grid grid-cols-3 gap-1 w-full mt-3 pt-3 border-t'>
                    <button
                        className='flex flex-col items-center p-2 hover:bg-gray-50 rounded border text-xs gap-1'
                        onClick={handleButtonClick("applications")}
                    >
                        <FaTerminal className='text-gray-400 text-sm' />
                        <span>Apps</span>
                    </button>
                    <button
                        className={`flex flex-col items-center p-2 rounded border text-xs gap-1 ${
                            !isOnline
                                ? "opacity-50 cursor-not-allowed"
                                : "hover:bg-gray-50"
                        }`}
                        onClick={
                            isOnline
                                ? handleButtonClick("processes")
                                : undefined
                        }
                        disabled={!isOnline}
                    >
                        <FaList className='text-gray-400 text-sm' />
                        <span>Tasks</span>
                    </button>
                    <button
                        className={`flex flex-col items-center p-2 rounded border text-xs gap-1 ${
                            !isOnline
                                ? "opacity-50 cursor-not-allowed"
                                : "hover:bg-gray-50"
                        }`}
                        onClick={
                            isOnline ? handleButtonClick("network") : undefined
                        }
                        disabled={!isOnline}
                    >
                        <FaNetworkWired className='text-gray-400 text-sm' />
                        <span>Network</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default ComputerCard;
