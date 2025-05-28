// 主菜单元素
const mainMenu = document.getElementById('mainMenu');
const gameContainer = document.getElementById('gameContainer');
const singlePlayerBtn = document.getElementById('singlePlayerBtn');
const lanGameBtn = document.getElementById('lanGameBtn');
const onlineGameBtn = document.getElementById('onlineGameBtn');

// 游戏界面元素
const grid = document.getElementById('grid');
const gameGrid = document.getElementById('gameGrid');
const setupContainer = document.getElementById('setupContainer');
const gameBoard = document.getElementById('gameBoard');
const redAutoInitBtn = document.getElementById('redAutoInitBtn');
const blackAutoInitBtn = document.getElementById('blackAutoInitBtn');
const redResetBtn = document.getElementById('redResetBtn');
const blackResetBtn = document.getElementById('blackResetBtn');
const redCompleteBtn = document.getElementById('redCompleteBtn');
const blackCompleteBtn = document.getElementById('blackCompleteBtn');
const redStatus = document.getElementById('redStatus');
const blackStatus = document.getElementById('blackStatus');
const redStorage = document.getElementById('redStorage');
const blackStorage = document.getElementById('blackStorage');

// 游戏状态
let gameMode = 'setup'; // 'setup' 或 'playing'
let selectedPosition = null;
let emptyTargetPosition = null;
let draggedPiece = null;
let selectedStoragePiece = null; // 选中的存储区棋子
let redCompleted = false; // 红方是否完成初始化
let blackCompleted = false; // 黑方是否完成初始化

// 联机游戏状态
let isOnlineMode = false; // 是否为联机模式
let websocket = null; // WebSocket连接
let playerId = null; // 玩家ID
let playerSide = null; // 玩家身份：'red' 或 'black'
let roomId = null; // 房间ID
let connectionStatus = 'disconnected'; // 连接状态
let currentTurn = 'red'; // 当前回合：'red' 或 'black'
let turnNumber = 1; // 回合数

// 动态棋盘状态（初始为空）
let boardState = {};

// WebSocket连接管理
function connectToServer(serverUrl = null) {
    let wsUrl;

    if (serverUrl) {
        // 远程联机模式，使用指定的服务器地址
        const protocol = serverUrl.startsWith('https://') ? 'wss:' : 'ws:';
        wsUrl = serverUrl.replace(/^https?:\/\//, protocol + '//');
    } else {
        // 局域网联机模式，使用当前主机
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}`;
    }

    websocket = new WebSocket(wsUrl);

    websocket.onopen = function() {
        console.log('WebSocket连接已建立');
        updateConnectionStatus('connecting');

        // 加入游戏
        websocket.send(JSON.stringify({
            type: 'joinGame'
        }));
    };

    websocket.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            handleServerMessage(data);
        } catch (error) {
            console.error('解析服务器消息时出错:', error);
        }
    };

    websocket.onclose = function() {
        console.log('WebSocket连接已关闭');
        updateConnectionStatus('disconnected');
        websocket = null;

        // 如果是联机模式，尝试重连
        if (isOnlineMode) {
            setTimeout(() => {
                if (isOnlineMode) {
                    connectToServer();
                }
            }, 3000);
        }
    };

    websocket.onerror = function(error) {
        console.error('WebSocket错误:', error);
        updateConnectionStatus('disconnected');
    };
}

// 处理服务器消息
function handleServerMessage(data) {
    switch (data.type) {
        case 'playerAssigned':
            playerId = data.playerId;
            playerSide = data.playerSide;
            roomId = data.roomId;
            console.log(`分配为玩家 ${playerId} (${playerSide === 'red' ? '红方' : '黑方'}), 房间 ${roomId}`);
            updateConnectionStatus('connected');
            updatePlayerIdentityDisplay(); // 更新身份显示
            updateSetupPlayerIdentity(); // 更新初始化界面身份显示
            break;

        case 'playerJoined':
            console.log(`玩家 ${data.playerId} 加入游戏, 当前玩家数: ${data.playerCount}`);
            if (data.playerCount === 2) {
                updateConnectionStatus('connected');
            }
            break;

        case 'gameReady':
            console.log(data.message);
            updateConnectionStatus('connected');
            break;

        case 'playerLeft':
            console.log(`玩家 ${data.playerId} 离开游戏`);
            updateConnectionStatus('connecting');
            break;

        case 'gameStateUpdate':
            // 同步游戏状态
            syncGameState(data.gameState);
            break;

        case 'move':
            // 同步移动
            if (data.playerId !== playerId) {
                syncMove(data.move);
            }
            break;

        case 'error':
            console.error('服务器错误:', data.message);
            break;

        case 'pong':
            // 心跳响应
            break;
    }
}

// 更新连接状态显示
function updateConnectionStatus(status) {
    connectionStatus = status;
    const statusElement = document.getElementById('connectionStatus');
    const statusText = document.getElementById('statusText');

    if (!isOnlineMode) {
        statusElement.style.display = 'none';
        return;
    }

    statusElement.style.display = 'block';
    statusElement.className = 'connection-status ' + status;

    switch (status) {
        case 'connecting':
            statusText.textContent = '正在连接...';
            break;
        case 'connected':
            statusText.textContent = '已连接';
            break;
        case 'disconnected':
            statusText.textContent = '连接断开';
            break;
    }
}

// 发送游戏状态更新
function sendGameStateUpdate() {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
            type: 'gameStateUpdate',
            gameState: {
                boardState: boardState,
                gameMode: gameMode,
                redCompleted: redCompleted,
                blackCompleted: blackCompleted,
                currentTurn: currentTurn,
                turnNumber: turnNumber
            }
        }));
    }
}

// 发送移动
function sendMove(move) {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
            type: 'move',
            move: move
        }));
    }
}

// 同步游戏状态
function syncGameState(newGameState) {
    boardState = newGameState.boardState || {};
    gameMode = newGameState.gameMode || 'setup';
    redCompleted = newGameState.redCompleted || false;
    blackCompleted = newGameState.blackCompleted || false;
    currentTurn = newGameState.currentTurn || 'red';
    turnNumber = newGameState.turnNumber || 1;

    // 更新UI
    updateRedStatus();
    updateBlackStatus();
    updateStorageDisplay(); // 更新存储区显示
    updateTurnDisplay(); // 更新回合显示
    renderBoard();

    // 检查是否需要开始游戏
    if (redCompleted && blackCompleted && gameMode === 'setup') {
        setTimeout(() => {
            startGame();
        }, 500);
    }
}

// 同步移动
function syncMove(move) {
    const { fromCol, fromRow, toCol, toRow } = move;
    movePiece(fromCol, fromRow, toCol, toRow);
}

// 更新存储区显示状态
function updateStorageDisplay() {
    // 统计棋盘上的棋子数量
    const redPiecesOnBoard = {};
    const blackPiecesOnBoard = {};

    Object.values(boardState).forEach(piece => {
        if (piece.startsWith('红')) {
            redPiecesOnBoard[piece] = (redPiecesOnBoard[piece] || 0) + 1;
        } else if (piece.startsWith('黑') || piece.startsWith('黒')) {
            blackPiecesOnBoard[piece] = (blackPiecesOnBoard[piece] || 0) + 1;
        }
    });

    // 更新红方存储区
    allPieces.red.forEach((pieceData, index) => {
        const usedCount = redPiecesOnBoard[pieceData.name] || 0;
        const remainingCount = pieceData.count - usedCount;

        const piece = redStorage.querySelectorAll('.draggable-piece')[index];
        const countLabel = redStorage.querySelectorAll('.piece-count')[index];

        if (piece) {
            piece.dataset.currentCount = remainingCount;

            if (remainingCount > 0) {
                piece.style.display = 'block';
                if (countLabel && pieceData.count > 1) {
                    countLabel.style.display = 'flex';
                    countLabel.textContent = `×${remainingCount}`;
                }
            } else {
                piece.style.display = 'none';
                if (countLabel) {
                    countLabel.style.display = 'none';
                }
            }
        }
    });

    // 更新黑方存储区
    allPieces.black.forEach((pieceData, index) => {
        const usedCount = blackPiecesOnBoard[pieceData.name] || 0;
        const remainingCount = pieceData.count - usedCount;

        const piece = blackStorage.querySelectorAll('.draggable-piece')[index];
        const countLabel = blackStorage.querySelectorAll('.piece-count')[index];

        if (piece) {
            piece.dataset.currentCount = remainingCount;

            if (remainingCount > 0) {
                piece.style.display = 'block';
                if (countLabel && pieceData.count > 1) {
                    countLabel.style.display = 'flex';
                    countLabel.textContent = `×${remainingCount}`;
                }
            } else {
                piece.style.display = 'none';
                if (countLabel) {
                    countLabel.style.display = 'none';
                }
            }
        }
    });
}

// 更新回合显示
function updateTurnDisplay() {
    // 在游戏阶段显示回合信息
    if (gameMode === 'playing' && isOnlineMode) {
        const turnInfo = document.getElementById('turnInfo');
        if (!turnInfo) {
            // 创建回合信息显示元素
            const turnElement = document.createElement('div');
            turnElement.id = 'turnInfo';
            turnElement.style.cssText = `
                position: fixed;
                top: 20px;
                left: 20px;
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                font-size: 16px;
                font-weight: bold;
                z-index: 1000;
                border: 2px solid #666;
            `;
            document.body.appendChild(turnElement);
        }

        const turnElement = document.getElementById('turnInfo');
        const isMyTurn = currentTurn === playerSide;
        const turnText = currentTurn === 'red' ? '红方' : '黑方';

        if (isMyTurn) {
            turnElement.textContent = `第${turnNumber}回合 - 轮到您了 (${turnText})`;
            turnElement.style.background = 'rgba(76, 175, 80, 0.9)'; // 绿色
        } else {
            turnElement.textContent = `第${turnNumber}回合 - 等待对方 (${turnText})`;
            turnElement.style.background = 'rgba(255, 152, 0, 0.9)'; // 橙色
        }
    } else {
        // 非游戏阶段或单人模式，隐藏回合信息
        const turnInfo = document.getElementById('turnInfo');
        if (turnInfo) {
            turnInfo.remove();
        }
    }
}

// 定义所有棋子（合并相同棋子）
const allPieces = {
    red: [
        { name: '红车', count: 2 },
        { name: '红马', count: 2 },
        { name: '红象', count: 2 },
        { name: '红士', count: 2 },
        { name: '红帅', count: 1 },
        { name: '红炮', count: 2 },
        { name: '红兵', count: 5 }
    ],
    black: [
        { name: '黑车', count: 2 },
        { name: '黑马', count: 2 },
        { name: '黑象', count: 2 },
        { name: '黒士', count: 2 },
        { name: '黑将', count: 1 },
        { name: '黑炮', count: 2 },
        { name: '黑兵', count: 5 }
    ]
};

// 定义初始化点位置（己方可以放置棋子的位置）
const initializationZones = {
    red: [
        // 红方后排（除了将/帅和士的专属位置）
        [0,0], [1,0], [2,0], [6,0], [7,0], [8,0],
        // 红方炮位（只有两个位置）
        [1,2], [7,2],
        // 红方兵位（只有奇数列）
        [0,3], [2,3], [4,3], [6,3], [8,3]
    ],
    black: [
        // 黑方后排（除了将/帅和士的专属位置）
        [0,9], [1,9], [2,9], [6,9], [7,9], [8,9],
        // 黑方炮位（只有两个位置）
        [1,7], [7,7],
        // 黑方兵位（只有奇数列）
        [0,6], [2,6], [4,6], [6,6], [8,6]
    ]
};

// 初始化棋子存储区
function initializePieceStorage() {
    console.log('初始化棋子存储区...');
    // 清空存储区
    redStorage.innerHTML = '';
    blackStorage.innerHTML = '';

    // 创建红方棋子
    allPieces.red.forEach((pieceData, index) => {
        const slot = document.createElement('div');
        slot.className = 'storage-slot';

        const piece = document.createElement('img');
        piece.className = 'draggable-piece';
        piece.src = `IMAGE/${pieceData.name}.png`;
        piece.alt = pieceData.name;
        piece.dataset.piece = pieceData.name;
        piece.dataset.color = 'red';
        piece.dataset.originalIndex = index;
        piece.dataset.maxCount = pieceData.count;
        piece.dataset.currentCount = pieceData.count;

        // 添加拖拽事件
        addDragEvents(piece);

        // 添加点击事件
        addStoragePieceClickEvent(piece, slot, pieceData.name, 'red');

        slot.appendChild(piece);

        // 如果数量大于1，添加数量标签
        if (pieceData.count > 1) {
            const countLabel = document.createElement('div');
            countLabel.className = 'piece-count';
            countLabel.textContent = `×${pieceData.count}`;
            slot.appendChild(countLabel);
        }

        // 添加存储槽的拖拽接收功能
        addStorageSlotDragEvents(slot, pieceData.name, 'red');

        redStorage.appendChild(slot);
    });

    // 创建黑方棋子
    allPieces.black.forEach((pieceData, index) => {
        const slot = document.createElement('div');
        slot.className = 'storage-slot';

        const piece = document.createElement('img');
        piece.className = 'draggable-piece';
        piece.src = `IMAGE/${pieceData.name}.png`;
        piece.alt = pieceData.name;
        piece.dataset.piece = pieceData.name;
        piece.dataset.color = 'black';
        piece.dataset.originalIndex = index;
        piece.dataset.maxCount = pieceData.count;
        piece.dataset.currentCount = pieceData.count;

        // 添加拖拽事件
        addDragEvents(piece);

        // 添加点击事件
        addStoragePieceClickEvent(piece, slot, pieceData.name, 'black');

        slot.appendChild(piece);

        // 如果数量大于1，添加数量标签
        if (pieceData.count > 1) {
            const countLabel = document.createElement('div');
            countLabel.className = 'piece-count';
            countLabel.textContent = `×${pieceData.count}`;
            slot.appendChild(countLabel);
        }

        // 添加存储槽的拖拽接收功能
        addStorageSlotDragEvents(slot, pieceData.name, 'black');

        blackStorage.appendChild(slot);
    });
}

// 添加拖拽事件
function addDragEvents(piece) {
    piece.draggable = true;

    piece.addEventListener('dragstart', (e) => {
        draggedPiece = piece;
        piece.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', piece.outerHTML);
    });

    piece.addEventListener('dragend', (e) => {
        piece.classList.remove('dragging');
        draggedPiece = null;
    });
}

// 添加存储槽的拖拽接收功能
function addStorageSlotDragEvents(slot, pieceName, color) {
    slot.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (draggedPiece && draggedPiece.dataset.fromBoard === 'true') {
            const draggedPieceName = draggedPiece.dataset.piece;
            const draggedPieceColor = draggedPiece.dataset.color;

            // 只有相同类型和颜色的棋子才能拖回对应的存储槽
            if (draggedPieceName === pieceName && draggedPieceColor === color) {
                e.dataTransfer.dropEffect = 'move';
                slot.classList.add('drag-over');
            } else {
                e.dataTransfer.dropEffect = 'none';
            }
        }
    });

    slot.addEventListener('dragleave', (e) => {
        slot.classList.remove('drag-over');
    });

    slot.addEventListener('drop', (e) => {
        e.preventDefault();
        slot.classList.remove('drag-over');

        if (draggedPiece && draggedPiece.dataset.fromBoard === 'true') {
            const draggedPieceName = draggedPiece.dataset.piece;
            const draggedPieceColor = draggedPiece.dataset.color;

            // 只有相同类型和颜色的棋子才能拖回对应的存储槽
            if (draggedPieceName === pieceName && draggedPieceColor === color) {
                // 从棋盘移除棋子
                const originalCol = parseInt(draggedPiece.dataset.boardCol);
                const originalRow = parseInt(draggedPiece.dataset.boardRow);
                delete boardState[`${originalCol},${originalRow}`];

                // 更新存储区数量
                const slotPiece = slot.querySelector('.draggable-piece');
                if (slotPiece) {
                    const currentCount = parseInt(slotPiece.dataset.currentCount);
                    const newCount = currentCount + 1;
                    slotPiece.dataset.currentCount = newCount;

                    // 显示棋子（如果之前被隐藏）
                    slotPiece.style.display = 'block';

                    // 更新数量显示
                    let countLabel = slot.querySelector('.piece-count');
                    if (newCount > 1) {
                        if (!countLabel) {
                            countLabel = document.createElement('div');
                            countLabel.className = 'piece-count';
                            slot.appendChild(countLabel);
                        }
                        countLabel.textContent = `×${newCount}`;
                    }
                }

                // 重新渲染棋盘
                renderBoard();
            }
        }
    });
}

// 检查位置是否在初始化区域内
function isInInitializationZone(col, row, color) {
    const zones = initializationZones[color];
    return zones.some(([zoneCol, zoneRow]) => zoneCol === col && zoneRow === row);
}

// 显示可放置的位置
function showAvailablePlacements(pieceName, color) {
    clearAvailablePlacements();

    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 9; col++) {
            if (canPieceBePlacedAt(pieceName, col, row, color) && !boardState[`${col},${row}`]) {
                const position = grid.querySelector(`[data-col="${col}"][data-row="${row}"]`);
                if (position) {
                    position.classList.add('available-placement');
                }
            }
        }
    }
}

// 清除可放置位置的显示
function clearAvailablePlacements() {
    document.querySelectorAll('.available-placement').forEach(pos => {
        pos.classList.remove('available-placement');
    });
}

// 清除存储区选择
function clearStorageSelection() {
    document.querySelectorAll('.storage-slot.selected').forEach(slot => {
        slot.classList.remove('selected');
    });
    selectedStoragePiece = null;
    clearAvailablePlacements();
}

// 添加存储区棋子点击事件
function addStoragePieceClickEvent(piece, slot, pieceName, color) {
    piece.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // 在联机模式下，检查是否有权限操作这个颜色的棋子
        if (isOnlineMode && playerSide && color !== playerSide) {
            console.log('无权限操作对方棋子');
            return;
        }

        // 检查棋子是否可用（数量大于0）
        const currentCount = parseInt(piece.dataset.currentCount);
        if (currentCount <= 0) {
            return; // 棋子已用完，不能选择
        }

        // 如果已经选中了这个棋子，取消选择
        if (selectedStoragePiece === piece) {
            clearStorageSelection();
            return;
        }

        // 清除之前的选择
        clearStorageSelection();

        // 选择当前棋子
        selectedStoragePiece = piece;
        slot.classList.add('selected');

        // 显示可放置的位置
        showAvailablePlacements(pieceName, color);
    });
}

// 随机打乱数组
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// 红方随机初始化
function redAutoRandomInitialize() {
    // 在联机模式下，检查是否有权限操作红方
    if (isOnlineMode && playerSide && playerSide !== 'red') {
        console.log('无权限操作红方');
        return;
    }

    // 清除存储区选择和可放置位置提示
    clearStorageSelection();

    // 重置红方完成状态
    redCompleted = false;
    updateRedStatus();

    // 清除棋盘上的红方棋子
    Object.keys(boardState).forEach(key => {
        if (boardState[key].startsWith('红')) {
            delete boardState[key];
        }
    });

    // 获取红方可用位置
    const redGeneralPositions = [[3,0], [4,0], [5,0]]; // 将/帅和士的专属位置
    const redNormalPositions = [...initializationZones.red]; // 其他棋子的位置

    // 过滤掉已被黑方占据的位置
    const availableGeneralPos = redGeneralPositions.filter(([col, row]) => !boardState[`${col},${row}`]);
    const availableNormalPos = redNormalPositions.filter(([col, row]) => !boardState[`${col},${row}`]);

    // 随机放置红方棋子
    const redPieces = [];
    allPieces.red.forEach(pieceData => {
        for (let i = 0; i < pieceData.count; i++) {
            redPieces.push(pieceData.name);
        }
    });

    // 分离将/帅和士
    const redGenerals = redPieces.filter(piece => piece.includes('帅') || piece.includes('士'));
    const redOthers = redPieces.filter(piece => !piece.includes('帅') && !piece.includes('士'));

    // 随机放置红方将/帅和士
    const shuffledRedGeneralPos = shuffleArray(availableGeneralPos);
    redGenerals.forEach((piece, index) => {
        if (index < shuffledRedGeneralPos.length) {
            const [col, row] = shuffledRedGeneralPos[index];
            boardState[`${col},${row}`] = piece;
        }
    });

    // 随机放置红方其他棋子
    const shuffledRedNormalPos = shuffleArray(availableNormalPos);
    redOthers.forEach((piece, index) => {
        if (index < shuffledRedNormalPos.length) {
            const [col, row] = shuffledRedNormalPos[index];
            boardState[`${col},${row}`] = piece;
        }
    });

    // 更新红方存储区显示（隐藏所有红方棋子）
    redStorage.querySelectorAll('.draggable-piece').forEach(piece => {
        piece.style.display = 'none';
        piece.dataset.currentCount = '0';
    });

    // 隐藏红方数量标签
    redStorage.querySelectorAll('.piece-count').forEach(label => {
        label.style.display = 'none';
    });

    // 重新渲染棋盘
    renderBoard();

    // 如果是联机模式，发送游戏状态更新
    if (isOnlineMode) {
        sendGameStateUpdate();
    }
}

// 黑方随机初始化
function blackAutoRandomInitialize() {
    // 在联机模式下，检查是否有权限操作黑方
    if (isOnlineMode && playerSide && playerSide !== 'black') {
        console.log('无权限操作黑方');
        return;
    }

    // 清除存储区选择和可放置位置提示
    clearStorageSelection();

    // 重置黑方完成状态
    blackCompleted = false;
    updateBlackStatus();

    // 清除棋盘上的黑方棋子
    Object.keys(boardState).forEach(key => {
        if (boardState[key].startsWith('黑') || boardState[key].startsWith('黒')) {
            delete boardState[key];
        }
    });

    // 获取黑方可用位置
    const blackGeneralPositions = [[3,9], [4,9], [5,9]]; // 将和士的专属位置
    const blackNormalPositions = [...initializationZones.black]; // 其他棋子的位置

    // 过滤掉已被红方占据的位置
    const availableGeneralPos = blackGeneralPositions.filter(([col, row]) => !boardState[`${col},${row}`]);
    const availableNormalPos = blackNormalPositions.filter(([col, row]) => !boardState[`${col},${row}`]);

    // 随机放置黑方棋子
    const blackPieces = [];
    allPieces.black.forEach(pieceData => {
        for (let i = 0; i < pieceData.count; i++) {
            blackPieces.push(pieceData.name);
        }
    });

    // 分离将和士
    const blackGenerals = blackPieces.filter(piece => piece.includes('将') || piece.includes('士'));
    const blackOthers = blackPieces.filter(piece => !piece.includes('将') && !piece.includes('士'));

    // 随机放置黑方将和士
    const shuffledBlackGeneralPos = shuffleArray(availableGeneralPos);
    blackGenerals.forEach((piece, index) => {
        if (index < shuffledBlackGeneralPos.length) {
            const [col, row] = shuffledBlackGeneralPos[index];
            boardState[`${col},${row}`] = piece;
        }
    });

    // 随机放置黑方其他棋子
    const shuffledBlackNormalPos = shuffleArray(availableNormalPos);
    blackOthers.forEach((piece, index) => {
        if (index < shuffledBlackNormalPos.length) {
            const [col, row] = shuffledBlackNormalPos[index];
            boardState[`${col},${row}`] = piece;
        }
    });

    // 更新黑方存储区显示（隐藏所有黑方棋子）
    blackStorage.querySelectorAll('.draggable-piece').forEach(piece => {
        piece.style.display = 'none';
        piece.dataset.currentCount = '0';
    });

    // 隐藏黑方数量标签
    blackStorage.querySelectorAll('.piece-count').forEach(label => {
        label.style.display = 'none';
    });

    // 重新渲染棋盘
    renderBoard();

    // 如果是联机模式，发送游戏状态更新
    if (isOnlineMode) {
        sendGameStateUpdate();
    }
}

// 检查特定棋子是否可以放置在指定位置
function canPieceBePlacedAt(pieceName, col, row, color) {
    // 检查是否是将/帅和士的专属位置
    const isKingPosition = (color === 'red' && (col === 3 || col === 4 || col === 5) && row === 0) ||
                         (color === 'black' && (col === 3 || col === 4 || col === 5) && row === 9);

    // 将/帅只能放在指定的三个位置
    if (pieceName.includes('将') || pieceName.includes('帅')) {
        return isKingPosition;
    }

    // 士只能放在指定的三个位置
    if (pieceName.includes('士')) {
        return isKingPosition;
    }

    // 其他棋子不能放在将/帅和士的专属位置
    if (isKingPosition) {
        return false;
    }

    // 其他棋子使用通用的初始化区域检查
    return isInInitializationZone(col, row, color);
}

// 检查兵是否可以快速移动
function canPawnFastMove(fromCol, fromRow, toCol, toRow) {
    // 快速移动的有效列：0, 8
    const validCols = [0, 8];
    // 快速移动的有效行：0, 4, 5, 9
    const validRows = [0, 4, 5, 9];

    // 检查起点是否在快速移动网络中
    const fromOnValidRow = validRows.includes(fromRow);
    const fromOnValidCol = validCols.includes(fromCol);

    // 起点必须在有效位置（有效行或有效列）
    if (!fromOnValidRow && !fromOnValidCol) {
        return false;
    }

    // 如果起点和终点相同，不是快速移动
    if (fromCol === toCol && fromRow === toRow) {
        return false;
    }

    // 使用BFS寻找路径，只要能找到路径就可以到达
    return findPawnFastPath(fromCol, fromRow, toCol, toRow);
}

// 使用BFS寻找兵的快速移动路径
function findPawnFastPath(fromCol, fromRow, toCol, toRow) {
    const validCols = [0, 8];
    const validRows = [0, 4, 5, 9];

    // 简化版本：直接检查几种常见的多拐弯路径
    const possiblePaths = [
        // 2次拐弯的路径模式
        [[fromCol, fromRow], [fromCol, 0], [toCol, 0], [toCol, toRow]],
        [[fromCol, fromRow], [fromCol, 4], [toCol, 4], [toCol, toRow]],
        [[fromCol, fromRow], [fromCol, 5], [toCol, 5], [toCol, toRow]],
        [[fromCol, fromRow], [fromCol, 9], [toCol, 9], [toCol, toRow]],
        [[fromCol, fromRow], [0, fromRow], [0, toRow], [toCol, toRow]],
        [[fromCol, fromRow], [8, fromRow], [8, toRow], [toCol, toRow]],

        // 3次拐弯的路径模式
        [[fromCol, fromRow], [fromCol, 0], [0, 0], [0, toRow], [toCol, toRow]],
        [[fromCol, fromRow], [fromCol, 0], [8, 0], [8, toRow], [toCol, toRow]],
        [[fromCol, fromRow], [fromCol, 4], [0, 4], [0, toRow], [toCol, toRow]],
        [[fromCol, fromRow], [fromCol, 4], [8, 4], [8, toRow], [toCol, toRow]],
        [[fromCol, fromRow], [fromCol, 5], [0, 5], [0, toRow], [toCol, toRow]],
        [[fromCol, fromRow], [fromCol, 5], [8, 5], [8, toRow], [toCol, toRow]],
        [[fromCol, fromRow], [fromCol, 9], [0, 9], [0, toRow], [toCol, toRow]],
        [[fromCol, fromRow], [fromCol, 9], [8, 9], [8, toRow], [toCol, toRow]],
        [[fromCol, fromRow], [0, fromRow], [0, 0], [toCol, 0], [toCol, toRow]],
        [[fromCol, fromRow], [0, fromRow], [0, 4], [toCol, 4], [toCol, toRow]],
        [[fromCol, fromRow], [0, fromRow], [0, 5], [toCol, 5], [toCol, toRow]],
        [[fromCol, fromRow], [0, fromRow], [0, 9], [toCol, 9], [toCol, toRow]],
        [[fromCol, fromRow], [8, fromRow], [8, 0], [toCol, 0], [toCol, toRow]],
        [[fromCol, fromRow], [8, fromRow], [8, 4], [toCol, 4], [toCol, toRow]],
        [[fromCol, fromRow], [8, fromRow], [8, 5], [toCol, 5], [toCol, toRow]],
        [[fromCol, fromRow], [8, fromRow], [8, 9], [toCol, 9], [toCol, toRow]]
    ];

    // 检查每个可能的路径
    for (let path of possiblePaths) {
        if (isValidPath(path, validCols, validRows) && isPathClear(path)) {
            return true; // 找到有效且畅通的路径
        }
    }

    return false; // 没有找到有效路径
}

// 检查路径是否有效
function isValidPath(path, validCols, validRows) {
    for (let i = 0; i < path.length - 1; i++) {
        const [fromCol, fromRow] = path[i];
        const [toCol, toRow] = path[i + 1];

        // 检查这一步移动是否有效
        if (fromCol === toCol) {
            // 同列移动，起点必须在有效列上
            if (!validCols.includes(fromCol)) {
                return false;
            }
        } else if (fromRow === toRow) {
            // 同行移动，起点必须在有效行上
            if (!validRows.includes(fromRow)) {
                return false;
            }
        } else {
            // 不是同行也不是同列，无效移动
            return false;
        }
    }
    return true;
}

// 检查路径是否畅通（没有棋子阻挡，终点除外）
function isPathClear(path) {
    // 检查路径上每一段移动的所有点是否有棋子阻挡
    for (let i = 0; i < path.length - 1; i++) {
        const [fromCol, fromRow] = path[i];
        const [toCol, toRow] = path[i + 1];

        // 检查这一段路径上的所有中间点
        if (fromCol === toCol) {
            // 同列移动，检查中间的行
            const startRow = Math.min(fromRow, toRow);
            const endRow = Math.max(fromRow, toRow);
            for (let r = startRow + 1; r < endRow; r++) {
                if (boardState[`${fromCol},${r}`]) {
                    return false; // 路径被阻挡
                }
            }
        } else if (fromRow === toRow) {
            // 同行移动，检查中间的列
            const startCol = Math.min(fromCol, toCol);
            const endCol = Math.max(fromCol, toCol);
            for (let c = startCol + 1; c < endCol; c++) {
                if (boardState[`${c},${fromRow}`]) {
                    return false; // 路径被阻挡
                }
            }
        }

        // 检查中转点是否被阻挡（除了起点和最终终点）
        if (i > 0 && i < path.length - 2) {
            // 只检查中间的中转点，不检查最后一个点（终点）
            if (boardState[`${toCol},${toRow}`]) {
                return false; // 中转点被阻挡
            }
        }
    }
    return true; // 路径畅通
}

// 检查位置是否在保护区内（象的快速传送目标点位）
function isInProtectedZone(col, row) {
    const redProtectedPositions = [
        // 红兵初始位置
        [0, 3], [2, 3], [4, 3], [6, 3], [8, 3],
        // 红炮初始位置
        [1, 2], [7, 2]
    ];

    const blackProtectedPositions = [
        // 黑兵初始位置
        [0, 6], [2, 6], [4, 6], [6, 6], [8, 6],
        // 黑炮初始位置
        [1, 7], [7, 7]
    ];

    // 检查是否在红方保护区
    for (let [protectedCol, protectedRow] of redProtectedPositions) {
        if (col === protectedCol && row === protectedRow) {
            return true;
        }
    }

    // 检查是否在黑方保护区
    for (let [protectedCol, protectedRow] of blackProtectedPositions) {
        if (col === protectedCol && row === protectedRow) {
            return true;
        }
    }

    return false;
}

// 检查棋子移动是否有效
function isValidMove(fromCol, fromRow, toCol, toRow, piece) {
    // 检查是否在棋盘范围内
    if (toCol < 0 || toCol > 8 || toRow < 0 || toRow > 9) {
        return false;
    }

    // 检查目标位置是否被己方棋子占据
    const targetPiece = boardState[`${toCol},${toRow}`];
    if (targetPiece) {
        const targetColor = targetPiece.startsWith('红') ? '红' : '黑';
        const currentColor = piece.startsWith('红') ? '红' : '黑';
        if (targetColor === currentColor) {
            return false; // 不能吃己方棋子
        }

        // 检查保护区规则：只有象能吃保护区内的敌方棋子
        if (isInProtectedZone(toCol, toRow) && !piece.includes('象')) {
            return false; // 非象棋子不能吃保护区内的棋子
        }
    }

    const colDiff = Math.abs(toCol - fromCol);
    const rowDiff = Math.abs(toRow - fromRow);

    // 兵的移动规则：一次走一格 + 快速移动
    if (piece.includes('兵')) {
        const validCols = [0, 8];
        const validRows = [0, 4, 5, 9];
        const fromOnValidRow = validRows.includes(fromRow);
        const fromOnValidCol = validCols.includes(fromCol);

        // 普通移动：一次走一格（上下左右）
        if ((colDiff === 1 && rowDiff === 0) || (colDiff === 0 && rowDiff === 1)) {
            return true; // 一格移动总是允许的
        }

        // 检查是否是在快速移动网络上的直线移动
        if (fromOnValidRow || fromOnValidCol) {
            // 同列移动（在有效列上）
            if (fromCol === toCol && validCols.includes(fromCol)) {
                // 检查路径上是否有阻挡
                const startRow = Math.min(fromRow, toRow);
                const endRow = Math.max(fromRow, toRow);
                for (let r = startRow + 1; r < endRow; r++) {
                    if (boardState[`${fromCol},${r}`]) {
                        return false; // 路径被阻挡
                    }
                }
                return true;
            }

            // 同行移动（在有效行上）
            if (fromRow === toRow && validRows.includes(fromRow)) {
                // 检查路径上是否有阻挡
                const startCol = Math.min(fromCol, toCol);
                const endCol = Math.max(fromCol, toCol);
                for (let c = startCol + 1; c < endCol; c++) {
                    if (boardState[`${c},${fromRow}`]) {
                        return false; // 路径被阻挡
                    }
                }
                return true;
            }
        }

        // 复杂的快速移动：需要拐弯的移动
        return canPawnFastMove(fromCol, fromRow, toCol, toRow);
    }

    // 炮的移动规则：一次走一格（上下左右）
    if (piece.includes('炮')) {
        return (colDiff === 1 && rowDiff === 0) || (colDiff === 0 && rowDiff === 1);
    }

    // 象的移动规则：一次走一格 + 快速移动到己方兵炮初始位置，不能走出己方半场
    if (piece.includes('象')) {
        const currentColor = piece.startsWith('红') ? '红' : '黑';

        // 检查是否在己方半场内
        let inOwnHalf = false;
        if (currentColor === '红') {
            // 红方半场：行数 0-4
            inOwnHalf = (toRow >= 0 && toRow <= 4);
        } else {
            // 黑方半场：行数 5-9
            inOwnHalf = (toRow >= 5 && toRow <= 9);
        }

        // 如果目标位置不在己方半场，不能移动
        if (!inOwnHalf) {
            return false;
        }

        // 普通移动：一次走一格（上下左右）
        if ((colDiff === 1 && rowDiff === 0) || (colDiff === 0 && rowDiff === 1)) {
            return true;
        }

        // 特殊移动：快速移动到己方半场的兵和炮的初始位置
        let validTargetPositions = [];

        if (currentColor === '红') {
            // 红方象可以快速移动到红方兵和炮的初始位置
            validTargetPositions = [
                // 红兵初始位置
                [0, 3], [2, 3], [4, 3], [6, 3], [8, 3],
                // 红炮初始位置
                [1, 2], [7, 2]
            ];
        } else {
            // 黑方象可以快速移动到黑方兵和炮的初始位置
            validTargetPositions = [
                // 黑兵初始位置
                [0, 6], [2, 6], [4, 6], [6, 6], [8, 6],
                // 黑炮初始位置
                [1, 7], [7, 7]
            ];
        }

        // 检查目标位置是否是有效的快速移动位置且为空
        for (let [targetCol, targetRow] of validTargetPositions) {
            if (toCol === targetCol && toRow === targetRow) {
                // 目标位置必须为空才能快速移动
                return !targetPiece;
            }
        }

        return false;
    }

    // 车的移动规则：直线移动，路径上不能有棋子
    if (piece.includes('车')) {
        // 必须是直线移动（同行或同列）
        if (colDiff === 0 || rowDiff === 0) {
            // 检查路径上是否有棋子阻挡
            if (colDiff === 0) {
                // 垂直移动
                const startRow = Math.min(fromRow, toRow);
                const endRow = Math.max(fromRow, toRow);
                for (let r = startRow + 1; r < endRow; r++) {
                    if (boardState[`${fromCol},${r}`]) {
                        return false; // 路径被阻挡
                    }
                }
            } else {
                // 水平移动
                const startCol = Math.min(fromCol, toCol);
                const endCol = Math.max(fromCol, toCol);
                for (let c = startCol + 1; c < endCol; c++) {
                    if (boardState[`${c},${fromRow}`]) {
                        return false; // 路径被阻挡
                    }
                }
            }
            return true;
        }
        return false;
    }

    // 马的移动规则：日字形移动，需要检查蹩马腿
    if (piece.includes('马')) {
        // 马走日字：2+1或1+2的组合
        if ((colDiff === 2 && rowDiff === 1) || (colDiff === 1 && rowDiff === 2)) {
            // 检查蹩马腿
            let blockCol, blockRow;
            if (colDiff === 2) {
                // 水平方向走2格，检查中间位置
                blockCol = fromCol + (toCol > fromCol ? 1 : -1);
                blockRow = fromRow;
            } else {
                // 垂直方向走2格，检查中间位置
                blockCol = fromCol;
                blockRow = fromRow + (toRow > fromRow ? 1 : -1);
            }

            // 如果蹩马腿位置有棋子，则不能移动
            if (boardState[`${blockCol},${blockRow}`]) {
                return false;
            }
            return true;
        }
        return false;
    }

    // 其他棋子暂时不允许移动
    return false;
}

// 清除所有高亮和角框
function clearHighlights() {
    document.querySelectorAll('.position').forEach(pos => {
        pos.classList.remove('selected', 'empty-target');
        // 移除角框元素
        pos.querySelectorAll('.corner-frame, .corner-bottom').forEach(corner => {
            corner.remove();
        });
    });
}

// 添加四个角的三角框架（围绕棋子图片或空位）
function addCornerFrames(position, type = 'selected') {
    // 添加两个元素，每个元素用::before和::after创建两个三角形
    const topCorners = document.createElement('div');
    topCorners.className = 'corner-frame';
    position.appendChild(topCorners);

    const bottomCorners = document.createElement('div');
    bottomCorners.className = 'corner-bottom';
    position.appendChild(bottomCorners);

    position.classList.add(type);
}

// 显示胜利信息
function showVictoryMessage(message) {
    const victoryElement = document.getElementById('victoryMessage');
    victoryElement.textContent = message;
    victoryElement.style.display = 'block';
}

// 移动棋子
function movePiece(fromCol, fromRow, toCol, toRow) {
    const fromKey = `${fromCol},${fromRow}`;
    const toKey = `${toCol},${toRow}`;

    const movingPiece = boardState[fromKey];
    const targetPiece = boardState[toKey];

    // 检查特殊吃子规则：士、炮、兵、将的特殊规则
    if (targetPiece) {
        // 有目标棋子，这是吃子操作

        // 将的特殊规则
        if (targetPiece.includes('将') || targetPiece.includes('帅')) {
            if (movingPiece.includes('兵')) {
                // 兵吃将/帅：游戏胜利
                delete boardState[fromKey];
                delete boardState[toKey];

                // 显示胜利信息
                const winnerColor = movingPiece.startsWith('红') ? '红方' : '黑方';
                showVictoryMessage(`${winnerColor}获胜！兵成功吃掉了敌方的将/帅！`);
            } else {
                // 其他棋子吃将/帅：攻击方消失，将/帅还在
                delete boardState[fromKey];
                // targetPiece (将/帅) 保持在原位置，不删除
            }
        }
        // 炮的特殊规则（优先级高，因为炮被吃时总是同归于尽）
        else if (movingPiece.includes('炮') || targetPiece.includes('炮')) {
            // 炮吃任何棋子时，双方都消失
            // 炮被任何棋子吃掉时，双方都消失（包括兵吃炮）
            delete boardState[fromKey];
            delete boardState[toKey];
        }
        // 兵的特殊规则（除了吃炮和将/帅的情况）
        else if (movingPiece.includes('兵')) {
            if (targetPiece.includes('士')) {
                // 兵吃士：双方都消失（同归于尽）
                delete boardState[fromKey];
                delete boardState[toKey];
            } else if (targetPiece.includes('兵')) {
                // 兵吃敌方兵：双方都消失（同归于尽）
                delete boardState[fromKey];
                delete boardState[toKey];
            } else {
                // 兵吃其他棋子：兵自杀，目标棋子还在
                delete boardState[fromKey];
                // targetPiece 保持在原位置，不删除
            }
        }
        // 士的特殊规则（非兵吃士的情况）
        else if (targetPiece.includes('士')) {
            // 其他棋子吃士：只有吃士的棋子消失，士还在
            delete boardState[fromKey];
            // targetPiece (士) 保持在原位置，不删除
        }
        // 正常吃子
        else {
            // 正常吃子，移动棋子到目标位置
            boardState[toKey] = boardState[fromKey];
            delete boardState[fromKey];
        }
    } else {
        // 没有目标棋子，正常移动
        boardState[toKey] = boardState[fromKey];
        delete boardState[fromKey];
    }

    // 重新渲染棋盘
    renderBoard();

    // 在联机模式下切换回合
    if (isOnlineMode && gameMode === 'playing') {
        switchTurn();
    }
}

// 渲染棋盘
function renderBoard() {
    const currentGrid = gameMode === 'setup' ? grid : gameGrid;

    // 清空现有棋子
    currentGrid.querySelectorAll('.chess-piece').forEach(piece => piece.remove());

    // 重新添加棋子
    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 9; col++) {
            const pieceKey = `${col},${row}`;
            if (boardState[pieceKey]) {
                const position = currentGrid.querySelector(`[data-col="${col}"][data-row="${row}"]`);
                if (position) {
                    const piece = document.createElement('img');
                    piece.className = 'chess-piece';

                    const pieceName = boardState[pieceKey];
                    const pieceColor = pieceName.startsWith('红') ? 'red' : 'black';

                    // 在联机模式下，对面玩家的棋子显示为蒙版（包括初始化阶段）
                    if (isOnlineMode && playerSide) {
                        if (pieceColor !== playerSide) {
                            // 对面玩家的棋子显示蒙版
                            piece.src = 'IMAGE/蒙版.png';
                            piece.alt = '蒙版';
                            piece.dataset.piece = pieceName; // 保留真实棋子信息用于游戏逻辑
                            piece.dataset.masked = 'true'; // 标记为蒙版显示
                        } else {
                            // 自己的棋子正常显示
                            piece.src = `IMAGE/${pieceName}.png`;
                            piece.alt = pieceName;
                            piece.dataset.piece = pieceName;
                            piece.dataset.masked = 'false';
                        }
                    } else {
                        // 单人模式或未分配身份时正常显示所有棋子
                        piece.src = `IMAGE/${pieceName}.png`;
                        piece.alt = pieceName;
                        piece.dataset.piece = pieceName;
                        piece.dataset.masked = 'false';
                    }

                    piece.dataset.color = pieceColor;

                    // 如果是初始化模式，添加双击和拖拽功能
                    if (gameMode === 'setup') {
                        const pieceName = boardState[pieceKey];
                        const pieceColor = pieceName.startsWith('红') ? 'red' : 'black';

                        // 启用拖拽和指针事件
                        piece.draggable = true;
                        piece.style.pointerEvents = 'auto';
                        piece.style.webkitUserDrag = 'element';
                        piece.style.cursor = 'grab';

                        // 添加双击移除功能
                        piece.addEventListener('dblclick', (e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            // 移除棋子并放回存储区
                            delete boardState[`${col},${row}`];
                            position.removeChild(piece);

                            // 找到对应的存储区棋子并增加数量
                            const storage = pieceColor === 'red' ? redStorage : blackStorage;
                            const slots = storage.querySelectorAll('.storage-slot');

                            for (let slot of slots) {
                                const slotPiece = slot.querySelector('.draggable-piece');
                                if (slotPiece && slotPiece.dataset.piece === pieceName) {
                                    const currentCount = parseInt(slotPiece.dataset.currentCount);
                                    const newCount = currentCount + 1;
                                    slotPiece.dataset.currentCount = newCount;

                                    // 显示棋子（如果之前被隐藏）
                                    slotPiece.style.display = 'block';

                                    // 更新数量显示
                                    let countLabel = slot.querySelector('.piece-count');
                                    if (newCount > 1) {
                                        if (!countLabel) {
                                            countLabel = document.createElement('div');
                                            countLabel.className = 'piece-count';
                                            slot.appendChild(countLabel);
                                        }
                                        countLabel.textContent = `×${newCount}`;
                                        countLabel.style.display = 'flex';
                                    }
                                    break;
                                }
                            }
                        });

                        // 添加拖拽功能，让棋子可以拖回存储区或重新放置
                        piece.addEventListener('dragstart', (e) => {
                            draggedPiece = piece;
                            piece.classList.add('dragging');
                            piece.style.cursor = 'grabbing';
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/html', piece.outerHTML);
                            // 标记这是从棋盘拖拽的棋子
                            piece.dataset.fromBoard = 'true';
                            piece.dataset.boardCol = col;
                            piece.dataset.boardRow = row;
                        });

                        piece.addEventListener('dragend', (e) => {
                            piece.classList.remove('dragging');
                            piece.style.cursor = 'grab';
                            draggedPiece = null;
                            delete piece.dataset.fromBoard;
                            delete piece.dataset.boardCol;
                            delete piece.dataset.boardRow;
                        });
                    }

                    position.appendChild(piece);
                }
            }
        }
    }
}

// 更新玩家身份显示
function updatePlayerIdentityDisplay() {
    if (isOnlineMode) {
        // 查找或创建身份显示元素
        let identityDisplay = document.getElementById('playerIdentity');
        if (!identityDisplay) {
            identityDisplay = document.createElement('div');
            identityDisplay.id = 'playerIdentity';
            identityDisplay.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                color: white;
                padding: 10px 15px;
                border-radius: 5px;
                font-size: 16px;
                font-weight: bold;
                z-index: 1000;
            `;
            document.body.appendChild(identityDisplay);
        }

        if (playerSide) {
            // 已分配身份
            const sideText = playerSide === 'red' ? '红方' : '黑方';
            identityDisplay.textContent = sideText;
            identityDisplay.style.background = playerSide === 'red' ? 'rgba(244, 67, 54, 0.9)' : 'rgba(33, 33, 33, 0.9)';
            identityDisplay.style.borderColor = playerSide === 'red' ? '#d32f2f' : '#424242';
            identityDisplay.style.border = `2px solid ${playerSide === 'red' ? '#d32f2f' : '#424242'}`;
        } else {
            // 等待分配身份
            identityDisplay.textContent = '等待分配身份...';
            identityDisplay.style.background = 'rgba(255, 152, 0, 0.9)'; // 橙色
            identityDisplay.style.borderColor = '#f57c00';
            identityDisplay.style.border = '2px solid #f57c00';
        }
    } else {
        // 单人模式，移除身份显示
        const identityDisplay = document.getElementById('playerIdentity');
        if (identityDisplay) {
            identityDisplay.remove();
        }
    }
}

// 更新初始化界面的玩家身份显示
function updateSetupPlayerIdentity() {
    const redIdentity = document.getElementById('redPlayerIdentity');
    const blackIdentity = document.getElementById('blackPlayerIdentity');

    if (isOnlineMode && gameMode === 'setup') {
        if (playerSide === 'red') {
            // 红方玩家
            redIdentity.textContent = '本局您为红方';
            redIdentity.style.display = 'block';
            blackIdentity.style.display = 'none';
        } else if (playerSide === 'black') {
            // 黑方玩家
            blackIdentity.textContent = '本局您为黑方';
            blackIdentity.style.display = 'block';
            redIdentity.style.display = 'none';
        } else {
            // 等待分配身份，两边都不显示
            redIdentity.style.display = 'none';
            blackIdentity.style.display = 'none';
        }
    } else {
        // 单人模式或非初始化阶段，隐藏显示
        redIdentity.style.display = 'none';
        blackIdentity.style.display = 'none';
    }
}

// 检查是否可以选择棋子（权限和回合制控制）
function canSelectPiece(piece) {
    if (!piece) return false;

    // 单人模式：可以选择任何棋子
    if (!isOnlineMode) return true;

    // 联机模式：检查权限和回合
    const pieceColor = piece.startsWith('红') ? 'red' : 'black';

    // 检查是否是自己的棋子
    if (pieceColor !== playerSide) {
        console.log('不能选择对方的棋子');
        return false;
    }

    // 检查是否轮到自己
    if (currentTurn !== playerSide) {
        console.log('还没轮到您');
        return false;
    }

    return true;
}

// 切换回合
function switchTurn() {
    // 切换到下一个玩家
    currentTurn = currentTurn === 'red' ? 'black' : 'red';

    // 如果回到红方，增加回合数
    if (currentTurn === 'red') {
        turnNumber++;
    }

    // 更新回合显示
    updateTurnDisplay();

    // 发送游戏状态更新
    if (isOnlineMode) {
        sendGameStateUpdate();
    }
}

// 创建棋盘位置点
function createBoard(gridElement, isSetupMode = false) {
    gridElement.innerHTML = '';

    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 9; col++) {
            const position = document.createElement('div');
            position.className = 'position';
            position.dataset.col = col;
            position.dataset.row = row;

            if (isSetupMode) {
                // 初始化模式：添加点击放置事件
                position.addEventListener('click', (e) => {
                    e.preventDefault();

                    // 如果有选中的存储区棋子，尝试放置
                    if (selectedStoragePiece) {
                        const pieceName = selectedStoragePiece.dataset.piece;
                        const pieceColor = selectedStoragePiece.dataset.color;

                        // 检查是否可以放置在这个位置
                        if (canPieceBePlacedAt(pieceName, col, row, pieceColor) && !boardState[`${col},${row}`]) {
                            // 放置棋子到棋盘
                            boardState[`${col},${row}`] = pieceName;

                            // 更新存储区数量
                            const currentCount = parseInt(selectedStoragePiece.dataset.currentCount);
                            const newCount = currentCount - 1;
                            selectedStoragePiece.dataset.currentCount = newCount;

                            // 更新数量显示
                            const selectedSlot = selectedStoragePiece.parentElement;
                            const countLabel = selectedSlot.querySelector('.piece-count');
                            if (newCount > 1) {
                                if (countLabel) {
                                    countLabel.textContent = `×${newCount}`;
                                }
                            } else if (newCount === 1) {
                                // 移除数量标签
                                if (countLabel) {
                                    countLabel.remove();
                                }
                            } else {
                                // 数量为0，隐藏棋子
                                selectedStoragePiece.style.display = 'none';
                            }

                            // 清除选择状态
                            clearStorageSelection();

                            // 重新渲染棋盘
                            renderBoard();

                            // 如果是联机模式，发送游戏状态更新
                            if (isOnlineMode) {
                                sendGameStateUpdate();
                            }
                        }
                    }
                });

                // 初始化模式：添加拖拽放置事件
                position.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    if (draggedPiece) {
                        const pieceColor = draggedPiece.dataset.color;
                        const pieceName = draggedPiece.dataset.piece;
                        const isFromBoard = draggedPiece.dataset.fromBoard === 'true';

                        // 如果是从棋盘拖拽的棋子，需要检查目标位置是否为空或者是原位置
                        const isOriginalPosition = isFromBoard &&
                            parseInt(draggedPiece.dataset.boardCol) === col &&
                            parseInt(draggedPiece.dataset.boardRow) === row;

                        const targetIsEmpty = !boardState[`${col},${row}`] || isOriginalPosition;

                        if (canPieceBePlacedAt(pieceName, col, row, pieceColor) && targetIsEmpty) {
                            e.dataTransfer.dropEffect = 'move';
                            position.classList.add('drag-over-valid');
                            position.classList.remove('drag-over-invalid');
                        } else {
                            e.dataTransfer.dropEffect = 'none';
                            position.classList.add('drag-over-invalid');
                            position.classList.remove('drag-over-valid');
                        }
                    }
                });

                position.addEventListener('dragleave', () => {
                    position.classList.remove('drag-over-valid', 'drag-over-invalid');
                });

                position.addEventListener('drop', (e) => {
                    e.preventDefault();
                    position.classList.remove('drag-over-valid', 'drag-over-invalid');

                    if (draggedPiece) {
                        const pieceColor = draggedPiece.dataset.color;
                        const pieceName = draggedPiece.dataset.piece;
                        const isFromBoard = draggedPiece.dataset.fromBoard === 'true';

                        // 如果是从棋盘拖拽的棋子，需要检查目标位置是否为空或者是原位置
                        const isOriginalPosition = isFromBoard &&
                            parseInt(draggedPiece.dataset.boardCol) === col &&
                            parseInt(draggedPiece.dataset.boardRow) === row;

                        const targetIsEmpty = !boardState[`${col},${row}`] || isOriginalPosition;

                        if (canPieceBePlacedAt(pieceName, col, row, pieceColor) && targetIsEmpty) {
                            // 有效放置
                            if (isFromBoard) {
                                // 从棋盘拖拽：移除原位置的棋子
                                const originalCol = parseInt(draggedPiece.dataset.boardCol);
                                const originalRow = parseInt(draggedPiece.dataset.boardRow);
                                delete boardState[`${originalCol},${originalRow}`];

                                // 如果不是拖回原位置，则在新位置放置棋子
                                if (!isOriginalPosition) {
                                    boardState[`${col},${row}`] = pieceName;
                                } else {
                                    // 拖回原位置，重新放置
                                    boardState[`${col},${row}`] = pieceName;
                                }
                            } else {
                                // 从存储区拖拽：正常处理
                                boardState[`${col},${row}`] = pieceName;

                                // 更新存储区数量
                                const currentCount = parseInt(draggedPiece.dataset.currentCount);
                                const newCount = currentCount - 1;
                                draggedPiece.dataset.currentCount = newCount;

                                // 更新数量显示
                                const countLabel = draggedPiece.parentElement.querySelector('.piece-count');
                                if (newCount > 1) {
                                    if (countLabel) {
                                        countLabel.textContent = `×${newCount}`;
                                    }
                                } else if (newCount === 1) {
                                    // 移除数量标签
                                    if (countLabel) {
                                        countLabel.remove();
                                    }
                                } else {
                                    // 数量为0，隐藏棋子
                                    draggedPiece.style.display = 'none';
                                }
                            }

                            // 重新渲染棋盘
                            renderBoard();

                            // 如果是联机模式，发送游戏状态更新
                            if (isOnlineMode) {
                                sendGameStateUpdate();
                            }
                        }
                    }
                });
            } else {
                // 游戏模式：添加点击事件
                position.addEventListener('click', () => {
                    const clickedCol = parseInt(col);
                    const clickedRow = parseInt(row);
                    const clickedPiece = boardState[`${clickedCol},${clickedRow}`];

                    if (selectedPosition) {
                        // 已选中棋子，尝试移动
                        const [selectedCol, selectedRow] = selectedPosition;
                        const selectedPiece = boardState[`${selectedCol},${selectedRow}`];

                        if (clickedCol === selectedCol && clickedRow === selectedRow) {
                            // 点击同一位置，取消选择
                            clearHighlights();
                            selectedPosition = null;
                            emptyTargetPosition = null;
                        } else if (selectedPiece && isValidMove(selectedCol, selectedRow, clickedCol, clickedRow, selectedPiece)) {
                            // 有效移动
                            clearHighlights();
                            movePiece(selectedCol, selectedRow, clickedCol, clickedRow);

                            // 如果是联机模式，发送移动信息
                            if (isOnlineMode) {
                                sendMove({
                                    fromCol: selectedCol,
                                    fromRow: selectedRow,
                                    toCol: clickedCol,
                                    toRow: clickedRow
                                });
                            }

                            selectedPosition = null;
                            emptyTargetPosition = null;
                        } else {
                            // 无效移动，重新选择
                            clearHighlights();
                            selectedPosition = null;
                            emptyTargetPosition = null;
                            if (clickedPiece) {
                                // 在联机模式下检查权限
                                if (canSelectPiece(clickedPiece)) {
                                    selectedPosition = [clickedCol, clickedRow];
                                    addCornerFrames(position, 'selected');
                                }
                            } else if (!clickedPiece) {
                                // 点击空位，显示红色角框
                                emptyTargetPosition = [clickedCol, clickedRow];
                                addCornerFrames(position, 'empty-target');
                            }
                        }
                    } else {
                        // 未选中棋子
                        if (emptyTargetPosition) {
                            // 已有空位被选中
                            const [emptyCol, emptyRow] = emptyTargetPosition;
                            if (clickedCol === emptyCol && clickedRow === emptyRow) {
                                // 点击同一空位，取消红色角框
                                clearHighlights();
                                emptyTargetPosition = null;
                            } else {
                                // 点击其他位置
                                clearHighlights();
                                emptyTargetPosition = null;
                                if (clickedPiece) {
                                    // 在联机模式下检查权限
                                    if (canSelectPiece(clickedPiece)) {
                                        selectedPosition = [clickedCol, clickedRow];
                                        addCornerFrames(position, 'selected');
                                    }
                                } else if (!clickedPiece) {
                                    // 点击其他空位，显示红色角框
                                    emptyTargetPosition = [clickedCol, clickedRow];
                                    addCornerFrames(position, 'empty-target');
                                }
                            }
                        } else {
                            // 没有任何选中
                            clearHighlights();
                            if (clickedPiece) {
                                // 在联机模式下检查权限
                                if (canSelectPiece(clickedPiece)) {
                                    selectedPosition = [clickedCol, clickedRow];
                                    addCornerFrames(position, 'selected');
                                }
                            } else if (!clickedPiece) {
                                // 点击空位，显示红色角框
                                emptyTargetPosition = [clickedCol, clickedRow];
                                addCornerFrames(position, 'empty-target');
                            }
                        }
                    }
                });
            }

            gridElement.appendChild(position);
        }
    }
}

// 开始游戏
function startGame() {
    gameMode = 'playing';
    setupContainer.style.display = 'none';
    gameBoard.style.display = 'block';

    // 重置回合状态
    currentTurn = 'red';
    turnNumber = 1;

    // 隐藏初始化界面的身份显示
    updateSetupPlayerIdentity();

    // 创建游戏棋盘
    createBoard(gameGrid, false);

    // 渲染棋子到游戏棋盘
    renderBoard();

    // 更新回合显示
    updateTurnDisplay();
}

// 初始化游戏
function initializeGame() {
    gameMode = 'setup';
    boardState = {};

    // 重置完成状态
    redCompleted = false;
    blackCompleted = false;

    // 显示初始化界面
    setupContainer.style.display = 'flex';
    gameBoard.style.display = 'none';

    // 清除胜利消息
    document.getElementById('victoryMessage').style.display = 'none';

    // 清除存储区选择
    clearStorageSelection();

    // 初始化棋子存储区
    initializePieceStorage();

    // 更新状态显示
    updateRedStatus();
    updateBlackStatus();

    // 创建初始化棋盘
    createBoard(grid, true);
}

// 更新红方状态显示
function updateRedStatus() {
    if (redCompleted) {
        redStatus.style.display = 'block';
        redCompleteBtn.textContent = '继续初始化';
        redCompleteBtn.style.backgroundColor = '#FF9800'; // 橙色
    } else {
        redStatus.style.display = 'none';
        redCompleteBtn.textContent = '完成初始化';
        redCompleteBtn.style.backgroundColor = '#4CAF50'; // 绿色
    }
}

// 更新黑方状态显示
function updateBlackStatus() {
    if (blackCompleted) {
        blackStatus.style.display = 'block';
        blackCompleteBtn.textContent = '继续初始化';
        blackCompleteBtn.style.backgroundColor = '#FF9800'; // 橙色
    } else {
        blackStatus.style.display = 'none';
        blackCompleteBtn.textContent = '完成初始化';
        blackCompleteBtn.style.backgroundColor = '#4CAF50'; // 绿色
    }
}

// 检查是否可以开始游戏
function checkGameStart() {
    if (redCompleted && blackCompleted) {
        // 两边都完成了，自动开始游戏
        setTimeout(() => {
            startGame();
        }, 500); // 延迟500ms让用户看到状态变化
    }
}

// 红方完成初始化
function redComplete() {
    // 在联机模式下，检查是否有权限操作红方
    if (isOnlineMode && playerSide && playerSide !== 'red') {
        console.log('无权限操作红方');
        return;
    }

    if (redCompleted) {
        // 如果已完成，点击"继续初始化"重新开始
        redCompleted = false;
        updateRedStatus();
    } else {
        // 完成初始化
        redCompleted = true;
        updateRedStatus();
        clearStorageSelection();
        checkGameStart();
    }

    // 如果是联机模式，发送游戏状态更新
    if (isOnlineMode) {
        sendGameStateUpdate();
    }
}

// 黑方完成初始化
function blackComplete() {
    // 在联机模式下，检查是否有权限操作黑方
    if (isOnlineMode && playerSide && playerSide !== 'black') {
        console.log('无权限操作黑方');
        return;
    }

    if (blackCompleted) {
        // 如果已完成，点击"继续初始化"重新开始
        blackCompleted = false;
        updateBlackStatus();
    } else {
        // 完成初始化
        blackCompleted = true;
        updateBlackStatus();
        clearStorageSelection();
        checkGameStart();
    }

    // 如果是联机模式，发送游戏状态更新
    if (isOnlineMode) {
        sendGameStateUpdate();
    }
}

// 红方重新初始化
function redReset() {
    // 在联机模式下，检查是否有权限操作红方
    if (isOnlineMode && playerSide && playerSide !== 'red') {
        console.log('无权限操作红方');
        return;
    }

    // 清除存储区选择和可放置位置提示
    clearStorageSelection();

    // 重置红方完成状态
    redCompleted = false;
    updateRedStatus();

    // 清除棋盘上的红方棋子
    Object.keys(boardState).forEach(key => {
        if (boardState[key].startsWith('红')) {
            delete boardState[key];
        }
    });

    // 重置红方存储区显示（显示所有红方棋子）
    redStorage.querySelectorAll('.draggable-piece').forEach(piece => {
        piece.style.display = 'block';
        piece.dataset.currentCount = piece.dataset.maxCount;
    });

    // 显示红方数量标签
    redStorage.querySelectorAll('.piece-count').forEach((label, index) => {
        const piece = redStorage.querySelectorAll('.draggable-piece')[index];
        if (piece && parseInt(piece.dataset.maxCount) > 1) {
            label.style.display = 'flex';
            label.textContent = `×${piece.dataset.maxCount}`;
        }
    });

    // 重新渲染棋盘
    renderBoard();

    // 如果是联机模式，发送游戏状态更新
    if (isOnlineMode) {
        sendGameStateUpdate();
    }
}

// 黑方重新初始化
function blackReset() {
    // 在联机模式下，检查是否有权限操作黑方
    if (isOnlineMode && playerSide && playerSide !== 'black') {
        console.log('无权限操作黑方');
        return;
    }

    // 清除存储区选择和可放置位置提示
    clearStorageSelection();

    // 重置黑方完成状态
    blackCompleted = false;
    updateBlackStatus();

    // 清除棋盘上的黑方棋子
    Object.keys(boardState).forEach(key => {
        if (boardState[key].startsWith('黑') || boardState[key].startsWith('黒')) {
            delete boardState[key];
        }
    });

    // 重置黑方存储区显示（显示所有黑方棋子）
    blackStorage.querySelectorAll('.draggable-piece').forEach(piece => {
        piece.style.display = 'block';
        piece.dataset.currentCount = piece.dataset.maxCount;
    });

    // 显示黑方数量标签
    blackStorage.querySelectorAll('.piece-count').forEach((label, index) => {
        const piece = blackStorage.querySelectorAll('.draggable-piece')[index];
        if (piece && parseInt(piece.dataset.maxCount) > 1) {
            label.style.display = 'flex';
            label.textContent = `×${piece.dataset.maxCount}`;
        }
    });

    // 重新渲染棋盘
    renderBoard();

    // 如果是联机模式，发送游戏状态更新
    if (isOnlineMode) {
        sendGameStateUpdate();
    }
}

// 红方随机初始化按钮事件
redAutoInitBtn.addEventListener('click', redAutoRandomInitialize);

// 黑方随机初始化按钮事件
blackAutoInitBtn.addEventListener('click', blackAutoRandomInitialize);

// 红方重新初始化按钮事件
redResetBtn.addEventListener('click', redReset);

// 黑方重新初始化按钮事件
blackResetBtn.addEventListener('click', blackReset);

// 红方完成初始化按钮事件
redCompleteBtn.addEventListener('click', redComplete);

// 黑方完成初始化按钮事件
blackCompleteBtn.addEventListener('click', blackComplete);

// 主菜单功能
function showMainMenu() {
    mainMenu.style.display = 'flex';
    gameContainer.style.display = 'none';
}

function hideMainMenu() {
    mainMenu.style.display = 'none';
    gameContainer.style.display = 'block';
}

function startSinglePlayerGame() {
    isOnlineMode = false;
    playerSide = null; // 清除玩家身份
    hideMainMenu();
    // 初始化单人游戏
    initializeGame();
    updatePlayerIdentityDisplay(); // 更新身份显示（移除）
    updateSetupPlayerIdentity(); // 更新初始化界面身份显示（隐藏）
}

function startLanGame() {
    isOnlineMode = true;
    hideMainMenu();
    // 连接到服务器
    connectToServer();
    // 初始化联机游戏
    initializeGame();
    // 立即更新身份显示（即使还没分配身份，也显示等待状态）
    updatePlayerIdentityDisplay();
    updateSetupPlayerIdentity();
}

function startRemoteGame() {
    // 从配置文件获取默认远程服务器地址
    const defaultRemoteServer = window.CHESS_CONFIG ? window.CHESS_CONFIG.DEFAULT_REMOTE_SERVER : 'wss://your-codespace-name-3000.preview.app.github.dev';

    // 可以让用户输入自定义服务器地址，或使用默认地址
    let serverUrl = prompt('请输入远程服务器地址（留空使用默认服务器）:', defaultRemoteServer);

    if (serverUrl === null) {
        // 用户取消了
        return;
    }

    if (!serverUrl.trim()) {
        serverUrl = defaultRemoteServer;
    }

    // 确保URL格式正确
    if (!serverUrl.startsWith('ws://') && !serverUrl.startsWith('wss://') &&
        !serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
        serverUrl = 'wss://' + serverUrl;
    }

    isOnlineMode = true;
    hideMainMenu();
    // 连接到远程服务器
    connectToServer(serverUrl);
    // 初始化联机游戏
    initializeGame();
    // 立即更新身份显示（即使还没分配身份，也显示等待状态）
    updatePlayerIdentityDisplay();
    updateSetupPlayerIdentity();
}

// 主菜单按钮事件
singlePlayerBtn.addEventListener('click', startSinglePlayerGame);
lanGameBtn.addEventListener('click', startLanGame);
onlineGameBtn.addEventListener('click', startRemoteGame);

// 页面加载时显示主菜单
showMainMenu();