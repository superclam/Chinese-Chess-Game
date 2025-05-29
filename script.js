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
const rulesBtnSetup = document.getElementById('rulesBtnSetup');
const rulesBtnGame = document.getElementById('rulesBtnGame');
const rulesPanel = document.getElementById('rulesPanel');
const returnBtn = document.getElementById('returnBtn');


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
let lastMovePositions = null; // 联机模式下最后一次移动的起点和终点坐标 {from: [col, row], to: [col, row]}

// 动态棋盘状态（初始为空）
let boardState = {};

// 规则面板状态
let rulesVisible = false;



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

    console.log(`敌方移动: 从 (${fromCol},${fromRow}) 到 (${toCol},${toRow})`);

    // 清除之前的移动历史显示
    clearMoveHistory();

    // 执行移动
    movePiece(fromCol, fromRow, toCol, toRow, true);

    // 敌方移动后，显示红色三角框标记最后一步
    if (isOnlineMode && gameMode === 'playing') {
        // 转换逻辑坐标为显示坐标
        const fromDisplayCoords = logicToDisplay(fromCol, fromRow);
        const toDisplayCoords = logicToDisplay(toCol, toRow);

        console.log(`显示敌方移动标记: 起点(${fromDisplayCoords.col},${fromDisplayCoords.row}) 终点(${toDisplayCoords.col},${toDisplayCoords.row})`);

        // 获取游戏棋盘上的位置元素
        const fromPosition = gameGrid.querySelector(`[data-col="${fromDisplayCoords.col}"][data-row="${fromDisplayCoords.row}"]`);
        const toPosition = gameGrid.querySelector(`[data-col="${toDisplayCoords.col}"][data-row="${toDisplayCoords.row}"]`);

        // 添加起点红色三角框
        if (fromPosition) {
            addCornerFrames(fromPosition, 'move-from');
            console.log('起点红色三角框已添加');
        } else {
            console.log('未找到起点位置');
        }

        // 添加终点红色三角框
        if (toPosition) {
            addCornerFrames(toPosition, 'move-to');
            console.log('终点红色三角框已添加');
        } else {
            console.log('未找到终点位置');
        }

        // 保存移动历史
        lastMovePositions = {
            from: [fromCol, fromRow],
            to: [toCol, toRow]
        };

        switchTurn();
    }
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

    // 随机打乱棋子顺序，避免位置固定
    const shuffledRedPieces = shuffleArray(allPieces.red);
    const shuffledBlackPieces = shuffleArray(allPieces.black);

    // 创建红方棋子
    shuffledRedPieces.forEach((pieceData, index) => {
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
    shuffledBlackPieces.forEach((pieceData, index) => {
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

                // 如果是联机模式，发送游戏状态更新
                if (isOnlineMode) {
                    sendGameStateUpdate();
                }
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
                // 转换逻辑坐标为显示坐标
                const displayCoords = logicToDisplay(col, row);
                const position = grid.querySelector(`[data-col="${displayCoords.col}"][data-row="${displayCoords.row}"]`);
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



// 检查位置是否在铁路线上
function isOnRailway(col, row) {
    // 铁路线：0、4、5、9行和0、8列
    return (row === 0 || row === 4 || row === 5 || row === 9) || (col === 0 || col === 8);
}

// 检查铁路线路径是否被阻挡（使用广度优先搜索）
function isRailwayPathClear(fromCol, fromRow, toCol, toRow) {
    // 如果起点和终点都在铁路线上，检查路径
    if (!isOnRailway(fromCol, fromRow) || !isOnRailway(toCol, toRow)) {
        return false;
    }

    // 如果起点和终点相同
    if (fromCol === toCol && fromRow === toRow) {
        return true;
    }

    // 使用广度优先搜索找到路径
    const queue = [{col: fromCol, row: fromRow, path: [`${fromCol},${fromRow}`]}];
    const visited = new Set([`${fromCol},${fromRow}`]);

    while (queue.length > 0) {
        const {col, row, path} = queue.shift();

        // 检查四个方向的移动
        const directions = [
            {dc: 0, dr: 1},  // 下
            {dc: 0, dr: -1}, // 上
            {dc: 1, dr: 0},  // 右
            {dc: -1, dr: 0}  // 左
        ];

        for (const {dc, dr} of directions) {
            // 尝试在这个方向上移动多步
            for (let step = 1; step <= 9; step++) {
                const newCol = col + dc * step;
                const newRow = row + dr * step;

                // 检查是否超出棋盘范围
                if (newCol < 0 || newCol > 8 || newRow < 0 || newRow > 9) {
                    break;
                }

                // 检查新位置是否在铁路线上
                if (!isOnRailway(newCol, newRow)) {
                    break;
                }

                const newPosKey = `${newCol},${newRow}`;

                // 如果到达目标位置，直接返回true（允许吃子）
                if (newCol === toCol && newRow === toRow) {
                    return true; // 找到目标位置，无论是否有棋子（吃子）
                }

                // 检查路径上是否有棋子阻挡（不包括目标位置）
                if (boardState[`${newCol},${newRow}`]) {
                    break; // 被阻挡，不能继续在这个方向移动
                }

                // 如果这个位置还没有访问过，加入队列
                if (!visited.has(newPosKey)) {
                    visited.add(newPosKey);
                    queue.push({
                        col: newCol,
                        row: newRow,
                        path: [...path, newPosKey]
                    });
                }
            }
        }
    }

    return false; // 没有找到有效路径
}

// 兵的移动规则验证
function isValidPawnMove(fromCol, fromRow, toCol, toRow) {
    const colDiff = Math.abs(toCol - fromCol);
    const rowDiff = Math.abs(toRow - fromRow);

    // 不能原地不动
    if (colDiff === 0 && rowDiff === 0) {
        return false;
    }

    // 一、铁路线移动（快速路径）
    if (isOnRailway(fromCol, fromRow) && isOnRailway(toCol, toRow)) {
        // 在铁路线上可以任意方向移动，包括直走和直角拐弯
        return isRailwayPathClear(fromCol, fromRow, toCol, toRow);
    }

    // 二、公路线移动（常规路径）
    // 每次只能移动1格，方向仅限上下左右直走
    if ((colDiff === 1 && rowDiff === 0) || (colDiff === 0 && rowDiff === 1)) {
        return true;
    }

    // 其他移动方式无效
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

        // 检查保护区规则：只有象和兵能吃保护区内的敌方棋子
        if (isInProtectedZone(toCol, toRow) && !piece.includes('象') && !piece.includes('兵')) {
            return false; // 非象、非兵棋子不能吃保护区内的棋子
        }
    }

    const colDiff = Math.abs(toCol - fromCol);
    const rowDiff = Math.abs(toRow - fromRow);

    // 兵的移动规则：铁路线移动（快速路径）+ 公路线移动（常规路径）
    if (piece.includes('兵')) {
        return isValidPawnMove(fromCol, fromRow, toCol, toRow);
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

// 清除移动历史显示
function clearMoveHistory() {
    document.querySelectorAll('.position').forEach(pos => {
        pos.classList.remove('move-from', 'move-to');
        // 移除移动历史的角框元素
        pos.querySelectorAll('.corner-frame, .corner-bottom').forEach(corner => {
            corner.remove();
        });
    });
    console.log('移动历史已清除');
}

// 显示移动历史（联机模式下的起点和终点红色三角框）
function showMoveHistory(fromCol, fromRow, toCol, toRow) {
    // 只在联机模式下显示移动历史
    if (!isOnlineMode || gameMode !== 'playing') {
        return;
    }

    // 清除之前的移动历史显示
    clearMoveHistory();

    // 保存移动历史
    lastMovePositions = {
        from: [fromCol, fromRow],
        to: [toCol, toRow]
    };

    // 转换逻辑坐标为显示坐标
    const fromDisplayCoords = logicToDisplay(fromCol, fromRow);
    const toDisplayCoords = logicToDisplay(toCol, toRow);

    // 获取当前游戏棋盘
    const currentGrid = gameGrid;

    // 显示起点红色三角框
    const fromPosition = currentGrid.querySelector(`[data-col="${fromDisplayCoords.col}"][data-row="${fromDisplayCoords.row}"]`);
    if (fromPosition) {
        addCornerFrames(fromPosition, 'move-from');
    }

    // 显示终点红色三角框
    const toPosition = currentGrid.querySelector(`[data-col="${toDisplayCoords.col}"][data-row="${toDisplayCoords.row}"]`);
    if (toPosition) {
        addCornerFrames(toPosition, 'move-to');
    }
}

// 添加四个角的三角框架（围绕棋子图片或空位）
function addCornerFrames(position, type = 'selected') {
    console.log(`addCornerFrames 被调用，类型: ${type}`);

    // 添加两个元素，每个元素用::before和::after创建两个三角形
    const topCorners = document.createElement('div');
    topCorners.className = 'corner-frame';
    position.appendChild(topCorners);

    const bottomCorners = document.createElement('div');
    bottomCorners.className = 'corner-bottom';
    position.appendChild(bottomCorners);

    position.classList.add(type);

    console.log(`角框已添加到位置，类名: ${position.className}`);
}

// 重新游戏函数
function restartGame() {
    // 隐藏胜利消息
    const victoryElement = document.getElementById('victoryMessage');
    victoryElement.style.display = 'none';
    victoryElement.innerHTML = '';

    // 重置游戏状态
    gameMode = 'setup';
    selectedPosition = null;
    emptyTargetPosition = null;
    draggedPiece = null;
    selectedStoragePiece = null;
    redCompleted = false;
    blackCompleted = false;

    // 重置回合状态
    currentTurn = 'red';
    turnNumber = 1;

    // 清空棋盘状态
    boardState = {};

    // 显示初始化界面，隐藏游戏界面
    setupContainer.style.display = 'flex'; // 确保使用正确的display值
    gameBoard.style.display = 'none';

    // 清除回合显示信息
    const turnInfo = document.getElementById('turnInfo');
    if (turnInfo) {
        turnInfo.remove();
    }

    // 清除所有高亮和选择状态
    clearHighlights();
    clearStorageSelection();
    clearAvailablePlacements();
    clearMoveHistory();

    // 重置移动历史
    lastMovePositions = null;

    // 重新初始化棋子存储区
    initializePieceStorage();

    // 重新创建初始化棋盘
    createBoard(grid, true);

    // 更新状态显示
    updateRedStatus();
    updateBlackStatus();
    updateSetupPlayerIdentity();
    updatePlayerIdentityDisplay(); // 确保玩家身份显示正确

    // 如果是联机模式，发送游戏重置信息
    if (isOnlineMode) {
        sendGameStateUpdate();
    }

    console.log('游戏已重新开始');
}

// 显示胜利信息
function showVictoryMessage(message) {
    const victoryElement = document.getElementById('victoryMessage');

    // 清空之前的内容
    victoryElement.innerHTML = '';

    // 创建胜利消息文本
    const messageText = document.createElement('div');
    messageText.textContent = message;
    messageText.style.marginBottom = '20px';
    messageText.style.fontSize = '24px';
    messageText.style.fontWeight = 'bold';

    // 创建重新游戏按钮
    const restartButton = document.createElement('button');
    restartButton.textContent = '重新游戏';
    restartButton.className = 'restart-btn';
    restartButton.style.cssText = `
        padding: 12px 24px;
        font-size: 18px;
        font-weight: bold;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: background-color 0.3s;
    `;

    // 添加按钮悬停效果
    restartButton.addEventListener('mouseenter', () => {
        restartButton.style.backgroundColor = '#45a049';
    });

    restartButton.addEventListener('mouseleave', () => {
        restartButton.style.backgroundColor = '#4CAF50';
    });

    // 添加重新游戏功能
    restartButton.addEventListener('click', () => {
        restartGame();
    });

    // 将元素添加到胜利消息容器
    victoryElement.appendChild(messageText);
    victoryElement.appendChild(restartButton);
    victoryElement.style.display = 'block';
}

// 移动棋子
function movePiece(fromCol, fromRow, toCol, toRow, skipMoveHistory = false) {
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

    // 在联机模式下显示移动历史（除非明确跳过）
    if (isOnlineMode && gameMode === 'playing' && !skipMoveHistory) {
        showMoveHistory(fromCol, fromRow, toCol, toRow);
        switchTurn();
    }
}

// 坐标转换函数：将逻辑坐标转换为显示坐标
function logicToDisplay(col, row) {
    // 在联机模式下，让我方始终在上方
    if (isOnlineMode && playerSide) {
        if (playerSide === 'red') {
            // 红方玩家：翻转棋盘让红方在上方（原本红方在下方row=0,2,3）
            return {
                col: 8 - col,  // 列翻转
                row: 9 - row   // 行翻转
            };
        } else if (playerSide === 'black') {
            // 黑方玩家：保持原样（黑方本来就在上方row=6,7,9）
            return { col, row };
        }
    }
    // 单人模式或未分配身份时保持原样
    return { col, row };
}

// 坐标转换函数：将显示坐标转换为逻辑坐标
function displayToLogic(col, row) {
    // 在联机模式下，让我方始终在上方
    if (isOnlineMode && playerSide) {
        if (playerSide === 'red') {
            // 红方玩家：翻转棋盘让红方在上方（原本红方在下方row=0,2,3）
            return {
                col: 8 - col,  // 列翻转
                row: 9 - row   // 行翻转
            };
        } else if (playerSide === 'black') {
            // 黑方玩家：保持原样（黑方本来就在上方row=6,7,9）
            return { col, row };
        }
    }
    // 单人模式或未分配身份时保持原样
    return { col, row };
}

// 渲染棋盘
function renderBoard() {
    const currentGrid = gameMode === 'setup' ? grid : gameGrid;

    // 保存当前的移动历史状态
    const savedMoveHistory = lastMovePositions;

    // 清空现有棋子（但保留角框元素）
    currentGrid.querySelectorAll('.chess-piece').forEach(piece => piece.remove());
    console.log('棋子已清除，开始重新渲染');

    // 重新添加棋子
    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 9; col++) {
            const pieceKey = `${col},${row}`;
            if (boardState[pieceKey]) {
                // 转换为显示坐标
                const displayCoords = logicToDisplay(col, row);
                const position = currentGrid.querySelector(`[data-col="${displayCoords.col}"][data-row="${displayCoords.row}"]`);
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

                        // 在联机模式下，检查是否有权限操作这个棋子
                        const canManipulatePiece = !isOnlineMode || !playerSide || pieceColor === playerSide;

                        if (canManipulatePiece) {
                            // 启用拖拽和指针事件
                            piece.draggable = true;
                            piece.style.pointerEvents = 'auto';
                            piece.style.webkitUserDrag = 'element';
                            piece.style.cursor = 'grab';
                        } else {
                            // 敌方棋子：禁用拖拽和指针事件
                            piece.draggable = false;
                            piece.style.pointerEvents = 'none';
                            piece.style.webkitUserDrag = 'none';
                            piece.style.cursor = 'default';
                        }

                        // 添加双击移除功能（仅限自己的棋子）
                        if (canManipulatePiece) {
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

                                // 如果是联机模式，发送游戏状态更新
                                if (isOnlineMode) {
                                    sendGameStateUpdate();
                                }
                            });

                            // 添加拖拽功能，让棋子可以拖回存储区或重新放置（仅限自己的棋子）
                            piece.addEventListener('dragstart', (e) => {
                                draggedPiece = piece;
                                piece.classList.add('dragging');
                                piece.style.cursor = 'grabbing';
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/html', piece.outerHTML);
                                // 标记这是从棋盘拖拽的棋子，使用逻辑坐标
                                piece.dataset.fromBoard = 'true';
                                piece.dataset.boardCol = col;  // 这里的col,row已经是逻辑坐标
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
                    }

                    position.appendChild(piece);
                }
            }
        }
    }

    // 恢复移动历史显示（如果有的话）
    if (savedMoveHistory && isOnlineMode && gameMode === 'playing') {
        const { from, to } = savedMoveHistory;
        showMoveHistory(from[0], from[1], to[0], to[1]);
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
            // 红方玩家 - 显示在上方（我方）
            redIdentity.textContent = '本局您为红方';
            redIdentity.style.display = 'block';
            blackIdentity.style.display = 'none';
        } else if (playerSide === 'black') {
            // 黑方玩家 - 显示在上方（我方）
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

                        // 转换显示坐标为逻辑坐标
                        const logicCoords = displayToLogic(col, row);
                        const logicCol = logicCoords.col;
                        const logicRow = logicCoords.row;

                        // 检查是否可以放置在这个位置
                        if (canPieceBePlacedAt(pieceName, logicCol, logicRow, pieceColor) && !boardState[`${logicCol},${logicRow}`]) {
                            // 放置棋子到棋盘
                            boardState[`${logicCol},${logicRow}`] = pieceName;

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

                        // 在联机模式下，检查是否有权限拖拽这个棋子
                        const canDragPiece = !isOnlineMode || !playerSide || pieceColor === playerSide;

                        if (!canDragPiece) {
                            e.dataTransfer.dropEffect = 'none';
                            position.classList.add('drag-over-invalid');
                            position.classList.remove('drag-over-valid');
                            return;
                        }

                        // 转换显示坐标为逻辑坐标
                        const logicCoords = displayToLogic(col, row);
                        const logicCol = logicCoords.col;
                        const logicRow = logicCoords.row;

                        // 如果是从棋盘拖拽的棋子，需要检查目标位置是否为空或者是原位置
                        const isOriginalPosition = isFromBoard &&
                            parseInt(draggedPiece.dataset.boardCol) === logicCol &&
                            parseInt(draggedPiece.dataset.boardRow) === logicRow;

                        const targetIsEmpty = !boardState[`${logicCol},${logicRow}`] || isOriginalPosition;

                        if (canPieceBePlacedAt(pieceName, logicCol, logicRow, pieceColor) && targetIsEmpty) {
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

                        // 在联机模式下，检查是否有权限拖拽这个棋子
                        const canDragPiece = !isOnlineMode || !playerSide || pieceColor === playerSide;

                        if (!canDragPiece) {
                            return; // 没有权限，直接返回
                        }

                        // 转换显示坐标为逻辑坐标
                        const logicCoords = displayToLogic(col, row);
                        const logicCol = logicCoords.col;
                        const logicRow = logicCoords.row;

                        // 如果是从棋盘拖拽的棋子，需要检查目标位置是否为空或者是原位置
                        const isOriginalPosition = isFromBoard &&
                            parseInt(draggedPiece.dataset.boardCol) === logicCol &&
                            parseInt(draggedPiece.dataset.boardRow) === logicRow;

                        const targetIsEmpty = !boardState[`${logicCol},${logicRow}`] || isOriginalPosition;

                        if (canPieceBePlacedAt(pieceName, logicCol, logicRow, pieceColor) && targetIsEmpty) {
                            // 有效放置
                            if (isFromBoard) {
                                // 从棋盘拖拽：移除原位置的棋子
                                const originalCol = parseInt(draggedPiece.dataset.boardCol);
                                const originalRow = parseInt(draggedPiece.dataset.boardRow);
                                delete boardState[`${originalCol},${originalRow}`];

                                // 如果不是拖回原位置，则在新位置放置棋子
                                if (!isOriginalPosition) {
                                    boardState[`${logicCol},${logicRow}`] = pieceName;
                                } else {
                                    // 拖回原位置，重新放置
                                    boardState[`${logicCol},${logicRow}`] = pieceName;
                                }
                            } else {
                                // 从存储区拖拽：正常处理
                                boardState[`${logicCol},${logicRow}`] = pieceName;

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
                    // 转换显示坐标为逻辑坐标
                    const logicCoords = displayToLogic(col, row);
                    const clickedCol = logicCoords.col;
                    const clickedRow = logicCoords.row;
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

                            // 在联机模式下，清除之前的移动历史显示
                            if (isOnlineMode && gameMode === 'playing') {
                                clearMoveHistory();
                            }

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

    // 清除移动历史
    clearMoveHistory();
    lastMovePositions = null;

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

// 规则按钮功能
function toggleRules() {
    rulesVisible = !rulesVisible;
    if (rulesVisible) {
        rulesPanel.style.display = 'block';
    } else {
        rulesPanel.style.display = 'none';
    }
}

// 规则按钮事件
rulesBtnSetup.addEventListener('click', toggleRules);
rulesBtnGame.addEventListener('click', toggleRules);

// 返回按钮事件
returnBtn.addEventListener('click', () => {
    // 隐藏规则面板（如果正在显示）
    rulesPanel.style.display = 'none';
    rulesVisible = false;

    // 断开WebSocket连接（如果存在）
    if (websocket) {
        websocket.close();
        websocket = null;
    }

    // 重置游戏状态
    isOnlineMode = false;
    playerSide = null;
    connectionStatus = 'disconnected';

    // 返回主菜单
    showMainMenu();
});



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
    let serverUrl;

    // 自动检测Codespaces环境
    if (window.location.hostname.includes('.preview.app.github.dev') ||
        window.location.hostname.includes('.app.github.dev')) {
        // 在Codespaces环境中，直接使用当前域名
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        serverUrl = `${protocol}//${window.location.host}`;
        console.log('检测到Codespaces环境，使用当前地址:', serverUrl);
    } else {
        // 不在Codespaces环境中，使用配置文件中的默认地址
        const defaultRemoteServer = window.CHESS_CONFIG ? window.CHESS_CONFIG.DEFAULT_REMOTE_SERVER : 'wss://your-codespace-name-3000.preview.app.github.dev';
        serverUrl = defaultRemoteServer;
        console.log('使用配置的远程服务器地址:', serverUrl);
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