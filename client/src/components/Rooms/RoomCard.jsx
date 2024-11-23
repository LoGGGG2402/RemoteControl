const RoomCard = ({ room }) => {
    return (
        <div>
            <h1>{room.name}</h1>
            <p>{room.description}</p>
        </div>
    );
}