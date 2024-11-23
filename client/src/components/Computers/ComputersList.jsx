import React from 'react';
const ComputersList = ({ user }) => {
    const { data, isLoading, isError } = useQuery('computers', fetchComputers);
    
    if (isLoading) return <p>Loading...</p>;
    if (isError) return <p>Error</p>;
    
    return (
        <div>
        <h1>Computers</h1>
        <ul>
            {data.map((computer) => (
            <li key={computer.id}>{computer.name}</li>
            ))}
        </ul>
        </div>
    );
}

export default ComputersList;