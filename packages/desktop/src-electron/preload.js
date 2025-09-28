import { setupDialogsInPreloader } from './dialogs/electronDialog.js';
import { setupFSInPreloader} from './electronFs.js';
import { setupFileSystemAPI } from './fileSystemAPI.js';
import { setupChatGptImportPreload } from './parser/chatgptImportPreload.js';

// So our app can use the file system
setupFSInPreloader();

// So our app can use the native dialogs
setupDialogsInPreloader();

// So our app can use the file protocol
setupFileSystemAPI();

// Expose ChatGPT import API
setupChatGptImportPreload();