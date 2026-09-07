/* eslint-disable */

jest.mock('react-native-mmkv', () => {
  const store = new Map();
  return {
    MMKV: class {
      set(k, v) { store.set(k, v); }
      getString(k) { return store.get(k); }
      getBoolean(k) { return store.get(k); }
      getNumber(k) { return store.get(k); }
      delete(k) { store.delete(k); }
      clearAll() { store.clear(); }
      addOnValueChangedListener() { return { remove() {} }; }
    },
  };
});

jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    setItemAsync: async (k, v) => { store.set(k, v); },
    getItemAsync: async (k) => store.get(k) ?? null,
    deleteItemAsync: async (k) => { store.delete(k); },
    isAvailableAsync: async () => true,
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'whenUnlockedThisDeviceOnly',
  };
});

jest.mock('@modules/content-protection', () => require('@modules/content-protection/src/index.web.ts'));
