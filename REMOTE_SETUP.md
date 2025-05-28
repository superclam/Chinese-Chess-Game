# 远程联机设置指南

## 快速开始

### 1. 部署服务器到GitHub Codespaces

1. **Fork仓库**：
   - 访问 https://github.com/your-username/Chess
   - 点击右上角的"Fork"按钮

2. **创建Codespace**：
   - 在你fork的仓库页面，点击绿色的"Code"按钮
   - 选择"Codespaces"标签
   - 点击"Create codespace on main"

3. **等待自动部署**：
   - Codespace会自动安装依赖并启动服务器
   - 查看终端输出，找到类似这样的信息：
   ```
   GitHub Codespaces访问: https://your-codespace-name-3000.preview.app.github.dev
   WebSocket地址: wss://your-codespace-name-3000.preview.app.github.dev
   ```

### 2. 配置客户端

1. **修改配置文件**（可选）：
   - 编辑 `config.js` 文件
   - 将 `DEFAULT_REMOTE_SERVER` 改为你的Codespace地址

2. **或者在游戏中输入地址**：
   - 点击"远程联机"按钮
   - 在弹出的对话框中输入WebSocket地址

### 3. 开始游戏

1. **服务器部署者**：
   - 分享WebSocket地址给朋友
   - 自己也可以通过这个地址连接

2. **其他玩家**：
   - 在任何地方打开游戏网页
   - 点击"远程联机"
   - 输入服务器地址
   - 开始游戏！

## 注意事项

- GitHub Codespaces有使用时间限制，免费用户每月有一定的免费时间
- 如果Codespace停止运行，需要重新启动
- 服务器地址中的`your-codespace-name`部分会根据你的Codespace名称变化
- 确保防火墙允许WebSocket连接

## 故障排除

### 连接失败
1. 检查服务器地址是否正确
2. 确认Codespace正在运行
3. 检查网络连接

### 服务器无响应
1. 在Codespace终端中重启服务器：`npm start`
2. 检查端口3000是否被正确转发

### 游戏同步问题
- 刷新页面重新连接
- 检查网络稳定性
