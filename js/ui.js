/* ===========================================
   ui.js - UI コンポーネント
   モーダル / サイドメニュー / サウンド制御
   =========================================== */

const UI = (() => {
    let soundEnabled = true;
    let audioContext = null;
    let modalCloseCallback = null;
    let confirmResolve = null;

    /* --- 初期化 --- */
    function init() {
        // 画像モーダル閉じるボタン
        document.getElementById('modal-close').addEventListener('click', hideModal);

        // モーダル背景クリックで閉じる
        document.getElementById('image-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                hideModal();
            }
        });

        // サイドメニューオーバーレイ
        document.getElementById('side-menu-overlay').addEventListener('click', hideMenu);

        // 全画面のサウンドボタン
        document.querySelectorAll('.btn-sound').forEach((btn) => {
            btn.addEventListener('click', toggleSound);
        });

        // 確認モーダルのボタン
        document.getElementById('confirm-cancel').addEventListener('click', () => {
            hideConfirmModal();
            if (confirmResolve) {
                confirmResolve(false);
                confirmResolve = null;
            }
        });

        document.getElementById('confirm-ok').addEventListener('click', () => {
            hideConfirmModal();
            if (confirmResolve) {
                confirmResolve(true);
                confirmResolve = null;
            }
        });

        // アルバムモーダル閉じるボタン
        document.getElementById('album-modal-close').addEventListener('click', hideAlbumModal);

        // アルバムモーダル背景クリックで閉じる
        document.getElementById('album-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                hideAlbumModal();
            }
        });

        updateSoundIcons();
    }

    /* ===================
       画像拡大モーダル
       =================== */
    function showModal(imageSrc, onClose) {
        const modal = document.getElementById('image-modal');
        const img = document.getElementById('modal-image');
        img.src = imageSrc;
        modal.classList.add('active');
        modalCloseCallback = onClose || null;
        playSound('open');
    }

    function hideModal() {
        const modal = document.getElementById('image-modal');
        modal.classList.remove('active');
        document.getElementById('modal-image').src = '';
        playSound('close');

        if (modalCloseCallback) {
            const cb = modalCloseCallback;
            modalCloseCallback = null;
            // 少し遅延を入れてアニメーションを待つ
            setTimeout(cb, 150);
        }
    }

    function isModalOpen() {
        return document.getElementById('image-modal').classList.contains('active');
    }

    /* ===================
       確認ダイアログモーダル
       =================== */
    function showConfirmModal(message, okLabel = 'はい', cancelLabel = 'いいえ') {
        return new Promise((resolve) => {
            confirmResolve = resolve;

            document.getElementById('confirm-message').textContent = message;
            document.getElementById('confirm-ok').textContent = okLabel;
            document.getElementById('confirm-cancel').textContent = cancelLabel;
            document.getElementById('confirm-modal').classList.add('active');
            playSound('open');
        });
    }

    function hideConfirmModal() {
        document.getElementById('confirm-modal').classList.remove('active');
        playSound('close');
    }

    function isConfirmModalOpen() {
        return document.getElementById('confirm-modal').classList.contains('active');
    }

    /* ===================
       アルバム管理モーダル
       =================== */
    function showAlbumModal(title = 'アルバム') {
        document.getElementById('album-modal-title').textContent = title;
        document.getElementById('album-modal').classList.add('active');
        playSound('open');
    }

    function hideAlbumModal() {
        document.getElementById('album-modal').classList.remove('active');
        playSound('close');
    }

    function isAlbumModalOpen() {
        return document.getElementById('album-modal').classList.contains('active');
    }

    function setAlbumModalContent(html) {
        document.getElementById('album-modal-body').innerHTML = html;
    }

    function setAlbumModalTitle(title) {
        document.getElementById('album-modal-title').textContent = title;
    }

    /* ===================
       サイドメニュー
       =================== */
    function showMenu() {
        document.getElementById('side-menu').classList.add('active');
        document.getElementById('side-menu-overlay').classList.add('active');
    }

    function hideMenu() {
        document.getElementById('side-menu').classList.remove('active');
        document.getElementById('side-menu-overlay').classList.remove('active');
    }

    function isMenuOpen() {
        return document.getElementById('side-menu').classList.contains('active');
    }

    /* ===================
       サウンド制御
       =================== */
    function toggleSound() {
        soundEnabled = !soundEnabled;
        updateSoundIcons();
        playSound('click');
    }

    function updateSoundIcons() {
        document.querySelectorAll('.btn-sound').forEach((btn) => {
            const onIcon = btn.querySelector('.icon-sound-on');
            const offIcon = btn.querySelector('.icon-sound-off');
            if (onIcon) onIcon.style.display = soundEnabled ? '' : 'none';
            if (offIcon) offIcon.style.display = soundEnabled ? 'none' : '';
        });
    }

    function isSoundEnabled() {
        return soundEnabled;
    }

    /* --- Web Audio API で効果音を生成 --- */
    function getAudioContext() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioContext;
    }

    function playSound(type) {
        if (!soundEnabled) return;

        try {
            const ctx = getAudioContext();
            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            const now = ctx.currentTime;

            switch (type) {
                case 'click':
                    oscillator.frequency.setValueAtTime(800, now);
                    gainNode.gain.setValueAtTime(0.1, now);
                    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                    oscillator.start(now);
                    oscillator.stop(now + 0.1);
                    break;

                case 'flip':
                    oscillator.frequency.setValueAtTime(500, now);
                    oscillator.frequency.linearRampToValueAtTime(700, now + 0.1);
                    gainNode.gain.setValueAtTime(0.08, now);
                    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                    oscillator.start(now);
                    oscillator.stop(now + 0.15);
                    break;

                case 'match':
                    oscillator.type = 'sine';
                    oscillator.frequency.setValueAtTime(523, now);        // C5
                    oscillator.frequency.setValueAtTime(659, now + 0.1);  // E5
                    oscillator.frequency.setValueAtTime(784, now + 0.2);  // G5
                    gainNode.gain.setValueAtTime(0.12, now);
                    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                    oscillator.start(now);
                    oscillator.stop(now + 0.4);
                    break;

                case 'mismatch':
                    oscillator.type = 'sawtooth';
                    oscillator.frequency.setValueAtTime(300, now);
                    oscillator.frequency.linearRampToValueAtTime(200, now + 0.2);
                    gainNode.gain.setValueAtTime(0.06, now);
                    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                    oscillator.start(now);
                    oscillator.stop(now + 0.3);
                    break;

                case 'complete':
                    // 完了ファンファーレ（複数音）
                    playNote(ctx, 523, 0, 0.15);   // C5
                    playNote(ctx, 659, 0.12, 0.15); // E5
                    playNote(ctx, 784, 0.24, 0.15); // G5
                    playNote(ctx, 1047, 0.36, 0.4); // C6
                    return; // playNote が個別に処理するため return

                case 'open':
                    oscillator.frequency.setValueAtTime(400, now);
                    oscillator.frequency.linearRampToValueAtTime(600, now + 0.08);
                    gainNode.gain.setValueAtTime(0.06, now);
                    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                    oscillator.start(now);
                    oscillator.stop(now + 0.1);
                    break;

                case 'close':
                    oscillator.frequency.setValueAtTime(600, now);
                    oscillator.frequency.linearRampToValueAtTime(400, now + 0.08);
                    gainNode.gain.setValueAtTime(0.06, now);
                    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                    oscillator.start(now);
                    oscillator.stop(now + 0.1);
                    break;
            }
        } catch (e) {
            // AudioContext が使えない環境では無視
        }
    }

    function playNote(ctx, freq, delay, duration) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        const now = ctx.currentTime + delay;
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.start(now);
        osc.stop(now + duration);
    }

    return {
        init,
        // 画像モーダル
        showModal,
        hideModal,
        isModalOpen,
        // 確認モーダル
        showConfirmModal,
        hideConfirmModal,
        isConfirmModalOpen,
        // アルバムモーダル
        showAlbumModal,
        hideAlbumModal,
        isAlbumModalOpen,
        setAlbumModalContent,
        setAlbumModalTitle,
        // サイドメニュー
        showMenu,
        hideMenu,
        isMenuOpen,
        // サウンド
        toggleSound,
        isSoundEnabled,
        playSound,
    };
})();
