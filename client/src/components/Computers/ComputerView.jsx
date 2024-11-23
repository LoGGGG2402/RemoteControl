import React from "react";
const ComputerView = ({ user, computer }) => {
    const { id } = useParams();

    if (isLoading) return <div>Loading...</div>;
    if (error) return <div>Error: {error.message}</div>;

    return (
        <div>
            <h1>{computer.name}</h1>
            <p>{computer.description}</p>
        </div>
    );
};

export default ComputerView;
