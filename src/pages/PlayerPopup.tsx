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
import { db } from "../db/indexedDB"; // IndexedDB 實例
import ReactPlayer from "react-player"; // 使用 react-player
import "./PlayerPopup.scss";

interface PlayerPopupProps {
  visible: boolean;
  files: MediaFile[];
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

  const playerRef = useRef<ReactPlayer>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekTime, setSeekTime] = useState<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const [touchStartX, setTouchStartX] = useState(0);

  const file = files[playingIndex];
  const isVideo =
    file?.type.startsWith("video/") || file?.name.endsWith(".mp4");

  // 載入 Blob URL
  useEffect(() => {
    if (!visible) return;

    let revoked = false;

    async function loadBlobUrl() {
      if (!file?.id) {
        setMediaUrl(null);
        return;
      }
      try {
        const full = await db.mediaFiles.get(file.id);
        if (!full || !full.file) {
          Toast.show("讀取檔案失敗");
          setMediaUrl(null);
          return;
        }
        const url = URL.createObjectURL(full.file);
        if (!revoked) {
          setMediaUrl(url);
        }
      } catch (err) {
        console.error(err);
        Toast.show("讀取檔案失敗");
        setMediaUrl(null);
      }
    }

    loadBlobUrl();

    return () => {
      revoked = true;
      if (mediaUrl) {
        URL.revokeObjectURL(mediaUrl);
        setMediaUrl(null);
      }
    };
  }, [playingIndex, visible]);

  // 每換歌重置
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setSeekTime(null);
  }, [playingIndex]);

  // 同步外部 currentIndex
  useEffect(() => {
    setPlayingIndex(currentIndex);
  }, [currentIndex]);

  // 切換播放 / 暫停
  const togglePlay = () => {
    const player = playerRef.current;
    if (!player) return;
    if (isPlaying) {
      playerRef.current!.getInternalPlayer()?.pause?.();
    } else {
      playerRef.current!.getInternalPlayer()?.play?.();
    }
  };

  const handlePlay = () => {
    setIsPlaying(true);
  };
  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleDuration = (dur: number) => {
    setDuration(dur);
  };

  const handleProgress = (state: { playedSeconds: number; played: number }) => {
    if (!isSeeking) {
      setCurrentTime(state.playedSeconds);
    }
  };

  // 拖動滑桿變更
  const onSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setSeekTime(v);
  };

  const onSeekStart = () => {
    setIsSeeking(true);
  };

  const onSeekEnd = () => {
    if (seekTime !== null && playerRef.current) {
      playerRef.current.seekTo(seekTime, "seconds");
      setCurrentTime(seekTime);
      setSeekTime(null);
    }
    setIsSeeking(false);
  };

  const playPrev = () => {
    if (playingIndex > 0) {
      setPlayingIndex(playingIndex - 1);
    } else {
      Toast.show("已經是第一首");
    }
  };

  const playNext = () => {
    if (playingIndex < files.length - 1) {
      setPlayingIndex(playingIndex + 1);
    } else {
      Toast.show("已經是最後一首");
    }
  };

  // 左右滑動快進 / 倒退 30 秒
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchEndX - touchStartX;
    if (Math.abs(diffX) < 30) {
      return;
    }
    if (!playerRef.current) return;
    const internal = playerRef.current.getInternalPlayer();
    if (!internal) return;

    const cur = currentTime;
    const dur = duration;

    if (diffX > 50) {
      const newTime = Math.min(dur, cur + 30);
      playerRef.current.seekTo(newTime, "seconds");
      Toast.show("快進30秒");
    } else if (diffX < -50) {
      const newTime = Math.max(0, cur - 30);
      playerRef.current.seekTo(newTime, "seconds");
      Toast.show("倒退30秒");
    }
  };

  const onToggleControls = (e: React.MouseEvent | React.TouchEvent) => {
    if ("touches" in e) {
      if ((e as React.TouchEvent).touches.length > 1) return;
    }
    setShowControls((v) => !v);
  };

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
    setShowControls(true);
  };
  const onTouchEndForClicks = () => {
    if (clickTimeoutRef.current) {
      window.clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      handleDoubleClick();
    } else {
      clickTimeoutRef.current = window.setTimeout(() => {
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

      <div
        className="player-popup__media-container"
        onTouchStart={onTouchStart}
        onTouchEnd={(e) => {
          onTouchEnd(e);
        }}
        onClick={(e) => {
          onTouchEndForClicks();
        }}
      >
        {mediaUrl && (
          <ReactPlayer
            url={mediaUrl}
            playing={true}
            controls={false} // ✅ 不要內建控制器
            playsinline={true} // ✅ 禁止自動全螢幕（iOS 專用）
            width="100%"
            height="100%"
            style={{ backgroundColor: "black" }}
            onPlay={handlePlay}
            onPause={handlePause}
            onProgress={handleProgress}
            onDuration={handleDuration}
            ref={playerRef}
          />
        )}
      </div>

      {/* Footer */}
      <div className={`player-popup__footer ${showControls ? "visible" : ""}`}>
        <div className="player-popup__progress-wrapper">
          <span className="player-popup__time">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={seekTime !== null ? seekTime : currentTime}
            onChange={onSeekChange}
            onMouseDown={onSeekStart}
            onTouchStart={onSeekStart}
            onMouseUp={onSeekEnd}
            onTouchEnd={onSeekEnd}
            onPointerUp={onSeekEnd}
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
