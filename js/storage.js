/* ===========================================
   storage.js - 画像管理 & IndexedDB
   プライバシー重視: データは全てローカルに保持
   =========================================== */

const ImageStorage = (() => {
    const DB_NAME = 'MemoryGameDB';
    const DB_VERSION = 2; // アルバム機能追加のためバージョンアップ
    const STORE_IMAGES = 'images';
    const STORE_ALBUMS = 'albums';
    let db = null;

    /* --- IndexedDB 初期化 --- */
    async function init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (e) => {
                const database = e.target.result;

                // 画像ストア
                if (!database.objectStoreNames.contains(STORE_IMAGES)) {
                    database.createObjectStore(STORE_IMAGES, { keyPath: 'id', autoIncrement: true });
                }

                // アルバムストア
                if (!database.objectStoreNames.contains(STORE_ALBUMS)) {
                    const albumStore = database.createObjectStore(STORE_ALBUMS, { keyPath: 'id', autoIncrement: true });
                    albumStore.createIndex('name', 'name', { unique: false });
                }
            };

            request.onsuccess = (e) => {
                db = e.target.result;
                resolve(db);
            };

            request.onerror = (e) => {
                console.error('IndexedDB open error:', e);
                reject(e);
            };
        });
    }

    /* ===========================================
       画像操作（従来機能）
       =========================================== */

    /* --- 画像をIndexedDBに保存（既存をクリアして上書き） --- */
    async function saveImages(imageDataArray) {
        if (!db) await init();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_IMAGES, 'readwrite');
            const store = tx.objectStore(STORE_IMAGES);

            store.clear();

            imageDataArray.forEach((dataUrl) => {
                store.add({ data: dataUrl, timestamp: Date.now() });
            });

            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e);
        });
    }

    /* --- 画像をIndexedDBに追加（既存を保持したまま追加） --- */
    async function addImages(imageDataArray) {
        if (!db) await init();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_IMAGES, 'readwrite');
            const store = tx.objectStore(STORE_IMAGES);

            imageDataArray.forEach((dataUrl) => {
                store.add({ data: dataUrl, timestamp: Date.now() });
            });

            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e);
        });
    }

    /* --- IndexedDBから画像を取得 --- */
    async function getImages() {
        if (!db) await init();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_IMAGES, 'readonly');
            const store = tx.objectStore(STORE_IMAGES);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result.map((item) => item.data));
            };

            request.onerror = (e) => reject(e);
        });
    }

    /* --- IndexedDBの画像数を取得 --- */
    async function getImageCount() {
        if (!db) await init();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_IMAGES, 'readonly');
            const store = tx.objectStore(STORE_IMAGES);
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e);
        });
    }

    /* --- IndexedDBをクリア --- */
    async function clearImages() {
        if (!db) await init();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_IMAGES, 'readwrite');
            const store = tx.objectStore(STORE_IMAGES);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e);
        });
    }

    /* ===========================================
       アルバム操作（新機能）
       =========================================== */

    /* --- アルバムを作成 --- */
    async function createAlbum(name, imageDataArray) {
        if (!db) await init();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_ALBUMS, 'readwrite');
            const store = tx.objectStore(STORE_ALBUMS);

            const album = {
                name: name,
                images: imageDataArray,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            const request = store.add(album);

            request.onsuccess = () => {
                resolve({ ...album, id: request.result });
            };
            request.onerror = (e) => reject(e);
        });
    }

    /* --- 全アルバムを取得 --- */
    async function getAllAlbums() {
        if (!db) await init();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_ALBUMS, 'readonly');
            const store = tx.objectStore(STORE_ALBUMS);
            const request = store.getAll();

            request.onsuccess = () => {
                // 更新日時の新しい順にソート
                const albums = request.result.sort((a, b) => b.updatedAt - a.updatedAt);
                resolve(albums);
            };

            request.onerror = (e) => reject(e);
        });
    }

    /* --- アルバムをIDで取得 --- */
    async function getAlbumById(id) {
        if (!db) await init();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_ALBUMS, 'readonly');
            const store = tx.objectStore(STORE_ALBUMS);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e);
        });
    }

    /* --- アルバムを更新 --- */
    async function updateAlbum(id, name, imageDataArray) {
        if (!db) await init();

        return new Promise(async (resolve, reject) => {
            // 既存のアルバムを取得
            const existing = await getAlbumById(id);
            if (!existing) {
                reject(new Error('Album not found'));
                return;
            }

            const tx = db.transaction(STORE_ALBUMS, 'readwrite');
            const store = tx.objectStore(STORE_ALBUMS);

            const updatedAlbum = {
                ...existing,
                name: name,
                images: imageDataArray,
                updatedAt: Date.now()
            };

            const request = store.put(updatedAlbum);

            request.onsuccess = () => resolve(updatedAlbum);
            request.onerror = (e) => reject(e);
        });
    }

    /* --- アルバムを削除 --- */
    async function deleteAlbum(id) {
        if (!db) await init();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_ALBUMS, 'readwrite');
            const store = tx.objectStore(STORE_ALBUMS);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e);
        });
    }

    /* --- アルバム数を取得 --- */
    async function getAlbumCount() {
        if (!db) await init();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_ALBUMS, 'readonly');
            const store = tx.objectStore(STORE_ALBUMS);
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e);
        });
    }

    /* ===========================================
       ユーティリティ
       =========================================== */

    /* --- ダミー画像を生成 (Canvas ベース) --- */
    function generateDummyImages(count) {
        const colors = [
            '#E57373', '#81C784', '#64B5F6', '#FFB74D', '#BA68C8',
            '#4DB6AC', '#FF8A65', '#A1887F', '#90A4AE', '#F06292',
            '#AED581', '#7986CB', '#FFD54F', '#4DD0E1', '#CE93D8'
        ];

        const labels = [
            'A', 'B', 'C', 'D', 'E',
            'F', 'G', 'H', 'I', 'J',
            'K', 'L', 'M', 'N', 'O'
        ];

        const images = [];

        for (let i = 0; i < count; i++) {
            const canvas = document.createElement('canvas');
            canvas.width = 400;
            canvas.height = 400;
            const ctx = canvas.getContext('2d');

            // 背景色
            ctx.fillStyle = colors[i % colors.length];
            ctx.fillRect(0, 0, 400, 400);

            // 装飾的な円
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.beginPath();
            ctx.arc(200, 200, 120, 0, Math.PI * 2);
            ctx.fill();

            // ラベル文字
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 120px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(labels[i % labels.length], 200, 200);

            // 番号
            ctx.font = '32px sans-serif';
            ctx.fillText(`No.${i + 1}`, 200, 340);

            images.push(canvas.toDataURL('image/png'));
        }

        return images;
    }

    /* --- ファイル選択で画像を読み込む --- */
    function pickFiles(inputElement) {
        return new Promise((resolve) => {
            const handler = () => {
                inputElement.removeEventListener('change', handler);
                const files = Array.from(inputElement.files).filter((f) =>
                    f.type.startsWith('image/')
                );
                if (files.length === 0) {
                    resolve([]);
                    return;
                }
                Promise.all(files.map((file) => readFileAsDataURL(file))).then(resolve);
                inputElement.value = '';
            };

            inputElement.addEventListener('change', handler);
            inputElement.click();
        });
    }

    /* --- File を DataURL に変換 --- */
    function readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    return {
        init,
        // 画像操作
        saveImages,
        addImages,
        getImages,
        getImageCount,
        clearImages,
        // アルバム操作
        createAlbum,
        getAllAlbums,
        getAlbumById,
        updateAlbum,
        deleteAlbum,
        getAlbumCount,
        // ユーティリティ
        generateDummyImages,
        pickFiles,
        readFileAsDataURL,
    };
})();
