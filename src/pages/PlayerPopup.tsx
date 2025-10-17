import React, { useEffect, useState, useRef } from "react";
import { Popup, Toast } from "antd-mobile";
import {
  FaPlay,
  FaPause,
  FaStepBackward,
  FaStepForward,
  FaArrowLeft,
} from "react-icons/fa";
import type { MediaFile } from "../db/indexedDB"; // 請自行調整型別路徑
import { db } from "../db/indexedDB"; // 新增：import IndexedDB instance
import "./PlayerPopup.scss";

interface PlayerPopupProps {
  visible: boolean;
  files: MediaFile[]; // 只有 metadata，沒有帶 file Blob
  currentIndex: number;
  onClose: () => void;
}

export default function PlayerPopup({
  visible,
  files,
  currentIndex,
  onClose,
}: PlayerPopupProps) {
  const [playingIndex, setPlayingIndex] = useState(currentIndex);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [touchStartX, setTouchStartX] = useState(0);

  // 拖動時暫存時間
  const [seekTime, setSeekTime] = useState<number | null>(null);

  // 判斷是不是影片
  const file = files[playingIndex];
  const isVideo =
    file?.type.startsWith("video/") || file?.name.endsWith(".mp4");

  // --- 修改處 1: 改為從 IndexedDB 載入 Blob ---
  useEffect(() => {
    if (!visible) return;

    async function loadBlobUrl() {
      if (!file?.id) {
        setMediaUrl(null);
        return;
      }

      try {
        const fullFile = await db.mediaFiles.get(file.id);
        if (!fullFile || !fullFile.file) {
          Toast.show("讀取檔案失敗");
          setMediaUrl(null);
          return;
        }
        const url = URL.createObjectURL(fullFile.file);
        setMediaUrl(url);
      } catch (error) {
        Toast.show("讀取檔案失敗");
        setMediaUrl(null);
        console.error(error);
      }
    }

    loadBlobUrl();

    return () => {
      if (mediaUrl) {
        URL.revokeObjectURL(mediaUrl);
        setMediaUrl(null);
      }
    };
  }, [playingIndex, visible]);

  // 每換歌重置狀態
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setSeekTime(null);
  }, [playingIndex]);

  // 同步外部 currentIndex 與內部 playingIndex
  useEffect(() => {
    setPlayingIndex(currentIndex);
  }, [currentIndex]);

  // 取得當前媒體元素 (video 或 audio)
  const mediaElement = isVideo ? videoRef.current : audioRef.current;

  // 播放/暫停切換
  const togglePlay = () => {
    const element = mediaElement;

    if (!element) {
      console.error("Media element is null!");
      Toast.show("Media element is null!");
      return;
    }

    if (element.paused) {
      console.log("Attempting to play...");
      // ⚠️ 關鍵：捕獲 Promise 失敗
      element.play().catch((error) => {
        console.error("Play failed (iOS restriction likely):", error); // 這裡可以顯示一個 Toast 或其他提示給使用者
        Toast.show("無法播放，請確認靜音或權限");
      });
    } else {
      console.log("Attempting to pause...");
      element.pause();
    }
  };

  const onPlay = () => setIsPlaying(true);
  const onPause = () => setIsPlaying(false);

  const onLoadedMetadata = () => {
    if (!mediaElement) return;
    setDuration(mediaElement.duration);
  };

  // 拖動滑桿改變 seekTime
  const onSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setSeekTime(val);
  };

  // 拖動結束（滑鼠放開、觸控結束或 pointer 結束）時設定影片 currentTime
  const onSeekEnd = () => {
    if (!mediaElement) return;
    if (seekTime !== null) {
      mediaElement.currentTime = seekTime;
      setCurrentTime(seekTime);
      setSeekTime(null);
    }
  };

  // 播放時間更新事件，非拖動狀態才更新 currentTime
  const onTimeUpdate = () => {
    if (!mediaElement) return;
    if (seekTime === null) {
      setCurrentTime(mediaElement.currentTime);
    }
  };

  const playPrev = () => {
    if (playingIndex > 0) setPlayingIndex(playingIndex - 1);
    else Toast.show("已經是第一首");
  };

  const playNext = () => {
    if (playingIndex < files.length - 1) setPlayingIndex(playingIndex + 1);
    else Toast.show("已經是最後一首");
  };

  // 左右滑動快進/倒退 30 秒
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!mediaElement) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchEndX - touchStartX;
    if (Math.abs(diffX) < 30) {
      // 小於閾值，視為點擊，不觸發快進倒退
      return;
    }

    if (diffX > 50) {
      mediaElement.currentTime = Math.min(
        mediaElement.duration,
        mediaElement.currentTime + 30
      );
      Toast.show("快進30秒");
    } else if (diffX < -50) {
      mediaElement.currentTime = Math.max(0, mediaElement.currentTime - 30);
      Toast.show("倒退30秒");
    }
  };

  // 點擊切換控制列顯示/隱藏（避免左右滑動誤觸）
  const onToggleControls = (e: React.MouseEvent | React.TouchEvent) => {
    // 判斷是否是滑動手勢（可以用手指移動距離或事件類型判斷）
    // 這裡簡單判斷滑動小於閾值時才切換顯示
    if ("touches" in e) {
      // 觸控事件不做特別處理，因為滑動事件會被 onTouchEnd 過濾
      if ((e as React.TouchEvent).touches.length > 1) return; // 多指觸控不切換
    }
    setShowControls((v) => !v);
  };

  // 格式化時間 mm:ss
  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    const m = Math.floor(time / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(time % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  };

  const clickTimeoutRef = useRef<number | null>(null);

  const handleSingleClick = () => {
    setShowControls((v) => !v);
  };

  const handleDoubleClick = () => {
    togglePlay();
    // 雙擊一定顯示控制列
    setShowControls(true);
  };

  const onTouchEndForClicks = (e: React.TouchEvent) => {
    if (clickTimeoutRef.current) {
      // 第二次點擊，判定雙擊
      window.clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      handleDoubleClick();
    } else {
      // 第一次點擊，先等250ms確認是不是雙擊
      clickTimeoutRef.current = window.setTimeout(() => {
        // 確認沒有第二次點擊就執行單擊
        handleSingleClick();
        clickTimeoutRef.current = null;
      }, 250);
    }
  };

  return (
    <Popup
      visible={visible}
      onMaskClick={onClose}
      bodyStyle={{ padding: 0, height: "100vh", backgroundColor: "black" }}
      position="bottom"
      destroyOnClose
    >
      {/* Header */}
      <div className={`player-popup__header ${showControls ? "visible" : ""}`}>
        <FaArrowLeft
          size={20}
          onClick={onClose}
          className="player-popup__icon"
        />
        <div className="player-popup__title">{file?.name ?? ""}</div>
        <div className="player-popup__spacer" />
      </div>

      {/* 媒體區域 */}
      <div
        className="player-popup__media-container"
        onTouchStart={onTouchStart}
        onTouchEnd={(e) => {
          onTouchEnd(e);
          onTouchEndForClicks(e);
        }}
      >
        {isVideo ? (
          <video
            ref={videoRef}
            src={mediaUrl || undefined}
            className="player-popup__media"
            onPlay={onPlay}
            onPause={onPause}
            onLoadedMetadata={onLoadedMetadata}
            onTimeUpdate={onTimeUpdate}
            // autoPlay
            muted
            playsInline
            // controls={false}
            webkit-playsinline="" // ✅ 必須這樣寫
          />
        ) : (
          <audio
            ref={audioRef}
            src={mediaUrl || undefined}
            onPlay={onPlay}
            onPause={onPause}
            onLoadedMetadata={onLoadedMetadata}
            onTimeUpdate={onTimeUpdate}
            autoPlay
            controls={false}
          />
        )}
      </div>

      {/* Footer */}
      <div className={`player-popup__footer ${showControls ? "visible" : ""}`}>
        {/* 進度條 */}
        <div className="player-popup__progress-wrapper">
          <span className="player-popup__time">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={seekTime !== null ? seekTime : currentTime}
            onChange={onSeekChange}
            onMouseUp={onSeekEnd}
            onTouchEnd={onSeekEnd}
            onPointerUp={onSeekEnd} // 加這行，確保拖動結束事件被捕捉
            className="player-popup__progress"
            style={
              {
                "--progress":
                  (seekTime !== null ? seekTime : currentTime) / duration || 0,
              } as React.CSSProperties
            }
          />
          <span className="player-popup__time">{formatTime(duration)}</span>
        </div>

        {/* 控制按鈕 */}
        <div className="player-popup__controls">
          <FaStepBackward
            size={28}
            onClick={playPrev}
            className={`player-popup__icon ${
              playingIndex === 0 ? "player-popup__icon--disabled" : ""
            }`}
          />
          {isPlaying ? (
            <FaPause
              size={36}
              onClick={togglePlay}
              className="player-popup__icon player-popup__icon--playpause"
            />
          ) : (
            <FaPlay
              size={36}
              onClick={togglePlay}
              className="player-popup__icon player-popup__icon--playpause"
            />
          )}
          <FaStepForward
            size={28}
            onClick={playNext}
            className={`player-popup__icon ${
              playingIndex === files.length - 1
                ? "player-popup__icon--disabled"
                : ""
            }`}
          />
        </div>
      </div>
    </Popup>
  );
}
