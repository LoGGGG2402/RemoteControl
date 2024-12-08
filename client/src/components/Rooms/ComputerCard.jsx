import React, { useState, useEffect } from 'react';
import { FaDesktop, FaNetworkWired, FaList, FaTerminal, FaCircle, FaMemory, FaMicrochip, FaHdd, FaPlus } from 'react-icons/fa';

const ComputerCard = ({ computer, isPlaceholder, position }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isOnline, setIsOnline] = useState(false);
    const [isError, setIsError] = useState(false);

    useEffect(() => {
        if (computer) {
            setIsOnline(computer.online || false);
            setIsError(computer.error || false);
        }
    }, [computer]);


    if (isPlaceholder) {
        return (
            <div
                className='bg-gray-50 border rounded-lg p-2 shadow-sm hover:shadow-md transition-all relative aspect-square flex flex-col justify-between'
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <div className='flex flex-col items-center gap-1.5'>
                    <div className='relative flex-shrink-0'>
                        <div className='w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center'>
                            <FaDesktop className='text-xl text-gray-300' />
                        </div>
                    </div>
                    <div className='flex flex-col items-center text-center'>
                        <h3 className='text-xs font-medium text-gray-400 truncate'>
                            {position}
                        </h3>
                        <span className='text-[9px] text-gray-400'>
                            No computer assigned
                        </span>
                    </div>
                </div>

                {isHovered && (
                    <div className='absolute bottom-2 left-0 w-full px-2'>
                        <button className='w-full flex items-center justify-center gap-1 p-1.5 hover:bg-gray-50 rounded border text-[10px] text-gray-600'>
                            <FaPlus className='text-gray-400' />
                            <span>Add Computer</span>
                        </button>
                    </div>
                )}
            </div>
        );
    }

    const { id, hostname, ip_address } = computer || {};

    return (
        <div
            className='bg-white border rounded-lg p-2 shadow-sm hover:shadow-md transition-all relative aspect-square flex flex-col justify-between'
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className='flex flex-col items-center gap-1.5'>
                <div className='relative flex-shrink-0'>
                    <div className='w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center'>
                        <FaDesktop className='text-xl text-blue-500' />
                    </div>
                    <FaCircle
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 ${
                            isOnline
                                ? "text-green-500"
                                : isError
                                ? "text-red-500"
                                : "text-gray-400"
                        } drop-shadow-sm`}
                    />
                </div>
                <div className='flex flex-col items-center text-center'>
                    <h3 className='text-xs font-medium truncate'>
                        {hostname}
                    </h3>
                    <div className='flex flex-col items-center gap-1 mt-0.5'>
                        <div className='flex items-center gap-1'>
                            <FaNetworkWired className='w-2.5 h-2.5 text-gray-400' />
                            <span className='text-[9px] text-gray-500'>
                                {ip_address}
                            </span>
                        </div>
                        <div className='flex items-center gap-1.5'>
                            <FaMicrochip className='w-2.5 h-2.5 text-gray-400' />
                            <FaMemory className='w-2.5 h-2.5 text-gray-400' />
                            <FaHdd className='w-2.5 h-2.5 text-gray-400' />
                        </div>
                    </div>
                </div>
            </div>

            {isHovered && (
                <div className='grid grid-cols-3 gap-0.5 w-full'>
                    <button className='flex flex-col items-center p-1.5 hover:bg-gray-50 rounded border text-[9px]'>
                        <FaList className='text-gray-400 mb-0.5 text-[10px]' />
                        <span>Tasks</span>
                    </button>
                    <button className='flex flex-col items-center p-1.5 hover:bg-gray-50 rounded border text-[9px]'>
                        <FaNetworkWired className='text-gray-400 mb-0.5 text-[10px]' />
                        <span>Network</span>
                    </button>
                    <button className='flex flex-col items-center p-1.5 hover:bg-gray-50 rounded border text-[9px]'>
                        <FaTerminal className='text-gray-400 mb-0.5 text-[10px]' />
                        <span>Apps</span>
                    </button>
                </div>
            )}
        </div>
    );
}

export default ComputerCard;