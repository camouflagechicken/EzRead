const DB_NAME = 'EzReadDB';
const DB_VERSION = 3;
const STORE_NAME = 'personalVault';
const PROGRESS_STORE = 'progressVault';
const SETTINGS_STORE = 'settingsVault';

export interface SavedBook {
  id: string;
  title: string;
  fileType: string;
  coverUrl: string;
  timestamp: number;
}

export interface SavedBookData extends SavedBook {
  fileData: string; // Base64 for PDF, raw text for TXT
}

export interface BookProgress {
  bookId: string;
  currentIndex: number;
  totalItems: number;
  timestamp: number;
}

export interface UserSettings {
  id: string; // 'master'
  fontSize: number;
  containerWidth: number;
  isFocusMode: boolean;
  volume: number;
  rate: number;
  pitch: number;
  selectedVoiceURI: string;
}

export const StorageService = {
  initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(PROGRESS_STORE)) {
          db.createObjectStore(PROGRESS_STORE, { keyPath: 'bookId' });
        }
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: 'id' });
        }
      };
    });
  },

  async saveBook(id: string, title: string, fileData: string, fileType: string, coverUrl: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const book: SavedBookData = {
        id,
        title,
        fileData,
        fileType,
        coverUrl,
        timestamp: Date.now()
      };

      const request = store.put(book);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async getAllBooks(): Promise<SavedBook[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        // Strip heavy fileData for the UI
        const books = request.result.map((book: SavedBookData) => ({
          id: book.id,
          title: book.title,
          fileType: book.fileType,
          coverUrl: book.coverUrl,
          timestamp: book.timestamp
        }));
        // Sort by newest first
        books.sort((a, b) => b.timestamp - a.timestamp);
        resolve(books);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async getBookData(id: string): Promise<SavedBookData | null> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  async deleteBook(id: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME, PROGRESS_STORE], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const progressStore = transaction.objectStore(PROGRESS_STORE);
      
      store.delete(id);
      progressStore.delete(id);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },

  async saveProgress(bookId: string, currentIndex: number, totalItems: number): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PROGRESS_STORE, 'readwrite');
      const store = transaction.objectStore(PROGRESS_STORE);
      
      const progress: BookProgress = {
        bookId,
        currentIndex,
        totalItems,
        timestamp: Date.now()
      };

      const request = store.put(progress);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async getProgress(bookId: string): Promise<BookProgress | null> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PROGRESS_STORE, 'readonly');
      const store = transaction.objectStore(PROGRESS_STORE);
      const request = store.get(bookId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  async getAllProgress(): Promise<Record<string, BookProgress>> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PROGRESS_STORE, 'readonly');
      const store = transaction.objectStore(PROGRESS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const progressMap: Record<string, BookProgress> = {};
        request.result.forEach((p: BookProgress) => {
          progressMap[p.bookId] = p;
        });
        resolve(progressMap);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async saveSettings(settingsData: Omit<UserSettings, 'id'>): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SETTINGS_STORE, 'readwrite');
      const store = transaction.objectStore(SETTINGS_STORE);
      
      const settings: UserSettings = {
        id: 'master',
        ...settingsData
      };

      const request = store.put(settings);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async getSettings(): Promise<UserSettings | null> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SETTINGS_STORE, 'readonly');
      const store = transaction.objectStore(SETTINGS_STORE);
      const request = store.get('master');

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }
};
