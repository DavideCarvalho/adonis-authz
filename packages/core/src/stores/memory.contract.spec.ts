import { runPermissionStoreContract } from '../testing.js';
import { MemoryPermissionStore } from './memory.js';

runPermissionStoreContract('MemoryPermissionStore', () => new MemoryPermissionStore());
