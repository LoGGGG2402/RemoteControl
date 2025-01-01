const WebSocket = require('ws');

const websocketMiddleware = (wss) => {
    wss.on('connection', (ws, req) => {
        ws.isAlive = true;
        
        ws.on('pong', () => {
            ws.isAlive = true;
        });
        
        // Kiểm tra kết nối định kỳ
        const interval = setInterval(() => {
            if (ws.isAlive === false) {
                clearInterval(interval);
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping();
        }, 30000);
        
        ws.on('close', () => {
            clearInterval(interval);
        });
    });
};

module.exports = websocketMiddleware; 