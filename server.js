const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');

// 创建HTTP服务器来提供静态文件
const server = http.createServer((req, res) => {
    // 添加CORS头部支持远程访问
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // 处理预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    // 处理URL编码
    filePath = decodeURIComponent(filePath);

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.woff': 'application/font-woff',
        '.ttf': 'application/font-ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.otf': 'application/font-otf',
        '.wasm': 'application/wasm'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('404 Not Found', 'utf-8');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('Server Error: ' + error.code, 'utf-8');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

// 创建WebSocket服务器
const wss = new WebSocket.Server({ server });

// 游戏房间管理
const gameRooms = new Map();

class GameRoom {
    constructor(id) {
        this.id = id;
        this.players = [];
        this.gameState = {
            boardState: {},
            gameMode: 'setup',
            redCompleted: false,
            blackCompleted: false,
            currentTurn: 'red', // 红方先手
            turnNumber: 1
        };
    }

    addPlayer(ws) {
        if (this.players.length < 2) {
            this.players.push(ws);
            ws.roomId = this.id;
            ws.playerId = this.players.length;

            let playerSide;
            if (this.players.length === 1) {
                // 第一个玩家随机分配红方或黑方
                playerSide = Math.random() < 0.5 ? 'red' : 'black';
                this.firstPlayerSide = playerSide;
            } else {
                // 第二个玩家分配剩余的身份
                playerSide = this.firstPlayerSide === 'red' ? 'black' : 'red';
            }

            ws.playerSide = playerSide;

            // 发送玩家ID和房间信息
            ws.send(JSON.stringify({
                type: 'playerAssigned',
                playerId: ws.playerId,
                playerSide: playerSide,
                roomId: this.id,
                playerCount: this.players.length
            }));

            // 通知房间内所有玩家
            this.broadcast({
                type: 'playerJoined',
                playerId: ws.playerId,
                playerCount: this.players.length
            });

            // 如果有两个玩家，发送游戏开始信号
            if (this.players.length === 2) {
                this.broadcast({
                    type: 'gameReady',
                    message: '两名玩家已连接，可以开始游戏'
                });
            }

            return true;
        }
        return false;
    }

    removePlayer(ws) {
        const index = this.players.indexOf(ws);
        if (index !== -1) {
            this.players.splice(index, 1);

            // 通知剩余玩家
            this.broadcast({
                type: 'playerLeft',
                playerId: ws.playerId,
                playerCount: this.players.length
            });
        }
    }

    broadcast(message, excludeWs = null) {
        this.players.forEach(player => {
            if (player !== excludeWs && player.readyState === WebSocket.OPEN) {
                player.send(JSON.stringify(message));
            }
        });
    }

    updateGameState(newState, fromWs) {
        this.gameState = { ...this.gameState, ...newState };

        // 广播游戏状态更新给其他玩家
        this.broadcast({
            type: 'gameStateUpdate',
            gameState: this.gameState
        }, fromWs);
    }
}

// WebSocket连接处理
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'joinGame':
                    // 查找可用房间或创建新房间
                    let room = null;
                    for (let [roomId, gameRoom] of gameRooms) {
                        if (gameRoom.players.length < 2) {
                            room = gameRoom;
                            break;
                        }
                    }

                    if (!room) {
                        // 创建新房间
                        const roomId = 'room_' + Date.now();
                        room = new GameRoom(roomId);
                        gameRooms.set(roomId, room);
                    }

                    if (!room.addPlayer(ws)) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: '房间已满'
                        }));
                    }
                    break;

                case 'gameStateUpdate':
                    // 更新游戏状态
                    if (ws.roomId && gameRooms.has(ws.roomId)) {
                        const room = gameRooms.get(ws.roomId);
                        room.updateGameState(data.gameState, ws);
                    }
                    break;

                case 'move':
                    // 处理移动
                    if (ws.roomId && gameRooms.has(ws.roomId)) {
                        const room = gameRooms.get(ws.roomId);
                        room.broadcast({
                            type: 'move',
                            move: data.move,
                            playerId: ws.playerId
                        }, ws);
                    }
                    break;

                case 'selection':
                    // 处理选择状态
                    if (ws.roomId && gameRooms.has(ws.roomId)) {
                        const room = gameRooms.get(ws.roomId);
                        room.broadcast({
                            type: 'selection',
                            selection: data.selection,
                            playerId: ws.playerId
                        }, ws);
                    }
                    break;

                case 'ping':
                    // 心跳响应
                    ws.send(JSON.stringify({ type: 'pong' }));
                    break;
            }
        } catch (error) {
            ws.send(JSON.stringify({
                type: 'error',
                message: '服务器错误'
            }));
        }
    });

    ws.on('close', () => {
        // 从房间中移除玩家
        if (ws.roomId && gameRooms.has(ws.roomId)) {
            const room = gameRooms.get(ws.roomId);
            room.removePlayer(ws);

            // 如果房间为空，删除房间
            if (room.players.length === 0) {
                gameRooms.delete(ws.roomId);
            }
        }
    });

    ws.on('error', (error) => {
        // 静默处理错误
    });
});

const PORT = process.env.PORT || 3001;

// 获取本机IP地址
function getLocalIP() {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const interface of interfaces[name]) {
            if (interface.family === 'IPv4' && !interface.internal) {
                return interface.address;
            }
        }
    }
    return 'localhost';
}

server.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log('='.repeat(60));
    console.log('🎮 中国象棋联机服务器已启动');
    console.log('='.repeat(60));
    console.log(`📱 本机访问: http://localhost:${PORT}`);
    console.log(`🌐 局域网访问: http://${localIP}:${PORT}`);

    // 如果在GitHub Codespaces环境中
    if (process.env.CODESPACE_NAME) {
        console.log(`☁️  GitHub Codespaces访问: https://${process.env.CODESPACE_NAME}-${PORT}.preview.app.github.dev`);
        console.log(`🔗 WebSocket地址: wss://${process.env.CODESPACE_NAME}-${PORT}.preview.app.github.dev`);
    }

    console.log('='.repeat(60));
    console.log('💡 使用说明:');
    console.log('   • 单人游戏: 直接在浏览器中游戏');
    console.log('   • 局域网联机: 两个玩家访问同一地址');
    console.log('   • 远程联机: 使用GitHub Codespaces地址');
    console.log('='.repeat(60));
    console.log('⚠️  关闭服务器: 按 Ctrl+C 或在终端中输入 Ctrl+C');
    console.log('='.repeat(60));
});

// 优雅关闭服务器
process.on('SIGINT', () => {
    console.log('\n' + '='.repeat(60));
    console.log('🛑 正在关闭服务器...');
    console.log('='.repeat(60));

    // 关闭WebSocket服务器
    wss.close(() => {
        console.log('✅ WebSocket服务器已关闭');
    });

    // 关闭HTTP服务器
    server.close(() => {
        console.log('✅ HTTP服务器已关闭');
        console.log('👋 服务器已安全关闭，感谢使用！');
        console.log('='.repeat(60));
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n' + '='.repeat(60));
    console.log('🛑 收到终止信号，正在关闭服务器...');
    console.log('='.repeat(60));

    wss.close(() => {
        console.log('✅ WebSocket服务器已关闭');
    });

    server.close(() => {
        console.log('✅ HTTP服务器已关闭');
        console.log('👋 服务器已安全关闭！');
        console.log('='.repeat(60));
        process.exit(0);
    });
});
