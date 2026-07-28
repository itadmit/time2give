import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'saved_offers_v1';

type Ctx = { saved: string[]; isSaved: (id: string) => boolean; toggle: (id: string) => void };
const FavoritesContext = createContext<Ctx>({ saved: [], isSaved: () => false, toggle: () => {} });
export const useFavorites = () => useContext(FavoritesContext);

/** שמירת תרומות מקומית (AsyncStorage) — לב על כרטיס + מסך "שמורים". */
export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [saved, setSaved] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v) try { setSaved(JSON.parse(v)); } catch {}
    });
  }, []);

  const persist = (next: string[]) => {
    setSaved(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next));
  };
  const toggle = (id: string) => persist(saved.includes(id) ? saved.filter((x) => x !== id) : [id, ...saved]);
  const isSaved = (id: string) => saved.includes(id);

  return <FavoritesContext.Provider value={{ saved, isSaved, toggle }}>{children}</FavoritesContext.Provider>;
}
