// 游戏配置文件
const CONFIG = {
    // 默认远程服务器地址（用户可以修改这个地址）
    DEFAULT_REMOTE_SERVER: 'wss://your-codespace-name-3000.preview.app.github.dev',
    
    // 常用的远程服务器地址列表
    REMOTE_SERVERS: [
        'wss://your-codespace-name-3000.preview.app.github.dev',
        // 用户可以在这里添加更多服务器地址
    ],
    
    // 连接超时时间（毫秒）
    CONNECTION_TIMEOUT: 10000,
    
    // 重连间隔时间（毫秒）
    RECONNECT_INTERVAL: 3000
};

// 如果在浏览器环境中，将配置暴露到全局
if (typeof window !== 'undefined') {
    window.CHESS_CONFIG = CONFIG;
}
