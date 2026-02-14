/* ===========================================
   app.js - メインアプリケーションコントローラー
   画面遷移 / イベント管理 / ゲーム統合
   =========================================== */

const App = (() => {
    /* --- 状態 --- */
    const state = {
        currentScreen: 'title',
        difficulty: 0,              // 0: Easy(6枚), 1: Medium(12枚), 2: Hard(20枚)
        cardCounts: [6, 12, 20],
        starCounts: [1, 2, 3],
        selectedImages: [],         // 選択された画像 DataURL[]
        navStack: [],               // 画面遷移履歴
        game: null,                 // MemoryGame インスタンス
        editingAlbumId: null,       // 編集中のアルバムID
    };

    /* --- DOM 要素キャッシュ --- */
    const screens = {};
    const elements = {};

    /* ===========================================
       初期化
       =========================================== */
    function init() {
        cacheElements();
        bindEvents();
        UI.init();
        ImageStorage.init().catch(console.error);
        showScreen('title');
        updateDifficultyDisplay();
    }

    function cacheElements() {
        // 各画面
        document.querySelectorAll('.screen').forEach((el) => {
            screens[el.id.replace('screen-', '')] = el;
        });

        // よく使う要素
        elements.starsDisplay = document.getElementById('stars-display');
        elements.cardCountDisplay = document.getElementById('card-count-display');
        elements.gameBoard = document.getElementById('game-board');
        elements.previewArea = document.getElementById('preview-area');
        elements.fileInputImages = document.getElementById('file-input-images');
        elements.fileInputAdd = document.getElementById('file-input-add');
        elements.selectionCounter = document.getElementById('selection-counter');
        elements.counterText = document.getElementById('counter-text');
        elements.btnGameStart = document.getElementById('btn-game-start');
        elements.albumModalBody = document.getElementById('album-modal-body');
    }

    function bindEvents() {
        // タイトル画面
        document.getElementById('btn-start').addEventListener('click', () => {
            UI.playSound('click');
            navigateTo('difficulty');
        });

        document.getElementById('btn-exit').addEventListener('click', () => {
            UI.playSound('click');
            if (confirm('アプリを終了しますか？')) {
                window.close();
                // window.close() が効かない場合のフォールバック
                document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-size:2rem;color:#666;">ご利用ありがとうございました</div>';
            }
        });

        // 難易度画面
        document.getElementById('btn-diff-left').addEventListener('click', () => {
            changeDifficulty(-1);
        });

        document.getElementById('btn-diff-right').addEventListener('click', () => {
            changeDifficulty(1);
        });

        document.getElementById('btn-confirm-difficulty').addEventListener('click', () => {
            UI.playSound('click');
            navigateTo('image-select');
        });

        // 画像選択画面
        document.getElementById('btn-custom-images').addEventListener('click', () => {
            UI.playSound('click');
            // 選択をリセットしてファイル選択を開始
            state.selectedImages = [];
            elements.fileInputImages.click();
        });

        document.getElementById('btn-album').addEventListener('click', () => {
            UI.playSound('click');
            openAlbumModal();
        });

        // ファイル入力の change イベント（任意の画像）
        elements.fileInputImages.addEventListener('change', handleCustomImageSelected);

        // プレビュー画面
        document.getElementById('btn-add-more').addEventListener('click', () => {
            UI.playSound('click');
            elements.fileInputAdd.click();
        });

        // 追加用ファイル入力
        elements.fileInputAdd.addEventListener('change', handleAddMoreImages);

        document.getElementById('btn-game-start').addEventListener('click', async () => {
            UI.playSound('click');
            await handleGameStart();
        });

        // ゲーム画面
        document.getElementById('btn-hamburger').addEventListener('click', () => {
            if (UI.isMenuOpen()) {
                UI.hideMenu();
            } else {
                UI.showMenu();
            }
        });

        document.getElementById('menu-return-title').addEventListener('click', () => {
            UI.hideMenu();
            UI.playSound('click');
            if (confirm('タイトルに戻りますか？\nゲームの進行状況は失われます。')) {
                returnToTitle();
            }
        });

        document.getElementById('menu-restart').addEventListener('click', () => {
            UI.hideMenu();
            UI.playSound('click');
            if (confirm('最初からやり直しますか？')) {
                startGame();
            }
        });

        // クリア画面
        document.getElementById('btn-replay').addEventListener('click', () => {
            UI.playSound('click');
            startGame();
        });

        document.getElementById('btn-return-title').addEventListener('click', () => {
            UI.playSound('click');
            returnToTitle();
        });

        // 全画面の戻るボタン
        document.querySelectorAll('.btn-back').forEach((btn) => {
            btn.addEventListener('click', () => {
                UI.playSound('click');
                goBack();
            });
        });
    }

    /* ===========================================
       画面遷移
       =========================================== */
    function showScreen(name) {
        Object.values(screens).forEach((s) => s.classList.remove('active'));
        const target = screens[name];
        if (target) {
            target.classList.add('active');
            target.classList.remove('fade-in');
            // アニメーションリトリガー
            void target.offsetWidth;
            target.classList.add('fade-in');
            state.currentScreen = name;
        }
    }

    function navigateTo(name) {
        state.navStack.push(state.currentScreen);
        showScreen(name);
    }

    function goBack() {
        if (state.navStack.length > 0) {
            const prev = state.navStack.pop();
            showScreen(prev);
        }
    }

    function returnToTitle() {
        state.navStack = [];
        state.game = null;
        state.selectedImages = [];
        showScreen('title');
    }

    /* ===========================================
       難易度選択
       =========================================== */
    function changeDifficulty(direction) {
        UI.playSound('click');
        state.difficulty += direction;
        if (state.difficulty < 0) state.difficulty = state.cardCounts.length - 1;
        if (state.difficulty >= state.cardCounts.length) state.difficulty = 0;
        updateDifficultyDisplay();
    }

    function updateDifficultyDisplay() {
        const count = state.cardCounts[state.difficulty];
        const stars = state.starCounts[state.difficulty];

        // 星表示を更新
        let starsHtml = '';
        for (let i = 0; i < stars; i++) {
            starsHtml += '<span class="star">★</span>';
        }
        elements.starsDisplay.innerHTML = starsHtml;

        // 枚数表示を更新
        elements.cardCountDisplay.textContent = `枚数：${count}枚`;
    }

    /* ===========================================
       画像選択 - 「任意の画像」フロー
       =========================================== */
    function getRequiredImageCount() {
        return state.cardCounts[state.difficulty] / 2;
    }

    function handleCustomImageSelected(e) {
        const files = Array.from(e.target.files).filter((f) =>
            f.type.startsWith('image/')
        );
        e.target.value = '';

        if (files.length === 0) {
            return;
        }

        // ファイルを読み込んでDataURLに変換
        Promise.all(files.map(readFileAsDataURL)).then((dataUrls) => {
            state.selectedImages = dataUrls;
            showPreview();
            navigateTo('preview');
        });
    }

    function handleAddMoreImages(e) {
        const files = Array.from(e.target.files).filter((f) =>
            f.type.startsWith('image/')
        );
        e.target.value = '';

        if (files.length === 0) {
            return;
        }

        Promise.all(files.map(readFileAsDataURL)).then((dataUrls) => {
            state.selectedImages = state.selectedImages.concat(dataUrls);
            showPreview();
        });
    }

    async function handleGameStart() {
        const required = getRequiredImageCount();
        const current = state.selectedImages.length;

        if (current < required) {
            // 不足している場合は確認ダイアログを表示
            const shortage = required - current;
            const confirmed = await UI.showConfirmModal(
                `画像が${shortage}枚足りません。\n足りない分をダミー画像で補いますか？`,
                '補う',
                'キャンセル'
            );

            if (!confirmed) {
                return;
            }

            // ダミー画像で補完
            const dummies = ImageStorage.generateDummyImages(shortage);
            state.selectedImages = state.selectedImages.concat(dummies);
        } else if (current > required) {
            // 多すぎる場合はランダムに選出
            state.selectedImages = shuffleArray([...state.selectedImages]).slice(0, required);
        }

        // IndexedDBに保存
        await ImageStorage.addImages(state.selectedImages).catch(console.error);

        startGame();
    }

    function readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /* ===========================================
       プレビュー画面
       =========================================== */
    function showPreview() {
        const required = getRequiredImageCount();
        const current = state.selectedImages.length;

        // カウンター更新
        elements.counterText.textContent = `${required}枚中 ${current}枚選択済み`;

        // 準備完了状態の更新
        if (current >= required) {
            elements.selectionCounter.classList.add('complete');
            elements.btnGameStart.classList.add('ready');
        } else {
            elements.selectionCounter.classList.remove('complete');
            elements.btnGameStart.classList.remove('ready');
        }

        // プレビューエリア更新
        elements.previewArea.innerHTML = '';
        state.selectedImages.forEach((dataUrl, i) => {
            const item = document.createElement('div');
            item.className = 'preview-item';

            const img = document.createElement('img');
            img.src = dataUrl;
            img.alt = `画像 ${i + 1}`;
            img.className = 'preview-thumb';

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'preview-delete';
            deleteBtn.innerHTML = '×';
            deleteBtn.setAttribute('aria-label', '削除');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                UI.playSound('click');
                removePreviewImage(i);
            });

            item.appendChild(img);
            item.appendChild(deleteBtn);
            elements.previewArea.appendChild(item);
        });
    }

    function removePreviewImage(index) {
        state.selectedImages.splice(index, 1);
        showPreview();
    }

    /* ===========================================
       アルバム管理モーダル
       =========================================== */
    async function openAlbumModal() {
        state.editingAlbumId = null;
        UI.setAlbumModalTitle('アルバム');
        await renderAlbumList();
        UI.showAlbumModal();
    }

    async function renderAlbumList() {
        const albums = await ImageStorage.getAllAlbums();

        let html = `
            <button class="btn-album-new" id="btn-album-create">
                ＋ 新しいアルバムを作成
            </button>
        `;

        if (albums.length === 0) {
            html += `
                <div class="album-empty-message">
                    保存されたアルバムはありません。<br>
                    「新しいアルバムを作成」から<br>
                    お気に入りの画像を保存できます。
                </div>
            `;
        } else {
            html += '<div class="album-list">';
            albums.forEach((album) => {
                const thumbnail = album.images[0] || '';
                html += `
                    <div class="album-list-item" data-album-id="${album.id}">
                        ${thumbnail
                            ? `<img class="album-thumbnail" src="${thumbnail}" alt="">`
                            : '<div class="album-thumbnail" style="background:#ddd;"></div>'
                        }
                        <div class="album-info">
                            <div class="album-name">${escapeHtml(album.name)}</div>
                            <div class="album-count">${album.images.length}枚</div>
                        </div>
                        <div class="album-actions">
                            <button class="btn-album-edit" data-album-id="${album.id}" aria-label="編集">
                                <svg viewBox="0 0 24 24" width="20" height="20">
                                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/>
                                </svg>
                            </button>
                            <button class="btn-album-delete" data-album-id="${album.id}" aria-label="削除">
                                <svg viewBox="0 0 24 24" width="20" height="20">
                                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }

        UI.setAlbumModalContent(html);

        // イベントバインド
        document.getElementById('btn-album-create').addEventListener('click', () => {
            UI.playSound('click');
            showAlbumForm(null);
        });

        // アルバム選択
        document.querySelectorAll('.album-list-item').forEach((item) => {
            item.addEventListener('click', async (e) => {
                // 編集・削除ボタンのクリックは除外
                if (e.target.closest('.btn-album-edit') || e.target.closest('.btn-album-delete')) {
                    return;
                }
                UI.playSound('click');
                const albumId = parseInt(item.dataset.albumId);
                await selectAlbumForGame(albumId);
            });
        });

        // 編集ボタン
        document.querySelectorAll('.btn-album-edit').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                UI.playSound('click');
                const albumId = parseInt(btn.dataset.albumId);
                await showAlbumForm(albumId);
            });
        });

        // 削除ボタン
        document.querySelectorAll('.btn-album-delete').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                UI.playSound('click');
                const albumId = parseInt(btn.dataset.albumId);
                await deleteAlbumConfirm(albumId);
            });
        });
    }

    async function selectAlbumForGame(albumId) {
        const album = await ImageStorage.getAlbumById(albumId);
        if (!album || album.images.length === 0) {
            alert('このアルバムには画像がありません。');
            return;
        }

        const required = getRequiredImageCount();
        let images = [...album.images];

        if (images.length > required) {
            images = shuffleArray(images).slice(0, required);
        } else if (images.length < required) {
            // 足りない分はダミーで補完
            const dummies = ImageStorage.generateDummyImages(required - images.length);
            images = images.concat(dummies);
        }

        state.selectedImages = images;
        UI.hideAlbumModal();
        showPreview();
        navigateTo('preview');
    }

    async function deleteAlbumConfirm(albumId) {
        const album = await ImageStorage.getAlbumById(albumId);
        if (!album) return;

        const confirmed = await UI.showConfirmModal(
            `「${album.name}」を削除しますか？\nこの操作は取り消せません。`,
            '削除',
            'キャンセル'
        );

        if (confirmed) {
            await ImageStorage.deleteAlbum(albumId);
            await renderAlbumList();
        }
    }

    /* --- アルバム作成/編集フォーム --- */
    let albumFormImages = [];
    let albumFormFileInput = null;

    async function showAlbumForm(albumId) {
        state.editingAlbumId = albumId;
        let albumName = '';
        albumFormImages = [];

        if (albumId) {
            const album = await ImageStorage.getAlbumById(albumId);
            if (album) {
                albumName = album.name;
                albumFormImages = [...album.images];
            }
            UI.setAlbumModalTitle('アルバムを編集');
        } else {
            UI.setAlbumModalTitle('新しいアルバム');
        }

        renderAlbumForm(albumName);
    }

    function renderAlbumForm(name = '') {
        let previewHtml = '';
        if (albumFormImages.length > 0) {
            previewHtml = '<div class="album-form-preview">';
            albumFormImages.forEach((img, i) => {
                previewHtml += `<img class="album-form-thumb" src="${img}" alt="画像${i + 1}">`;
            });
            previewHtml += '</div>';
        }

        const html = `
            <div class="album-form">
                <div class="album-form-group">
                    <label class="album-form-label">アルバム名</label>
                    <input type="text" class="album-form-input" id="album-name-input"
                           value="${escapeHtml(name)}" placeholder="例：孫の写真、旅行など">
                </div>
                <div class="album-form-group">
                    <label class="album-form-label">画像（${albumFormImages.length}枚選択中）</label>
                    <button class="btn-album-select-images" id="btn-album-select-images">
                        画像を選択する
                    </button>
                    ${previewHtml}
                </div>
                <input type="file" id="album-file-input" accept="image/*" multiple style="display:none">
                <div class="album-form-actions">
                    <button class="btn-secondary" id="btn-album-form-cancel">戻る</button>
                    <button class="btn-primary" id="btn-album-form-save">保存</button>
                </div>
            </div>
        `;

        UI.setAlbumModalContent(html);

        // ファイル入力の参照を取得
        albumFormFileInput = document.getElementById('album-file-input');

        // イベントバインド
        document.getElementById('btn-album-select-images').addEventListener('click', () => {
            UI.playSound('click');
            albumFormFileInput.click();
        });

        albumFormFileInput.addEventListener('change', handleAlbumFileSelect);

        document.getElementById('btn-album-form-cancel').addEventListener('click', async () => {
            UI.playSound('click');
            await renderAlbumList();
            UI.setAlbumModalTitle('アルバム');
        });

        document.getElementById('btn-album-form-save').addEventListener('click', async () => {
            UI.playSound('click');
            await saveAlbum();
        });
    }

    function handleAlbumFileSelect(e) {
        const files = Array.from(e.target.files).filter((f) =>
            f.type.startsWith('image/')
        );
        e.target.value = '';

        if (files.length === 0) {
            return;
        }

        Promise.all(files.map(readFileAsDataURL)).then((dataUrls) => {
            albumFormImages = dataUrls;
            const currentName = document.getElementById('album-name-input').value;
            renderAlbumForm(currentName);
        });
    }

    async function saveAlbum() {
        const nameInput = document.getElementById('album-name-input');
        const name = nameInput.value.trim();

        if (!name) {
            alert('アルバム名を入力してください。');
            nameInput.focus();
            return;
        }

        if (albumFormImages.length === 0) {
            alert('画像を1枚以上選択してください。');
            return;
        }

        try {
            if (state.editingAlbumId) {
                await ImageStorage.updateAlbum(state.editingAlbumId, name, albumFormImages);
            } else {
                await ImageStorage.createAlbum(name, albumFormImages);
            }

            state.editingAlbumId = null;
            albumFormImages = [];
            await renderAlbumList();
            UI.setAlbumModalTitle('アルバム');

        } catch (error) {
            console.error('アルバム保存エラー:', error);
            alert('保存に失敗しました。');
        }
    }

    /* ===========================================
       ゲーム開始 & 実行
       =========================================== */
    function startGame() {
        const cardCount = state.cardCounts[state.difficulty];

        // 画像が未選択の場合ダミーを使用
        if (state.selectedImages.length === 0) {
            state.selectedImages = ImageStorage.generateDummyImages(cardCount / 2);
        }

        // ゲームインスタンス作成
        state.game = new MemoryGame({
            cardCount: cardCount,
            images: state.selectedImages,
            onCardFlip: handleCardFlip,
            onMatch: handleMatch,
            onMismatch: handleMismatch,
            onComplete: handleComplete,
        });

        state.game.init();
        renderGameBoard();

        // 画面遷移（スタックをリセットしてゲーム画面へ）
        state.navStack = [];
        showScreen('game');
    }

    function renderGameBoard() {
        const board = elements.gameBoard;
        board.innerHTML = '';

        // グリッド列数設定
        board.className = 'game-board';
        board.classList.add(`cols-${state.game.getColumnCount()}`);

        const cards = state.game.getCards();
        cards.forEach((card, index) => {
            const cardEl = document.createElement('div');
            cardEl.className = 'card';
            cardEl.dataset.index = index;
            cardEl.style.animationDelay = `${index * 0.05}s`;

            const inner = document.createElement('div');
            inner.className = 'card-inner';

            const front = document.createElement('div');
            front.className = 'card-front';

            const back = document.createElement('div');
            back.className = 'card-back';
            const img = document.createElement('img');
            img.src = card.image;
            img.alt = '';
            img.draggable = false;
            back.appendChild(img);

            inner.appendChild(front);
            inner.appendChild(back);
            cardEl.appendChild(inner);

            cardEl.addEventListener('click', () => {
                onCardClick(index);
            });

            board.appendChild(cardEl);
        });
    }

    /* --- カードクリック処理 --- */
    function onCardClick(index) {
        if (UI.isModalOpen()) return;
        if (!state.game) return;

        const flipped = state.game.flipCard(index);
        if (!flipped) return;

        // カード要素をめくる（CSS アニメーション）
        const cardEl = getCardElement(index);
        if (cardEl) {
            cardEl.classList.add('flipped');
        }

        UI.playSound('flip');

        // 拡大モーダルを表示
        const card = state.game.getCard(index);
        UI.showModal(card.image, () => {
            // モーダルが閉じた後
            state.game.onModalClosed();
        });
    }

    /* --- コールバック: カードめくり --- */
    function handleCardFlip(index) {
        // flipCard 内で処理済み
    }

    /* --- コールバック: マッチ成功 --- */
    function handleMatch(idx1, idx2) {
        UI.playSound('match');

        const el1 = getCardElement(idx1);
        const el2 = getCardElement(idx2);
        if (el1) el1.classList.add('matched');
        if (el2) el2.classList.add('matched');
    }

    /* --- コールバック: マッチ失敗 --- */
    function handleMismatch(idx1, idx2) {
        UI.playSound('mismatch');

        const el1 = getCardElement(idx1);
        const el2 = getCardElement(idx2);
        if (el1) el1.classList.remove('flipped');
        if (el2) el2.classList.remove('flipped');
    }

    /* --- コールバック: ゲーム完了 --- */
    function handleComplete() {
        UI.playSound('complete');
        setTimeout(() => {
            showScreen('clear');
        }, 500);
    }

    /* --- カードDOM要素を取得 --- */
    function getCardElement(index) {
        return elements.gameBoard.querySelector(`.card[data-index="${index}"]`);
    }

    /* ===========================================
       ユーティリティ
       =========================================== */
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /* ===========================================
       起動
       =========================================== */
    document.addEventListener('DOMContentLoaded', init);

    return {
        getState: () => state,
    };
})();
