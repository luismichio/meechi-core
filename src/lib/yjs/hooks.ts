'use client';

import { useState, useEffect } from 'react';
import { useYjs } from './YjsProvider';
import * as Y from 'yjs';

export function useYDoc() {
  const { doc, synced } = useYjs();
  return { doc, synced };
}

export function useYMap<T>(name: string): [Y.Map<T>, T] {
  const { doc } = useYjs();
  const map = doc.getMap<T>(name);
  const [toJSON, setToJSON] = useState<T>(map.toJSON() as any);

  useEffect(() => {
    const onChange = () => {
      setToJSON(map.toJSON() as any);
    };

    map.observe(onChange);
    
    return () => {
      map.unobserve(onChange);
    };
  }, [map]);

  return [map, toJSON];
}

export function useYArray<T>(name: string): [Y.Array<T>, T[]] {
    const { doc } = useYjs();
    const array = doc.getArray<T>(name);
    const [toJSON, setToJSON] = useState<T[]>(array.toArray());
  
    useEffect(() => {
      const onChange = () => {
        setToJSON(array.toArray());
      };
  
      array.observe(onChange);
      
      return () => {
        array.unobserve(onChange);
      };
    }, [array]);
  
    return [array, toJSON];
}
