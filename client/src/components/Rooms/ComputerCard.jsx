import React, { useState, useEffect } from "react";
import {
    FaDesktop,
    FaNetworkWired,
    FaList,
    FaTerminal,
    FaCircle,
    FaMemory,
    FaMicrochip,
    FaHdd,
    FaPlus,
    FaCheckCircle,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const ComputerCard = ({
    computer,
    isPlaceholder,
    position,
    installationResult,
}) => {
    const navigate = useNavigate();
    const [isHovered, setIsHovered] = useState(false);
    const [isOnline, setIsOnline] = useState(false);
    const [isError, setIsError] = useState(false);

    useEffect(() => {
        if (computer) {
            setIsOnline(computer.online || false);
            setIsError(computer.error || false);
        }
    }, [computer]);

    const handleCardClick = () => {
        if (!isPlaceholder && computer?.id) {
            navigate(`/computers/${computer.id}`);
        }
    };

    const getInstallStatusColor = () => {
        if (!installationResult) return "";
        return installationResult.success
            ? "border-green-400 bg-green-50"
            : "border-red-400 bg-red-50";
    };

    const handleButtonClick = (tab) => (e) => {
        e.stopPropagation(); // Prevent card click
        if (computer?.id) {
            navigate(`/computers/${computer.id}`, {
                state: { activeTab: tab },
            });
        }
    };

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

    const { hostname, ip_address } = computer || {};

    return (
        <div
            className={`h-full p-2 ${
                installationResult
                    ? getInstallStatusColor()
                    : computer.hasSelectedApp
                    ? "bg-blue-50 border-2 border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)] animate-pulse-subtle"
                    : "bg-white border"
            } rounded-lg shadow-sm hover:shadow-md transition-all relative aspect-square flex flex-col justify-between cursor-pointer`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleCardClick}
            title={
                computer.hasSelectedApp
                    ? `Installed on: ${new Date(
                          computer.installationDate
                      ).toLocaleString()}`
                    : ""
            }
        >
            {computer.hasSelectedApp && (
                <div className='absolute -top-2 -right-2 bg-blue-500 rounded-full p-1 shadow-md z-10'>
                    <FaCheckCircle className='text-white text-sm' />
                </div>
            )}

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
                    <h3 className='text-xs font-medium truncate'>{hostname}</h3>
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

            {installationResult && (
                <div className='absolute bottom-0 left-0 right-0 p-1 text-[9px] text-center bg-black/60 text-white rounded-b'>
                    {installationResult.message}
                </div>
            )}

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
                            ? 'opacity-50 cursor-not-allowed' 
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={isOnline ? handleButtonClick("processes") : undefined}
                        disabled={!isOnline}
                    >
                        <FaList className='text-gray-400 text-sm' />
                        <span>Tasks</span>
                    </button>
                    <button
                        className={`flex flex-col items-center p-2 rounded border text-xs gap-1 ${
                            !isOnline 
                            ? 'opacity-50 cursor-not-allowed' 
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={isOnline ? handleButtonClick("network") : undefined}
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
