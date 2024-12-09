const net = require("net");

const sendCommandToComputer = (ipAddress, commandType, params = {}) => {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        const command = JSON.stringify({
            type: commandType,
            params: params
        });

        client.connect(5000, ipAddress, () => {
            client.write(command);
            let data = "";
            client.on("data", (chunk) => {
                data += chunk;
            });
            client.on("end", () => {
                resolve(JSON.parse(data));
            });
        });
        client.on("error", (err) => {
            console.error("Error communicating with agent:", err);
            reject(err);
        });
    });
};

module.exports = { sendCommandToComputer };
