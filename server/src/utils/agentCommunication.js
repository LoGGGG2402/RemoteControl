const net = require("net");

const sendCommandToComputer = (ipAddress, command) => {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
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
