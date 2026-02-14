/* ===========================================
   game.js - 神経衰弱ゲームロジック
   カードシャッフル / マッチ判定 / 勝利判定
   =========================================== */

class MemoryGame {
    /**
     * @param {Object} config
     * @param {number} config.cardCount - カード枚数 (6, 12, 20)
     * @param {string[]} config.images - 画像DataURL配列 (ペア数分)
     * @param {Function} config.onCardFlip - カードめくり時コールバック (index)
     * @param {Function} config.onMatch - マッチ時コールバック (idx1, idx2)
     * @param {Function} config.onMismatch - 不一致時コールバック (idx1, idx2)
     * @param {Function} config.onComplete - 全ペア完成時コールバック
     */
    constructor(config) {
        this.cardCount = config.cardCount;
        this.images = config.images;
        this.onCardFlip = config.onCardFlip || (() => {});
        this.onMatch = config.onMatch || (() => {});
        this.onMismatch = config.onMismatch || (() => {});
        this.onComplete = config.onComplete || (() => {});

        this.cards = [];
        this.flippedIndices = [];
        this.matchedCount = 0;
        this.totalPairs = this.cardCount / 2;
        this.isProcessing = false;
    }

    /* --- ゲーム初期化 --- */
    init() {
        this.cards = [];
        this.flippedIndices = [];
        this.matchedCount = 0;
        this.isProcessing = false;

        // ペアを作成 (各画像を2枚ずつ)
        const pairImages = this.images.slice(0, this.totalPairs);
        for (let i = 0; i < pairImages.length; i++) {
            this.cards.push({ pairId: i, image: pairImages[i], flipped: false, matched: false });
            this.cards.push({ pairId: i, image: pairImages[i], flipped: false, matched: false });
        }

        // シャッフル (Fisher-Yates)
        this.shuffle(this.cards);
    }

    /* --- Fisher-Yates シャッフル --- */
    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }

    /* --- カードをめくる --- */
    flipCard(index) {
        // 入力無効状態なら無視
        if (this.isProcessing) return false;

        const card = this.cards[index];

        // 既にめくられているか、マッチ済みなら無視
        if (!card || card.flipped || card.matched) return false;

        // 既に2枚めくられていたら無視
        if (this.flippedIndices.length >= 2) return false;

        // カードをめくる
        card.flipped = true;
        this.flippedIndices.push(index);

        // コールバック: カードがめくられた
        this.onCardFlip(index);

        return true;
    }

    /* --- モーダルが閉じた後の処理 --- */
    onModalClosed() {
        if (this.flippedIndices.length === 2) {
            this.checkMatch();
        }
    }

    /* --- マッチ判定 --- */
    checkMatch() {
        if (this.flippedIndices.length !== 2) return;

        this.isProcessing = true;
        const [idx1, idx2] = this.flippedIndices;
        const card1 = this.cards[idx1];
        const card2 = this.cards[idx2];

        if (card1.pairId === card2.pairId) {
            // マッチ成功
            setTimeout(() => {
                card1.matched = true;
                card2.matched = true;
                this.matchedCount++;
                this.flippedIndices = [];
                this.isProcessing = false;

                this.onMatch(idx1, idx2);

                // 全ペア完成チェック
                if (this.isComplete()) {
                    setTimeout(() => {
                        this.onComplete();
                    }, 600);
                }
            }, 400);
        } else {
            // マッチ失敗
            setTimeout(() => {
                card1.flipped = false;
                card2.flipped = false;
                this.flippedIndices = [];

                this.onMismatch(idx1, idx2);
                this.isProcessing = false;
            }, 800);
        }
    }

    /* --- 全ペア完成判定 --- */
    isComplete() {
        return this.matchedCount >= this.totalPairs;
    }

    /* --- ゲームリセット (同じ画像で再シャッフル) --- */
    reset() {
        this.init();
    }

    /* --- カードデータ取得 --- */
    getCard(index) {
        return this.cards[index] || null;
    }

    getCards() {
        return this.cards;
    }

    /* --- グリッド列数を取得 --- */
    getColumnCount() {
        if (this.cardCount <= 6) return 2;
        if (this.cardCount <= 12) return 3;
        return 4;
    }
}
