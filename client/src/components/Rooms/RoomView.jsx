const RoomView = ({ user, room }) => {
    const {id} = useParams();
    return (
        <div>
            <h1>{room.name}</h1>
            <p>{room.description}</p>
        </div>
    );
}

export default RoomView;