#!/bin/bash

echo "🎮 启动中国象棋游戏服务器..."
echo "================================"

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖包..."
    npm install
fi

# 启动服务器
echo "🚀 启动游戏服务器在端口 3000..."
echo "📱 在Codespaces中，服务器将自动转发端口"
echo "🌐 点击弹出的链接或在端口面板中打开端口 3000"
echo "================================"

node server.js
