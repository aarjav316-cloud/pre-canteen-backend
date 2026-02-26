let io;

export const initSocket = (serverIo) => {
    io = serverIo;
}

export const getIo = () => {
    if(!io){
        throw new Error("socket Io not initialized");
    }

    return io;
}


