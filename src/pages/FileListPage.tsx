import React, { useEffect, useState, useRef } from "react";
import { List, NavBar, Toast, Dialog, Badge } from "antd-mobile";
import { CloseOutline, UploadOutline } from "antd-mobile-icons";
import { db, type MediaFile } from "../db/indexedDB";
import PlayerPopup from "./PlayerPopup";
import { FaPlay, FaTrash } from "react-icons/fa";
import "./FileListPage.scss";

const LONG_PRESS_MS = 500;

export function FileListPage() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [popupVisible, setPopupVisible] = useState(false);
  const [playingIndex, setPlayingIndex] = useState(0);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const pressTimer = useRef<number | null>(null);

  useEffect(() => {
    fetchFiles();
  }, []);

  async function fetchFiles() {
    const allFiles = await db.mediaFiles.toArray();
    setFiles(allFiles);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    try {
      await db.mediaFiles.add({
        name: file.name,
        type: file.type,
        file: file,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      Toast.show("檔案已上傳");
      fetchFiles();
    } catch (error) {
      Toast.show("上傳失敗");
      console.error(error);
    }
  }

  function openPlayer(index: number) {
    setPlayingIndex(index);
    setPopupVisible(true);
  }

  function closePlayer() {
    setPopupVisible(false);
  }

  function startPressTimer(id?: number) {
    if (!id) return;
    pressTimer.current = window.setTimeout(() => {
      setSelectMode(true);
      setSelectedIds((prev) => new Set(prev).add(id));
    }, LONG_PRESS_MS);
  }

  function clearPressTimer() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function onFileClick(file: MediaFile, index: number) {
    if (selectMode) {
      if (!file.id) return;
      const newSelected = new Set(selectedIds);
      if (newSelected.has(file.id)) newSelected.delete(file.id);
      else newSelected.add(file.id);
      setSelectedIds(newSelected);
    } else {
      openPlayer(index);
    }
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  const allIds = files.map((f) => f.id!).filter(Boolean) as number[];
  const isAllSelected =
    allIds.length > 0 && allIds.every((id) => selectedIds.has(id));

  function toggleSelectAll() {
    if (isAllSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(allIds));
  }

  async function handleDelete() {
    if (selectedIds.size === 0) {
      Toast.show("請先選取要刪除的檔案");
      return;
    }
    const count = selectedIds.size;
    const result = await Dialog.confirm({
      content: `確定刪除選取的 ${count} 個檔案嗎？刪除後無法復原。`,
      confirmText: "刪除",
      cancelText: "取消",
    });
    if (!result) return;

    try {
      await db.mediaFiles.bulkDelete(Array.from(selectedIds));
      Toast.show("刪除完成");
      await fetchFiles();
      exitSelectMode();
    } catch (error) {
      console.error(error);
      Toast.show("刪除失敗");
    }
  }

  return (
    <div className="file-list-page">
      <NavBar
        backArrow={selectMode ? <CloseOutline fontSize={20} /> : false}
        onBack={selectMode ? exitSelectMode : undefined}
        right={
          selectMode ? (
            <span
              role="button"
              onClick={toggleSelectAll}
              className="nav-right-button"
            >
              {isAllSelected ? "取消全選" : "全選"}
            </span>
          ) : (
            <>
              <label htmlFor="file-upload">
                <UploadOutline style={{ fontSize: 24, cursor: "pointer" }} />
              </label>
              <input
                id="file-upload"
                type="file"
                accept="audio/*,video/*"
                style={{ display: "none" }}
                onChange={handleUpload}
              />
            </>
          )
        }
      >
        {selectMode ? `已選 ${selectedIds.size}` : "檔案列表"}
      </NavBar>

      <List>
        {files.map((file, index) => {
          const checked = file.id ? selectedIds.has(file.id) : false;

          return (
            <List.Item
              key={file.id}
              prefix={<FaPlay />}
              extra={
                selectMode ? (
                  <Badge
                    content={checked ? "✓" : undefined}
                    className={`select-badge ${
                      checked ? "checked" : "unchecked"
                    }`}
                  />
                ) : null
              }
              className={`list-item ${checked ? "selected" : ""}`}
            >
              <div
                onClick={() => onFileClick(file, index)}
                onMouseDown={() => startPressTimer(file.id)}
                onMouseUp={clearPressTimer}
                onMouseLeave={clearPressTimer}
                onTouchStart={() => startPressTimer(file.id)}
                onTouchEnd={clearPressTimer}
              >
                {file.name}
              </div>
            </List.Item>
          );
        })}
      </List>

      {selectMode && (
        <div className="bottom-action-bar">
          <button className="delete-btn" onClick={handleDelete} type="button">
            <FaTrash />
            <span>刪除</span>
          </button>
        </div>
      )}

      {files.length > 0 && (
        <PlayerPopup
          visible={popupVisible}
          files={files}
          currentIndex={playingIndex}
          onClose={closePlayer}
        />
      )}
    </div>
  );
}
