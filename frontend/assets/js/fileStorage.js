/**
 * GopherDrop - File Storage (IndexedDB)
 * Menyimpan file yang dipilih agar tidak hilang saat refresh halaman
 */

const DB_NAME = 'GopherDropFiles';
const DB_VERSION = 1;
const STORE_NAME = 'selectedFiles';

let db = null;

/**
 * Initialize IndexedDB
 */
function initFileDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }
        
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

/**
 * Save files to IndexedDB
 * @param {File[]} files - Array of File objects
 */
async function saveFilesToDB(files) {
    try {
        // 1. Prepare Buffer (OUTSIDE Transaction)
        // IndexedDB transaction auto-commits if you await async tasks inside it!
        const fileRecords = await Promise.all(files.map(async (file) => {
            const arrayBuffer = await file.arrayBuffer();
            return {
                name: file.name,
                type: file.type,
                size: file.size,
                lastModified: file.lastModified,
                data: arrayBuffer
            };
        }));

        const database = await initFileDB();
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        // Clear existing files first
        store.clear();
        
        // Save each file (Synchronous add inside transaction)
        for (const record of fileRecords) {
            store.add(record);
        }
        
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
        });
    } catch (error) {
        return false;
    }
}

/**
 * Load files from IndexedDB
 * @returns {Promise<File[]>} Array of File objects
 */
async function loadFilesFromDB() {
    try {
        const database = await initFileDB();
        const transaction = database.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                const records = request.result;
                const files = records.map(record => {
                    return new File([record.data], record.name, {
                        type: record.type,
                        lastModified: record.lastModified
                    });
                });
                resolve(files);
            };
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        return [];
    }
}

/**
 * Clear all files from IndexedDB
 */
async function clearFilesFromDB() {
    try {
        const database = await initFileDB();
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.clear();
        
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
        });
    } catch (error) {
        return false;
    }
}

/**
 * Check if there are saved files
 * @returns {Promise<boolean>}
 */
async function hasSavedFiles() {
    try {
        const database = await initFileDB();
        const transaction = database.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.count();
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result > 0);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        return false;
    }
}

// Expose globally
window.saveFilesToDB = saveFilesToDB;
window.loadFilesFromDB = loadFilesFromDB;
window.clearFilesFromDB = clearFilesFromDB;
window.hasSavedFiles = hasSavedFiles;
