import React, { useState, useEffect } from 'react';
import { FaDesktop, FaNetworkWired, FaList, FaTerminal, FaCircle, FaMapMarkerAlt, FaExclamationTriangle } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const ComputerCard = ({ computer }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isOnline, setIsOnline] = useState(false);
    const [isError, setIsError] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (computer) {
            setIsOnline(computer.online || false);
            setIsError(computer.error || false);
        }
    }, [computer]);

    const handleCardClick = () => {
        if (computer?.id) {
            navigate(`/computers/${computer.id}`);
        }
    };

    const { hostname, ip_address, mac_address, notes, errors } = computer || {};

    return (
        <div
            className='bg-white border rounded-lg p-3 shadow-sm hover:shadow-md transition-all relative flex flex-col justify-between h-full cursor-pointer'
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
                            <FaCircle
                                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${
                                    isOnline
                                        ? "text-green-500"
                                        : isError
                                        ? "text-red-500"
                                        : "text-gray-400"
                                } drop-shadow-sm`}
                            />
                        </div>
                        <div>
                            <h3 className='font-medium text-sm'>{hostname}</h3>
                            <div className='flex items-center gap-1 text-xs text-gray-500'>
                                <FaMapMarkerAlt className='w-3 h-3' />
                                {computer.room_name || 'Unassigned Room'}
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
                        <span className='text-gray-600 text-[11px]'>{mac_address}</span>
                    </div>
                    {notes && (
                        <div className='text-gray-500 text-[11px] italic'>
                            {notes}
                        </div>
                    )}
                    {errors && (
                        <div className='flex items-center gap-1 text-red-500 text-[11px]'>
                            <FaExclamationTriangle />
                            <span>{errors}</span>
                        </div>
                    )}
                </div>
            </div>

            {isHovered && (
                <div className='grid grid-cols-3 gap-1 w-full mt-3 pt-3 border-t'>
                    <button className='flex flex-col items-center p-2 hover:bg-gray-50 rounded border text-xs gap-1'>
                        <FaList className='text-gray-400 text-sm' />
                        <span>Tasks</span>
                    </button>
                    <button className='flex flex-col items-center p-2 hover:bg-gray-50 rounded border text-xs gap-1'>
                        <FaNetworkWired className='text-gray-400 text-sm' />
                        <span>Network</span>
                    </button>
                    <button className='flex flex-col items-center p-2 hover:bg-gray-50 rounded border text-xs gap-1'>
                        <FaTerminal className='text-gray-400 text-sm' />
                        <span>Apps</span>
                    </button>
                </div>
            )}
        </div>
    );
}

export default ComputerCard;