import React, { useState, useEffect } from 'react';
const ComputerCard = ({ computer }) => {
    const { id, index, ip_address, mac_address, hostname, notes, errors, updated_at } = computer;
    const [isOnline, setIsOnline] = useState(false);
    const [isError, setIsError] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            axios.get(`/computer/${id}/network`)
                .then(res => {
                    const { data } = res;
                    setIsOnline(data.length > 0);
                })
                .catch(err => {
                    console.error(err);
                    setIsError(true);
                });
        }, 5000);

        return () => clearInterval(interval);
    }, [id]);

    return (
        <div
            className={`computer-card ${isOnline ? 'online' : ''} ${isError ? 'error' : ''}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="computer-card-header">
                <h3>{hostname}</h3>
                <h4>{ip_address}</h4>
            </div>
            <div className="computer-card-body">
                <p>{notes}</p>
                <p>{errors}</p>
            </div>
            <div className="computer-card-footer">
                <p>{updated_at}</p>
                {isHovered && (
                    <div className="computer-card-actions">
                        <button>View Processes</button>
                        <button>View Network</button>
                        <button>View Applications</button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ComputerCard;