import Dexie, { type Table } from "dexie";

export interface MediaFile {
  id?: number;
  name: string;
  type: string;
  file?: File; // file 可選，首頁不用讀取
  createdAt?: number;
  updatedAt?: number;
}

class MyDB extends Dexie {
  mediaFiles!: Table<MediaFile, number>;

  constructor() {
    super("mediaPlayerDB");

    this.version(1).stores({
      mediaFiles: "++id,name,type,createdAt",
    });
  }
}

export const db = new MyDB();
