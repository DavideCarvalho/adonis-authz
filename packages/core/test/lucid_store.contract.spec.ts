import { LucidPermissionStore } from '../src/stores/lucid.js';
import { runPermissionStoreContract } from '../src/testing.js';
import { asLucidDatabase, makeMemoryDatabase } from './lucid_helpers.js';

// Each contract test gets a fresh in-memory sqlite db with auto-created schema.
runPermissionStoreContract(
  'LucidPermissionStore',
  () => new LucidPermissionStore(asLucidDatabase(makeMemoryDatabase())),
);
