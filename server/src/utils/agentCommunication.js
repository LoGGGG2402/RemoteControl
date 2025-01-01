const WebSocket = require('ws');

let wss = null;
const computerClients = new Map();

const initializeWebSocket = (server) => {
    if (wss) return;

    wss = new WebSocket.Server({ 
        server,
        path: '/ws',
        verifyClient: (info) => {
            return true;
        },
        handleProtocols: (protocols, request) => {
            return 'agent-protocol';
        }
    });

    wss.on('connection', (ws, req) => {
        console.log('New client connected');

        try {
            ws.send(JSON.stringify({ 
                type: 'welcome', 
                message: 'Connected to server',
                timestamp: new Date().toISOString()
            }));
        } catch (error) {
            console.error('Error sending welcome message:', error);
        }

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());
                
                if (data.type === 'auth' && data.computer_id) {
                    const computerId = data.computer_id.toString();
                    console.log('Client authenticated with computer ID:', computerId);
                    
                    const existingConnection = computerClients.get(computerId);
                    if (existingConnection && existingConnection !== ws) {
                        existingConnection.close();
                    }
                    
                    ws.computer_id = computerId;
                    computerClients.set(computerId, ws);
                    console.log('Current connected computers:', Array.from(computerClients.keys()));
                }
            } catch (e) {
                console.error('Error processing message:', e);
            }
        });

        ws.on('close', () => {
            if (ws.computer_id) {
                console.log('Client disconnected, computer ID:', ws.computer_id);
                computerClients.delete(ws.computer_id);
            }
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });
    });

    return wss;
};

const sendCommandToComputer = (computerId, commandType, params = {}) => {
    return new Promise((resolve, reject) => {
        const ws = computerClients.get(computerId.toString());
        
        if (!ws) {
            console.error(`No connection found for computer ID: ${computerId}`);
            reject(new Error('Computer not connected'));
            return;
        }

        const command = JSON.stringify({
            type: commandType,
            params: params,
        });

        ws.send(command);

        const handleMessage = (message) => {
            try {
                const response = JSON.parse(message.toString());
                ws.removeListener('message', handleMessage);
                resolve(response);
            } catch (e) {
                console.error('Error parsing response:', e);
                reject(e);
            }
        };

        ws.on('message', handleMessage);

        setTimeout(() => {
            ws.removeListener('message', handleMessage);
            reject(new Error('Command timeout'));
        }, 120000);
    });
};

const getConnectedComputers = () => {
    return Array.from(computerClients.keys());
};

module.exports = { 
    initializeWebSocket, 
    sendCommandToComputer,
    getConnectedComputers,
    computerClients 
};
